// Customer agent API keys: long-lived, revocable, hashed credentials that let a coding agent
// spend a user's prepaid credits without a browser session. No admin power (see admin-api-keys.ts).
import { createHash, randomBytes } from 'node:crypto';
import { dbAll, dbGet, dbRun } from '../db.js';

const KEY_PREFIX = 'bkk_';
const MAX_ACTIVE_KEYS = 10;
const LAST_USED_THROTTLE_S = 60;

export interface AgentApiKeyInfo {
  id: number;
  label: string | null;
  prefix: string;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
}

export class AgentApiKeyLimitError extends Error {
  readonly code = 'agent_key_limit';
  constructor() {
    super(`Maximum of ${MAX_ACTIVE_KEYS} active agent API keys reached`);
    this.name = 'AgentApiKeyLimitError';
  }
}

const now = () => Math.floor(Date.now() / 1000);
const hashKey = (raw: string) => createHash('sha256').update(raw).digest('hex');
const normEmail = (email: string) => email.trim().toLowerCase();

export async function mintAgentApiKey(
  email: string,
  label: string | null,
  opts: { checkoutSessionId?: string } = {},
): Promise<{ id: number; key: string; prefix: string } | { alreadyMinted: true }> {
  const addr = normEmail(email);
  const sessionId = opts.checkoutSessionId || null;
  if (sessionId) {
    const existing = await dbGet<{ id: number }>(
      'SELECT id FROM agent_api_keys WHERE checkout_session_id = ?', sessionId);
    if (existing) return { alreadyMinted: true };
  }
  const active = await dbGet<{ n: number }>(
    'SELECT COUNT(*) AS n FROM agent_api_keys WHERE email = ? AND revoked_at IS NULL', addr);
  if (Number(active?.n ?? 0) >= MAX_ACTIVE_KEYS) throw new AgentApiKeyLimitError();

  const key = KEY_PREFIX + randomBytes(32).toString('base64url');
  const prefix = key.slice(0, 12);
  try {
    const res = await dbRun(
      `INSERT INTO agent_api_keys (email, label, key_hash, key_prefix, created_at, checkout_session_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      addr, label ? label.slice(0, 80) : null, hashKey(key), prefix, now(), sessionId);
    return { id: Number(res.lastInsertRowid), key, prefix };
  } catch (err) {
    // A concurrent mint for the same checkout session lost the UNIQUE race.
    if (sessionId && /UNIQUE|constraint/i.test(String((err as Error)?.message))) return { alreadyMinted: true };
    throw err;
  }
}

export async function verifyAgentApiKey(raw: string): Promise<string | null> {
  if (typeof raw !== 'string' || !raw.startsWith(KEY_PREFIX)) return null;
  const t = now();
  const row = await dbGet<{ id: number; email: string; last_used_at: number | null }>(
    'SELECT id, email, last_used_at FROM agent_api_keys WHERE key_hash = ? AND revoked_at IS NULL', hashKey(raw));
  if (!row) return null;
  if (row.last_used_at === null || t - row.last_used_at >= LAST_USED_THROTTLE_S) {
    await dbRun('UPDATE agent_api_keys SET last_used_at = ? WHERE id = ?', t, row.id);
  }
  return row.email;
}

export async function listAgentApiKeys(email: string): Promise<AgentApiKeyInfo[]> {
  return dbAll<AgentApiKeyInfo>(
    `SELECT id, label, key_prefix AS prefix, created_at, last_used_at, revoked_at
     FROM agent_api_keys WHERE email = ? ORDER BY created_at DESC, id DESC`, normEmail(email));
}

export async function revokeAgentApiKey(id: number, email: string): Promise<boolean> {
  const res = await dbRun(
    'UPDATE agent_api_keys SET revoked_at = ? WHERE id = ? AND email = ? AND revoked_at IS NULL',
    now(), id, normEmail(email));
  return res.changes > 0;
}
