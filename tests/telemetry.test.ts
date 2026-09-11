import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbAll, dbRun } from '../server/db.js';
import { registerTelemetryRoutes, pruneTelemetry } from '../server/routes/telemetry.js';

const app = Fastify({ trustProxy: true, logger: false });
registerTelemetryRoutes(app);

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

  it('an absent identify_email does not wipe a previously opted-in one', async () => {
    await inject('POST', '/api/telemetry/install', { ...profile, identify_email: 'a@b.com' }, '10.1.0.3');
    await inject('POST', '/api/telemetry/install', profile, '10.1.0.3');
    const rows = await dbAll<{ identify_email: string }>('SELECT identify_email FROM app_installs');
    expect(rows[0].identify_email).toBe('a@b.com');
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
