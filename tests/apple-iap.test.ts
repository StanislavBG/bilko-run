import { createPrivateKey, sign, X509Certificate } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APPLE_ROOT_CA_G3_BASE64,
  APPLE_ROOT_CA_G3_SHA256,
  assertRootFingerprint,
  createAppleVerifier,
  getAppleVerifier,
  readAppleIapConfig,
  setAppleVerifierForTests,
  type AppleVerifier,
} from '../server/services/apple-iap.js';

// Throwaway self-signed chain (root -> intermediate -> leaf) carrying Apple's marker OIDs
// (1.2.840.113635.100.6.2.1 on the intermediate, .6.11.1 on the leaf). It is NOT Apple's;
// the leaf key below exists only to forge JWS for these tests.
const FORGED_ROOT = 'MIIBajCCAQ+gAwIBAgIBATAKBggqhkjOPQQDAjAbMRkwFwYDVQQDDBBGb3JnZWQgVGVzdCBSb290MCAXDTI2MTExNTA1MjczMFoYDzIxMjYxMDIyMDUyNzMwWjAbMRkwFwYDVQQDDBBGb3JnZWQgVGVzdCBSb290MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEuWtu0gbDBUdopBjoxXGEWeWCFPUQoemp2iPzOkVHyjDbRzXETtnqzuMMAYw8tTs699FZ9QBKN4R2N+IuERNgOqNCMEAwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYwHQYDVR0OBBYEFCPQ2YwavbQAWUKaKhLkX5BDwZetMAoGCCqGSM49BAMCA0kAMEYCIQDIQHnkJOsR+KT9MX/aVeL1mw+XIYuILDBUanLNDowbKAIhANKmG90fYuaadZN6SvtxiDSrGYxuLxBUJqxJa97oj44J';
const FORGED_INTERMEDIATE = 'MIIBqDCCAU2gAwIBAgIBAjAKBggqhkjOPQQDAjAbMRkwFwYDVQQDDBBGb3JnZWQgVGVzdCBSb290MCAXDTI2MTExNTA1MjczMFoYDzIxMjYxMDIyMDUyNzMwWjAjMSEwHwYDVQQDDBhGb3JnZWQgVGVzdCBJbnRlcm1lZGlhdGUwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAQCL0lLESzVTIKVtrYcYy+4PPMCtfbaWM3R2Q2BboCTcnexiN0Xsg8CnQiNgPowfiSJYE5ugobVYTKk5fmZcdIto3gwdjASBgNVHRMBAf8ECDAGAQH/AgEAMA4GA1UdDwEB/wQEAwIBBjAQBgoqhkiG92NkBgIBBAIFADAdBgNVHQ4EFgQUVrCJtj5kGN4dY8OF+PO5DCMHXAswHwYDVR0jBBgwFoAUI9DZjBq9tABZQpoqEuRfkEPBl60wCgYIKoZIzj0EAwIDSQAwRgIhAIRC4dGFRJZnLe0i5JTeRPxPrLMUIDXjlvWUylA8qoBBAiEA8FJnzDmNpIRDQrzo7mCiPer+mcC9jk8JhvpRa5rrKL4=';
const FORGED_LEAF = 'MIIBojCCAUegAwIBAgIBAzAKBggqhkjOPQQDAjAjMSEwHwYDVQQDDBhGb3JnZWQgVGVzdCBJbnRlcm1lZGlhdGUwIBcNMjYxMTE1MDUyNzMwWhgPMjEyNjEwMjIwNTI3MzBaMBsxGTAXBgNVBAMMEEZvcmdlZCBUZXN0IExlYWYwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASvXttMGUCDoUioOZFBrvlln9YiuCMmv8m6yPdbmIo0wEhp5Qy7dJARCClk+z16QbKavSOxqZZA6EYOJezR3FS5o3IwcDAMBgNVHRMBAf8EAjAAMA4GA1UdDwEB/wQEAwIHgDAQBgoqhkiG92NkBgsBBAIFADAdBgNVHQ4EFgQUniff/oml0PLpTLT6zxPjgED2ceswHwYDVR0jBBgwFoAUVrCJtj5kGN4dY8OF+PO5DCMHXAswCgYIKoZIzj0EAwIDSQAwRgIhAIApp4lh4F3EoHIt7ov9WTpZBs9UXZsR+3W8pwpssPKRAiEAy5V1z5VML7AZYvoUDhJa10JqVGCPGF6teWkWQC+A9Yk=';
const FORGED_LEAF_KEY = '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQggXf+lb2f38OpuHex\nGVTo7PQi2W22j9aM5Y2Ht2dsAj6hRANCAASvXttMGUCDoUioOZFBrvlln9YiuCMm\nv8m6yPdbmIo0wEhp5Qy7dJARCClk+z16QbKavSOxqZZA6EYOJezR3FS5\n-----END PRIVATE KEY-----\n';

