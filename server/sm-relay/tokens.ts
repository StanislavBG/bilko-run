// Session Manager web-remote relay — token stores.
// Ported from session-manager web-remote/relay/src/tokens.ts.
// Auth-mechanism-agnostic: `userId` is the Clerk user's email (see routes.ts).
// Long-lived device tokens persist in the `sm_relay_devices` table and client tokens
// in `sm_relay_clients`, so paired desktops survive a redeploy. Short-lived OTPs, WS tickets and rate counters stay in-process —
// losing them on redeploy only means re-requesting a code or ticket.
import crypto from 'node:crypto';
import { dbGet, dbAll, dbRun } from '../db.js';

/**
 * What a pairing code may be redeemed for. A 'device' code mints an agent token
 * (POST /pair); a 'client' code mints a token that drives the user's devices as a
 * browser (POST /client-pair). The two are never interchangeable.
 */
export type OtpPurpose = 'device' | 'client';

export interface OtpEntry {
  code: string;
  userId: string;
  email: string;
  purpose: OtpPurpose;
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
  /** Set when a paired desktop client (not a Clerk session) holds this browser ticket. */
  clientId?: string;
  expiresAt: number;
}

export interface ClientRecord {
  clientId: string;
  userId: string;
  email: string;
  clientName: string;
  issuedAt: number;
  expiresAt: number;
}

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RATE_LIMIT_COUNT = 10;
const OTP_RATE_WINDOW_MS = 60 * 60 * 1000;
const WS_TICKET_TTL_MS = 30 * 1000;
const DEVICE_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const CLIENT_TOKEN_TTL_MS = DEVICE_TOKEN_TTL_MS;

// Unambiguous alphanumeric charset (excludes 0/O, 1/I, 8/B look-alikes)
const OTP_CHARSET = 'ACDEFGHJKLMNPQRTUVWXY234679';

const otpStore = new Map<string, OtpEntry>();
const wsTicketStore = new Map<string, WsTicketEntry>();
const otpRateStore = new Map<string, { count: number; resetAt: number }>();

function generateOtpCode(): string {
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
  purpose: OtpPurpose = 'device',
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
    if (entry.userId === userId && entry.purpose === purpose) otpStore.delete(code);
  }

  const code = generateOtpCode();
  otpStore.set(code, { code, userId, email, purpose, expiresAt: now + OTP_TTL_MS, attempts: 0 });
  return { code };
}

/** A code redeemed at the wrong endpoint is reported as invalid and left unconsumed. */
export function verifyOtp(
  code: string,
  purpose: OtpPurpose = 'device',
  now = Date.now(),
): { userId: string; email: string } | { error: string; status: number } {
  const normalized = code.toUpperCase().trim();
  const entry = otpStore.get(normalized);
  if (!entry || entry.purpose !== purpose) return { error: 'invalid_code', status: 400 };
  if (now > entry.expiresAt) {
    otpStore.delete(normalized);
    return { error: 'code_expired', status: 400 };
  }
  otpStore.delete(normalized);
  return { userId: entry.userId, email: entry.email };
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

// ── Client tokens: a paired desktop Session Manager acting as a browser ──
// Same storage model as device tokens: hashed, revocable by row delete.

interface ClientRow {
  client_id: string;
  user_id: string;
  email: string;
  client_name: string;
  issued_at: number;
  expires_at: number;
}

function toClient(row: ClientRow): ClientRecord {
  return {
    clientId: row.client_id,
    userId: row.user_id,
    email: row.email,
    clientName: row.client_name,
    issuedAt: Number(row.issued_at),
    expiresAt: Number(row.expires_at),
  };
}

const CLIENT_COLS = 'client_id, user_id, email, client_name, issued_at, expires_at';

export async function issueClientToken(
  userId: string,
  email: string,
  clientName: string,
  now = Date.now(),
): Promise<{ clientId: string; clientToken: string }> {
  const clientId = crypto.randomUUID();
  const clientToken = crypto.randomBytes(32).toString('base64url');
  await dbRun(
    `INSERT INTO sm_relay_clients (client_id, token_hash, user_id, email, client_name, issued_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    clientId, hashToken(clientToken), userId, email, clientName, now, now + CLIENT_TOKEN_TTL_MS,
  );
  return { clientId, clientToken };
}

export async function verifyClientToken(token: string, now = Date.now()): Promise<ClientRecord | null> {
  const row = await dbGet<ClientRow>(
    `SELECT ${CLIENT_COLS} FROM sm_relay_clients WHERE token_hash = ?`,
    hashToken(token),
  );
  if (!row) return null;
  if (now > Number(row.expires_at)) {
    await dbRun('DELETE FROM sm_relay_clients WHERE client_id = ?', row.client_id);
    return null;
  }
  return toClient(row);
}

export async function getClient(clientId: string, now = Date.now()): Promise<ClientRecord | null> {
  const row = await dbGet<ClientRow>(
    `SELECT ${CLIENT_COLS} FROM sm_relay_clients WHERE client_id = ? AND expires_at >= ?`,
    clientId, now,
  );
  return row ? toClient(row) : null;
}

export async function getClientsForUser(userId: string, now = Date.now()): Promise<Array<Omit<ClientRecord, 'userId'>>> {
  const rows = await dbAll<ClientRow>(
    `SELECT ${CLIENT_COLS} FROM sm_relay_clients WHERE user_id = ? AND expires_at >= ? ORDER BY issued_at`,
    userId, now,
  );
  return rows.map((r) => {
    const { userId: _u, ...rest } = toClient(r);
    return rest;
  });
}

/** Also drops the client's unconsumed WS tickets, so revocation can't be outrun. */
function dropTicketsForClients(clientIds: string[]): void {
  for (const [ticket, entry] of wsTicketStore) {
    if (entry.clientId && clientIds.includes(entry.clientId)) wsTicketStore.delete(ticket);
  }
}

export async function revokeClient(clientId: string): Promise<boolean> {
  const { changes } = await dbRun('DELETE FROM sm_relay_clients WHERE client_id = ?', clientId);
  dropTicketsForClients([clientId]);
  return changes > 0;
}

export async function revokeAllClientsForUser(userId: string): Promise<string[]> {
  const rows = await dbAll<{ client_id: string }>(
    'DELETE FROM sm_relay_clients WHERE user_id = ? RETURNING client_id',
    userId,
  );
  const ids = rows.map((r) => r.client_id);
  dropTicketsForClients(ids);
  return ids;
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
  await dbRun('DELETE FROM sm_relay_clients WHERE expires_at < ?', now);
}
