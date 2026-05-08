import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbAll, dbRun } from '../server/db.js';
import { registerTelemetryRoutes } from '../server/routes/telemetry.js';

const app = Fastify({ trustProxy: true, logger: false });
registerTelemetryRoutes(app);

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM app_logs');
  await dbRun('DELETE FROM app_errors');
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
