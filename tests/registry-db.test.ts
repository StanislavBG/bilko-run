import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';
import { dbAll, dbGet, dbRun, initDb } from '../server/db.js';
import {
  listProjects, getProject, putProject, deleteProject, importRegistryFile,
  META_API_WRITTEN, META_IMPORT_SHA256,
} from '../server/services/registry-db.js';

const ACTOR = 'test-actor';

function entry(slug: string, name = slug.toUpperCase()) {
  return {
    slug,
    name,
    tagline: `${slug} tagline`,
    category: 'Test',
    status: 'live',
    year: 2026,
    host: { kind: 'static-path', path: `/projects/${slug}/` },
  };
}

type LogRow = { slug: string | null; action: string; before_json: string | null; after_json: string | null; actor: string; at: number };
const logRows = () => dbAll<LogRow>(`SELECT slug, action, before_json, after_json, actor, at FROM bilko_db_project_log ORDER BY id`);

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM bilko_db_projects');
  await dbRun('DELETE FROM bilko_db_project_log');
  await dbRun('DELETE FROM bilko_db_meta');
});

describe('schema', () => {
  const cols = async (t: string) => dbAll<{ name: string; pk: number; type: string }>(`PRAGMA table_info(${t})`);

  it('creates bilko_db_projects keyed by slug', async () => {
    const c = await cols('bilko_db_projects');
    expect(c.map((x) => x.name).sort()).toEqual(['entry_json', 'position', 'slug', 'updated_at', 'updated_by', 'version']);
    expect(c.filter((x) => Number(x.pk) > 0).map((x) => x.name)).toEqual(['slug']);
  });

  it('creates bilko_db_project_log with an autoincrement id', async () => {
    const c = await cols('bilko_db_project_log');
    expect(c.map((x) => x.name).sort()).toEqual(['action', 'actor', 'after_json', 'at', 'before_json', 'id', 'slug']);
    const sql = await dbGet<{ sql: string }>(`SELECT sql FROM sqlite_master WHERE name = 'bilko_db_project_log'`);
    expect(sql!.sql).toMatch(/id\s+INTEGER PRIMARY KEY AUTOINCREMENT/);
  });

  it('creates bilko_db_meta keyed by key', async () => {
    const c = await cols('bilko_db_meta');
    expect(c.map((x) => x.name).sort()).toEqual(['key', 'value']);
    expect(c.filter((x) => Number(x.pk) > 0).map((x) => x.name)).toEqual(['key']);
  });
});

describe('putProject / getProject / listProjects', () => {
  it('creates at version 1, appends new slugs last and lists in position order', async () => {
    const before = Date.now();
    for (const s of ['zeta', 'alpha', 'mid']) {
      const r = await putProject(entry(s), ACTOR);
      expect(r).toMatchObject({ version: 1, entry: { slug: s } });
    }
    expect((await listProjects()).map((p) => p.slug)).toEqual(['zeta', 'alpha', 'mid']);
    const row = await dbGet<{ position: number; updated_at: number; updated_by: string }>(
      `SELECT position, updated_at, updated_by FROM bilko_db_projects WHERE slug = 'mid'`,
    );
    expect(Number(row!.position)).toBe(2);
    expect(Number(row!.updated_at)).toBeGreaterThanOrEqual(before);
    expect(row!.updated_by).toBe(ACTOR);
  });

  it('updates in place: keeps the position and bumps the version', async () => {
    await putProject(entry('aa'), ACTOR);
    await putProject(entry('bb'), ACTOR);
    const r = await putProject(entry('aa', 'Renamed'), 'other');
    expect(r).toMatchObject({ version: 2, entry: { name: 'Renamed' } });
    expect((await listProjects()).map((p) => p.slug)).toEqual(['aa', 'bb']);
    expect(await getProject('aa')).toEqual({ entry: { ...entry('aa'), name: 'Renamed' }, version: 2 });
  });

  it('getProject returns null for an unknown slug', async () => {
    expect(await getProject('nope')).toBeNull();
  });

  it('rejects an invalid entry without writing anything', async () => {
    const r = await putProject({ ...entry('bad'), status: 'nope' }, ACTOR);
    expect(r).toMatchObject({ error: 'invalid_entry' });
    const banned = await putProject({ ...entry('bad2'), tagline: 'like ContentGrade' }, ACTOR);
    expect(banned).toMatchObject({ error: 'invalid_entry' });
    expect(await listProjects()).toEqual([]);
    expect(await logRows()).toEqual([]);
    expect(await dbGet(`SELECT value FROM bilko_db_meta WHERE key = ?`, META_API_WRITTEN)).toBeUndefined();
  });

  it('listProjects validates each stored entry with RegistryProjectSchema', async () => {
    await dbRun(
      `INSERT INTO bilko_db_projects (slug, position, entry_json, version, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)`,
      'xx', 0, JSON.stringify({ slug: 'xx' }), 1, 0, ACTOR,
    );
    await expect(listProjects()).rejects.toThrow();
  });
});

