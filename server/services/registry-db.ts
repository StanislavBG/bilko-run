// Bilko-DB project registry store: one schema-validated registry entry per project, a version
// per row for compare-and-set writes, and an audit log in place of git history.
// importRegistryFile is the one-way bridge from src/data/standalone-projects.json; it stops
// for good once putProject or deleteProject has ever run.
import { createHash } from 'crypto';
import type { Transaction } from '@libsql/client';
import { dbAll, dbGet, dbTransaction, txGet, txRun } from '../db.js';
import {
  RegistryProjectSchema,
  RegistrySchema,
  type RegistryProject,
} from '../../mcp-host-server/src/contract/registry.js';

export const META_IMPORT_SHA256 = 'registry_import_sha256';
export const META_API_WRITTEN = 'registry_api_written';

export type ProjectRecord = { entry: RegistryProject; version: number };
export type VersionMismatch = { error: 'version_mismatch'; version: number };
export type InvalidEntry = { error: 'invalid_entry'; issues: string[] };
export type NotFound = { error: 'not_found' };

type Row = { slug: string; position: number; entry_json: string; version: number };

function parseRow(row: Row): RegistryProject {
  return RegistryProjectSchema.parse(JSON.parse(row.entry_json));
}

export async function listProjects(): Promise<RegistryProject[]> {
  const rows = await dbAll<Row>(
    `SELECT slug, position, entry_json, version FROM bilko_db_projects ORDER BY position ASC, slug ASC`,
  );
  return rows.map(parseRow);
}

export async function getProject(slug: string): Promise<ProjectRecord | null> {
  const row = await dbGet<Row>(
    `SELECT slug, position, entry_json, version FROM bilko_db_projects WHERE slug = ?`,
    slug,
  );
  if (!row) return null;
  return { entry: parseRow(row), version: Number(row.version) };
}

async function writeLog(
  tx: Transaction,
  slug: string | null,
  action: 'put' | 'delete' | 'import',
  before: string | null,
  after: string | null,
  actor: string,
  at: number,
): Promise<void> {
  await txRun(
    tx,
    `INSERT INTO bilko_db_project_log (slug, action, before_json, after_json, actor, at) VALUES (?, ?, ?, ?, ?, ?)`,
    slug, action, before, after, actor, at,
  );
}

