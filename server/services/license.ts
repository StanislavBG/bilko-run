import crypto from 'crypto';
import { dbGet, dbAll, dbRun } from '../db.js';

export function generateLicenseKey(): string {
  const bytes = crypto.randomBytes(8);
  const hex = bytes.toString('hex').toUpperCase();
  return `CG-${hex.slice(0,4)}-${hex.slice(4,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}`;
}

export async function upsertLicenseKey(email: string, stripeCustomerId?: string, productKey = 'contentgrade_pro'): Promise<string> {
  const existing = await dbGet<{ key: string }>(
    `SELECT key FROM license_keys WHERE email = ? AND product_key = ? AND status = 'active' LIMIT 1`,
    email, productKey,
  );
  if (existing) return existing.key;

  const key = generateLicenseKey();
  await dbRun(
    `INSERT INTO license_keys (key, email, stripe_customer_id, product_key, status) VALUES (?, ?, ?, ?, 'active')`,
    key, email, stripeCustomerId ?? null, productKey,
  );
  return key;
}

export async function validateLicenseKey(key: string): Promise<{ valid: boolean; email?: string; productKey?: string; status?: string }> {
  const row = await dbGet<{ key: string; email: string; product_key: string; status: string }>(
    `SELECT key, email, product_key, status FROM license_keys WHERE key = ? LIMIT 1`, key,
  );
  if (!row) return { valid: false };

  await dbRun(
    `UPDATE license_keys SET last_validated_at = CURRENT_TIMESTAMP, validation_count = validation_count + 1 WHERE key = ?`,
    key,
  );

  if (row.status !== 'active') return { valid: false, status: row.status };
  return { valid: true, email: row.email, productKey: row.product_key, status: row.status };
}

export async function getLicenseKeysForEmail(email: string): Promise<Array<{ key: string; productKey: string; status: string; createdAt: string }>> {
  const rows = await dbAll<{ key: string; product_key: string; status: string; created_at: string }>(
    `SELECT key, product_key, status, created_at FROM license_keys WHERE email = ? ORDER BY created_at DESC`,
    email,
  );
  return rows.map(r => ({ key: r.key, productKey: r.product_key, status: r.status, createdAt: r.created_at }));
}

export async function revokeLicenseKey(key: string): Promise<void> {
  await dbRun(`UPDATE license_keys SET status = 'revoked' WHERE key = ?`, key);
}
