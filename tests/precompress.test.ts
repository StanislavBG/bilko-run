import Fastify from 'fastify';
import compress from '@fastify/compress';
import staticPlugin from '@fastify/static';
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { brotliDecompressSync, gunzipSync } from 'zlib';
import { brotliQuality, precompressTree } from '../server/precompress.js';
import { registerEncodingVary, setStaticCacheHeaders } from '../server/static-cache.js';

// A Godot-style payload: compressible, well over the 1 KB floor.
const WASM = Buffer.from('\0asm' + 'godot-engine-function-body;'.repeat(4000));
const HTML = '<html><head></head><body>' + 'x'.repeat(4000) + '</body></html>';

function makeTree(): string {
  const root = mkdtempSync(join(tmpdir(), 'bilko-precompress-'));
  const game = join(root, 'projects', 'game');
  mkdirSync(game, { recursive: true });
  writeFileSync(join(game, 'index.wasm'), WASM);
  writeFileSync(join(game, 'index.html'), HTML);
  // A variant shipped by the sibling — stale, and HTML must never have one.
  writeFileSync(join(game, 'index.html.br'), 'stale');
  writeFileSync(join(game, 'index.wasm.gz'), 'stale');
  writeFileSync(join(game, 'tiny.js'), 'let a=1');
  // A real .gz download with no source beside it is content, not a variant.
  writeFileSync(join(game, 'levels.tar.gz'), 'archive');
  return root;
}

describe('precompressTree', () => {
  let root: string;
  beforeAll(async () => {
    root = makeTree();
    await precompressTree(root);
  });

  it('writes .br and .gz siblings that decode to the source', () => {
    const game = join(root, 'projects', 'game');
    expect(brotliDecompressSync(readFileSync(join(game, 'index.wasm.br')))).toEqual(WASM);
    expect(gunzipSync(readFileSync(join(game, 'index.wasm.gz')))).toEqual(WASM);
  });

  it('never leaves an HTML variant, skips tiny files, keeps lone archives', () => {
    const game = join(root, 'projects', 'game');
    expect(existsSync(join(game, 'index.html.br'))).toBe(false);
    expect(existsSync(join(game, 'index.html.gz'))).toBe(false);
    expect(existsSync(join(game, 'tiny.js.br'))).toBe(false);
    expect(readFileSync(join(game, 'levels.tar.gz'), 'utf-8')).toBe('archive');
  });

  it('trades quality for build time on big files', () => {
    expect(brotliQuality(100_000)).toBe(11);
    expect(brotliQuality(4 << 20)).toBe(9);
    expect(brotliQuality(40 << 20)).toBe(5);
  });
});

/** Mirrors the production order in server/index.ts: compress → vary → static. */
async function buildApp(root: string) {
  const app = Fastify({ logger: false });
  await app.register(compress, { threshold: 1024, encodings: ['br', 'gzip'] });
  registerEncodingVary(app);
  await app.register(staticPlugin, {
    root,
    prefix: '/',
    cacheControl: false,
    setHeaders: (res, path) => setStaticCacheHeaders(res, path),
    preCompressed: true,
    redirect: true,
  });
  return app;
}

describe('serving precompressed variants', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => {
    const root = makeTree();
    await precompressTree(root);
    app = await buildApp(root);
  });

  it('serves the .br file with a Content-Length, the source type and cache policy', async () => {
    const res = await app.inject({ url: '/projects/game/index.wasm', headers: { 'accept-encoding': 'br, gzip' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-encoding']).toBe('br');
    expect(res.headers['content-type']).toBe('application/wasm');
    expect(Number(res.headers['content-length'])).toBe(res.rawPayload.length);
    expect(res.rawPayload.length).toBeLessThan(WASM.length / 5);
    expect(String(res.headers.vary)).toMatch(/accept-encoding/i);
    expect(res.headers['cache-control']).toBe('public, max-age=600');
    expect(brotliDecompressSync(res.rawPayload)).toEqual(WASM);
  });

  it('falls back to .gz, then to the identity file', async () => {
    const gz = await app.inject({ url: '/projects/game/index.wasm', headers: { 'accept-encoding': 'gzip' } });
    expect(gz.headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(gz.rawPayload)).toEqual(WASM);
    const plain = await app.inject({ url: '/projects/game/index.wasm' });
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(plain.rawPayload).toEqual(WASM);
  });

  it('still serves directory-index HTML for a br-capable client', async () => {
    const res = await app.inject({ url: '/projects/game/', headers: { 'accept-encoding': 'br' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
  });
});
