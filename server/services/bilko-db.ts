// Bilko-DB document store: named JSON or text documents per signed-in user per app,
// versioned for safe concurrent writes, and PNG/JPEG/WebP/GIF images per user per app, all
// inside one per-user storage quota.
import { randomBytes } from 'node:crypto';
import type { Transaction } from '@libsql/client';
import { dbAll, dbGet, dbTransaction, txGet, txRun } from '../db.js';

const APP_NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const DOC_KEY_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/;

export const DOC_MAX_BYTES = 1_048_576;
export const USER_QUOTA_BYTES = 104_857_600;

export type DocKind = 'json' | 'text';

export function isAppName(s: unknown): s is string {
  return typeof s === 'string' && APP_NAME_RE.test(s);
}

export function isDocKey(s: unknown): s is string {
  return typeof s === 'string' && DOC_KEY_RE.test(s);
}

export interface DocMeta {
  key: string;
  kind: DocKind;
  bytes: number;
  version: number;
  updatedAt: number;
}

export interface Doc extends DocMeta {
  body: string;
}

export type PutDocResult =
  | { key: string; kind: DocKind; version: number; bytes: number; updatedAt: number }
  | { error: 'version_mismatch'; version: number }
  | { error: 'too_large' }
  | { error: 'quota_exceeded' };

export type DeleteDocResult = { deleted: boolean } | { error: 'version_mismatch'; version: number };

interface DocRow {
  key: string;
  kind: DocKind;
  body: string;
  bytes: number;
  version: number;
  updated_at: number;
}

function toMeta(r: Omit<DocRow, 'body'>): DocMeta {
  return {
    key: String(r.key),
    kind: r.kind,
    bytes: Number(r.bytes),
    version: Number(r.version),
    updatedAt: Number(r.updated_at),
  };
}

// Serializes this process's Bilko-DB write transactions. libsql's local file client opens a
// new connection per transaction and fails a second concurrent writer with SQLITE_BUSY
// instead of waiting; queuing here makes the loser see the winner's version instead.
let writeChain: Promise<unknown> = Promise.resolve();
export function serializedWrite<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const run = writeChain.then(() => dbTransaction(fn));
  writeChain = run.catch(() => undefined);
  return run;
}

const USED_BYTES_SQL = `SELECT
  (SELECT COALESCE(SUM(bytes), 0) FROM bilko_db_docs WHERE user_email = ?) +
  (SELECT COALESCE(SUM(bytes), 0) FROM bilko_db_images WHERE user_email = ?) AS used`;

/** Total stored bytes (documents and images) for a user across every app. */
export async function usedBytes(user: string): Promise<number> {
  const row = await dbGet<{ used: number }>(USED_BYTES_SQL, user, user);
  return Number(row?.used ?? 0);
}

async function txUsedBytes(tx: Transaction, user: string): Promise<number> {
  const row = await txGet<{ used: number }>(tx, USED_BYTES_SQL, user, user);
  return Number(row?.used ?? 0);
}

export async function putDoc(opts: {
  app: string;
  user: string;
  key: string;
  kind: DocKind;
  body: string;
  ifVersion?: number;
  createOnly?: boolean;
}): Promise<PutDocResult> {
  const { app, user, key, kind, body, ifVersion, createOnly } = opts;
  const bytes = Buffer.byteLength(body, 'utf8');
  if (bytes > DOC_MAX_BYTES) return { error: 'too_large' };

  return serializedWrite(async (tx): Promise<PutDocResult> => {
    const cur = await txGet<{ version: number; bytes: number }>(
      tx,
      `SELECT version, bytes FROM bilko_db_docs WHERE app = ? AND user_email = ? AND key = ?`,
      app, user, key,
    );
    const curVersion = cur ? Number(cur.version) : 0;
    if (createOnly && cur) return { error: 'version_mismatch', version: curVersion };
    if (ifVersion !== undefined && ifVersion !== curVersion) {
      return { error: 'version_mismatch', version: curVersion };
    }
    const used = await txUsedBytes(tx, user);
    if (used - (cur ? Number(cur.bytes) : 0) + bytes > USER_QUOTA_BYTES) {
      return { error: 'quota_exceeded' };
    }
    const version = curVersion + 1;
    const updatedAt = Date.now();
    await txRun(
      tx,
      `INSERT INTO bilko_db_docs (app, user_email, key, kind, body, bytes, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(app, user_email, key) DO UPDATE
       SET kind = excluded.kind,
           body = excluded.body,
           bytes = excluded.bytes,
           version = excluded.version,
           updated_at = excluded.updated_at`,
      app, user, key, kind, body, bytes, version, updatedAt,
    );
    return { key, kind, version, bytes, updatedAt };
  });
}

