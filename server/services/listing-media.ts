// Store for owner-uploaded card media, served at /projects/<slug>/_media/<sha256>.<ext>.
// Bytes live in the database (like web_product_releases), split into 1 MiB chunk rows so
// an 8 MB video never needs one huge statement. Files are content-addressed: the name is
// the sha256 of the bytes, re-checked on every uncached read.
import { createHash } from 'node:crypto';
import { dbAll, dbGet, dbRun } from '../db.js';
import {
  checkCardMediaBytes, mediaContentType,
  type CardMediaField, type HostedMediaExt,
} from '../../shared/listing-media.js';
import { hasAudioTrack } from '../../shared/video-audio.js';

export const LISTING_MEDIA_CHUNK_BYTES = 1048576;
export const LISTING_MEDIA_CACHE_BYTES = 67108864;

const FILE_RE = /^([0-9a-f]{64})\.(png|mp4|webm)$/;

export interface ListingMediaMeta {
  bytes: number;
  hasAudio: boolean;
  contentType: string;
}

export interface ListingMedia extends ListingMediaMeta {
  content: Buffer;
}

export type StoreListingMediaResult = 'stored' | 'exists' | { error: string };

function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function toBuffer(raw: unknown): Buffer {
  if (raw instanceof ArrayBuffer) return Buffer.from(new Uint8Array(raw));
  const u = raw as Uint8Array;
  return Buffer.from(u.buffer, u.byteOffset, u.byteLength);
}

// LRU: Map in insertion order (oldest first) with a running byte total.
const cache = new Map<string, ListingMedia>();
let cacheBytes = 0;
const keyOf = (slug: string, file: string) => `${slug}/${file}`;

function cacheGet(key: string): ListingMedia | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cachePut(key: string, value: ListingMedia): void {
  const size = value.content.length;
  if (size > LISTING_MEDIA_CACHE_BYTES) return;
  const prev = cache.get(key);
  if (prev) {
    cache.delete(key);
    cacheBytes -= prev.content.length;
  }
  cache.set(key, value);
  cacheBytes += size;
  for (const [k, v] of cache) {
    if (cacheBytes <= LISTING_MEDIA_CACHE_BYTES) break;
    cache.delete(k);
    cacheBytes -= v.content.length;
  }
}

export async function storeListingMedia(
  slug: string,
  file: string,
  field: CardMediaField,
  buf: Buffer,
): Promise<StoreListingMediaResult> {
  const m = FILE_RE.exec(file);
  if (!m) return { error: `file name ${JSON.stringify(file)} must be <sha256>.png, .mp4 or .webm` };
  const [, hash, extRaw] = m;
  const ext = extRaw as HostedMediaExt;
  if (sha256Hex(buf) !== hash) return { error: `bytes do not match sha256 ${hash}` };
  const problem = checkCardMediaBytes(field, ext, buf);
  if (problem) return { error: `${field} ${problem}` };

  const existing = await dbGet(
    'SELECT 1 AS ok FROM listing_media WHERE slug = ? AND file = ?',
    slug, file,
  );
  if (existing) return 'exists';

  const hasAudio = field === 'video' && hasAudioTrack(buf, `.${ext}`);
  const chunks = Math.max(1, Math.ceil(buf.length / LISTING_MEDIA_CHUNK_BYTES));
  for (let idx = 0; idx < chunks; idx++) {
    const part = buf.subarray(idx * LISTING_MEDIA_CHUNK_BYTES, (idx + 1) * LISTING_MEDIA_CHUNK_BYTES);
    await dbRun(
      'INSERT OR IGNORE INTO listing_media_chunks (slug, file, idx, content) VALUES (?, ?, ?, ?)',
      slug, file, idx, part,
    );
  }
  const res = await dbRun(
    `INSERT OR IGNORE INTO listing_media
       (slug, file, field, bytes, has_audio, chunks, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    slug, file, field, buf.length, hasAudio ? 1 : 0, chunks, Date.now(),
  );
  return (res?.changes ?? 0) > 0 ? 'stored' : 'exists';
}

interface MetaRow {
  bytes: number;
  has_audio: number;
  chunks: number;
}

function metaFrom(file: string, row: MetaRow): ListingMediaMeta {
  const ext = FILE_RE.exec(file)![2] as HostedMediaExt;
  return { bytes: Number(row.bytes), hasAudio: Number(row.has_audio) === 1, contentType: mediaContentType(ext) };
}

export async function getListingMediaMeta(slug: string, file: string): Promise<ListingMediaMeta | null> {
  if (!FILE_RE.test(file)) return null;
  const hit = cache.get(keyOf(slug, file));
  if (hit) return { bytes: hit.bytes, hasAudio: hit.hasAudio, contentType: hit.contentType };
  const row = await dbGet<MetaRow>(
    'SELECT bytes, has_audio, chunks FROM listing_media WHERE slug = ? AND file = ?',
    slug, file,
  );
  return row ? metaFrom(file, row) : null;
}

export async function getListingMedia(slug: string, file: string): Promise<ListingMedia | null> {
  const m = FILE_RE.exec(file);
  if (!m) return null;
  const key = keyOf(slug, file);
  const hit = cacheGet(key);
  if (hit) return hit;

  const row = await dbGet<MetaRow>(
    'SELECT bytes, has_audio, chunks FROM listing_media WHERE slug = ? AND file = ?',
    slug, file,
  );
  if (!row) return null;
  const parts = await dbAll<{ idx: number; content: unknown }>(
    'SELECT idx, content FROM listing_media_chunks WHERE slug = ? AND file = ? ORDER BY idx',
    slug, file,
  );
  const content = Buffer.concat(
    parts
      .filter((p) => p.content != null)
      .sort((a, b) => Number(a.idx) - Number(b.idx))
      .map((p) => toBuffer(p.content)),
  );
  if (sha256Hex(content) !== m[1]) {
    console.error(`[listing-media] ${slug}/${file}: stored bytes (${content.length}) no longer match the sha256 name`);
    return null;
  }
  const media: ListingMedia = { content, ...metaFrom(file, row) };
  cachePut(key, media);
  return media;
}
