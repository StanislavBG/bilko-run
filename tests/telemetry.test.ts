import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbAll, dbRun } from '../server/db.js';
import { registerTelemetryRoutes, pruneTelemetry, pruneTelemetryScheduled } from '../server/routes/telemetry.js';

const app = Fastify({ trustProxy: true, logger: false });
registerTelemetryRoutes(app, { scheduledPrune: false });

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM app_logs');
  await dbRun('DELETE FROM app_errors');
  await dbRun('DELETE FROM app_installs');
});

function inject(method: 'POST', url: string, body: unknown, ip = '10.0.0.1') {
  return app.inject({
    method,
    url,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('Telemetry ingest — /api/telemetry/log', () => {
  it('happy path: batch of 3 writes 3 rows', async () => {
    const res = await inject('POST', '/api/telemetry/log', {
      batch: [
        { app: 'test-app', version: '1.0.0', level: 'info', msg: 'hello', ts: Date.now() },
        { app: 'test-app', version: '1.0.0', level: 'warn', msg: 'careful', ts: Date.now() },
        { app: 'test-app', version: '1.0.0', level: 'error', msg: 'oops', ts: Date.now() },
      ],
    });
    expect(res.statusCode).toBe(200);
    const rows = await dbAll('SELECT * FROM app_logs WHERE app = ?', 'test-app');
    expect(rows).toHaveLength(3);
  });

  it('invalid level is silently skipped', async () => {
    const res = await inject('POST', '/api/telemetry/log', {
      batch: [
        { app: 'test-app', version: '1.0.0', level: 'pwn', msg: 'hax', ts: Date.now() },
        { app: 'test-app', version: '1.0.0', level: 'info', msg: 'legit', ts: Date.now() },
      ],
    }, '10.0.0.2');
    expect(res.statusCode).toBe(200);
    const rows = await dbAll('SELECT * FROM app_logs WHERE app = ?', 'test-app');
    expect(rows).toHaveLength(1); // only the valid row
    expect((rows[0] as Record<string, unknown>).level).toBe('info');
  });
});

describe('Telemetry ingest — /api/telemetry/error', () => {
  it('stack longer than 16 KB is truncated', async () => {
    const longStack = 'x'.repeat(20_000); // 20 KB
    const res = await inject('POST', '/api/telemetry/error', {
      batch: [{
        app: 'test-app', version: '1.0.0', name: 'RangeError',
        msg: 'too long', stack: longStack, ts: Date.now(),
      }],
    }, '10.0.0.3');
    expect(res.statusCode).toBe(200);
    const rows = await dbAll<{ stack: string }>('SELECT stack FROM app_errors WHERE app = ?', 'test-app');
    expect(rows).toHaveLength(1);
    expect(rows[0].stack.length).toBe(16_000);
  });

  it('rate-limits excessive requests from same IP', async () => {
    // Error endpoint limit: 300/min per IP. Fire 301 to verify 429 fires.
    let saw429 = false;
    for (let i = 0; i < 302; i++) {
      const res = await inject('POST', '/api/telemetry/error', { batch: [] }, '10.0.0.99');
      if (res.statusCode === 429) { saw429 = true; break; }
    }
    expect(saw429).toBe(true);
  });
});

describe('Telemetry ingest — /api/telemetry/install', () => {
  const profile = {
    install_id: 'inst-aaa', app: 'session-manager', app_version: '0.81.0',
    platform: 'linux', os_release: '6.18.7', arch: 'x64', cpu_count: 16,
    total_mem_mb: 32_768, node_version: '22.3.0', electron_version: '31.0.0',
    install_channel: 'npx', locale: 'en-US', timezone: 'America/Los_Angeles',
  };

  it('creates a row on first post', async () => {
    const res = await inject('POST', '/api/telemetry/install', profile, '10.1.0.1');
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
    const rows = await dbAll<Record<string, unknown>>('SELECT * FROM app_installs');
    expect(rows).toHaveLength(1);
    expect(rows[0].app_version).toBe('0.81.0');
    expect(rows[0].seen_count).toBe(1);
    expect(rows[0].cpu_count).toBe(16);
  });

  it('upserts: preserves first_seen_at, bumps last_seen_at + seen_count, overwrites profile', async () => {
    await inject('POST', '/api/telemetry/install', profile, '10.1.0.2');
    const before = await dbAll<{ first_seen_at: number }>('SELECT first_seen_at FROM app_installs');
    // Backdate so the last_seen_at bump is observable at 1-second resolution.
    await dbRun('UPDATE app_installs SET first_seen_at = ?, last_seen_at = ?', 1000, 1000);

    await inject('POST', '/api/telemetry/install', { ...profile, app_version: '0.82.0' }, '10.1.0.2');

    const rows = await dbAll<Record<string, number | string>>('SELECT * FROM app_installs');
    expect(rows).toHaveLength(1);
    expect(rows[0].first_seen_at).toBe(1000);
    expect(rows[0].last_seen_at as number).toBeGreaterThan(1000);
    expect(rows[0].seen_count).toBe(2);
    expect(rows[0].app_version).toBe('0.82.0');
    expect(before).toHaveLength(1);
  });


  it('rejects a post with no install_id', async () => {
    const res = await inject('POST', '/api/telemetry/install', { app: 'session-manager' }, '10.1.0.4');
    expect(res.statusCode).toBe(400);
    expect(await dbAll('SELECT * FROM app_installs')).toHaveLength(0);
  });

  it('clamps oversized strings and non-numeric ints', async () => {
    await inject('POST', '/api/telemetry/install', {
      ...profile, install_id: 'x'.repeat(200), app_version: 'v'.repeat(100), cpu_count: 'lots',
    }, '10.1.0.5');
    const rows = await dbAll<{ install_id: string; app_version: string; cpu_count: number | null }>(
      'SELECT install_id, app_version, cpu_count FROM app_installs',
    );
    expect(rows[0].install_id.length).toBe(80);
    expect(rows[0].app_version.length).toBe(20);
    expect(rows[0].cpu_count).toBeNull();
  });

  it('rate-limits excessive requests from same IP', async () => {
    let saw429 = false;
    for (let i = 0; i < 62; i++) {
      const res = await inject('POST', '/api/telemetry/install', profile, '10.1.9.99');
      if (res.statusCode === 429) { saw429 = true; break; }
    }
    expect(saw429).toBe(true);
  });
});

describe('Telemetry ingest — /api/telemetry/install seeds', () => {
  const base = { app: 'session-manager', app_version: '0.120.0', platform: 'linux' };

  async function storedSeeds(installId: string): Promise<unknown> {
    const rows = await dbAll<{ seeds: string | null }>('SELECT seeds FROM app_installs WHERE install_id = ?', installId);
    expect(rows).toHaveLength(1);
    return rows[0].seeds === null ? null : JSON.parse(rows[0].seeds);
  }

  it('stores a valid seeds object, and a later post overwrites it like any profile field', async () => {
    const res = await inject('POST', '/api/telemetry/install', {
      ...base, install_id: 'seed-1', seeds: { 'dev-plugin': 'done', 'scheduler-mcp': 'failed' },
    }, '10.4.0.1');
    expect(res.statusCode).toBe(200);
    expect(await storedSeeds('seed-1')).toEqual({ 'dev-plugin': 'done', 'scheduler-mcp': 'failed' });

    await inject('POST', '/api/telemetry/install', {
      ...base, install_id: 'seed-1', seeds: { 'dev-plugin': 'done', 'scheduler-mcp': 'exhausted' },
    }, '10.4.0.1');
    expect(await storedSeeds('seed-1')).toEqual({ 'dev-plugin': 'done', 'scheduler-mcp': 'exhausted' });

    await inject('POST', '/api/telemetry/install', { ...base, install_id: 'seed-1' }, '10.4.0.1');
    expect(await storedSeeds('seed-1')).toBeNull();
  });

  it("keeps Session Manager's wire shape: camelCase steps, null where a status is unknown", async () => {
    await inject('POST', '/api/telemetry/install', {
      ...base, install_id: 'seed-2', seeds: { devPlugin: 'done', schedulerMcp: null, agentPersonas: 'pending' },
    }, '10.4.0.2');
    expect(await storedSeeds('seed-2')).toEqual({ devPlugin: 'done', agentPersonas: 'pending' });
  });

  it('stores NULL for null, missing, non-object or all-invalid seeds, and never 400s', async () => {
    const cases: Array<[string, unknown]> = [
      ['seed-null', null],
      ['seed-missing', undefined],
      ['seed-string', 'done'],
      ['seed-array', ['done']],
      ['seed-number', 42],
      ['seed-empty', {}],
      ['seed-invalid', { devPlugin: 'installed', schedulerMcp: 1, agentPersonas: { status: 'done' } }],
    ];
    for (const [installId, seeds] of cases) {
      const res = await inject('POST', '/api/telemetry/install', { ...base, install_id: installId, seeds }, '10.4.0.3');
      expect(res.statusCode).toBe(200);
      expect(await storedSeeds(installId)).toBeNull();
    }
  });

  it('drops invalid statuses and non-slug step names, clamps names to 60 chars, keeps at most 20 steps', async () => {
    await inject('POST', '/api/telemetry/install', {
      ...base,
      install_id: 'seed-3',
      seeds: {
        devPlugin: 'failed',
        schedulerMcp: 'DONE',
        'two words': 'done',
        'someone@example.com': 'done',
        ['x'.repeat(80)]: 'pending',
      },
    }, '10.4.0.4');
    expect(await storedSeeds('seed-3')).toEqual({ devPlugin: 'failed', ['x'.repeat(60)]: 'pending' });

    const many = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`step-${i}`, 'done']));
    await inject('POST', '/api/telemetry/install', { ...base, install_id: 'seed-4', seeds: many }, '10.4.0.4');
    expect(await storedSeeds('seed-4')).toEqual(Object.fromEntries(Object.entries(many).slice(0, 20)));
  });
});

