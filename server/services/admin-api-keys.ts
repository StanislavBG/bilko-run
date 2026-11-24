// Personal admin API keys: long-lived, revocable, hashed credentials minted from a
// signed-in admin session so headless clients (the Bilko MCP) can call the admin API.
import { createHash, randomBytes } from 'node:crypto';
import { dbAll, dbGet, dbRun } from '../db.js';
import { ADMIN_EMAILS, requireAdminSession } from '../clerk.js';

const KEY_PREFIX = 'bka_';
const DEFAULT_TTL_DAYS = 90;
const LAST_USED_THROTTLE_S = 60;

/** 'read': GET/HEAD on requireAdmin routes. 'registry': also any method on requireRegistryWriter routes. */
export const ADMIN_API_KEY_SCOPES = ['read', 'registry'] as const;
export type AdminApiKeyScope = (typeof ADMIN_API_KEY_SCOPES)[number];
export const isAdminApiKeyScope = (v: unknown): v is AdminApiKeyScope =>
  typeof v === 'string' && (ADMIN_API_KEY_SCOPES as readonly string[]).includes(v);

export interface AdminApiKeyInfo {
  id: number;
  label: string | null;
  prefix: string;
  scope: AdminApiKeyScope;
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
  scope: AdminApiKeyScope = 'read',
): Promise<{ id: number; key: string; prefix: string; expiresAt: number; scope: AdminApiKeyScope }> {
  if (!isAdminApiKeyScope(scope)) throw new Error(`Unknown admin API key scope: ${String(scope)}`);
  const days = Math.min(365, Math.max(1, Math.floor(Number.isFinite(ttlDays) ? ttlDays : DEFAULT_TTL_DAYS)));
  const key = KEY_PREFIX + randomBytes(32).toString('base64url');
  const prefix = key.slice(0, 12);
  const createdAt = now();
  const expiresAt = createdAt + days * 86400;
  const res = await dbRun(
    `INSERT INTO admin_api_keys (email, label, key_hash, key_prefix, created_at, expires_at, scope)
     VALUES (?, ?, ?, ?, ?, ?, ?)`, email, label ? label.slice(0, 80) : null, hashKey(key), prefix, createdAt, expiresAt, scope);
  return { id: Number(res.lastInsertRowid), key, prefix, expiresAt, scope };
}

/** Look up a live key (not revoked, not expired, owner still an admin); stamps last_used_at. */
async function lookupAdminApiKey(raw: string): Promise<{ id: number; email: string; scope: AdminApiKeyScope } | null> {
  if (typeof raw !== 'string' || !raw.startsWith(KEY_PREFIX)) return null;
  const t = now();
  const row = await dbGet<{ id: number; email: string; scope: string; last_used_at: number | null }>(
    `SELECT id, email, scope, last_used_at FROM admin_api_keys
     WHERE key_hash = ? AND revoked_at IS NULL AND expires_at > ?`, hashKey(raw), t);
  if (!row || !ADMIN_EMAILS.includes(row.email)) return null;
  if (row.last_used_at === null || t - row.last_used_at >= LAST_USED_THROTTLE_S) {
    await dbRun('UPDATE admin_api_keys SET last_used_at = ? WHERE id = ?', t, row.id);
  }
  return { id: row.id, email: row.email, scope: isAdminApiKeyScope(row.scope) ? row.scope : 'read' };
}

/** Any live key, any scope; used by requireAdmin, which limits keys to GET/HEAD. */
export async function verifyAdminApiKey(raw: string): Promise<string | null> {
  return (await lookupAdminApiKey(raw))?.email ?? null;
}

/**
 * Guard for registry (project metadata) writes. Accepts an admin Clerk session (actor = email)
 * or a `Bearer bka_` key with scope 'registry' (actor = `key:<id>`), for any method.
 * Read-scope keys are refused. Sends 403 and returns null on failure.
 */
export async function requireRegistryWriter(req: any, reply: any): Promise<string | null> {
  const header: string | undefined = req.headers?.authorization;
  if (header?.startsWith('Bearer bka_')) {
    const key = await lookupAdminApiKey(header.slice(7));
    if (!key) {
      reply.status(403).send({ error: 'Admin access required.' });
      return null;
    }
    if (key.scope !== 'registry') {
      reply.status(403).send({ error: 'This admin API key is read-only; registry writes need a registry key.' });
      return null;
    }
    return `key:${key.id}`;
  }
  return requireAdminSession(req, reply);
}

export async function listAdminApiKeys(email: string): Promise<AdminApiKeyInfo[]> {
  return dbAll<AdminApiKeyInfo>(
    `SELECT id, label, key_prefix AS prefix, scope, created_at, expires_at, last_used_at, revoked_at
     FROM admin_api_keys WHERE email = ? ORDER BY created_at DESC, id DESC`, email);
}

export async function revokeAdminApiKey(id: number, email: string): Promise<boolean> {
  const res = await dbRun(
    'UPDATE admin_api_keys SET revoked_at = ? WHERE id = ? AND email = ? AND revoked_at IS NULL', now(), id, email);
  return res.changes > 0;
}
