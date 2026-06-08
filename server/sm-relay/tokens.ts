// Session Manager web-remote relay — in-process token stores.
// Ported near-verbatim from session-manager web-remote/relay/src/tokens.ts.
// Auth-mechanism-agnostic: `userId` is the Clerk user's email (see routes.ts).
// Stores are in-process and lost on redeploy — acceptable (devices re-pair / browsers re-ticket).
import crypto from 'node:crypto';

export interface OtpEntry {
  code: string;
  userId: string;
  email: string;
  expiresAt: number;
  attempts: number;
}

export interface DeviceTokenEntry {
  token: string;
  deviceId: string;
  userId: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
  devicePubKey: string;
}

export interface WsTicketEntry {
  userId: string;
  email: string;
  role: 'browser' | 'agent';
  deviceId?: string;
  expiresAt: number;
}

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 3;
const OTP_RATE_LIMIT_COUNT = 10;
const OTP_RATE_WINDOW_MS = 60 * 60 * 1000;
const WS_TICKET_TTL_MS = 30 * 1000;
const DEVICE_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

// Unambiguous alphanumeric charset (excludes 0/O, 1/I, 8/B look-alikes)
const OTP_CHARSET = 'ACDEFGHJKLMNPQRTUVWXY234679';

export const otpStore = new Map<string, OtpEntry>();
export const deviceTokenStore = new Map<string, DeviceTokenEntry>();
export const deviceByIdStore = new Map<string, DeviceTokenEntry>();
export const wsTicketStore = new Map<string, WsTicketEntry>();
export const otpRateStore = new Map<string, { count: number; resetAt: number }>();

export function generateOtpCode(): string {
  const maxAccept = Math.floor(256 / OTP_CHARSET.length) * OTP_CHARSET.length;
  const chars: string[] = [];
  while (chars.length < 8) {
    const byte = crypto.randomBytes(1)[0];
    if (byte < maxAccept) chars.push(OTP_CHARSET[byte % OTP_CHARSET.length]);
  }
  return chars.join('');
}

export function issueOtp(
  userId: string,
  email: string,
  now = Date.now(),
): { code: string } | { error: string; retryAfterMs?: number } {
  const rate = otpRateStore.get(userId);
  if (rate && now < rate.resetAt) {
    if (rate.count >= OTP_RATE_LIMIT_COUNT) {
      return { error: 'rate_limited', retryAfterMs: rate.resetAt - now };
    }
    rate.count++;
  } else {
    otpRateStore.set(userId, { count: 1, resetAt: now + OTP_RATE_WINDOW_MS });
  }

  for (const [code, entry] of otpStore) {
    if (entry.userId === userId) otpStore.delete(code);
  }

  const code = generateOtpCode();
  otpStore.set(code, { code, userId, email, expiresAt: now + OTP_TTL_MS, attempts: 0 });
  return { code };
}

export function verifyOtp(
  code: string,
  now = Date.now(),
): { userId: string; email: string } | { error: string; status: number } {
  const normalized = code.toUpperCase().trim();
  const entry = otpStore.get(normalized);
  if (!entry) return { error: 'invalid_code', status: 400 };
  if (now > entry.expiresAt) {
    otpStore.delete(normalized);
    return { error: 'code_expired', status: 400 };
  }
  otpStore.delete(normalized);
  return { userId: entry.userId, email: entry.email };
}

export function recordOtpFailure(userId: string, now = Date.now()): boolean {
  for (const [code, entry] of otpStore) {
    if (entry.userId === userId && now <= entry.expiresAt) {
      entry.attempts++;
      if (entry.attempts >= OTP_MAX_ATTEMPTS) {
        otpStore.delete(code);
        return true;
      }
      return false;
    }
  }
  return false;
}

export function issueDeviceToken(
  deviceId: string,
  userId: string,
  email: string,
  devicePubKey: string,
  now = Date.now(),
): string {
  const existing = deviceByIdStore.get(deviceId);
  if (existing) deviceTokenStore.delete(existing.token);

  const token = crypto.randomBytes(32).toString('base64url');
  const entry: DeviceTokenEntry = {
    token, deviceId, userId, email, issuedAt: now,
    expiresAt: now + DEVICE_TOKEN_TTL_MS,
    revoked: false,
    devicePubKey,
  };
  deviceTokenStore.set(token, entry);
  deviceByIdStore.set(deviceId, entry);
  return token;
}

export function verifyDeviceToken(token: string, now = Date.now()): DeviceTokenEntry | null {
  const entry = deviceTokenStore.get(token);
  if (!entry || entry.revoked) return null;
  if (now > entry.expiresAt) {
    deviceTokenStore.delete(token);
    deviceByIdStore.delete(entry.deviceId);
    return null;
  }
  return entry;
}

export function revokeDevice(deviceId: string): boolean {
  const entry = deviceByIdStore.get(deviceId);
  if (!entry) return false;
  entry.revoked = true;
  deviceTokenStore.delete(entry.token);
  deviceByIdStore.delete(deviceId);
  return true;
}

export function getDevicesForUser(userId: string, now = Date.now()): Array<{ deviceId: string; email: string; issuedAt: number; expiresAt: number; devicePubKey: string }> {
  const result: Array<{ deviceId: string; email: string; issuedAt: number; expiresAt: number; devicePubKey: string }> = [];
  for (const entry of deviceByIdStore.values()) {
    if (entry.userId === userId && !entry.revoked && now <= entry.expiresAt) {
      result.push({
        deviceId: entry.deviceId,
        email: entry.email,
        issuedAt: entry.issuedAt,
        expiresAt: entry.expiresAt,
        devicePubKey: entry.devicePubKey,
      });
    }
  }
  return result;
}

export function revokeAllDevicesForUser(userId: string): string[] {
  const revoked: string[] = [];
  for (const entry of Array.from(deviceByIdStore.values())) {
    if (entry.userId === userId && !entry.revoked) {
      entry.revoked = true;
      deviceTokenStore.delete(entry.token);
      deviceByIdStore.delete(entry.deviceId);
      revoked.push(entry.deviceId);
    }
  }
  return revoked;
}

export function issueWsTicket(
  data: Omit<WsTicketEntry, 'expiresAt'>,
  now = Date.now(),
): string {
  const ticket = crypto.randomBytes(16).toString('base64url');
  wsTicketStore.set(ticket, { ...data, expiresAt: now + WS_TICKET_TTL_MS });
  return ticket;
}

export function consumeWsTicket(ticket: string, now = Date.now()): WsTicketEntry | null {
  const entry = wsTicketStore.get(ticket);
  if (!entry) return null;
  wsTicketStore.delete(ticket);
  if (now > entry.expiresAt) return null;
  return entry;
}

export function purgeExpired(now = Date.now()): void {
  for (const [code, entry] of otpStore) {
    if (now > entry.expiresAt) otpStore.delete(code);
  }
  for (const [ticket, entry] of wsTicketStore) {
    if (now > entry.expiresAt) wsTicketStore.delete(ticket);
  }
  for (const [userId, rate] of otpRateStore) {
    if (now > rate.resetAt) otpRateStore.delete(userId);
  }
  for (const [token, entry] of deviceTokenStore) {
    if (now > entry.expiresAt) {
      deviceTokenStore.delete(token);
      deviceByIdStore.delete(entry.deviceId);
    }
  }
}
