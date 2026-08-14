import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import cors from '@fastify/cors';
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  staticCacheControl,
  setStaticCacheHeaders,
  normalizeStaticMtimes,
  registerStaticCorsTrim,
} from '../server/static-cache.js';

function makeTree(): string {
  const root = mkdtempSync(join(tmpdir(), 'bilko-static-'));
  mkdirSync(join(root, 'assets'));
  mkdirSync(join(root, 'projects', 'demo'), { recursive: true });
  writeFileSync(join(root, 'index.html'), '<html><body>host</body></html>');
  writeFileSync(join(root, 'assets', 'index-Co_CVzBG.css'), 'body{color:red}');
  writeFileSync(join(root, 'assets', 'index-nPs_mZCK.js'), 'console.log(1)');
  writeFileSync(join(root, 'projects', 'demo', 'index.html'), '<html><body>demo</body></html>');
  writeFileSync(join(root, 'projects', 'demo', 'styles.css'), '.a{color:blue}');
  writeFileSync(join(root, 'projects', 'demo', 'app.jsx'), 'export default 1');
  writeFileSync(join(root, 'og-bilko.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return root;
}

/** Mirrors the production registration in server/index.ts. */
async function buildApp(root: string) {
  const app = Fastify({ logger: false });
  // Same order as server/index.ts: cors (stamps Vary: Origin) → trim → static.
  await app.register(cors, { origin: ['https://bilko.run'], credentials: true });
  registerStaticCorsTrim(app);
  app.get('/api/health', async () => ({ ok: true }));
  await app.register(staticPlugin, {
    root,
    prefix: '/',
    cacheControl: false,
    setHeaders: (res, path) => setStaticCacheHeaders(res, path),
    redirect: true,
  });
  await app.ready();
  return app;
}

describe('staticCacheControl policy', () => {
  it('marks content-hashed Vite bundles immutable for a year', () => {
    expect(staticCacheControl('/dist/assets/index-nPs_mZCK.js')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(staticCacheControl('/dist/assets/index-Co_CVzBG.css')).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it('makes HTML revalidate so a publish is visible immediately', () => {
    expect(staticCacheControl('/dist/index.html')).toBe('public, max-age=0, must-revalidate');
    expect(staticCacheControl('/dist/projects/demo/index.html')).toBe(
      'public, max-age=0, must-revalidate',
    );
  });

  it('gives unhashed project assets a short shared lifetime', () => {
    expect(staticCacheControl('/dist/projects/demo/styles.css')).toBe('public, max-age=600');
    expect(staticCacheControl('/dist/projects/demo/data-extended.js')).toBe('public, max-age=600');
  });

  it('does not mistake an English-word suffix for a content hash', () => {
    // `-extended` is eight word characters; treating it as a Vite hash would
    // pin a file that is regenerated on every publish for a year.
    expect(staticCacheControl('/dist/assets/data-extended.js')).toBe('public, max-age=600');
    expect(staticCacheControl('/dist/assets/theme-settings.css')).toBe('public, max-age=600');
    // …and a real hash outside an assets/ dir stays conservative.
    expect(staticCacheControl('/dist/projects/demo/index-nPs_mZCK.js')).toBe('public, max-age=600');
  });

  it('caches media for a day', () => {
    expect(staticCacheControl('/dist/og-bilko.png')).toBe('public, max-age=86400');
    expect(staticCacheControl('/dist/fonts/inter.woff2')).toBe('public, max-age=86400');
  });

  it('never emits max-age=0 for a non-HTML asset', () => {
    for (const p of ['/a/app.jsx', '/a/styles.css', '/a/data.json', '/a/logo.svg']) {
      expect(staticCacheControl(p)).not.toContain('max-age=0');
    }
  });
});

describe('normalizeStaticMtimes', () => {
  it('derives mtime from content, so a re-checkout of unchanged files keeps its ETag', () => {
    const root = makeTree();
    const file = join(root, 'projects', 'demo', 'styles.css');

    normalizeStaticMtimes(root);
    const first = statSync(file).mtimeMs;

    // Simulate a deploy: git checkout stamps every file with "now" without
    // touching its contents.
    const now = Date.now() / 1000;
    utimesSync(file, now, now);
    expect(statSync(file).mtimeMs).not.toBe(first);

    normalizeStaticMtimes(root);
    expect(statSync(file).mtimeMs).toBe(first);
  });

  it('changes mtime when contents change', () => {
    const root = makeTree();
    const file = join(root, 'projects', 'demo', 'styles.css');

    normalizeStaticMtimes(root);
    const before = statSync(file).mtimeMs;

    writeFileSync(file, '.a{color:green}');
    normalizeStaticMtimes(root);
    expect(statSync(file).mtimeMs).not.toBe(before);
  });

  it('is idempotent — a second pass rewrites nothing', () => {
    const root = makeTree();
    normalizeStaticMtimes(root);
    const second = normalizeStaticMtimes(root);
    expect(second.files).toBeGreaterThan(0);
    expect(second.changed).toBe(0);
  });

  it('produces plausible past timestamps', () => {
    const root = makeTree();
    normalizeStaticMtimes(root);
    const ms = statSync(join(root, 'index.html')).mtimeMs;
    expect(ms).toBeGreaterThan(Date.parse('2000-01-01T00:00:00Z') - 1);
    expect(ms).toBeLessThan(Date.now());
  });
});

describe('served responses', () => {
  let root: string;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    root = makeTree();
    normalizeStaticMtimes(root);
    app = await buildApp(root);
  });

  it('serves a real cache lifetime instead of @fastify/send default max-age=0', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/demo/styles.css' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=600');
  });

  it('serves hashed bundles as immutable', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/index-nPs_mZCK.js' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('still answers a conditional GET with 304 after the ETag rewrite', async () => {
    const first = await app.inject({ method: 'GET', url: '/projects/demo/app.jsx' });
    const etag = first.headers.etag as string;
    expect(etag).toBeTruthy();

    const second = await app.inject({
      method: 'GET',
      url: '/projects/demo/app.jsx',
      headers: { 'if-none-match': etag },
    });
    expect(second.statusCode).toBe(304);
  });

  it('keeps the same ETag across a simulated redeploy', async () => {
    const before = await app.inject({ method: 'GET', url: '/projects/demo/app.jsx' });
    const etag = before.headers.etag as string;

    const file = join(root, 'projects', 'demo', 'app.jsx');
    const now = Date.now() / 1000;
    utimesSync(file, now, now);
    normalizeStaticMtimes(root);

    const after = await app.inject({ method: 'GET', url: '/projects/demo/app.jsx' });
    expect(after.headers.etag).toBe(etag);
  });

  it('marks HTML must-revalidate', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/demo/index.html' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=0, must-revalidate');
  });
});

