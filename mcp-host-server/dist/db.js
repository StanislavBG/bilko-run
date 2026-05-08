import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
// Layout after compile: mcp-host-server/dist/db.js → ../../ = repo root
const HOST_ROOT = resolve(__dirname, '..', '..');
let _db = null;
export function getHostDb() {
    if (!_db) {
        const url = process.env.TURSO_DATABASE_URL;
        if (url) {
            _db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
        }
        else {
            const dataDir = resolve(HOST_ROOT, 'data');
            mkdirSync(dataDir, { recursive: true });
            _db = createClient({ url: `file:${resolve(dataDir, 'contentgrade.db')}` });
        }
    }
    return _db;
}
export async function mcpGet(sql, args = []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await getHostDb().execute({ sql, args: args });
    return result.rows.length === 0 ? undefined : result.rows[0];
}
export async function mcpRun(sql, args = []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getHostDb().execute({ sql, args: args });
}
export async function ensureGateTables() {
    const db = getHostDb();
    await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS app_budgets (
      slug              TEXT PRIMARY KEY,
      max_size_gz_bytes INTEGER NOT NULL,
      updated_at        INTEGER NOT NULL
    )`,
        args: [],
    });
    await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS publish_overrides (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      slug         TEXT NOT NULL,
      gate         TEXT NOT NULL,
      reason       TEXT,
      admin_email  TEXT,
      created_at   INTEGER NOT NULL
    )`,
        args: [],
    });
    await db.execute({
        sql: `CREATE INDEX IF NOT EXISTS idx_publish_overrides_slug ON publish_overrides (slug, created_at DESC)`,
        args: [],
    });
}
