import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { initDb, dbRun, dbGet, dbAll } from '../server/db.js';
import { registerEgressMeter, setStaticKnownSlugs, flushEgress, topEgress } from '../server/egress.js';

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

describe('static egress meter', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'egress-static-'));
  const assetBytes = 12_345;
  let staticApp: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    mkdirSync(join(fixtureRoot, 'projects', 'demo-app'), { recursive: true });
    writeFileSync(join(fixtureRoot, 'projects', 'demo-app', 'sprite.bin'), Buffer.alloc(assetBytes, 1));

    setStaticKnownSlugs(fixtureRoot);
    staticApp = Fastify({ logger: false });
    registerEgressMeter(staticApp, { flush: false });
    staticApp.get('/api/tiny', async () => ({ ok: true }));
    await staticApp.register(staticPlugin, { root: fixtureRoot, prefix: '/', etag: true });
    await staticApp.ready();
  });

  beforeEach(async () => {
    await dbRun('DELETE FROM api_egress_daily');
  });

  it('records real transferred bytes for a known project slug, matching content-length', async () => {
    const res = await staticApp.inject({ method: 'GET', url: '/projects/demo-app/sprite.bin' });
    expect(res.statusCode).toBe(200);
    expect(Number(res.headers['content-length'])).toBe(assetBytes);
    await flushEgress();

    const row = await dbGet<{ requests: number; bytes: number }>(
      'SELECT requests, bytes FROM api_egress_daily WHERE route = ?', 'static:demo-app',
    );
    expect(row!.requests).toBe(1);
    expect(row!.bytes).toBe(assetBytes);
  });

  it('counts a 304 revalidation as a request with 0 bytes, distinct from transfer volume', async () => {
    const first = await staticApp.inject({ method: 'GET', url: '/projects/demo-app/sprite.bin' });
    const etag = first.headers.etag as string;
    await flushEgress();

    const revalidate = await staticApp.inject({
      method: 'GET',
      url: '/projects/demo-app/sprite.bin',
      headers: { 'if-none-match': etag },
    });
    expect(revalidate.statusCode).toBe(304);
    await flushEgress();

    const row = await dbGet<{ requests: number; bytes: number }>(
      'SELECT requests, bytes FROM api_egress_daily WHERE route = ?', 'static:demo-app',
    );
    // First request transferred the full asset; the 304 added a request but no bytes.
    expect(row!.requests).toBe(2);
    expect(row!.bytes).toBe(assetBytes);
  });

  it('buckets an unrecognised /projects/<slug>/ path into static:_other, not a per-URL key', async () => {
    await staticApp.inject({ method: 'GET', url: '/projects/never-registered-app/nope.bin' });
    await staticApp.inject({ method: 'GET', url: '/projects/another-fake-one/also-nope.bin' });
    await flushEgress();

    const rows = await dbAll<{ route: string; requests: number }>(
      "SELECT route, requests FROM api_egress_daily WHERE route LIKE 'static:%'",
    );
    const other = rows.find((r) => r.route === 'static:_other');
    expect(other?.requests).toBe(2);
    expect(rows.some((r) => r.route.includes('never-registered-app'))).toBe(false);
  });

  it('records 0 bytes for a HEAD request even though Content-Length reflects the full resource', async () => {
    const res = await staticApp.inject({ method: 'HEAD', url: '/projects/demo-app/sprite.bin' });
    expect(res.statusCode).toBe(200);
    expect(Number(res.headers['content-length'])).toBe(assetBytes);
    await flushEgress();

    const row = await dbGet<{ requests: number; bytes: number }>(
      'SELECT requests, bytes FROM api_egress_daily WHERE route = ? AND method = ?', 'static:demo-app', 'HEAD',
    );
    expect(row!.requests).toBe(1);
    expect(row!.bytes).toBe(0);
  });

  it('buckets host chrome (non-/projects paths) into static:_host', async () => {
    await staticApp.inject({ method: 'GET', url: '/some-host-asset.js' });
    await flushEgress();

    const row = await dbGet<{ requests: number }>(
      'SELECT requests FROM api_egress_daily WHERE route = ?', 'static:_host',
    );
    expect(row!.requests).toBe(1);
  });

  it('records a matched /api/* route exactly once, not again under a static bucket', async () => {
    await staticApp.inject({ method: 'GET', url: '/api/tiny' });
    await flushEgress();

    const apiRow = await dbGet<{ requests: number }>(
      'SELECT requests FROM api_egress_daily WHERE route = ?', '/api/tiny',
    );
    expect(apiRow!.requests).toBe(1);

    const staticRows = await dbAll<{ route: string }>("SELECT route FROM api_egress_daily WHERE route LIKE 'static:%'");
    expect(staticRows.some((r) => r.route.includes('api'))).toBe(false);
  });

  it('does not double-count an unmatched /api/* request under a static bucket', async () => {
    await staticApp.inject({ method: 'GET', url: '/api/nonexistent-route' });
    await flushEgress();

    const rows = await dbAll<{ route: string }>("SELECT route FROM api_egress_daily WHERE route LIKE 'static:%'");
    expect(rows.some((r) => r.route.includes('api'))).toBe(false);
  });
});