export async function getDoc(opts: { app: string; user: string; key: string }): Promise<Doc | null> {
  const row = await dbGet<DocRow>(
    `SELECT key, kind, body, bytes, version, updated_at FROM bilko_db_docs
     WHERE app = ? AND user_email = ? AND key = ?`,
    opts.app, opts.user, opts.key,
  );
  if (!row) return null;
  return { ...toMeta(row), body: String(row.body) };
}

/** Metadata for a user's docs in one app, sorted by key; `prefix` matches literally. */
export async function listDocs(opts: { app: string; user: string; prefix?: string }): Promise<DocMeta[]> {
  const prefix = opts.prefix ?? '';
  const rows = await dbAll<Omit<DocRow, 'body'>>(
    `SELECT key, kind, bytes, version, updated_at FROM bilko_db_docs
     WHERE app = ? AND user_email = ? AND substr(key, 1, length(?)) = ?
     ORDER BY key`,
    opts.app, opts.user, prefix, prefix,
  );
  return rows.map(toMeta);
}

export async function deleteDoc(opts: {
  app: string;
  user: string;
  key: string;
  ifVersion?: number;
}): Promise<DeleteDocResult> {
  const { app, user, key, ifVersion } = opts;
  return serializedWrite(async (tx): Promise<DeleteDocResult> => {
    if (ifVersion !== undefined) {
      const cur = await txGet<{ version: number }>(
        tx,
        `SELECT version FROM bilko_db_docs WHERE app = ? AND user_email = ? AND key = ?`,
        app, user, key,
      );
      const curVersion = cur ? Number(cur.version) : 0;
      if (curVersion !== ifVersion) return { error: 'version_mismatch', version: curVersion };
    }
    const r = await txRun(
      tx,
      `DELETE FROM bilko_db_docs WHERE app = ? AND user_email = ? AND key = ?`,
      app, user, key,
    );
    return { deleted: r.changes > 0 };
  });
}

// ---------------------------------------------------------------------------------------
// Image store
// ---------------------------------------------------------------------------------------

export const IMAGE_MAX_BYTES = 10_485_760;
export const IMAGE_CHUNK_BYTES = 1_048_576;

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

export function isImageType(s: unknown): s is ImageType {
  return typeof s === 'string' && (IMAGE_TYPES as readonly string[]).includes(s);
}

export interface ImageMeta {
  id: string;
  type: ImageType;
  bytes: number;
  createdAt: number;
}

export interface StoredImage {
  app: string;
  user: string;
  type: ImageType;
  bytes: Buffer;
}

export type PutImageResult =
  | ImageMeta
  | { error: 'bad_image' }
  | { error: 'too_large' }
  | { error: 'quota_exceeded' };

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function magicMatches(type: ImageType, b: Buffer): boolean {
  switch (type) {
    case 'image/png':
      return b.length >= 8 && b.subarray(0, 8).equals(PNG_SIG);
    case 'image/jpeg':
      return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/webp':
      return b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP';
    case 'image/gif': {
      const sig = b.toString('latin1', 0, 6);
      return b.length >= 6 && (sig === 'GIF87a' || sig === 'GIF89a');
    }
  }
}

// JPEG: walk the marker segments from SOI and drop every APP1 (Exif, XMP) before SOS.
// Everything from SOS on (entropy-coded data, RSTn, EOI, trailers) is copied verbatim.
// Returns null when the segment structure cannot be walked.
function stripJpeg(b: Buffer): Buffer | null {
  const parts: Buffer[] = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    // Fill bytes (0xFF padding) before a marker carry no data.
    let j = i;
    while (j < b.length && b[j] === 0xff) j++;
    if (j >= b.length) return null;
    const marker = b[j]!;
    const markerStart = j - 1;
    if (marker === 0x00) return null;
    if (marker === 0xd9) {
      parts.push(b.subarray(markerStart));
      return Buffer.concat(parts);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(b.subarray(markerStart, j + 1));
      i = j + 1;
      continue;
    }
    if (j + 3 > b.length) return null;
    const len = b.readUInt16BE(j + 1);
    if (len < 2) return null;
    const end = j + 1 + len;
    if (end > b.length) return null;
    if (marker === 0xda) {
      parts.push(b.subarray(markerStart));
      return Buffer.concat(parts);
    }
    if (marker !== 0xe1) parts.push(b.subarray(markerStart, end));
    i = end;
  }
  return null;
}

// PNG: walk the chunks after the signature and drop eXIf chunks. Kept chunks (and their
// CRCs) are copied byte for byte; bytes after IEND are dropped. Returns null when the chunk
// structure is truncated or lacks IEND.
function stripPng(b: Buffer): Buffer | null {
  const parts: Buffer[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = b.readUInt32BE(i);
    const end = i + 12 + len;
    if (end > b.length) return null;
    const type = b.toString('latin1', i + 4, i + 8);
    if (type !== 'eXIf') parts.push(b.subarray(i, end));
    if (type === 'IEND') return Buffer.concat(parts);
    i = end;
  }
  return null;
}

