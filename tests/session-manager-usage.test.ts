import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun } from '../server/db.js';
import { registerSessionManagerUsageRoutes } from '../server/routes/admin-session-manager-usage.js';

const ADMIN_EMAIL = 'bilkobibitkov2000@gmail.com';
const APP = 'session-manager';

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return {
    ...original,
    requireAdmin: vi.fn().mockImplementation(async (_req: any, reply: any) => {
      reply.status(403).send({ error: 'Admin access required.' });
      return null;
    }),
  };
});

import { requireAdmin } from '../server/clerk.js';
const mockAdmin = requireAdmin as ReturnType<typeof vi.fn>;

function asAdmin() {
  mockAdmin.mockImplementation(async () => ADMIN_EMAIL);
}

const app = Fastify({ logger: false });
registerSessionManagerUsageRoutes(app);

const now = Math.floor(Date.now() / 1000);

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM app_installs');
  await dbRun('DELETE FROM app_errors');
  await dbRun('DELETE FROM app_logs');
  await dbRun('DELETE FROM funnel_events');
  mockAdmin.mockImplementation(async (_req: any, reply: any) => {
    reply.status(403).send({ error: 'Admin access required.' });
    return null;
  });
});

function get(url = '/api/admin/session-manager/usage', headers: Record<string, string> = {}) {
  return app.inject({ method: 'GET', url, headers });
}

