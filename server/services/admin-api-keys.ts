// Personal admin API keys: long-lived, revocable, hashed credentials minted from a
// signed-in admin session so headless clients (the Bilko MCP) can call the admin API.
import { createHash, randomBytes } from 'node:crypto';
import { dbAll, dbGet, dbRun } from '../db.js';
import { ADMIN_EMAILS } from '../clerk.js';

const KEY_PREFIX = 'bka_';
const DEFAULT_TTL_DAYS = 90;
const LAST_USED_THROTTLE_S = 60;

export interface AdminApiKeyInfo {
  id: number;
  label: string | null;
  prefix: string;
  created_at: number;
  expires_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
}

const now = () => Math.floor(Date.now() / 1000);
const hashKey = (raw: string) => createHash('sha256').update(raw).digest('hex');

export async function mintAdminApiKey(
  email: string,
  label: string | null,
  ttlDays: number = DEFAULT_TTL_DAYS,
): Promise<{ id: number; key: string; prefix: string; expiresAt: number }> {
  const days = Math.min(365, Math.max(1, Math.floor(Number.isFinite(ttlDays) ? ttlDays : DEFAULT_TTL_DAYS)));
  const key = KEY_PREFIX + randomBytes(32).toString('base64url');
  const prefix = key.slice(0, 12);
  const createdAt = now();
  const expiresAt = createdAt + days * 86400;
  const res = await dbRun(
    `INSERT INTO admin_api_keys (email, label, key_hash, key_prefix, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`, email, label ? label.slice(0, 80) : null, hashKey(key), prefix, createdAt, expiresAt);
  return { id: Number(res.lastInsertRowid), key, prefix, expiresAt };
}

export async function verifyAdminApiKey(raw: string): Promise<string | null> {
  if (typeof raw !== 'string' || !raw.startsWith(KEY_PREFIX)) return null;
  const t = now();
  const row = await dbGet<{ id: number; email: string; last_used_at: number | null }>(
    `SELECT id, email, last_used_at FROM admin_api_keys
     WHERE key_hash = ? AND revoked_at IS NULL AND expires_at > ?`, hashKey(raw), t);
  if (!row || !ADMIN_EMAILS.includes(row.email)) return null;
  if (row.last_used_at === null || t - row.last_used_at >= LAST_USED_THROTTLE_S) {
    await dbRun('UPDATE admin_api_keys SET last_used_at = ? WHERE id = ?', t, row.id);
  }
  return row.email;
}

export async function listAdminApiKeys(email: string): Promise<AdminApiKeyInfo[]> {
  return dbAll<AdminApiKeyInfo>(
    `SELECT id, label, key_prefix AS prefix, created_at, expires_at, last_used_at, revoked_at
     FROM admin_api_keys WHERE email = ? ORDER BY created_at DESC, id DESC`, email);
}

export async function revokeAdminApiKey(id: number, email: string): Promise<boolean> {
  const res = await dbRun(
    'UPDATE admin_api_keys SET revoked_at = ? WHERE id = ? AND email = ? AND revoked_at IS NULL', now(), id, email);
  return res.changes > 0;
}
