import Fastify from 'fastify';
import compress from '@fastify/compress';
import staticPlugin from '@fastify/static';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { brotliDecompressSync, gunzipSync } from 'zlib';
import { registerSecurityHeaders } from '../server/security-headers.js';
import { registerEgressMeter, setStaticKnownSlugs, flushEgress } from '../server/egress.js';
import { initDb, dbGet, dbRun } from '../server/db.js';

// Compressible-types regex mirrors server/index.ts — kept in sync manually
// since it isn't exported.
const CUSTOM_TYPES = /^text\/(?!event-stream)|(?:\+|\/)json(?:;|$)|(?:\+|\/)text(?:;|$)|(?:\+|\/)xml(?:;|$)|octet-stream(?:;|$)|javascript/u;

async function buildApp() {
  const app = Fastify({ logger: false });
  // Same registration order as server/index.ts: security headers (CSP nonce
  // onSend) → compress (so it compresses AFTER nonce injection) → egress meter.
  registerSecurityHeaders(app);
  await app.register(compress, { threshold: 1024, encodings: ['br', 'gzip'], customTypes: CUSTOM_TYPES });
  registerEgressMeter(app, { flush: false });

  app.get('/api/big', async () => ({ blob: 'x'.repeat(50_000) }));
  app.get('/api/tiny', async () => ({ ok: true }));
  app.get('/big.html', async (_req, reply) =>
    reply.type('text/html').send(
      `<html><head></head><body><script src="/app.js"></script>${'y'.repeat(50_000)}</body></html>`,
    ));

  return app;
}

const today = new Date().toISOString().slice(0, 10);

describe('origin compression', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    await initDb();
    app = await buildApp();
    await app.ready();
  });

  beforeEach(async () => {
    // Drain any in-memory buckets left by a prior test's un-flushed request
    // before clearing the table, so requests don't leak across tests.
    await flushEgress();
    await dbRun('DELETE FROM api_egress_daily');
  });

  it('sets content-encoding on a compressible JSON response above threshold', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/big',
      headers: { 'accept-encoding': 'br, gzip' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-encoding']).toBeTruthy();
    // The wire body must actually be smaller than the uncompressed JSON —
    // otherwise a content-encoding header alone proves nothing.
    const uncompressedSize = Buffer.byteLength(JSON.stringify({ blob: 'x'.repeat(50_000) }));
    expect(res.rawPayload.length).toBeLessThan(uncompressedSize);
  });

  it('does not compress a response below the threshold', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/tiny',
      headers: { 'accept-encoding': 'br, gzip' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-encoding']).toBeFalsy();
  });

  it('injects the CSP nonce before compressing an HTML response', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/big.html',
      headers: { 'accept-encoding': 'br, gzip' },
    });
    expect(res.headers['content-encoding']).toBeTruthy();
    const encoding = res.headers['content-encoding'] as string;
    const decompressed = (encoding === 'br' ? brotliDecompressSync : gunzipSync)(res.rawPayload).toString('utf-8');
    const cspHeader = res.headers['content-security-policy-report-only'] as string;
    const nonce = cspHeader.match(/nonce-([A-Za-z0-9+/=]+)/)?.[1];
    // Proves CSP's onSend (nonce injection) ran BEFORE compress's onSend —
    // if the order were reversed, compress would hand security-headers
    // compressed bytes, which its text/html string-replace would silently
    // no-op on, and the decompressed body would have no nonce attribute.
    expect(nonce).toBeTruthy();
    expect(decompressed).toContain(`nonce="${nonce}"`);
  });

  it('records the actually-compressed byte count in the egress meter, not the pre-compression size', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/big',
      headers: { 'accept-encoding': 'br, gzip' },
    });
    expect(res.headers['content-encoding']).toBeTruthy();
    await flushEgress();

    const row = await dbGet<{ bytes: number; requests: number }>(
      'SELECT bytes, requests FROM api_egress_daily WHERE route = ? AND date = ?',
      '/api/big', today,
    );
    expect(row!.requests).toBe(1);
    const uncompressedSize = Buffer.byteLength(JSON.stringify({ blob: 'x'.repeat(50_000) }));
    // The whole point of this PRD: billed bytes must reflect what actually
    // left the origin (compressed), not the pre-compression payload.
    expect(row!.bytes).toBeLessThan(uncompressedSize);
    expect(row!.bytes).toBeGreaterThan(0);
    // And it should match what was actually written on the wire for this response.
    expect(row!.bytes).toBe(res.rawPayload.length);
  });
});

describe('origin compression — static assets', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'compress-static-'));
  let staticApp: ReturnType<typeof Fastify>;
  const jsBody = 'console.log("x");'.repeat(2000); // well above 1KB threshold, compressible
  const pngBody = Buffer.alloc(5000, 0xff); // opaque binary, must pass through untouched

  beforeAll(async () => {
    mkdirSync(join(fixtureRoot, 'projects', 'demo-app'), { recursive: true });
    writeFileSync(join(fixtureRoot, 'projects', 'demo-app', 'bundle.js'), jsBody);
    writeFileSync(join(fixtureRoot, 'projects', 'demo-app', 'sprite.png'), pngBody);
    setStaticKnownSlugs(fixtureRoot);

    staticApp = Fastify({ logger: false });
    await staticApp.register(compress, { threshold: 1024, encodings: ['br', 'gzip'], customTypes: CUSTOM_TYPES });
    registerEgressMeter(staticApp, { flush: false });
    await staticApp.register(staticPlugin, { root: fixtureRoot, prefix: '/' });
    await staticApp.ready();
  });

  beforeEach(async () => {
    await dbRun('DELETE FROM api_egress_daily');
    await dbRun('DELETE FROM static_asset_daily');
  });

  it('compresses a static JS bundle and records the compressed byte count, not 0 or the on-disk size', async () => {
    const res = await staticApp.inject({
      method: 'GET',
      url: '/projects/demo-app/bundle.js',
      headers: { 'accept-encoding': 'br, gzip' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-encoding']).toBeTruthy();
    // Compression turns this into a stream response — Content-Length is
    // dropped, which is exactly the case the egress-meter fallback must cover.
    expect(res.headers['content-length']).toBeUndefined();
    await flushEgress();

    const row = await dbGet<{ bytes: number; requests: number }>(
      'SELECT bytes, requests FROM api_egress_daily WHERE route = ?', 'static:demo-app',
    );
    expect(row!.requests).toBe(1);
    expect(row!.bytes).toBeGreaterThan(0);
    expect(row!.bytes).toBeLessThan(Buffer.byteLength(jsBody));
    expect(row!.bytes).toBe(res.rawPayload.length);
  });

  it('does not compress a PNG even though it is above the threshold', async () => {
    const res = await staticApp.inject({
      method: 'GET',
      url: '/projects/demo-app/sprite.png',
      headers: { 'accept-encoding': 'br, gzip' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-encoding']).toBeFalsy();
    expect(res.rawPayload.length).toBe(pngBody.length);

    await flushEgress();
    const row = await dbGet<{ bytes: number }>(
      'SELECT bytes FROM api_egress_daily WHERE route = ?', 'static:demo-app',
    );
    expect(row!.bytes).toBe(pngBody.length);
  });
});