describe('Telemetry retention — pruneTelemetry()', () => {
  it('drops rows past the age cap and keeps recent ones', async () => {
    const now = Math.floor(Date.now() / 1000);
    await dbRun(
      `INSERT INTO app_logs (app, version, level, msg, created_at) VALUES ('old-app','1','info','ancient',?)`,
      now - 31 * 86_400,
    );
    await dbRun(
      `INSERT INTO app_logs (app, version, level, msg, created_at) VALUES ('old-app','1','info','fresh',?)`,
      now,
    );
    await dbRun(
      `INSERT INTO app_errors (app, msg, created_at) VALUES ('old-app','ancient',?)`,
      now - 91 * 86_400,
    );
    await dbRun(`INSERT INTO app_errors (app, msg, created_at) VALUES ('old-app','fresh',?)`, now);

    await pruneTelemetry();

    const logs = await dbAll<{ msg: string }>(`SELECT msg FROM app_logs WHERE app = 'old-app'`);
    const errs = await dbAll<{ msg: string }>(`SELECT msg FROM app_errors WHERE app = 'old-app'`);
    expect(logs.map(l => l.msg)).toEqual(['fresh']);
    expect(errs.map(e => e.msg)).toEqual(['fresh']);
  });
});

describe('Telemetry retention — pruneTelemetryScheduled()', () => {
  it('prunes old telemetry events and stale installs, never web-analytics rows', async () => {
    const old = new Date(Date.now() - 200 * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');
    await dbRun("DELETE FROM funnel_events WHERE tool = 'ret-app'");
    await dbRun(`INSERT INTO funnel_events (event, tool, env, created_at) VALUES ('tel-old', 'ret-app', 'prod', ?)`, old);
    await dbRun(`INSERT INTO funnel_events (event, tool, version, created_at) VALUES ('tel-old-legacy', 'ret-app', '0.1.0', ?)`, old);
    await dbRun(`INSERT INTO funnel_events (event, tool, created_at) VALUES ('checkout_start', 'ret-app', ?)`, old);
    await dbRun(`INSERT INTO funnel_events (event, tool, env) VALUES ('tel-fresh', 'ret-app', 'prod')`);
    const now = Math.floor(Date.now() / 1000);
    await dbRun(
      `INSERT INTO app_installs (install_id, app, first_seen_at, last_seen_at) VALUES ('stale', 'ret-app', ?, ?)`,
      now - 400 * 86_400, now - 366 * 86_400,
    );
    await dbRun(
      `INSERT INTO app_installs (install_id, app, first_seen_at, last_seen_at) VALUES ('live', 'ret-app', ?, ?)`,
      now - 400 * 86_400, now - 10 * 86_400,
    );

    await pruneTelemetryScheduled();

    const events = await dbAll<{ event: string }>(`SELECT event FROM funnel_events WHERE tool = 'ret-app' ORDER BY event`);
    expect(events.map(e => e.event)).toEqual(['checkout_start', 'tel-fresh']);
    const installs = await dbAll<{ install_id: string }>(`SELECT install_id FROM app_installs WHERE app = 'ret-app'`);
    expect(installs.map(i => i.install_id)).toEqual(['live']);
  });
});

describe('Telemetry abuse controls — identity-free, silent', () => {
  it('a record whose `app` is not slug-shaped is dropped before the INSERT', async () => {
    const res = await inject('POST', '/api/telemetry/log', {
      batch: [
        { app: 'bad app/../etc', version: '1', level: 'info', msg: 'junk' },
        { app: 'good-app', version: '1', level: 'info', msg: 'legit' },
      ],
    }, '10.2.0.1');
    expect(res.statusCode).toBe(200);
    const rows = await dbAll<{ app: string }>('SELECT app FROM app_logs');
    expect(rows.map(r => r.app)).toEqual(['good-app']);
  });

  it('a record with no `app` at all is dropped', async () => {
    await inject('POST', '/api/telemetry/error', { batch: [{ msg: 'anonymous' }] }, '10.2.0.2');
    expect(await dbAll('SELECT * FROM app_errors')).toHaveLength(0);
  });

  it('per-install hourly limit answers 429 + Retry-After, never a silent 200', async () => {
    const visitor = `install-${Math.random()}`;
    const statuses: number[] = [];
    let retryAfter = 0;
    // 5 requests × 50 records = 250 > the 200/hour per-install cap.
    for (let i = 0; i < 5; i++) {
      const res = await inject('POST', '/api/telemetry/error', {
        batch: Array.from({ length: 50 }, () => ({ app: 'quota-app', msg: 'burst', visitor_id: visitor })),
      }, `10.2.1.${i}`); // different IPs each time: only the per-install cap can bite
      statuses.push(res.statusCode);
      if (res.statusCode === 429) {
        retryAfter = Number(res.headers['retry-after']);
        expect(res.json()).toMatchObject({ error: 'quota_exceeded' });
      }
    }
    expect(statuses).toEqual([200, 200, 200, 200, 429]);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    const rows = await dbAll<{ n: number }>(`SELECT COUNT(*) AS n FROM app_errors WHERE app = 'quota-app'`);
    expect(rows[0].n).toBe(200);
  });

  it('a refused batch consumes no quota: 190 used, 20 refused, then 10 fits', async () => {
    const visitor = `install-${Math.random()}`;
    const mk = (n: number) => ({
      batch: Array.from({ length: n }, () => ({ app: 'peek-app', msg: 'x', visitor_id: visitor })),
    });
    for (let i = 0; i < 3; i++) {
      expect((await inject('POST', '/api/telemetry/error', mk(50), `10.2.4.${i}`)).statusCode).toBe(200);
    }
    expect((await inject('POST', '/api/telemetry/error', mk(40), '10.2.4.3')).statusCode).toBe(200); // 190 used
    const refused = await inject('POST', '/api/telemetry/error', mk(20), '10.2.4.4');
    expect(refused.statusCode).toBe(429);
    expect(Number(refused.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect((await inject('POST', '/api/telemetry/error', mk(10), '10.2.4.5')).statusCode).toBe(200);
    const rows = await dbAll<{ n: number }>(`SELECT COUNT(*) AS n FROM app_errors WHERE app = 'peek-app'`);
    expect(rows[0].n).toBe(200);
  });

  it('records with no visitor_id are not caught by the per-install limiter', async () => {
    for (let i = 0; i < 5; i++) {
      await inject('POST', '/api/telemetry/log', {
        batch: Array.from({ length: 50 }, () => ({ app: 'anon-app', level: 'info', msg: 'x' })),
      }, `10.2.2.${i}`);
    }
    const rows = await dbAll<{ n: number }>(`SELECT COUNT(*) AS n FROM app_logs WHERE app = 'anon-app'`);
    expect(rows[0].n).toBe(250);
  });

  it('the beacon tag gives recognised clients their own per-IP bucket', async () => {
    // Same IP: untagged traffic burns the shared bucket to 429, tagged traffic
    // on that same IP is unaffected because it keys a different bucket.
    let untaggedSaw429 = false;
    for (let i = 0; i < 320; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/telemetry/error',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.2.3.9' },
        body: JSON.stringify({ batch: [] }),
      });
      if (res.statusCode === 429) { untaggedSaw429 = true; break; }
    }
    expect(untaggedSaw429).toBe(true);

    const tagged = await app.inject({
      method: 'POST',
      url: '/api/telemetry/error',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '10.2.3.9',
        'x-sm-beacon': 'session-manager/0.81.0',
      },
      body: JSON.stringify({ batch: [{ app: 'session-manager', msg: 'still gets through' }] }),
    });
    expect(tagged.statusCode).toBe(200);
    const rows = await dbAll<{ msg: string }>(`SELECT msg FROM app_errors WHERE app = 'session-manager'`);
    expect(rows.map(r => r.msg)).toEqual(['still gets through']);
  });

  it('install: an unrecognised app slug is dropped silently with a 200', async () => {
    const res = await inject('POST', '/api/telemetry/install', {
      install_id: 'shape-test', app: 'not a slug!!',
    }, '10.2.4.1');
    expect(res.statusCode).toBe(200);
    expect(await dbAll('SELECT * FROM app_installs')).toHaveLength(0);
  });

  it('app_installs has no column that could hold PII', async () => {
    const cols = await dbAll<{ name: string }>(`SELECT name FROM pragma_table_info('app_installs')`);
    const names = cols.map(c => c.name);
    expect(names).not.toContain('identify_email');
    expect(names.filter(n => /email|user|host|name$/i.test(n))).toEqual([]);
  });
});

