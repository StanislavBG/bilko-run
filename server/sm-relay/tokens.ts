// Session Manager web-remote relay — token stores.
// Ported from session-manager web-remote/relay/src/tokens.ts.
// Auth-mechanism-agnostic: `userId` is the Clerk user's email (see routes.ts).
// Long-lived device tokens persist in the `sm_relay_devices` table so paired desktops
// survive a redeploy. Short-lived OTPs, WS tickets and rate counters stay in-process —
// losing them on redeploy only means re-requesting a code or ticket.
import crypto from 'node:crypto';
import { dbGet, dbAll, dbRun } from '../db.js';

export interface OtpEntry {
  code: string;
  userId: string;
  email: string;
  expiresAt: number;
  attempts: number;
}

export interface DeviceRecord {
  deviceId: string;
  userId: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
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

/** Device tokens are stored hashed: a DB read never yields a usable bearer token. */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

interface DeviceRow {
  device_id: string;
  user_id: string;
  email: string;
  issued_at: number;
  expires_at: number;
  device_pub_key: string;
}

function toDevice(row: DeviceRow): DeviceRecord {
  return {
    deviceId: row.device_id,
    userId: row.user_id,
    email: row.email,
    issuedAt: Number(row.issued_at),
    expiresAt: Number(row.expires_at),
    devicePubKey: row.device_pub_key,
  };
}

const DEVICE_COLS = 'device_id, user_id, email, issued_at, expires_at, device_pub_key';

/** Re-pairing a deviceId replaces its row, which invalidates the previous token. */
export async function issueDeviceToken(
  deviceId: string,
  userId: string,
  email: string,
  devicePubKey: string,
  now = Date.now(),
): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await dbRun(
    `INSERT INTO sm_relay_devices (device_id, token_hash, user_id, email, issued_at, expires_at, device_pub_key)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(device_id) DO UPDATE SET
       token_hash = excluded.token_hash, user_id = excluded.user_id, email = excluded.email,
       issued_at = excluded.issued_at, expires_at = excluded.expires_at, device_pub_key = excluded.device_pub_key`,
    deviceId, hashToken(token), userId, email, now, now + DEVICE_TOKEN_TTL_MS, devicePubKey,
  );
  return token;
}

export async function verifyDeviceToken(token: string, now = Date.now()): Promise<DeviceRecord | null> {
  const row = await dbGet<DeviceRow>(
    `SELECT ${DEVICE_COLS} FROM sm_relay_devices WHERE token_hash = ?`,
    hashToken(token),
  );
  if (!row) return null;
  if (now > Number(row.expires_at)) {
    await dbRun('DELETE FROM sm_relay_devices WHERE device_id = ?', row.device_id);
    return null;
  }
  return toDevice(row);
}

export async function getDevice(deviceId: string, now = Date.now()): Promise<DeviceRecord | null> {
  const row = await dbGet<DeviceRow>(
    `SELECT ${DEVICE_COLS} FROM sm_relay_devices WHERE device_id = ? AND expires_at >= ?`,
    deviceId, now,
  );
  return row ? toDevice(row) : null;
}

/** Revocation deletes the row, so the next verifyDeviceToken fails on every instance. */
export async function revokeDevice(deviceId: string): Promise<boolean> {
  const { changes } = await dbRun('DELETE FROM sm_relay_devices WHERE device_id = ?', deviceId);
  return changes > 0;
}

export async function getDevicesForUser(userId: string, now = Date.now()): Promise<Array<Omit<DeviceRecord, 'userId'>>> {
  const rows = await dbAll<DeviceRow>(
    `SELECT ${DEVICE_COLS} FROM sm_relay_devices WHERE user_id = ? AND expires_at >= ? ORDER BY issued_at`,
    userId, now,
  );
  return rows.map((r) => {
    const { userId: _u, ...rest } = toDevice(r);
    return rest;
  });
}

export async function revokeAllDevicesForUser(userId: string): Promise<string[]> {
  const rows = await dbAll<{ device_id: string }>(
    'DELETE FROM sm_relay_devices WHERE user_id = ? RETURNING device_id',
    userId,
  );
  return rows.map((r) => r.device_id);
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

export async function purgeExpired(now = Date.now()): Promise<void> {
  for (const [code, entry] of otpStore) {
    if (now > entry.expiresAt) otpStore.delete(code);
  }
  for (const [ticket, entry] of wsTicketStore) {
    if (now > entry.expiresAt) wsTicketStore.delete(ticket);
  }
  for (const [userId, rate] of otpRateStore) {
    if (now > rate.resetAt) otpRateStore.delete(userId);
  }
  await dbRun('DELETE FROM sm_relay_devices WHERE expires_at < ?', now);
}