async function setMeta(tx: Transaction, key: string, value: string): Promise<void> {
  await txRun(
    tx,
    `INSERT INTO bilko_db_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key, value,
  );
}

function issuesOf(err: { issues: Array<{ path: (string | number)[]; message: string }> }): string[] {
  return err.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message));
}

/**
 * Create or replace one project entry. A new slug goes last. `ifVersion` is compare-and-set:
 * the current version must equal it (0 means "must not exist yet"); otherwise nothing changes
 * and the current version comes back.
 */
export async function putProject(
  entry: unknown,
  actor: string,
  ifVersion?: number,
): Promise<ProjectRecord | VersionMismatch | InvalidEntry> {
  // RegistrySchema adds the cross-field rules (banned terms, asset paths) to the entry shape.
  const parsed = RegistrySchema.safeParse([entry]);
  if (!parsed.success) {
    return { error: 'invalid_entry', issues: issuesOf(parsed.error) };
  }
  const next = parsed.data[0]!;
  const json = JSON.stringify(next);
  return dbTransaction(async (tx) => {
    const cur = await txGet<Row>(
      tx,
      `SELECT slug, position, entry_json, version FROM bilko_db_projects WHERE slug = ?`,
      next.slug,
    );
    const curVersion = cur ? Number(cur.version) : 0;
    if (ifVersion !== undefined && ifVersion !== curVersion) {
      return { error: 'version_mismatch' as const, version: curVersion };
    }
    const now = Date.now();
    const version = curVersion + 1;
    if (cur) {
      await txRun(
        tx,
        `UPDATE bilko_db_projects SET entry_json = ?, version = ?, updated_at = ?, updated_by = ? WHERE slug = ?`,
        json, version, now, actor, next.slug,
      );
    } else {
      const max = await txGet<{ m: number | null }>(tx, `SELECT MAX(position) AS m FROM bilko_db_projects`);
      const position = max?.m == null ? 0 : Number(max.m) + 1;
      await txRun(
        tx,
        `INSERT INTO bilko_db_projects (slug, position, entry_json, version, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)`,
        next.slug, position, json, version, now, actor,
      );
    }
    await writeLog(tx, next.slug, 'put', cur ? cur.entry_json : null, json, actor, now);
    await setMeta(tx, META_API_WRITTEN, '1');
    return { entry: next, version };
  });
}

/** Delete one project entry, with the same `ifVersion` compare-and-set as putProject. */
export async function deleteProject(
  slug: string,
  actor: string,
  ifVersion?: number,
): Promise<{ deleted: true; version: number } | VersionMismatch | NotFound> {
  return dbTransaction(async (tx) => {
    const cur = await txGet<Row>(
      tx,
      `SELECT slug, position, entry_json, version FROM bilko_db_projects WHERE slug = ?`,
      slug,
    );
    const curVersion = cur ? Number(cur.version) : 0;
    if (ifVersion !== undefined && ifVersion !== curVersion) {
      return { error: 'version_mismatch' as const, version: curVersion };
    }
    if (!cur) return { error: 'not_found' as const };
    const now = Date.now();
    await txRun(tx, `DELETE FROM bilko_db_projects WHERE slug = ?`, slug);
    await writeLog(tx, slug, 'delete', cur.entry_json, null, actor, now);
    await setMeta(tx, META_API_WRITTEN, '1');
    return { deleted: true as const, version: curVersion };
  });
}

/**
 * One-way import of the registry file's raw text. Replaces every row with the file's entries in
 * file order and logs one 'import' row. Returns 'ignored' once the API has written anything,
 * 'unchanged' when the file's sha256 matches the last import, and throws (changing nothing) on
 * an invalid file.
 */
export async function importRegistryFile(
  raw: string,
  actor: string,
): Promise<'imported' | 'unchanged' | 'ignored'> {
  const hash = createHash('sha256').update(raw).digest('hex');
  return dbTransaction(async (tx) => {
    const written = await txGet<{ value: string }>(tx, `SELECT value FROM bilko_db_meta WHERE key = ?`, META_API_WRITTEN);
    if (written) return 'ignored' as const;
    const stored = await txGet<{ value: string }>(tx, `SELECT value FROM bilko_db_meta WHERE key = ?`, META_IMPORT_SHA256);
    if (stored?.value === hash) return 'unchanged' as const;

    const entries = RegistrySchema.parse(JSON.parse(raw));

    const before = await tx.execute({
      sql: `SELECT entry_json FROM bilko_db_projects ORDER BY position ASC, slug ASC`,
      args: [],
    });
    const beforeJson = `[${before.rows.map((r) => String(r.entry_json)).join(',')}]`;
    const prevVersions = new Map<string, number>();
    const versions = await tx.execute({ sql: `SELECT slug, version FROM bilko_db_projects`, args: [] });
    for (const r of versions.rows) prevVersions.set(String(r.slug), Number(r.version));

    const now = Date.now();
    await txRun(tx, `DELETE FROM bilko_db_projects`);
    for (const [position, entry] of entries.entries()) {
      // Keep versions monotonic across re-imports so a stale ifVersion never matches.
      const version = (prevVersions.get(entry.slug) ?? 0) + 1;
      await txRun(
        tx,
        `INSERT INTO bilko_db_projects (slug, position, entry_json, version, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)`,
        entry.slug, position, JSON.stringify(entry), version, now, actor,
      );
    }
    await writeLog(tx, null, 'import', beforeJson, JSON.stringify(entries), actor, now);
    await setMeta(tx, META_IMPORT_SHA256, hash);
    return 'imported' as const;
  });
}