describe('compare-and-set', () => {
  it('putProject with the right ifVersion writes; a wrong one returns the current version and changes nothing', async () => {
    await putProject(entry('aa'), ACTOR);
    expect(await putProject(entry('aa', 'Two'), ACTOR, 1)).toMatchObject({ version: 2 });
    expect(await putProject(entry('aa', 'Stale'), ACTOR, 1)).toEqual({ error: 'version_mismatch', version: 2 });
    expect((await getProject('aa'))!.entry.name).toBe('Two');
    expect((await logRows()).length).toBe(2);
  });

  it('ifVersion 0 means create-only', async () => {
    expect(await putProject(entry('aa'), ACTOR, 0)).toMatchObject({ version: 1 });
    expect(await putProject(entry('aa'), ACTOR, 0)).toEqual({ error: 'version_mismatch', version: 1 });
    expect(await putProject(entry('new'), ACTOR, 3)).toEqual({ error: 'version_mismatch', version: 0 });
    expect(await getProject('new')).toBeNull();
  });

  it('deleteProject honours ifVersion', async () => {
    await putProject(entry('aa'), ACTOR);
    await putProject(entry('aa'), ACTOR);
    expect(await deleteProject('aa', ACTOR, 1)).toEqual({ error: 'version_mismatch', version: 2 });
    expect(await getProject('aa')).not.toBeNull();
    expect(await deleteProject('aa', ACTOR, 2)).toEqual({ deleted: true, version: 2 });
    expect(await getProject('aa')).toBeNull();
    expect(await deleteProject('aa', ACTOR)).toEqual({ error: 'not_found' });
  });
});

describe('audit log', () => {
  it('writes one row per put and delete with before/after JSON and the actor', async () => {
    await putProject(entry('aa'), 'alice');
    await putProject(entry('aa', 'Two'), 'bob');
    await deleteProject('aa', 'carol');
    const rows = await logRows();
    expect(rows.map((r) => [r.slug, r.action, r.actor])).toEqual([
      ['aa', 'put', 'alice'],
      ['aa', 'put', 'bob'],
      ['aa', 'delete', 'carol'],
    ]);
    expect(rows[0]!.before_json).toBeNull();
    expect(JSON.parse(rows[0]!.after_json!)).toEqual(entry('aa'));
    expect(JSON.parse(rows[1]!.before_json!)).toEqual(entry('aa'));
    expect(JSON.parse(rows[1]!.after_json!).name).toBe('Two');
    expect(JSON.parse(rows[2]!.before_json!).name).toBe('Two');
    expect(rows[2]!.after_json).toBeNull();
    for (const r of rows) expect(Number(r.at)).toBeGreaterThan(0);
  });
});

