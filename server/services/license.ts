import crypto from 'crypto';
import { getDb } from '../db.js';

export function generateLicenseKey(): string {
  const bytes = crypto.randomBytes(8);
  const hex = bytes.toString('hex').toUpperCase();
  return `CG-${hex.slice(0,4)}-${hex.slice(4,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}`;
}

export function upsertLicenseKey(email: string, stripeCustomerId?: string, productKey = 'contentgrade_pro'): string {
  const db = getDb();
  const existing = db.prepare(
    `SELECT key FROM license_keys WHERE email = ? AND product_key = ? AND status = 'active' LIMIT 1`
  ).get(email, productKey) as { key: string } | undefined;
  if (existing) return existing.key;

  const key = generateLicenseKey();
  db.prepare(`
    INSERT INTO license_keys (key, email, stripe_customer_id, product_key, status)
    VALUES (?, ?, ?, ?, 'active')
  `).run(key, email, stripeCustomerId ?? null, productKey);
  return key;
}

export function validateLicenseKey(key: string): { valid: boolean; email?: string; productKey?: string; status?: string } {
  const db = getDb();
  const row = db.prepare(
    `SELECT key, email, product_key, status FROM license_keys WHERE key = ? LIMIT 1`
  ).get(key) as { key: string; email: string; product_key: string; status: string } | undefined;

  if (!row) return { valid: false };

  db.prepare(`
    UPDATE license_keys SET last_validated_at = CURRENT_TIMESTAMP, validation_count = validation_count + 1 WHERE key = ?
  `).run(key);

  if (row.status !== 'active') return { valid: false, status: row.status };
  return { valid: true, email: row.email, productKey: row.product_key, status: row.status };
}

export function getLicenseKeysForEmail(email: string): Array<{ key: string; productKey: string; status: string; createdAt: string }> {
  const rows = getDb().prepare(
    `SELECT key, product_key, status, created_at FROM license_keys WHERE email = ? ORDER BY created_at DESC`
  ).all(email) as Array<{ key: string; product_key: string; status: string; created_at: string }>;
  return rows.map(r => ({ key: r.key, productKey: r.product_key, status: r.status, createdAt: r.created_at }));
}

export function revokeLicenseKey(key: string): void {
  getDb().prepare(`UPDATE license_keys SET status = 'revoked' WHERE key = ?`).run(key);
}