const BUNDLE = 'run.bilko.threewinds';
const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');

function forgeJws(payload: Record<string, unknown>): string {
  const header = { alg: 'ES256', x5c: [FORGED_LEAF, FORGED_INTERMEDIATE, FORGED_ROOT] };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = sign('sha256', Buffer.from(input), { key: createPrivateKey(FORGED_LEAF_KEY), dsaEncoding: 'ieee-p1363' });
  return `${input}.${b64url(sig)}`;
}

function txPayload(over: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    transactionId: '2000000123',
    originalTransactionId: '2000000100',
    productId: 'taels.500',
    bundleId: BUNDLE,
    environment: 'Sandbox',
    purchaseDate: now - 1000,
    signedDate: now,
    type: 'Consumable',
    inAppOwnershipType: 'PURCHASED',
    ...over,
  };
}

function notificationPayload(signedTransactionInfo: string, dataOver: Record<string, unknown> = {}) {
  return {
    notificationType: 'REFUND',
    notificationUUID: '6a1f0d3e-1111-4c1b-9a77-000000000001',
    version: '2.0',
    signedDate: Date.now(),
    data: { bundleId: BUNDLE, environment: 'Sandbox', signedTransactionInfo, ...dataOver },
  };
}

/** Verifier that trusts the forged root, so chain checks pass and bundle/env/signature checks are isolated. */
const trustingForged = (over: Partial<Parameters<typeof createAppleVerifier>[0]> = {}) =>
  createAppleVerifier({
    bundleId: BUNDLE,
    environment: 'Sandbox',
    rootCertificates: [Buffer.from(FORGED_ROOT, 'base64')],
    ...over,
  });

afterEach(() => {
  vi.unstubAllEnvs();
  setAppleVerifierForTests(undefined);
});

describe('env gating', () => {
  function stub(env: Record<string, string | undefined>) {
    for (const k of ['APPLE_IAP_BUNDLE_ID', 'APPLE_IAP_ENVIRONMENT', 'APPLE_IAP_APP_APPLE_ID']) vi.stubEnv(k, env[k] ?? '');
    setAppleVerifierForTests(undefined);
  }

  it('is unavailable with no config', () => {
    stub({});
    expect(getAppleVerifier()).toBeNull();
  });

  it('needs both bundle id and environment', () => {
    stub({ APPLE_IAP_BUNDLE_ID: BUNDLE });
    expect(getAppleVerifier()).toBeNull();
    stub({ APPLE_IAP_ENVIRONMENT: 'Sandbox' });
    expect(getAppleVerifier()).toBeNull();
  });

  it('rejects an unknown environment', () => {
    stub({ APPLE_IAP_BUNDLE_ID: BUNDLE, APPLE_IAP_ENVIRONMENT: 'Xcode' });
    expect(getAppleVerifier()).toBeNull();
  });

  it('requires APPLE_IAP_APP_APPLE_ID in Production only', () => {
    stub({ APPLE_IAP_BUNDLE_ID: BUNDLE, APPLE_IAP_ENVIRONMENT: 'Production' });
    expect(getAppleVerifier()).toBeNull();
    stub({ APPLE_IAP_BUNDLE_ID: BUNDLE, APPLE_IAP_ENVIRONMENT: 'Production', APPLE_IAP_APP_APPLE_ID: 'abc' });
    expect(getAppleVerifier()).toBeNull();
    stub({ APPLE_IAP_BUNDLE_ID: BUNDLE, APPLE_IAP_ENVIRONMENT: 'Production', APPLE_IAP_APP_APPLE_ID: '1234567890' });
    expect(getAppleVerifier()).not.toBeNull();
    stub({ APPLE_IAP_BUNDLE_ID: BUNDLE, APPLE_IAP_ENVIRONMENT: 'Sandbox' });
    expect(getAppleVerifier()).not.toBeNull();
  });

  it('parses config', () => {
    expect(readAppleIapConfig({ APPLE_IAP_BUNDLE_ID: BUNDLE, APPLE_IAP_ENVIRONMENT: 'Production', APPLE_IAP_APP_APPLE_ID: '42' }))
      .toEqual({ bundleId: BUNDLE, environment: 'Production', appAppleId: 42 });
  });

  it('setAppleVerifierForTests overrides the cached verifier', () => {
    stub({});
    const fake: AppleVerifier = { verifyTransaction: vi.fn(), verifyNotification: vi.fn() };
    setAppleVerifierForTests(fake);
    expect(getAppleVerifier()).toBe(fake);
  });
});