describe('Telemetry ingest — /api/telemetry/event version attribution', () => {
  beforeEach(async () => {
    await dbRun("DELETE FROM funnel_events WHERE tool IN ('version-app','browser-app')");
  });

  it('persists the version from props.appVersion and from a top-level version', async () => {
    const res = await inject('POST', '/api/telemetry/event', {
      batch: [
        { app: 'version-app', name: 'app.launch', visitor_id: 'v1', props: { appVersion: '0.82.0' } },
        { app: 'version-app', name: 'app.launch', visitor_id: 'v2', version: '0.83.0' },
      ],
    }, '10.9.0.1');
    expect(res.statusCode).toBe(200);
    const rows = await dbAll<{ version: string | null; email: string | null }>(
      'SELECT version, email FROM funnel_events WHERE tool = ? ORDER BY version',
      'version-app',
    );
    expect(rows.map((r) => r.version)).toEqual(['0.82.0', '0.83.0']);
    // Telemetry ingest is strictly anonymous — it never writes the email column.
    expect(rows.every((r) => r.email === null)).toBe(true);
  });

  it('leaves version NULL for callers that do not report one', async () => {
    await inject('POST', '/api/telemetry/event', {
      batch: [{ app: 'browser-app', name: 'page.view', props: { path: '/' } }],
    }, '10.9.0.2');
    const rows = await dbAll<{ version: string | null }>(
      'SELECT version FROM funnel_events WHERE tool = ?', 'browser-app',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBeNull();
  });
});

describe('Telemetry ingest — /api/telemetry/event client time', () => {
  beforeEach(async () => {
    await dbRun("DELETE FROM funnel_events WHERE tool = 'ts-app'");
  });

  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

  it('dates an event by its own ts when plausible, else by server time', async () => {
    const before = Date.now();
    const twoDaysAgo = before - 2 * 86_400_000;
    const res = await inject('POST', '/api/telemetry/event', {
      batch: [
        { app: 'ts-app', name: 'late', visitor_id: 'ts1', ts: twoDaysAgo },
        { app: 'ts-app', name: 'future', visitor_id: 'ts1', ts: before + 86_400_000 },
        { app: 'ts-app', name: 'ancient', visitor_id: 'ts1', ts: before - 31 * 86_400_000 },
        { app: 'ts-app', name: 'string', visitor_id: 'ts1', ts: String(twoDaysAgo) },
        { app: 'ts-app', name: 'none', visitor_id: 'ts1' },
      ],
    }, '10.12.0.1');
    expect(res.statusCode).toBe(200);
    const after = Date.now();
    const rows = await dbAll<{ event: string; created_at: string }>(
      'SELECT event, created_at FROM funnel_events WHERE tool = ?', 'ts-app',
    );
    const at = Object.fromEntries(rows.map((r) => [r.event, r.created_at]));
    expect(at.late).toBe(iso(twoDaysAgo));
    for (const name of ['future', 'ancient', 'string', 'none']) {
      expect(at[name] >= iso(before - 1000) && at[name] <= iso(after)).toBe(true);
    }
  });
});

describe('Telemetry ingest — recordId deduplication', () => {
  beforeEach(async () => {
    await dbRun("DELETE FROM funnel_events WHERE tool IN ('dedup-app', 'dedup-other')");
  });

  it('stores an event once per recordId, across batches and inside one batch', async () => {
    const rec = (recordId?: string, app = 'dedup-app') => ({
      app, name: 'app.launch', visitor_id: 'd1', props: recordId ? { recordId } : {},
    });
    const first = await inject('POST', '/api/telemetry/event', {
      batch: [rec('r-1'), rec('r-1'), rec('r-2'), rec(), rec()],
    }, '10.13.0.1');
    expect(first.statusCode).toBe(200);
    // A replayed backlog: the same records again, plus the same id under another app.
    const replay = await inject('POST', '/api/telemetry/event', {
      batch: [rec('r-1'), rec('r-2'), rec('r-1', 'dedup-other')],
    }, '10.13.0.1');
    expect(replay.statusCode).toBe(200);
    const rows = await dbAll<{ tool: string; record_id: string | null }>(
      "SELECT tool, record_id FROM funnel_events WHERE tool IN ('dedup-app', 'dedup-other') ORDER BY tool, record_id",
    );
    expect(rows).toEqual([
      { tool: 'dedup-app', record_id: null },
      { tool: 'dedup-app', record_id: null },
      { tool: 'dedup-app', record_id: 'r-1' },
      { tool: 'dedup-app', record_id: 'r-2' },
      { tool: 'dedup-other', record_id: 'r-1' },
    ]);
  });

  it('stores a log line once per fields.recordId and an error once per context.recordId', async () => {
    const log = { app: 'dedup-app', level: 'warn', msg: 'w', visitor_id: 'd2', fields: { recordId: 'l-1' } };
    const err = { app: 'dedup-app', name: 'E', msg: 'e', stack: 'at x', visitor_id: 'd2', context: { recordId: 'e-1' } };
    for (let i = 0; i < 2; i++) {
      expect((await inject('POST', '/api/telemetry/log', { batch: [log, log] }, '10.13.0.2')).statusCode).toBe(200);
      expect((await inject('POST', '/api/telemetry/error', { batch: [err, err] }, '10.13.0.2')).statusCode).toBe(200);
    }
    // A malformed id is kept as NULL and never deduplicated.
    const bad = { ...err, context: { recordId: 'has spaces' } };
    await inject('POST', '/api/telemetry/error', { batch: [bad, bad] }, '10.13.0.2');
    const logs = await dbAll<{ record_id: string | null }>("SELECT record_id FROM app_logs WHERE app = 'dedup-app'");
    expect(logs).toEqual([{ record_id: 'l-1' }]);
    const errors = await dbAll<{ record_id: string | null }>(
      "SELECT record_id FROM app_errors WHERE app = 'dedup-app' ORDER BY record_id",
    );
    expect(errors).toEqual([{ record_id: null }, { record_id: null }, { record_id: 'e-1' }]);
  });
});

describe('Telemetry ingest — env discriminator', () => {
  it('stores env only when it is prod, dev or test', async () => {
    await dbRun("DELETE FROM funnel_events WHERE tool = 'env-app'");
    await inject('POST', '/api/telemetry/event', {
      batch: [
        { app: 'env-app', name: 'e', env: 'test' },
        { app: 'env-app', name: 'e', env: 'staging' },
        { app: 'env-app', name: 'e' },
      ],
    }, '10.3.0.1');
    await inject('POST', '/api/telemetry/log', { batch: [{ app: 'env-app', level: 'info', msg: 'm', env: 'dev' }] }, '10.3.0.1');
    await inject('POST', '/api/telemetry/error', { batch: [{ app: 'env-app', msg: 'm', env: 'prod' }] }, '10.3.0.1');
    await inject('POST', '/api/telemetry/install', { install_id: 'env-inst', app: 'env-app', env: 'test' }, '10.3.0.1');

    const ev = await dbAll<{ env: string | null }>(`SELECT env FROM funnel_events WHERE tool = 'env-app' ORDER BY id`);
    expect(ev.map((r) => r.env)).toEqual(['test', null, null]);
    expect((await dbAll<{ env: string }>(`SELECT env FROM app_logs WHERE app = 'env-app'`))[0].env).toBe('dev');
    expect((await dbAll<{ env: string }>(`SELECT env FROM app_errors WHERE app = 'env-app'`))[0].env).toBe('prod');
    expect((await dbAll<{ env: string }>(`SELECT env FROM app_installs WHERE app = 'env-app'`))[0].env).toBe('test');
  });
});

describe('Telemetry ingest — session cookie stamping', () => {
  const SID = '11111111-1111-4111-8111-111111111111';
  const VID = '22222222-2222-4222-8222-222222222222';
  function injectCookie(url: string, body: unknown, cookie: string | undefined, ip: string) {
    const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': ip };
    if (cookie) headers.cookie = cookie;
    return app.inject({ method: 'POST', url, headers, body: JSON.stringify(body) });
  }
  const ev = (tool: string) => ({ app: tool, name: 'cookie_ev', session_id: 'body-sid', visitor_id: 'body-vid', props: {} });
  const er = (tool: string) => ({ app: tool, version: '1.0.0', name: 'E', msg: 'm', session_id: 'body-sid', visitor_id: 'body-vid', ts: Date.now() });

  it('cookie ids override body ids in funnel_events', async () => {
    const res = await injectCookie('/api/telemetry/event', { batch: [ev('ck-ev1')] }, `bilko_sid=${SID}; bilko_vid=${VID}`, '10.1.0.1');
    expect(res.statusCode).toBe(200);
    const rows = await dbAll<{ session_id: string; visitor_id: string }>('SELECT session_id, visitor_id FROM funnel_events WHERE tool = ?', 'ck-ev1');
    expect(rows).toEqual([{ session_id: SID, visitor_id: VID }]);
  });

  it('cookie ids override body ids in app_errors', async () => {
    const res = await injectCookie('/api/telemetry/error', { batch: [er('ck-er1')] }, `bilko_sid=${SID}; bilko_vid=${VID}`, '10.1.0.2');
    expect(res.statusCode).toBe(200);
    const rows = await dbAll<{ session_id: string; visitor_id: string }>('SELECT session_id, visitor_id FROM app_errors WHERE app = ?', 'ck-er1');
    expect(rows).toEqual([{ session_id: SID, visitor_id: VID }]);
  });

  it('keeps body ids when there is no cookie', async () => {
    await injectCookie('/api/telemetry/event', { batch: [ev('ck-ev2')] }, undefined, '10.1.0.3');
    const rows = await dbAll<{ session_id: string; visitor_id: string }>('SELECT session_id, visitor_id FROM funnel_events WHERE tool = ?', 'ck-ev2');
    expect(rows).toEqual([{ session_id: 'body-sid', visitor_id: 'body-vid' }]);
  });

  it('ignores a malformed cookie value', async () => {
    await injectCookie('/api/telemetry/error', { batch: [er('ck-er2')] }, 'bilko_sid=not-a-uuid; bilko_vid=zzz', '10.1.0.4');
    const rows = await dbAll<{ session_id: string; visitor_id: string }>('SELECT session_id, visitor_id FROM app_errors WHERE app = ?', 'ck-er2');
    expect(rows).toEqual([{ session_id: 'body-sid', visitor_id: 'body-vid' }]);
  });
});

// funnel_events / app_errors carry is_bot from isBotRequest (request headers):
// browser automation and crawlers are bots, first-party desktop and CLI clients
// are not, so automation runs drop out of every bots filter even in sessions that
// never send a page view while Session Manager's own reports stay visible.
describe('Telemetry ingest — is_bot from the request UA', () => {
  const HEADLESS_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36';
  const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  function injectUa(url: string, body: unknown, ua: string, ip: string, extra: Record<string, string> = {}) {
    return app.inject({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, 'user-agent': ua, ...extra },
      body: JSON.stringify(body),
    });
  }

  async function ingest(tool: string, ua: string, ip: string, extra: Record<string, string> = {}) {
    const ev = await injectUa('/api/telemetry/event', { batch: [{ app: tool, name: 'repo_opened', visitor_id: `${tool}-v`, props: {} }] }, ua, ip, extra);
    const er = await injectUa('/api/telemetry/error', { batch: [{ app: tool, version: '1.0.0', name: 'TypeError', msg: 'boom', visitor_id: `${tool}-v`, ts: Date.now() }] }, ua, ip, extra);
    expect([ev.statusCode, er.statusCode]).toEqual([200, 200]);
    const events = await dbAll<{ is_bot: number }>('SELECT is_bot FROM funnel_events WHERE tool = ?', tool);
    const errors = await dbAll<{ is_bot: number }>('SELECT is_bot FROM app_errors WHERE app = ?', tool);
    return { events: events.map((r) => r.is_bot), errors: errors.map((r) => r.is_bot) };
  }

  beforeEach(async () => {
    await dbRun("DELETE FROM funnel_events WHERE tool LIKE 'ua-%'");
    await dbRun("DELETE FROM app_errors WHERE app LIKE 'ua-%'");
  });

  it('a HeadlessChrome UA stores is_bot = 1 on funnel_events and app_errors', async () => {
    expect(await ingest('ua-headless', HEADLESS_UA, '10.6.0.1')).toEqual({ events: [1], errors: [1] });
  });

  it('a desktop Chrome UA stores is_bot = 0 on funnel_events and app_errors', async () => {
    expect(await ingest('ua-chrome', CHROME_UA, '10.6.0.2')).toEqual({ events: [0], errors: [0] });
  });

  // What Session Manager's desktop client sends: Node's fetch UA plus its beacon tag.
  it('a Session Manager beacon request stores is_bot = 0', async () => {
    expect(await ingest('ua-sm', 'node', '10.6.0.3', { 'x-sm-beacon': 'session-manager/1.4.2' })).toEqual({ events: [0], errors: [0] });
  });

  it('first-party non-browser clients (node, undici, Electron, a CLI) store is_bot = 0', async () => {
    const uas = ['node', 'undici', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) session-manager/1.4.2 Chrome/130.0.0.0 Electron/33.2.0 Safari/537.36', 'bilko-cli/0.3.1', ''];
    for (const [i, ua] of uas.entries()) {
      expect(await ingest(`ua-client-${i}`, ua, `10.6.1.${i + 1}`)).toEqual({ events: [0], errors: [0] });
    }
  });

  it('browser automation and crawler UAs store is_bot = 1', async () => {
    const uas = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Playwright/1.48.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Puppeteer Chrome/131.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Unknown; Linux x86_64) AppleWebKit/538.1 (KHTML, like Gecko) PhantomJS/2.1.1 Safari/538.1',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
    ];
    for (const [i, ua] of uas.entries()) {
      expect(await ingest(`ua-auto-${i}`, ua, `10.6.2.${i + 1}`)).toEqual({ events: [1], errors: [1] });
    }
  });

  it('an invalid X-SM-Beacon tag does not clear a HeadlessChrome flag', async () => {
    expect(await ingest('ua-badtag', HEADLESS_UA, '10.6.0.4', { 'x-sm-beacon': 'not a tag' })).toEqual({ events: [1], errors: [1] });
  });
});

