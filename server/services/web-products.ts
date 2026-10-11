// Persistence for web products (paid downloads). Release bytes are stored as a DB
// BLOB because the GitHub repo is public; a release is accepted only when its bytes
// match the sha256 and size declared in shared/web-products.ts.
import { createHash } from 'node:crypto';
import { dbAll, dbGet, dbRun } from '../db.js';
import { MAX_RELEASE_BYTES, type WebProduct } from '../../shared/web-products.js';

export interface WebProductOrder {
  checkout_session_id: string;
  slug: string;
  email: string;
  amount_total: number | null;
  currency: string | null;
  payment_status: string | null;
  created_at: number;
}

export interface RecordOrderInput {
  checkoutSessionId: string;
  slug: string;
  email: string;
  amountTotal: number | null;
  currency: string | null;
  paymentStatus: string | null;
}

export async function recordOrder(o: RecordOrderInput): Promise<void> {
  await dbRun(
    `INSERT OR IGNORE INTO web_product_orders
       (checkout_session_id, slug, email, amount_total, currency, payment_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    o.checkoutSessionId, o.slug, o.email.trim().toLowerCase(),
    o.amountTotal, o.currency, o.paymentStatus, Date.now(),
  );
}

export async function findOrder(slug: string, checkoutSessionId: string): Promise<WebProductOrder | null> {
  const row = await dbGet<WebProductOrder>(
    'SELECT * FROM web_product_orders WHERE slug = ? AND checkout_session_id = ?',
    slug, checkoutSessionId,
  );
  return row ?? null;
}

export async function hasOrderForEmail(slug: string, email: string): Promise<boolean> {
  const row = await dbGet(
    'SELECT 1 AS ok FROM web_product_orders WHERE slug = ? AND email = ? LIMIT 1',
    slug, email.trim().toLowerCase(),
  );
  return !!row;
}

export interface RecordDownloadInput {
  slug: string;
  version: string;
  checkoutSessionId: string | null;
  email: string | null;
  via: 'session' | 'account';
  ipHash: string | null;
}

export async function recordDownload(d: RecordDownloadInput): Promise<void> {
  await dbRun(
    `INSERT INTO web_product_downloads
       (slug, version, checkout_session_id, email, via, ip_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    d.slug, d.version, d.checkoutSessionId, d.email ? d.email.trim().toLowerCase() : null,
    d.via, d.ipHash, Date.now(),
  );
}

export async function countSessionDownloads(slug: string, checkoutSessionId: string): Promise<number> {
  const row = await dbGet<{ n: number }>(
    `SELECT COUNT(*) AS n FROM web_product_downloads
     WHERE slug = ? AND checkout_session_id = ? AND via = 'session'`,
    slug, checkoutSessionId,
  );
  return Number(row?.n ?? 0);
}

export type StoreReleaseResult = 'undeclared' | 'mismatch' | 'exists' | 'stored';

export interface StoredRelease {
  filename: string;
  bytes: number;
  sha256: string;
  content: Buffer;
}

const releaseCache = new Map<string, StoredRelease>();
const cacheKey = (slug: string, version: string) => `${slug}@${version}`;

export async function storeRelease(
  product: WebProduct,
  version: string,
  buf: Buffer,
): Promise<StoreReleaseResult> {
  const decl = product.release;
  if (!decl || decl.version !== version) return 'undeclared';
  if (
    buf.length > MAX_RELEASE_BYTES ||
    buf.length !== decl.bytes ||
    createHash('sha256').update(buf).digest('hex') !== decl.sha256
  ) {
    return 'mismatch';
  }
  const existing = await dbGet(
    'SELECT 1 AS ok FROM web_product_releases WHERE slug = ? AND version = ?',
    product.slug, version,
  );
  if (existing) return 'exists';
  await dbRun(
    `INSERT OR IGNORE INTO web_product_releases
       (slug, version, filename, sha256, bytes, content, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    product.slug, version, decl.filename, decl.sha256, decl.bytes, buf, Date.now(),
  );
  return 'stored';
}

export async function getRelease(slug: string, version: string): Promise<StoredRelease | null> {
  const key = cacheKey(slug, version);
  const hit = releaseCache.get(key);
  if (hit) return hit;
  const rows = await dbAll<{
    filename: string; bytes: number; sha256: string; content: unknown;
  }>(
    'SELECT filename, bytes, sha256, content FROM web_product_releases WHERE slug = ? AND version = ?',
    slug, version,
  );
  const row = rows[0];
  if (!row || row.content == null) return null;
  const raw = row.content;
  const content = raw instanceof ArrayBuffer
    ? Buffer.from(new Uint8Array(raw))
    : Buffer.from((raw as Uint8Array).buffer, (raw as Uint8Array).byteOffset, (raw as Uint8Array).byteLength);
  const rel: StoredRelease = {
    filename: row.filename, bytes: Number(row.bytes), sha256: row.sha256, content,
  };
  releaseCache.set(key, rel);
  return rel;
}