describe('pinned Apple Root CA - G3', () => {
  it('embeds the certificate with the expected fingerprint', () => {
    const cert = new X509Certificate(Buffer.from(APPLE_ROOT_CA_G3_BASE64, 'base64'));
    expect(cert.fingerprint256).toBe(APPLE_ROOT_CA_G3_SHA256);
    expect(APPLE_ROOT_CA_G3_SHA256).toBe('63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79');
    expect(cert.subject).toContain('CN=Apple Root CA - G3');
  });

  it('the load-time check rejects any other certificate', () => {
    expect(() => assertRootFingerprint(Buffer.from(FORGED_ROOT, 'base64'), APPLE_ROOT_CA_G3_SHA256)).toThrow(/fingerprint mismatch/);
    expect(() => assertRootFingerprint(Buffer.from(APPLE_ROOT_CA_G3_BASE64, 'base64'), APPLE_ROOT_CA_G3_SHA256)).not.toThrow();
  });
});

describe('forged JWS', () => {
  const apple = () => createAppleVerifier({ bundleId: BUNDLE, environment: 'Sandbox' });

  it('a forged chain is rejected by the Apple-rooted verifier', async () => {
    const jws = forgeJws(txPayload());
    await expect(apple().verifyTransaction(jws)).rejects.toThrow();
    await expect(apple().verifyNotification(forgeJws(notificationPayload(jws)))).rejects.toThrow();
  });

  it('the same forgery verifies when its root is trusted (so the rejection above is the chain)', async () => {
    const tx = await trustingForged().verifyTransaction(forgeJws(txPayload({ revocationDate: 1_700_000_000_000 })));
    expect(tx).toMatchObject({
      transactionId: '2000000123',
      originalTransactionId: '2000000100',
      productId: 'taels.500',
      bundleId: BUNDLE,
      environment: 'Sandbox',
      revocationDate: 1_700_000_000_000,
    });
    const n = await trustingForged().verifyNotification(forgeJws(notificationPayload(forgeJws(txPayload()))));
    expect(n.notificationType).toBe('REFUND');
    expect(n.transaction?.transactionId).toBe('2000000123');
  });

  it('rejects an invalid signature', async () => {
    const [h, , s] = forgeJws(txPayload()).split('.');
    const tampered = `${h}.${b64url(JSON.stringify(txPayload({ productId: 'taels.99999' })))}.${s}`;
    await expect(trustingForged().verifyTransaction(tampered)).rejects.toThrow();
    const [nh, , ns] = forgeJws(notificationPayload(forgeJws(txPayload()))).split('.');
    const tamperedN = `${nh}.${b64url(JSON.stringify({ ...notificationPayload(forgeJws(txPayload())), notificationType: 'ONE_TIME_CHARGE' }))}.${ns}`;
    await expect(trustingForged().verifyNotification(tamperedN)).rejects.toThrow();
  });

  it('rejects a wrong bundle id', async () => {
    await expect(trustingForged().verifyTransaction(forgeJws(txPayload({ bundleId: 'com.evil.app' })))).rejects.toThrow();
    await expect(trustingForged().verifyNotification(forgeJws(notificationPayload(forgeJws(txPayload()), { bundleId: 'com.evil.app' }))))
      .rejects.toThrow();
  });

  it('rejects a wrong environment', async () => {
    await expect(trustingForged().verifyTransaction(forgeJws(txPayload({ environment: 'Production' })))).rejects.toThrow();
    await expect(trustingForged().verifyNotification(forgeJws(notificationPayload(forgeJws(txPayload()), { environment: 'Production' }))))
      .rejects.toThrow();
    // A notification whose envelope matches but whose embedded transaction is from the other environment.
    await expect(trustingForged().verifyNotification(forgeJws(notificationPayload(forgeJws(txPayload({ environment: 'Production' }))))))
      .rejects.toThrow();
  });
});