/**
 * Removes location and camera metadata: JPEG APP1 segments (Exif, XMP) and PNG eXIf chunks.
 * WebP and GIF are returned unchanged. Returns null when the bytes are not a walkable image
 * of `type`.
 */
export function stripImageMetadata(type: ImageType, bytes: Buffer): Buffer | null {
  if (!magicMatches(type, bytes)) return null;
  if (type === 'image/jpeg') return stripJpeg(bytes);
  if (type === 'image/png') return stripPng(bytes);
  return bytes;
}

function toBuffer(raw: unknown): Buffer {
  if (raw instanceof ArrayBuffer) return Buffer.from(new Uint8Array(raw));
  const u = raw as Uint8Array;
  return Buffer.from(u.buffer, u.byteOffset, u.byteLength);
}

export async function putImage(opts: {
  app: string;
  user: string;
  bytes: Buffer;
  type: ImageType;
}): Promise<PutImageResult> {
  const { app, user, type } = opts;
  if (!isImageType(type) || !Buffer.isBuffer(opts.bytes)) return { error: 'bad_image' };
  const bytes = stripImageMetadata(type, opts.bytes);
  if (!bytes) return { error: 'bad_image' };
  if (bytes.length > IMAGE_MAX_BYTES) return { error: 'too_large' };

  return serializedWrite(async (tx): Promise<PutImageResult> => {
    const used = await txUsedBytes(tx, user);
    if (used + bytes.length > USER_QUOTA_BYTES) return { error: 'quota_exceeded' };
    const id = randomBytes(16).toString('base64url');
    const chunks = Math.max(1, Math.ceil(bytes.length / IMAGE_CHUNK_BYTES));
    for (let idx = 0; idx < chunks; idx++) {
      const part = bytes.subarray(idx * IMAGE_CHUNK_BYTES, (idx + 1) * IMAGE_CHUNK_BYTES);
      await txRun(tx, `INSERT INTO bilko_db_image_chunks (id, idx, content) VALUES (?, ?, ?)`, id, idx, part);
    }
    const createdAt = Date.now();
    // The image row goes last: it is what makes the image visible and counted.
    await txRun(
      tx,
      `INSERT INTO bilko_db_images (id, app, user_email, type, bytes, chunks, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id, app, user, type, bytes.length, chunks, createdAt,
    );
    return { id, type, bytes: bytes.length, createdAt };
  });
}

/** An image by id with its owner, or null. Ids are unguessable links; callers decide access. */
export async function getImage(id: string): Promise<StoredImage | null> {
  const row = await dbGet<{ app: string; user_email: string; type: ImageType; bytes: number; chunks: number }>(
    `SELECT app, user_email, type, bytes, chunks FROM bilko_db_images WHERE id = ?`,
    id,
  );
  if (!row) return null;
  const parts = await dbAll<{ idx: number; content: unknown }>(
    `SELECT idx, content FROM bilko_db_image_chunks WHERE id = ? ORDER BY idx`,
    id,
  );
  const content = Buffer.concat(
    parts
      .filter((p) => p.content != null)
      .sort((a, b) => Number(a.idx) - Number(b.idx))
      .map((p) => toBuffer(p.content)),
  );
  if (parts.length !== Number(row.chunks) || content.length !== Number(row.bytes)) {
    console.error(`[bilko-db] image ${id}: stored chunks (${content.length} bytes) do not match its row`);
    return null;
  }
  return { app: String(row.app), user: String(row.user_email), type: row.type, bytes: content };
}

/** Metadata for a user's images in one app, oldest first. */
export async function listImages(opts: { app: string; user: string }): Promise<ImageMeta[]> {
  const rows = await dbAll<{ id: string; type: ImageType; bytes: number; created_at: number }>(
    `SELECT id, type, bytes, created_at FROM bilko_db_images
     WHERE app = ? AND user_email = ? ORDER BY created_at, id`,
    opts.app, opts.user,
  );
  return rows.map((r) => ({ id: String(r.id), type: r.type, bytes: Number(r.bytes), createdAt: Number(r.created_at) }));
}

/** Deletes an image's row and chunks, only when `user` owns it in `app`. */
export async function deleteImage(opts: { app: string; user: string; id: string }): Promise<{ deleted: boolean }> {
  const { app, user, id } = opts;
  return serializedWrite(async (tx) => {
    const r = await txRun(
      tx,
      `DELETE FROM bilko_db_images WHERE id = ? AND app = ? AND user_email = ?`,
      id, app, user,
    );
    if (r.changes === 0) return { deleted: false };
    await txRun(tx, `DELETE FROM bilko_db_image_chunks WHERE id = ?`, id);
    return { deleted: true };
  });
}