async function addInstall(id: string, o: Partial<{
  version: string; platform: string; arch: string;
  cpu: number; mem: number; first: number; last: number;
}> = {}) {
  await dbRun(
    `INSERT INTO app_installs (install_id, app, app_version, platform, arch, cpu_count,
       total_mem_mb, first_seen_at, last_seen_at, seen_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    id, APP, o.version ?? '0.81.0', o.platform ?? 'linux', o.arch ?? 'x64',
    o.cpu ?? 8, o.mem ?? 16_384, o.first ?? now - 86_400, o.last ?? now - 3_600,
  );
}

async function addError(o: {
  name: string; stack: string; visitor: string;
  version?: string; created?: number; context?: string; ua?: string;
}) {
  await dbRun(
    `INSERT INTO app_errors (app, version, name, msg, stack, ua, visitor_id, context_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    APP, o.version ?? '0.81.0', o.name, `${o.name} happened`, o.stack,
    o.ua ?? null, o.visitor, o.context ?? '{}', o.created ?? now - 600,
  );
}

describe('GET /api/admin/session-manager/usage', () => {
  it('accepts the read tokens headlessly and refuses everything else', async () => {
    vi.stubEnv('SM_USAGE_READ_TOKEN', 'sm-read-secret');
    vi.stubEnv('PROJECT_SNAPSHOT_TOKEN', 'snapshot-secret');
    try {
      const url = '/api/admin/session-manager/usage?days=30';
      for (const tok of ['sm-read-secret', 'snapshot-secret']) {
        const res = await get(url, { authorization: `Bearer ${tok}` });
        expect(res.statusCode).toBe(200);
        expect(res.json().windowDays).toBe(30);
      }
      for (const authorization of ['Bearer sm-read-secreT', 'Bearer sm-read-secret-x', 'Bearer ']) {
        expect((await get(url, { authorization })).statusCode).toBe(403);
      }
      expect((await get(url)).statusCode).toBe(403);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('requires admin', async () => {
    const res = await get();
    expect(res.statusCode).toBe(403);
  });

  it('returns a fully-shaped response with zeros when there is no data', async () => {
    asAdmin();
    const res = await get();
    expect(res.statusCode).toBe(200);
    const b = res.json();

    expect(typeof b.generatedAt).toBe('number');
    expect(b.windowDays).toBe(30);
    expect(b.installs).toEqual({
      total: 0, active7: 0, active30: 0, new7: 0,
      byVersion: [], byPlatform: [],
      specs: { medianTotalMemMb: 0, medianCpuCount: 0 },
    });
    expect(b.usage).toEqual({ daily: [], byVersion: [] });
    expect(b.issues).toEqual([]);
    expect(b.errors).toEqual({ byVersion: [], daily: [] });
  });

  it('clamps days to 1..90 and defaults to 30', async () => {
    asAdmin();
    expect((await get('/api/admin/session-manager/usage?days=99999')).json().windowDays).toBe(90);
    expect((await get('/api/admin/session-manager/usage?days=0')).json().windowDays).toBe(1);
    expect((await get('/api/admin/session-manager/usage?days=-5')).json().windowDays).toBe(1);
    expect((await get('/api/admin/session-manager/usage?days=banana')).json().windowDays).toBe(30);
    expect((await get('/api/admin/session-manager/usage?days=7')).json().windowDays).toBe(7);
  });

  it('aggregates installs by version, platform and spec medians', async () => {
    asAdmin();
    await addInstall('i1', { version: '0.81.0', cpu: 4, mem: 8_192 });
    await addInstall('i2', { version: '0.81.0', cpu: 8, mem: 16_384 });
    await addInstall('i3', {
      version: '0.80.0', platform: 'darwin', arch: 'arm64',
      cpu: 12, mem: 32_768, first: now - 40 * 86_400, last: now - 40 * 86_400,
    });

    const b = (await get()).json();
    expect(b.installs.total).toBe(3);
    expect(b.installs.active7).toBe(2);   // i3 last seen 40d ago
    expect(b.installs.active30).toBe(2);
    expect(b.installs.new7).toBe(2);      // i3 first seen 40d ago

    expect(b.installs.byVersion).toEqual([
      { version: '0.81.0', installs: 2, active7: 2 },
      { version: '0.80.0', installs: 1, active7: 0 },
    ]);
    expect(b.installs.byPlatform).toEqual([
      { platform: 'linux', arch: 'x64', installs: 2 },
      { platform: 'darwin', arch: 'arm64', installs: 1 },
    ]);
    expect(b.installs.specs).toEqual({ medianTotalMemMb: 16_384, medianCpuCount: 8 });
  });

  // The load-bearing design decision: one machine in a crash loop must not
  // outrank a bug hitting many separate installs.
  it('ranks issues by installs affected, not raw occurrences', async () => {
    asAdmin();
    for (let i = 0; i < 200; i++) {
      await addError({ name: 'crash.oom', stack: 'at renderer', visitor: 'loop-machine' });
    }
    for (const v of ['a', 'b', 'c']) {
      await addError({ name: 'TypeError', stack: 'at foo', visitor: v });
    }

    const { issues } = (await get()).json();
    expect(issues).toHaveLength(2);
    expect(issues[0].name).toBe('TypeError');
    expect(issues[0].installsAffected).toBe(3);
    expect(issues[0].occurrences).toBe(3);
    expect(issues[1].name).toBe('crash.oom');
    expect(issues[1].installsAffected).toBe(1);
    expect(issues[1].occurrences).toBe(200);  // raw count kept as context
  });

  it('collects versions and resolves topPlatform from the context stamp', async () => {
    asAdmin();
    await addError({
      name: 'TypeError', stack: 'at foo', visitor: 'a',
      version: '0.81.0', context: JSON.stringify({ platform: 'darwin' }),
    });
    await addError({
      name: 'TypeError', stack: 'at foo', visitor: 'b',
      version: '0.80.0', context: JSON.stringify({ platform: 'darwin' }),
    });

    const { issues } = (await get()).json();
    expect(issues[0].versions).toEqual(['0.80.0', '0.81.0']);
    expect(issues[0].topPlatform).toBe('darwin');
    expect(issues[0].firstSeen).toBeGreaterThan(0);
    expect(issues[0].lastSeen).toBeGreaterThanOrEqual(issues[0].firstSeen);
  });

  it('falls back to the app_installs join when a row has no platform stamp', async () => {
    asAdmin();
    await addInstall('win-box', { platform: 'win32' });
    await addError({ name: 'RangeError', stack: 'at bar', visitor: 'win-box' });

    const { issues } = (await get()).json();
    expect(issues[0].topPlatform).toBe('win32');
  });

  it('normalizes a legacy UA string when neither stamp nor install row exists', async () => {
    asAdmin();
    await addError({
      name: 'LegacyError', stack: 'at baz', visitor: 'ghost',
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    });

    const { issues } = (await get()).json();
    expect(issues[0].topPlatform).toBe('darwin');
  });

  it('counts usage events per day and per version, oldest first', async () => {
    asAdmin();
    const ins = (event: string, visitor: string, version: string) => dbRun(
      `INSERT INTO funnel_events (event, tool, metadata, visitor_id, version)
       VALUES (?, ?, ?, ?, ?)`,
      event, APP, JSON.stringify({ appVersion: version }), visitor, version,
    );
    await ins('app.launch', 'i1', '0.81.0');
    await ins('app.launch', 'i2', '0.81.0');
    await ins('session.open', 'i1', '0.81.0');
    await ins('epic.create', 'i1', '0.80.0');
    await ins('unrelated.event', 'i1', '0.81.0');

    const { usage } = (await get()).json();
    expect(usage.daily).toHaveLength(1);
    expect(usage.daily[0]).toMatchObject({
      launches: 2, sessions: 1, epics: 1, installsSeen: 2,
    });
    expect(usage.daily[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const v81 = usage.byVersion.find((r: any) => r.version === '0.81.0');
    expect(v81).toEqual({ version: '0.81.0', launches: 2, sessions: 1 });
  });

  it('reads the version column but falls back to the metadata blob for legacy rows', async () => {
    asAdmin();
    // Row written before funnel_events.version existed: version column is NULL.
    await dbRun(
      `INSERT INTO funnel_events (event, tool, metadata, visitor_id) VALUES (?, ?, ?, ?)`,
      'app.launch', APP, JSON.stringify({ appVersion: '0.79.0' }), 'legacy',
    );

    const { usage } = (await get()).json();
    expect(usage.byVersion).toEqual([{ version: '0.79.0', launches: 1, sessions: 0 }]);
  });

  it('ignores other apps entirely', async () => {
    asAdmin();
    await dbRun(
      `INSERT INTO app_errors (app, version, name, msg, stack, visitor_id, context_json, created_at)
       VALUES ('some-other-app', '1.0.0', 'Nope', 'nope', 'at x', 'v', '{}', ?)`,
      now - 600,
    );
    await dbRun(
      `INSERT INTO funnel_events (event, tool, visitor_id) VALUES ('app.launch', 'some-other-app', 'v')`,
    );

    const b = (await get()).json();
    expect(b.issues).toEqual([]);
    expect(b.usage.daily).toEqual([]);
  });

  it('excludes data outside the requested window', async () => {
    asAdmin();
    await addError({ name: 'OldError', stack: 'at old', visitor: 'a', created: now - 60 * 86_400 });
    await addError({ name: 'NewError', stack: 'at new', visitor: 'a', created: now - 600 });

    const names = (await get('/api/admin/session-manager/usage?days=7')).json()
      .issues.map((i: any) => i.name);
    expect(names).toEqual(['NewError']);
  });

  it('aggregates warn/error log counts by version and by day', async () => {
    asAdmin();
    const log = (level: string, version: string, visitor: string) => dbRun(
      `INSERT INTO app_logs (app, version, level, msg, visitor_id, created_at)
       VALUES (?, ?, ?, 'm', ?, ?)`,
      APP, version, level, visitor, now - 600,
    );
    await log('error', '0.81.0', 'a');
    await log('error', '0.81.0', 'b');
    await log('warn', '0.81.0', 'a');
    await log('info', '0.81.0', 'a');  // must not be counted

    const { errors } = (await get()).json();
    expect(errors.byVersion).toEqual([
      { version: '0.81.0', errors: 2, warns: 1, installsAffected: 2 },
    ]);
    expect(errors.daily).toHaveLength(1);
    expect(errors.daily[0]).toMatchObject({ errors: 2, warns: 1 });
  });

  it('excludes test/dev rows by default and honours ?env=', async () => {
    asAdmin();
    const inst = (id: string, env: string | null) => dbRun(
      `INSERT INTO app_installs (install_id, app, app_version, platform, arch, cpu_count,
         total_mem_mb, first_seen_at, last_seen_at, seen_count, env)
       VALUES (?, ?, '0.81.0', 'linux', 'x64', 8, 16384, ?, ?, 1, ?)`,
      id, APP, now - 86_400, now - 3_600, env,
    );
    await inst('p1', 'prod');
    await inst('t1', 'test');
    await inst('legacy', null);
    await dbRun(
      `INSERT INTO app_errors (app, version, name, msg, stack, visitor_id, context_json, created_at, env)
       VALUES (?, '0.81.0', 'TestOnly', 'm', 'at t', 't1', '{}', ?, 'test')`,
      APP, now - 600,
    );
    for (const env of ['test', 'prod']) {
      await dbRun(
        `INSERT INTO funnel_events (event, tool, visitor_id, env) VALUES ('epic.create', ?, 'p1', ?)`,
        APP, env,
      );
    }

    const def = (await get()).json();
    expect(def.env).toBe('prod');
    expect(def.installs.total).toBe(2);
    expect(def.issues).toEqual([]);
    expect(def.usage.daily.reduce((n: number, d: any) => n + d.epics, 0)).toBe(1);

    const test = (await get('/api/admin/session-manager/usage?env=test')).json();
    expect(test.env).toBe('test');
    expect(test.installs.total).toBe(1);
    expect(test.issues.map((i: any) => i.name)).toEqual(['TestOnly']);

    const all = (await get('/api/admin/session-manager/usage?env=all')).json();
    expect(all.env).toBe('all');
    expect(all.installs.total).toBe(3);
  });

  it('drops Electron-version, 0.0.0-* and empty-version installs unless ?includeTest=1', async () => {
    asAdmin();
    await addInstall('real', { version: '0.119.1' });
    await addInstall('e2e', { version: '42.11.10' });
    await addInstall('stub', { version: '0.0.0-stub' });
    await addInstall('probe', { version: '0.0.0-probe' });
    await addInstall('blank', { version: '' });
    // Legacy error row with no version: attributed via the install it came from.
    await dbRun(
      `INSERT INTO app_errors (app, version, name, msg, stack, visitor_id, context_json, created_at)
       VALUES (?, NULL, 'E2eOnly', 'm', 'at e2e', 'e2e', '{}', ?)`,
      APP, now - 600,
    );
    await addError({ name: 'RealError', stack: 'at real', visitor: 'real', version: '0.119.1' });
    await addError({ name: 'StubError', stack: 'at stub', visitor: 'nobody', version: '0.0.0-stub' });
    await dbRun(
      `INSERT INTO funnel_events (event, tool, visitor_id, version) VALUES ('app.launch', ?, 'e2e', '42.11.10')`,
      APP,
    );
    await dbRun(
      `INSERT INTO funnel_events (event, tool, visitor_id, version) VALUES ('app.launch', ?, 'real', '0.119.1')`,
      APP,
    );
    await dbRun(
      `INSERT INTO app_logs (app, version, level, msg, visitor_id, created_at)
       VALUES (?, '42.11.10', 'error', 'm', 'e2e', ?)`,
      APP, now - 600,
    );

    const def = (await get()).json();
    expect(def.includeTest).toBe(false);
    expect(def.installs.total).toBe(1);
    expect(def.installs.byVersion.map((r: any) => r.version)).toEqual(['0.119.1']);
    expect(def.issues.map((i: any) => i.name)).toEqual(['RealError']);
    expect(def.usage.daily[0].launches).toBe(1);
    expect(def.errors.byVersion).toEqual([]);
    expect(def.perInstall).toHaveLength(1);

    const all = (await get('/api/admin/session-manager/usage?includeTest=1')).json();
    expect(all.includeTest).toBe(true);
    expect(all.installs.total).toBe(5);
    expect(all.issues.map((i: any) => i.name).sort()).toEqual(['E2eOnly', 'RealError', 'StubError']);
    expect(all.usage.daily[0].launches).toBe(2);
    expect(all.errors.byVersion).toHaveLength(1);
  });

  it('?excludeInstall= and exclude_self drop those installs from every section', async () => {
    asAdmin();
    const owner = '9c6b8ecd-b3da-400d-b795-0c0c32504731';
    for (const id of ['keep', 'drop1', 'drop2', owner]) {
      await addInstall(id);
      await addError({ name: `Err-${id}`, stack: `at ${id}`, visitor: id });
      await dbRun(`INSERT INTO funnel_events (event, tool, visitor_id) VALUES ('app.launch', ?, ?)`, APP, id);
      await dbRun(
        `INSERT INTO app_logs (app, version, level, msg, visitor_id, created_at)
         VALUES (?, '0.81.0', 'error', 'm', ?, ?)`,
        APP, id, now - 600,
      );
    }

    // Owner is excluded by default (exclude_self defaults on).
    const def = (await get()).json();
    expect(def.excludeSelf).toBe(true);
    expect(def.installs.total).toBe(3);

    const b = (await get('/api/admin/session-manager/usage?excludeInstall=drop1,drop2,bad%20id')).json();
    expect(b.installs.total).toBe(1);
    expect(b.issues.map((i: any) => i.name)).toEqual(['Err-keep']);
    expect(b.usage.daily[0]).toMatchObject({ launches: 1, installsSeen: 1 });
    expect(b.errors.byVersion[0]).toMatchObject({ errors: 1, installsAffected: 1 });
    expect(b.perInstall.map((r: any) => r.id)).toEqual(['keep']);

    const withSelf = (await get('/api/admin/session-manager/usage?exclude_self=0')).json();
    expect(withSelf.excludeSelf).toBe(false);
    expect(withSelf.installs.total).toBe(4);
  });

  it('returns perInstall rows with an 8-char prefix and 7d vs prior-7d counts', async () => {
    asAdmin();
    const id = 'f5adeb4a-1111-2222-3333-444455556666';
    await addInstall(id, { version: '0.117.0', platform: 'darwin', arch: 'arm64', first: now - 20 * 86_400 });
    const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const ev = (event: string, ago: number) => dbRun(
      `INSERT INTO funnel_events (event, tool, visitor_id, version, created_at) VALUES (?, ?, ?, '0.117.0', ?)`,
      event, APP, id, iso(now - ago),
    );
    await ev('app.launch', 3_600);
    await ev('app.launch', 2 * 86_400);
    await ev('session.open', 3_600);
    await ev('app.launch', 10 * 86_400);
    await ev('epic.create', 10 * 86_400);
    await ev('app.launch', 20 * 86_400);  // outside both windows
    await addError({ name: 'A', stack: 'at a', visitor: id, version: '0.117.0', created: now - 600 });
    await addError({ name: 'B', stack: 'at b', visitor: id, version: '0.117.0', created: now - 9 * 86_400 });

    const res = await get();
    const { perInstall } = res.json();
    expect(perInstall).toEqual([{
      id: 'f5adeb4a',
      version: '0.117.0',
      platform: 'darwin',
      arch: 'arm64',
      firstSeen: now - 20 * 86_400,
      lastSeen: now - 3_600,
      last7: { launches: 2, sessions: 1, epics: 0, errors: 1 },
      prev7: { launches: 1, sessions: 0, epics: 1, errors: 1 },
    }]);
    expect(res.payload).not.toContain(id);
  });

  it('returns no field that could carry PII', async () => {
    asAdmin();
    await addInstall('i1');
    await addError({ name: 'TypeError', stack: 'at foo', visitor: 'i1' });

    const raw = (await get()).payload;
    expect(raw).not.toMatch(/email|username|hostname/i);
  });
});
