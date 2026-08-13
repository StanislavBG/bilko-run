import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun, dbGet } from '../server/db.js';
import { registerEgressMeter, flushEgress, topEgress } from '../server/egress.js';

const app = Fastify({ logger: false });
// flush:false — no background timer in tests; we flush explicitly.
registerEgressMeter(app, { flush: false });

app.get('/api/tiny', async () => ({ ok: true }));
app.get('/api/fat/:id', async () => ({ blob: 'x'.repeat(50_000) }));
app.get('/not-api', async () => ({ ok: true }));

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM api_egress_daily');
});

const today = new Date().toISOString().slice(0, 10);

describe('egress meter', () => {
  it('records response bytes per route pattern, not per URL', async () => {
    await app.inject({ method: 'GET', url: '/api/fat/aaa' });
    await app.inject({ method: 'GET', url: '/api/fat/bbb' });
    await flushEgress();

    const row = await dbGet<{ requests: number; bytes: number }>(
      'SELECT requests, bytes FROM api_egress_daily WHERE route = ? AND date = ?',
      '/api/fat/:id', today,
    );
    // Two distinct URLs collapse into one row — cardinality stays bounded.
    expect(row!.requests).toBe(2);
    expect(row!.bytes).toBeGreaterThan(100_000);
  });

  it('ignores non-/api routes', async () => {
    await app.inject({ method: 'GET', url: '/not-api' });
    await flushEgress();
    const row = await dbGet('SELECT route FROM api_egress_daily WHERE route = ?', '/not-api');
    expect(row).toBeFalsy();
  });

  it('separates a high-volume cheap route from a low-volume expensive one', async () => {
    for (let i = 0; i < 20; i++) await app.inject({ method: 'GET', url: '/api/tiny' });
    await app.inject({ method: 'GET', url: '/api/fat/one' });
    await flushEgress();

    const rows = await topEgress(1, 10);
    // Ranked by total bytes: one fat response outweighs twenty tiny ones.
    expect(rows[0].route).toBe('/api/fat/:id');
    expect(rows[0].requests).toBe(1);
    // bytesPerRequest is the column that tells you WHY it's on top.
    expect(rows[0].bytesPerRequest).toBeGreaterThan(50_000);

    const tiny = rows.find((r) => r.route === '/api/tiny')!;
    expect(tiny.requests).toBe(20);
    expect(tiny.bytesPerRequest).toBeLessThan(100);
  });

  it('accumulates across flushes rather than overwriting the bucket', async () => {
    await app.inject({ method: 'GET', url: '/api/tiny' });
    await flushEgress();
    await app.inject({ method: 'GET', url: '/api/tiny' });
    await flushEgress();

    const row = await dbGet<{ requests: number }>(
      'SELECT requests FROM api_egress_daily WHERE route = ?', '/api/tiny',
    );
    expect(row!.requests).toBe(2);
  });

  it('measures UTF-8 bytes, not characters', async () => {
    const local = Fastify({ logger: false });
    registerEgressMeter(local, { flush: false });
    local.get('/api/unicode', async () => ({ s: 'é'.repeat(1000) }));
    await local.ready();
    await local.inject({ method: 'GET', url: '/api/unicode' });
    await flushEgress();

    const row = await dbGet<{ bytes: number }>(
      'SELECT bytes FROM api_egress_daily WHERE route = ?', '/api/unicode',
    );
    // 1000 two-byte chars → ~2000 bytes, not ~1000.
    expect(row!.bytes).toBeGreaterThan(1_900);
  });
});