describe('importRegistryFile', () => {
  const realRaw = readFileSync(resolve(__dirname, '../src/data/standalone-projects.json'), 'utf8');
  const realSlugs = (JSON.parse(realRaw) as Array<{ slug: string }>).map((e) => e.slug);

  it('imports the real registry file in file order with one import log row', async () => {
    expect(await importRegistryFile(realRaw, ACTOR)).toBe('imported');
    expect((await listProjects()).map((p) => p.slug)).toEqual(realSlugs);
    const rows = await logRows();
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ slug: null, action: 'import', actor: ACTOR });
    expect(JSON.parse(rows[0]!.before_json!)).toEqual([]);
    expect((JSON.parse(rows[0]!.after_json!) as Array<{ slug: string }>).map((e) => e.slug)).toEqual(realSlugs);
    const hash = await dbGet<{ value: string }>(`SELECT value FROM bilko_db_meta WHERE key = ?`, META_IMPORT_SHA256);
    expect(hash!.value).toBe(createHash('sha256').update(realRaw).digest('hex'));
    // Import is not an API write.
    expect(await dbGet(`SELECT value FROM bilko_db_meta WHERE key = ?`, META_API_WRITTEN)).toBeUndefined();
  });

  it('returns unchanged when the file hash matches and writes nothing', async () => {
    await importRegistryFile(realRaw, ACTOR);
    expect(await importRegistryFile(realRaw, ACTOR)).toBe('unchanged');
    expect((await logRows()).length).toBe(1);
  });

  it('replaces all rows when the file changes, dropping removed slugs', async () => {
    await importRegistryFile(JSON.stringify([entry('aa'), entry('bb'), entry('cc')]), ACTOR);
    expect(await importRegistryFile(JSON.stringify([entry('cc'), entry('aa', 'New')]), ACTOR)).toBe('imported');
    expect((await listProjects()).map((p) => [p.slug, p.name])).toEqual([['cc', 'CC'], ['aa', 'New']]);
    expect(await getProject('bb')).toBeNull();
    expect((await getProject('aa'))!.version).toBe(2);
    const rows = await logRows();
    expect(rows.map((r) => r.action)).toEqual(['import', 'import']);
    expect((JSON.parse(rows[1]!.before_json!) as Array<{ slug: string }>).map((e) => e.slug)).toEqual(['aa', 'bb', 'cc']);
  });

  it('throws without changing anything on an invalid file', async () => {
    const good = JSON.stringify([entry('aa')]);
    await importRegistryFile(good, ACTOR);
    const snapshot = async () => ({
      rows: await dbAll(`SELECT * FROM bilko_db_projects ORDER BY slug`),
      log: await logRows(),
      meta: await dbAll(`SELECT * FROM bilko_db_meta ORDER BY key`),
    });
    const before = await snapshot();
    await expect(importRegistryFile('not json', ACTOR)).rejects.toThrow();
    await expect(importRegistryFile(JSON.stringify([entry('xx'), { slug: 'yy' }]), ACTOR)).rejects.toThrow();
    await expect(importRegistryFile(JSON.stringify([entry('xx'), entry('xx')]), ACTOR)).rejects.toThrow(/duplicate/);
    expect(await snapshot()).toEqual(before);
  });

  it('returns ignored for good once putProject has run', async () => {
    await importRegistryFile(JSON.stringify([entry('aa')]), ACTOR);
    await putProject(entry('bb'), ACTOR);
    expect(await importRegistryFile(JSON.stringify([entry('zz')]), ACTOR)).toBe('ignored');
    expect(await importRegistryFile(realRaw, ACTOR)).toBe('ignored');
    expect((await listProjects()).map((p) => p.slug)).toEqual(['aa', 'bb']);
    expect((await logRows()).map((r) => r.action)).toEqual(['import', 'put']);
  });

  it('returns ignored once deleteProject has run, even with nothing imported', async () => {
    await putProject(entry('aa'), ACTOR);
    await dbRun(`DELETE FROM bilko_db_meta`);
    await deleteProject('aa', ACTOR);
    expect(await importRegistryFile(realRaw, ACTOR)).toBe('ignored');
    expect(await listProjects()).toEqual([]);
  });
});
