import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import { randomBytes } from 'crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  staticCacheControl,
  setStaticCacheHeaders,
  normalizeStaticMtimes,
  registerStaticCorsTrim,
  registerVersionedMediaCache,
  versionedMediaCacheControl,
  registerCrossOriginAssetCors,
  CROSS_ORIGIN_ASSET_PREFIXES,
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

describe('versionedMediaCacheControl', () => {
  const IMMUTABLE = 'public, max-age=31536000, immutable';

  it('marks a content-versioned card mp4 immutable', () => {
    expect(versionedMediaCacheControl('/projects/demo/tile.mp4?v=3f2a9c')).toBe(IMMUTABLE);
  });

  it('marks a content-versioned card webm immutable', () => {
    expect(versionedMediaCacheControl('/projects/demo/media/tile.webm?v=abc123')).toBe(IMMUTABLE);
  });

  it('leaves an unversioned mp4 alone', () => {
    expect(versionedMediaCacheControl('/projects/demo/tile.mp4')).toBeUndefined();
    expect(versionedMediaCacheControl('/projects/demo/tile.mp4?w=1')).toBeUndefined();
  });

  it('leaves an empty v alone', () => {
    expect(versionedMediaCacheControl('/projects/demo/tile.mp4?v=')).toBeUndefined();
    expect(versionedMediaCacheControl('/projects/demo/tile.mp4?v')).toBeUndefined();
  });

  it('leaves a versioned png alone', () => {
    expect(versionedMediaCacheControl('/projects/demo/tile.png?v=3f2a9c')).toBeUndefined();
  });

  it('leaves paths outside /projects alone', () => {
    expect(versionedMediaCacheControl('/media/tile.mp4?v=3f2a9c')).toBeUndefined();
    expect(versionedMediaCacheControl('/api/projects/demo/tile.mp4?v=3f2a9c')).toBeUndefined();
  });
});

describe('versioned card video responses', () => {
  let app: ReturnType<typeof Fastify>;
  let size: number;

  beforeAll(async () => {
    const root = makeTree();
    // Minimal ISO-BMFF ftyp box, then incompressible random bytes.
    const ftyp = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, // size 24, 'ftyp'
      0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00, // 'isom', minor 0x200
      0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x31, // 'isom', 'mp41'
    ]);
    const bytes = Buffer.concat([ftyp, randomBytes(64 * 1024)]);
    writeFileSync(join(root, 'projects', 'demo', 'tile.mp4'), bytes);
    size = bytes.length;
    normalizeStaticMtimes(root);

    // Same hook order as server/index.ts: cors → versioned media → trim → compress → static.
    app = Fastify({ logger: false });
    await app.register(cors, { origin: ['https://bilko.run'], credentials: true });
    registerVersionedMediaCache(app);
    registerStaticCorsTrim(app);
    await app.register(compress, {
      threshold: 1024,
      encodings: ['br', 'gzip'],
      customTypes: /^text\/(?!event-stream)|(?:\+|\/)json(?:;|$)|(?:\+|\/)text(?:;|$)|(?:\+|\/)xml(?:;|$)|octet-stream(?:;|$)|javascript|^application\/wasm(?:;|$)/u,
    });
    await app.register(staticPlugin, {
      root,
      prefix: '/',
      cacheControl: false,
      setHeaders: (res, path) => setStaticCacheHeaders(res, path),
      preCompressed: true,
      redirect: true,
    });
    await app.ready();
  });

  it('serves a byte range of a versioned video uncompressed and immutable', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/projects/demo/tile.mp4?v=3f2a9c',
      headers: { range: 'bytes=0-99', 'accept-encoding': 'br, gzip' },
    });
    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe(`bytes 0-99/${size}`);
    expect(res.rawPayload.length).toBe(100);
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    // The CORS trim still applies after the override.
    expect(res.headers.vary ?? '').not.toMatch(/origin/i);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('keeps the one-day policy for an unversioned video', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/demo/tile.mp4' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
  });
});

