import { X509Certificate } from 'node:crypto';
import { Environment, SignedDataVerifier } from '@apple/app-store-server-library';

/**
 * Apple Root CA - G3 (DER, base64), from
 * https://www.apple.com/certificateauthority/AppleRootCA-G3.cer.
 * Every StoreKit 2 transaction and App Store Server Notification v2 JWS chains to it.
 */
export const APPLE_ROOT_CA_G3_BASE64 =
  'MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==';

export const APPLE_ROOT_CA_G3_SHA256 =
  '63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79';

/** Throws unless `der` parses as an X.509 certificate with the given SHA-256 fingerprint. */
export function assertRootFingerprint(der: Buffer, expected: string): Buffer {
  const actual = new X509Certificate(der).fingerprint256;
  if (actual.toUpperCase() !== expected.toUpperCase()) {
    throw new Error(`[apple-iap] pinned root fingerprint mismatch: expected ${expected}, got ${actual}`);
  }
  return der;
}

// Checked at load: a tampered constant must fail loudly, never verify against an unknown root.
const APPLE_ROOT_CA_G3 = assertRootFingerprint(Buffer.from(APPLE_ROOT_CA_G3_BASE64, 'base64'), APPLE_ROOT_CA_G3_SHA256);

export type AppleIapEnvironment = 'Production' | 'Sandbox';

export interface AppleTransaction {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  bundleId: string;
  environment: AppleIapEnvironment;
  /** Epoch milliseconds. */
  purchaseDate: number;
  /** Epoch milliseconds; present when Apple refunded or revoked the purchase. */
  revocationDate?: number;
}

export interface AppleNotification {
  notificationType: string;
  subtype?: string;
  /** The verified data.signedTransactionInfo, when the notification carries one. */
  transaction?: AppleTransaction;
}

export interface AppleVerifier {
  verifyTransaction(jws: string): Promise<AppleTransaction>;
  verifyNotification(signedPayload: string): Promise<AppleNotification>;
}

export interface AppleIapConfig {
  bundleId: string;
  environment: AppleIapEnvironment;
  appAppleId?: number;
}

/** Reads APPLE_IAP_* env vars; null when the verifier is not configured. */
export function readAppleIapConfig(env: Record<string, string | undefined> = process.env): AppleIapConfig | null {
  const bundleId = env.APPLE_IAP_BUNDLE_ID?.trim();
  const environment = env.APPLE_IAP_ENVIRONMENT?.trim();
  if (!bundleId || (environment !== 'Production' && environment !== 'Sandbox')) return null;
  const rawAppId = env.APPLE_IAP_APP_APPLE_ID?.trim();
  let appAppleId: number | undefined;
  if (rawAppId) {
    if (!/^\d+$/.test(rawAppId)) return null;
    appAppleId = Number(rawAppId);
  }
  if (environment === 'Production' && appAppleId === undefined) return null;
  return { bundleId, environment, appAppleId };
}

/** Thrown for a JWS that decodes but lacks a field the caller relies on. */
export class AppleIapPayloadError extends Error {}

function requireString(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.length === 0) throw new AppleIapPayloadError(`[apple-iap] transaction missing ${field}`);
  return v;
}

export interface CreateAppleVerifierOptions extends AppleIapConfig {
  /** Trusted DER roots. Defaults to the pinned Apple Root CA - G3; tests pass their own. */
  rootCertificates?: Buffer[];
  /** Defaults to true in Production (OCSP + current-date checks), false in Sandbox. */
  enableOnlineChecks?: boolean;
}

export function createAppleVerifier(opts: CreateAppleVerifierOptions): AppleVerifier {
  const environment = opts.environment === 'Production' ? Environment.PRODUCTION : Environment.SANDBOX;
  const inner = new SignedDataVerifier(
    opts.rootCertificates ?? [APPLE_ROOT_CA_G3],
    opts.enableOnlineChecks ?? opts.environment === 'Production',
    environment,
    opts.bundleId,
    opts.appAppleId,
  );

  // The library already rejects a bad signature/chain, a different bundleId and a different
  // environment; the checks below only narrow the optional fields of its decoded type.
  async function verifyTransaction(jws: string): Promise<AppleTransaction> {
    const t = await inner.verifyAndDecodeTransaction(jws);
    if (typeof t.purchaseDate !== 'number') throw new AppleIapPayloadError('[apple-iap] transaction missing purchaseDate');
    return {
      transactionId: requireString(t.transactionId, 'transactionId'),
      originalTransactionId: requireString(t.originalTransactionId, 'originalTransactionId'),
      productId: requireString(t.productId, 'productId'),
      bundleId: requireString(t.bundleId, 'bundleId'),
      environment: opts.environment,
      purchaseDate: t.purchaseDate,
      ...(typeof t.revocationDate === 'number' ? { revocationDate: t.revocationDate } : {}),
    };
  }

  async function verifyNotification(signedPayload: string): Promise<AppleNotification> {
    const n = await inner.verifyAndDecodeNotification(signedPayload);
    const signedTx = n.data?.signedTransactionInfo;
    return {
      notificationType: requireString(n.notificationType, 'notificationType'),
      ...(n.subtype ? { subtype: n.subtype } : {}),
      ...(signedTx ? { transaction: await verifyTransaction(signedTx) } : {}),
    };
  }

  return { verifyTransaction, verifyNotification };
}

let _verifier: AppleVerifier | null | undefined;

/** Lazily built from env; null (unavailable) unless APPLE_IAP_* is configured. Never logs JWS contents. */
export function getAppleVerifier(): AppleVerifier | null {
  if (_verifier === undefined) {
    const config = readAppleIapConfig();
    _verifier = config ? createAppleVerifier(config) : null;
  }
  return _verifier;
}

/** Overrides the cached verifier; pass undefined to re-read env on the next getAppleVerifier(). */
export function setAppleVerifierForTests(v: AppleVerifier | null | undefined): void {
  _verifier = v;
}
