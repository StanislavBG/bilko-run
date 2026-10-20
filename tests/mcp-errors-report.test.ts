import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type Mod = typeof import('../mcp-host-server/src/errors-report.js');

let mod: Mod;
let dir: string;
const now = Math.floor(Date.now() / 1000);
const DAY = 86400;

describe('mcp errors-report', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'errrep-'));
    process.env.TURSO_DATABASE_URL = 'file:' + join(dir, 't.db');
    const { getHostDb } = await import('../mcp-host-server/src/db.js');
    const db = getHostDb();
    await db.execute(`CREATE TABLE app_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT, app TEXT NOT NULL, version TEXT, name TEXT,
      msg TEXT NOT NULL, stack TEXT, url TEXT, ua TEXT, visitor_id TEXT, session_id TEXT,
      context_json TEXT, created_at INTEGER NOT NULL, env TEXT)`);
    const ins = (app: string, version: string | null, name: string | null, msg: string,
      stack: string | null, ageSec: number, env: string | null, ctx: string | null = null) =>
      db.execute({
        sql: `INSERT INTO app_errors (app, version, name, msg, stack, url, ua, visitor_id, session_id, context_json, created_at, env)
              VALUES (?, ?, ?, ?, ?, ?, 'ua', 'v1', 's1', ?, ?, ?)`,
        args: [app, version, name, msg, stack, `https://x/${msg}`, ctx, now - ageSec, env],
      });
    await ins('alpha', '1.0', 'TypeError', 'a1', 'at foo', 100, null, '{"k":1}');
    await ins('alpha', '1.1', 'TypeError', 'a2', 'at foo', 50, 'prod', 'not json');
    await ins('alpha', null, 'RangeError', 'a3', 'at bar', 60, 'prod');
    await ins('beta', '2.0', null, 'b1', null, 70, 'prod');
    await ins('alpha', '1.0', 'TypeError', 'old', 'at foo', 10 * DAY, 'prod');
    await ins('alpha', '1.0', 'DevError', 'd1', 'at dev', 80, 'dev');
    mod = await import('../mcp-host-server/src/errors-report.js');
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('hostDbSource reports turso when TURSO_DATABASE_URL is set', async () => {
    const { hostDbSource } = await import('../mcp-host-server/src/db.js');
    expect(hostDbSource()).toBe('turso');
  });

  it('groups by app and signature with counts', async () => {
    const r = await mod.errorsReport({ days: 1 });
    expect(r.totals).toEqual({ errors: 4, groups: 3 });
    expect(r.byApp).toEqual([{ app: 'alpha', count: 3 }, { app: 'beta', count: 1 }]);
    const g = r.groups[0];
    expect(g).toMatchObject({ app: 'alpha', name: 'TypeError', count: 2, sampleUrl: 'https://x/a2' });
    expect(g.versions.sort()).toEqual(['1.0', '1.1']);
    expect(g.lastSeen).toBeGreaterThanOrEqual(g.firstSeen);
    expect(typeof g.sampleId).toBe('number');
    expect(r.groups.map((x) => x.app)).toContain('beta');
  });

  it('days window excludes old rows', async () => {
    const r = await mod.errorsReport({ days: 30 });
    expect(r.totals.errors).toBe(5);
    expect(r.groups[0].count).toBe(3);
  });

  it('env filtering', async () => {
    expect((await mod.errorsReport({ days: 1, env: 'dev' })).totals.errors).toBe(1);
    expect((await mod.errorsReport({ days: 1, env: 'all' })).totals.errors).toBe(5);
    expect((await mod.errorsReport({ days: 1, env: 'bogus' })).totals.errors).toBe(4);
    expect((await mod.errorsReport({ days: 1, env: 'prod' })).totals.errors).toBe(4);
  });

  it('caps groups at limit', async () => {
    const r = await mod.errorsReport({ days: 1, limit: 1 });
    expect(r.groups).toHaveLength(1);
    expect(r.totals.groups).toBe(3);
  });

  it('errorDetail returns full row, parsed context, and null for unknown', async () => {
    const r = await mod.errorsReport({ days: 1, app: 'alpha' });
    const ids = r.groups.map((g) => g.sampleId);
    const details = await Promise.all(ids.map((id) => mod.errorDetail(id)));
    const withCtx = details.find((d) => d?.msg === 'a2');
    expect(withCtx).toMatchObject({ app: 'alpha', visitor_id: 'v1', session_id: 's1', ua: 'ua', env: 'prod' });
    expect(withCtx?.context_json).toBe('not json');
    const first = await mod.errorDetail(1);
    expect(first?.context_json).toEqual({ k: 1 });
    expect(first?.env).toBeNull();
    expect(await mod.errorDetail(99999)).toBeNull();
  });

  it('treats malicious app value as data', async () => {
    const r = await mod.errorsReport({ days: 1, app: "x' OR 1=1 --" });
    expect(r.groups).toHaveLength(0);
    expect(r.totals).toEqual({ errors: 0, groups: 0 });
  });
});