describe('cross-origin widget assets', () => {
  const PROD_ORIGINS = [
    'https://bilko.run',
    'https://www.bilko.run',
    'https://clerk.bilko.run',
    'https://accounts.bilko.run',
  ];
  let app: Awaited<ReturnType<typeof Fastify>>;

  beforeAll(async () => {
    const root = makeTree();
    const sm = join(root, 'projects', 'session-manager');
    mkdirSync(join(sm, 'widget', 'v1'), { recursive: true });
    mkdirSync(join(sm, 'widgetx'), { recursive: true });
    mkdirSync(join(sm, 'assets'), { recursive: true });
    mkdirSync(join(root, 'projects', 'threewinds'), { recursive: true });
    writeFileSync(join(sm, 'index.html'), '<html><body>sm</body></html>');
    writeFileSync(join(sm, 'assets', 'app.js'), 'console.log("sm")');
    writeFileSync(join(sm, 'widget', 'v1', 'feedback.js'), 'console.log("widget")');
    writeFileSync(join(sm, 'widget', 'v1', 'inter.woff2'), Buffer.from([0x77, 0x4f, 0x46, 0x32]));
    writeFileSync(join(sm, 'widgetx', 'a.js'), 'console.log("x")');
    writeFileSync(join(root, 'projects', 'threewinds', 'x.js'), 'console.log("tw")');
    normalizeStaticMtimes(root);

    // Same order as server/index.ts: cors → versioned media → trim → widget CORS → static.
    app = Fastify({ logger: false });
    await app.register(cors, { origin: PROD_ORIGINS, credentials: true });
    registerVersionedMediaCache(app);
    registerStaticCorsTrim(app);
    registerCrossOriginAssetCors(app);
    await app.register(staticPlugin, {
      root,
      prefix: '/',
      cacheControl: false,
      setHeaders: (res, path) => setStaticCacheHeaders(res, path),
      redirect: true,
    });
    await app.ready();
  });

  it('exports the Session Manager widget prefix only', () => {
    expect(CROSS_ORIGIN_ASSET_PREFIXES).toEqual(['/projects/session-manager/widget/']);
  });

  const ORIGINS: Array<string | undefined> = [undefined, 'https://example.com', 'https://bilko.run'];
  const WIDGET_FILES = [
    '/projects/session-manager/widget/v1/feedback.js',
    '/projects/session-manager/widget/v1/inter.woff2',
  ];

  function expectOpen(res: { headers: Record<string, unknown> }) {
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    expect(String(res.headers.vary ?? '')).not.toMatch(/origin/i);
  }

  for (const origin of ORIGINS) {
    const headers = origin ? { origin } : {};
    const label = origin ?? 'no Origin';

    for (const url of WIDGET_FILES) {
      it(`serves ${url} with ACAO * on 200 and 304 (${label})`, async () => {
        const first = await app.inject({ method: 'GET', url, headers });
        expect(first.statusCode).toBe(200);
        expectOpen(first);

        const head = await app.inject({ method: 'HEAD', url, headers });
        expect(head.statusCode).toBe(200);
        expectOpen(head);

        const etag = first.headers.etag as string;
        expect(etag).toBeTruthy();
        const second = await app.inject({
          method: 'GET',
          url,
          headers: { ...headers, 'if-none-match': etag },
        });
        expect(second.statusCode).toBe(304);
        expectOpen(second);
      });
    }

    it(`serves a missing widget file with ACAO * on 404 (${label})`, async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/projects/session-manager/widget/v1/missing.js',
        headers,
      });
      expect(res.statusCode).toBe(404);
      expectOpen(res);
    });

    it(`matches a percent-encoded widget path (${label})`, async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/projects/session-manager/%77idget/v1/feedback.js',
        headers,
      });
      expectOpen(res);
    });

    for (const url of [
      '/projects/session-manager/',
      '/projects/session-manager/index.html',
      '/projects/session-manager/assets/app.js',
      '/projects/session-manager/widget',
      '/projects/session-manager/widgetx/a.js',
      '/projects/threewinds/x.js',
      '/projects/session-manager/widget/../index.html',
      '/projects/session-manager/widget/%2e%2e/index.html',
    ]) {
      it(`leaves ${url} unchanged (${label})`, async () => {
        const res = await app.inject({ method: 'GET', url, headers });
        expect(res.headers['access-control-allow-origin']).not.toBe('*');
        if (origin === 'https://bilko.run') {
          expect(res.headers['access-control-allow-origin']).toBe('https://bilko.run');
          expect(String(res.headers.vary ?? '')).toMatch(/origin/i);
        } else {
          expect(res.headers['access-control-allow-origin']).toBeUndefined();
        }
      });
    }
  }

  it('keeps other Vary values while dropping Origin', async () => {
    const app2 = Fastify({ logger: false });
    await app2.register(cors, { origin: PROD_ORIGINS, credentials: true });
    registerStaticCorsTrim(app2);
    registerCrossOriginAssetCors(app2);
    app2.get('/projects/session-manager/widget/v1/x.js', async (_req, reply) => {
      reply.header('cache-control', 'public, max-age=600');
      reply.header('vary', 'Origin, Accept-Encoding');
      return reply.type('text/javascript').send('1');
    });
    await app2.ready();
    const res = await app2.inject({
      method: 'GET',
      url: '/projects/session-manager/widget/v1/x.js',
      headers: { origin: 'https://example.com' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers.vary).toBe('Accept-Encoding');
  });

  it('does not open non-GET/HEAD methods', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/projects/session-manager/widget/v1/feedback.js',
      headers: { origin: 'https://example.com' },
    });
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });
});
