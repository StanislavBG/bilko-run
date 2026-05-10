import { dbGet, dbRun } from '../db.js';
import { createHash } from 'node:crypto';

const WINDOW_SEC = 86_400; // 24h sliding window
export const PER_DAY_LIMIT = 5;

export function emailHash(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16);
}

export async function quotaUsed(email: string): Promise<number> {
  const eh = emailHash(email);
  const cutoff = Math.floor(Date.now() / 1000) - WINDOW_SEC;
  const r = await dbGet<{ n: number }>(
    'SELECT COUNT(*) AS n FROM academy_quota_daily WHERE email_hash = ? AND call_at >= ? AND outcome = ?',
    eh, cutoff, 'ok',
  );
  return r?.n ?? 0;
}

export async function recordCall(
  email: string,
  outcome: 'ok' | 'error' | 'denied' | 'rate_limited',
  tokenIn = 0,
  tokenOut = 0,
): Promise<void> {
  const eh = emailHash(email);
  await dbRun(
    'INSERT INTO academy_quota_daily (email_hash, call_at, outcome, token_in, token_out) VALUES (?, ?, ?, ?, ?)',
    eh, Math.floor(Date.now() / 1000), outcome, tokenIn, tokenOut,
  );
}

export async function nextResetAt(email: string): Promise<Date | null> {
  const eh = emailHash(email);
  const cutoff = Math.floor(Date.now() / 1000) - WINDOW_SEC;
  const r = await dbGet<{ call_at: number }>(
    'SELECT MIN(call_at) AS call_at FROM academy_quota_daily WHERE email_hash = ? AND call_at >= ? AND outcome = ?',
    eh, cutoff, 'ok',
  );
  if (!r?.call_at) return null;
  return new Date((r.call_at + WINDOW_SEC) * 1000);
}