describe('Cloudflare-blocking CORS headers', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    const root = makeTree();
    normalizeStaticMtimes(root);
    app = await buildApp(root);
  });

  it('drops Vary: Origin from a same-origin static asset, so the edge can cache it', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/demo/styles.css' });
    expect(res.headers.vary ?? '').not.toMatch(/origin/i);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('preserves other Vary dimensions', async () => {
    const app2 = Fastify({ logger: false });
    await app2.register(cors, { origin: ['https://bilko.run'], credentials: true });
    registerStaticCorsTrim(app2);
    app2.get('/thing.css', async (_req, reply) => {
      reply.header('cache-control', 'public, max-age=600');
      reply.header('vary', 'Origin, Accept-Encoding');
      return reply.type('text/css').send('.a{}');
    });
    await app2.ready();

    const res = await app2.inject({ method: 'GET', url: '/thing.css' });
    expect(res.headers.vary).toBe('Accept-Encoding');
  });

  it('leaves a genuine cross-origin request fully CORS-headed', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/projects/demo/styles.css',
      headers: { origin: 'https://bilko.run' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('https://bilko.run');
    expect(res.headers.vary ?? '').toMatch(/origin/i);
  });

  it('leaves /api responses alone', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers.vary ?? '').toMatch(/origin/i);
  });
});
