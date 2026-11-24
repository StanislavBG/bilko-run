// Bilko-DB document store: named JSON or text documents per signed-in user per app,
// versioned for safe concurrent writes, inside a per-user storage quota.
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
function serializedWrite<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const run = writeChain.then(() => dbTransaction(fn));
  writeChain = run.catch(() => undefined);
  return run;
}

const USED_BYTES_SQL = `SELECT COALESCE(SUM(bytes), 0) AS used FROM bilko_db_docs WHERE user_email = ?`;

/** Total stored bytes for a user across every app. */
export async function usedBytes(user: string): Promise<number> {
  const row = await dbGet<{ used: number }>(USED_BYTES_SQL, user);
  return Number(row?.used ?? 0);
}

async function txUsedBytes(tx: Transaction, user: string): Promise<number> {
  const row = await txGet<{ used: number }>(tx, USED_BYTES_SQL, user);
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