// One-time repair: Session Manager desktop rows stored with is_bot = 1 after
// 80a49fe2 (2026-11-07 23:00 PST) go back to 0; nothing else moves.
describe('initDb — repair of mis-flagged Session Manager telemetry', () => {
  const MIGRATION = '2026-11-08-session-manager-telemetry-not-bot';
  const CUTOFF_SEC = 1794121200; // 2026-11-07 23:00 PST

  it('resets is_bot on SM funnel_events/app_errors since the cutoff, once', async () => {
    await dbRun("DELETE FROM funnel_events WHERE event LIKE 'repair-%'");
    await dbRun("DELETE FROM app_errors WHERE name LIKE 'repair-%'");
    const ev = (event: string, tool: string, at: string, bot: number) =>
      dbRun('INSERT INTO funnel_events (event, tool, created_at, is_bot) VALUES (?, ?, ?, ?)', event, tool, at, bot);
    const er = (name: string, app: string, at: number, bot: number) =>
      dbRun('INSERT INTO app_errors (app, name, msg, created_at, is_bot) VALUES (?, ?, ?, ?, ?)', app, name, 'boom', at, bot);
    await ev('repair-sm-after', 'session-manager', '2026-11-08 07:30:00', 1);
    await ev('repair-sm-before', 'session-manager', '2026-11-08 06:59:59', 1);
    await ev('repair-other-after', 'git-viewer', '2026-11-08 07:30:00', 1);
    await er('repair-sm-after', 'session-manager', CUTOFF_SEC + 60, 1);
    await er('repair-other-after', 'git-viewer', CUTOFF_SEC + 60, 1);
    await dbRun('DELETE FROM data_migrations WHERE id = ?', MIGRATION);

    await initDb();
    const evs = await dbAll<{ event: string; is_bot: number }>("SELECT event, is_bot FROM funnel_events WHERE event LIKE 'repair-%' ORDER BY event");
    const ers = await dbAll<{ name: string; is_bot: number }>("SELECT name, is_bot FROM app_errors WHERE name LIKE 'repair-%' ORDER BY name");
    expect(evs.map((r) => [r.event, r.is_bot])).toEqual([['repair-other-after', 1], ['repair-sm-after', 0], ['repair-sm-before', 1]]);
    expect(ers.map((r) => [r.name, r.is_bot])).toEqual([['repair-other-after', 1], ['repair-sm-after', 0]]);

    // Idempotent: a later SM row flagged for a real reason is not touched by the next boot.
    await dbRun("UPDATE funnel_events SET is_bot = 1 WHERE event = 'repair-sm-after'");
    await initDb();
    expect((await dbAll<{ is_bot: number }>("SELECT is_bot FROM funnel_events WHERE event = 'repair-sm-after'"))[0].is_bot).toBe(1);
  });
});
