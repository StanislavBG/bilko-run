import Fastify from 'fastify';
import { createHash } from 'crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Resvg } from '@resvg/resvg-js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerSecurityHeaders } from '../server/security-headers.js';
import { registerOgRoutes } from '../server/og-routes.js';
import { loadOgProjects } from '../server/og-meta.js';
import { initDb, dbRun } from '../server/db.js';
import { gitViewerOg } from '../server/routes/tools/git-viewer.js';

const HTML =
  '<html><head><title>Old</title><meta property="og:title" content="Page Roast"></head><body><script src="/a.js"></script></body></html>';

const staticRoot = mkdtempSync(join(tmpdir(), 'og-static-'));
const svgPng = (w: number, h: number, fill = '#123456') =>
  Buffer.from(new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${fill}"/></svg>`).render().asPng());
const etagOf = (b: Buffer) => `"${createHash('sha1').update(b).digest('hex').slice(0, 16)}"`;
const goodPng = svgPng(1200, 630);
mkdirSync(join(staticRoot, 'projects', 'share-ok'), { recursive: true });
mkdirSync(join(staticRoot, 'projects', 'share-other'), { recursive: true });
writeFileSync(join(staticRoot, 'projects', 'share-ok', 'og.png'), goodPng);
writeFileSync(join(staticRoot, 'projects', 'share-ok', 'small.png'), svgPng(600, 315));
writeFileSync(join(staticRoot, 'projects', 'share-ok', 'fake.png'), Buffer.from('not a png at all, just text'));
writeFileSync(join(staticRoot, 'projects', 'share-other', 'og.png'), goodPng);
mkdirSync(join(staticRoot, 'projects', 'share-mut'), { recursive: true });
writeFileSync(join(staticRoot, 'projects', 'share-mut', 'og.png'), goodPng);

const mk = (slug: string, shareImage: string) => ({ slug, name: slug, tagline: 't', category: 'c', shareImage });
const projects = [
  ...loadOgProjects(),
  mk('share-ok', '/projects/share-ok/og.png'),
  mk('share-small', '/projects/share-ok/small.png'),
  mk('share-fake', '/projects/share-ok/fake.png'),
  mk('share-missing', '/projects/share-ok/missing.png'),
  mk('share-escape', '/projects/share-ok/../share-other/og.png'),
  mk('share-mut', '/projects/share-mut/og.png'),
];
const app = Fastify();

afterAll(() => rmSync(staticRoot, { recursive: true, force: true }));

beforeAll(async () => {
  await initDb();
  registerSecurityHeaders(app);
  registerOgRoutes(app, { projects, blogPosts: [], dynamic: [gitViewerOg], staticRoot });
  app.get('/projects/page-roast/', async (_req, reply) => reply.type('text/html').send(HTML));
  app.get('/products/session-manager', async (_req, reply) => reply.type('text/html').send(HTML));
  app.get('/projects/git-viewer/', async (_req, reply) => reply.type('text/html').send(HTML));
  await dbRun(
    `INSERT INTO git_viewer_profiles (login, payload, tier, locked_count, updated_at) VALUES (?, ?, 'free', 0, 0)
     ON CONFLICT(login) DO UPDATE SET payload = excluded.payload`,
    'og-cached',
    JSON.stringify({ developer: { name: 'Ada <script>"x"', avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4' } }),
  );
  await dbRun(
    `INSERT INTO git_viewer_profiles (login, payload, tier, locked_count, updated_at) VALUES (?, ?, 'free', 0, 0)
     ON CONFLICT(login) DO UPDATE SET payload = excluded.payload`,
    'og-badavatar',
    JSON.stringify({ developer: { name: 'Bob', avatarUrl: 'javascript:alert(1)' } }),
  );
  app.get('/api/thing', async () => ({ ok: true }));
  await app.ready();
});

describe('OG image routes', () => {
  it('renders a registry slug card', async () => {
    const res = await app.inject({ method: 'GET', url: '/og/page-roast.png' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    expect(res.headers.etag).toBe(etagOf(res.rawPayload));
  });

  it('renders the default card', async () => {
    const res = await app.inject({ method: 'GET', url: '/og/default.png' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
  });

  it('serves a valid 1200x630 shareImage byte-for-byte', async () => {
    const res = await app.inject({ method: 'GET', url: '/og/share-ok.png' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    expect(res.headers.etag).toBe(etagOf(goodPng));
    expect(Buffer.compare(res.rawPayload, goodPng)).toBe(0);
  });

  it('carries a content ETag on the default and fallback cards', async () => {
    for (const url of ['/og/default.png', '/og/share-small.png']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(res.headers.etag).toMatch(/^"[0-9a-f]{16}"$/);
      expect(res.headers.etag).toBe(etagOf(res.rawPayload));
    }
  });

  it('answers a matching If-None-Match with an empty 304', async () => {
    const tag = etagOf(goodPng);
    for (const inm of [tag, `W/${tag}`, `"0000000000000000", ${tag}`, '*']) {
      const res = await app.inject({ method: 'GET', url: '/og/share-ok.png', headers: { 'if-none-match': inm } });
      expect(res.statusCode, inm).toBe(304);
      expect(res.rawPayload.length).toBe(0);
      expect(res.headers.etag).toBe(tag);
      expect(res.headers['cache-control']).toBe('public, max-age=300');
    }
    const gen = await app.inject({ method: 'GET', url: '/og/page-roast.png' });
    const res = await app.inject({
      method: 'GET',
      url: '/og/page-roast.png?v=abc12345',
      headers: { 'if-none-match': gen.headers.etag as string },
    });
    expect(res.statusCode).toBe(304);
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
  });

  it('sends the full 200 on a stale If-None-Match', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/og/share-ok.png',
      headers: { 'if-none-match': '"0000000000000000", W/"1111111111111111"' },
    });
    expect(res.statusCode).toBe(200);
    expect(Buffer.compare(res.rawPayload, goodPng)).toBe(0);
  });

  it('caches versioned requests for a day', async () => {
    const res = await app.inject({ method: 'GET', url: '/og/share-ok.png?v=abc12345' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
    const empty = await app.inject({ method: 'GET', url: '/og/share-ok.png?v=' });
    expect(empty.headers['cache-control']).toBe('public, max-age=300');
  });

  it('changes the ETag when the shareImage file is rewritten', async () => {
    const before = await app.inject({ method: 'GET', url: '/og/share-mut.png' });
    expect(before.headers.etag).toBe(etagOf(goodPng));
    const next = svgPng(1200, 630, '#abcdef');
    expect(Buffer.compare(next, goodPng)).not.toBe(0);
    writeFileSync(join(staticRoot, 'projects', 'share-mut', 'og.png'), next);
    const after = await app.inject({ method: 'GET', url: '/og/share-mut.png' });
    expect(after.statusCode).toBe(200);
    expect(after.headers.etag).toBe(etagOf(next));
    expect(after.headers.etag).not.toBe(before.headers.etag);
    const stale = await app.inject({
      method: 'GET',
      url: '/og/share-mut.png',
      headers: { 'if-none-match': before.headers.etag as string },
    });
    expect(stale.statusCode).toBe(200);
  });

  it.each(['share-small', 'share-fake', 'share-missing', 'share-escape'])(
    'falls back to the generated card for %s',
    async slug => {
      const res = await app.inject({ method: 'GET', url: `/og/${slug}.png` });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('image/png');
      expect(Buffer.compare(res.rawPayload, goodPng)).not.toBe(0);
      expect(res.rawPayload.subarray(0, 4).toString('hex')).toBe('89504e47');
    },
  );

  it('404s unknown and malformed names', async () => {
    for (const url of ['/og/nope.png', '/og/..%2fx.png']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toContain('text/plain');
    }
  });
});

describe('OG meta injection', () => {
  it('injects the project card into a static-path HTML response and keeps the nonce', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/page-roast/' });
    const name = projects.find(p => p.slug === 'page-roast')!;
    expect(res.body).toContain('og:title');
    expect(res.body).toContain(`${name.displayName ?? name.name} — bilko.run`);
    expect(res.body).toMatch(/https:\/\/bilko\.run\/og\/page-roast\.png\?v=[0-9a-f]{8}/);
    expect(res.body).not.toContain('content="Page Roast"');
    expect(res.body).toContain('name="csp-nonce"');
  });

  it('uses the session-manager tagline for /products/session-manager', async () => {
    const res = await app.inject({ method: 'GET', url: '/products/session-manager' });
    const sm = projects.find(p => p.slug === 'session-manager')!;
    expect(res.body).toContain(sm.tagline);
  });

  it('leaves JSON responses untouched', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/thing' });
    expect(res.body).toBe('{"ok":true}');
  });

  describe('git-viewer ?u= share cards', () => {
    const ogTitle = (body: string) => /property="og:title" content="([^"]*)"/.exec(body)?.[1];
    const ogImage = (body: string) => /property="og:image" content="([^"]*)"/.exec(body)?.[1];

    it('uses the cached name and avatar, HTML-escaped', async () => {
      const res = await app.inject({ method: 'GET', url: '/projects/git-viewer/?u=OG-Cached' });
      expect(ogTitle(res.body)).toBe('Ada &lt;script&gt;&quot;x&quot; — Your Git, your Résumé');
      expect(ogImage(res.body)).toBe('https://avatars.githubusercontent.com/u/1?v=4');
      expect(res.body).toContain('name="twitter:card" content="summary"');
      expect(res.body).toContain('content="https://bilko.run/projects/git-viewer/?u=OG-Cached"');
      expect(res.body).not.toContain('<script>"x"');
      expect(res.body).toContain('name="csp-nonce"');
    });

    it('falls back to the login and static card when uncached or the avatar is off-host', async () => {
      const a = await app.inject({ method: 'GET', url: '/projects/git-viewer/?u=octocat' });
      expect(ogTitle(a.body)).toBe('octocat — Your Git, your Résumé');
      expect(ogImage(a.body)).toBe('https://bilko.run/og/git-viewer.png');
      const b = await app.inject({ method: 'GET', url: '/projects/git-viewer/?u=og-badavatar' });
      expect(ogTitle(b.body)).toBe('Bob — Your Git, your Résumé');
      expect(ogImage(b.body)).toBe('https://bilko.run/og/git-viewer.png');
    });

    it('serves static project meta for a missing or invalid ?u=', async () => {
      const gv = projects.find(p => p.slug === 'git-viewer')!;
      for (const url of ['/projects/git-viewer/', '/projects/git-viewer/?u=%22%3E%3Cscript%3E', '/projects/git-viewer/?u=-bad-']) {
        const res = await app.inject({ method: 'GET', url });
        expect(ogTitle(res.body)).toBe(`${gv.displayName ?? gv.name} — bilko.run`);
        expect(res.body).not.toContain('<script>"');
      }
    });

    it('ignores ?u= on other pages', async () => {
      const res = await app.inject({ method: 'GET', url: '/projects/page-roast/?u=octocat' });
      expect(res.body).not.toContain('Your Git, your Résumé');
    });
  });
});

describe('OG image routes: hosted card media', () => {
  const hostedApp = Fastify();
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  const shareBytes = svgPng(1200, 630, '#0f0f0f');
  const iconBytes = svgPng(256, 256, '#ff0000');
  const wrongBytes = svgPng(600, 315);
  const shareFile = `${sha(shareBytes)}.png`;
  const iconFile = `${sha(iconBytes)}.png`;
  const wrongFile = `${sha(wrongBytes)}.png`;
  const missingFile = `${'a'.repeat(64)}.png`;
  const store: Record<string, Buffer> = {
    [`h-share/${shareFile}`]: shareBytes,
    [`h-icon/${iconFile}`]: iconBytes,
    [`h-wrong/${wrongFile}`]: wrongBytes,
  };
  const calls: string[] = [];
  const hp = (slug: string, file: string) => `/projects/${slug}/_media/${file}`;
  const hostedProjects = [
    { slug: 'h-share', name: 'H', tagline: 't', category: 'c', shareImage: hp('h-share', shareFile) },
    { slug: 'h-icon', name: 'H', tagline: 't', category: 'c', icon: hp('h-icon', iconFile) },
    { slug: 'h-plain', name: 'H', tagline: 't', category: 'c' },
    { slug: 'h-missing', name: 'H', tagline: 't', category: 'c', shareImage: hp('h-missing', missingFile) },
    { slug: 'h-wrong', name: 'H', tagline: 't', category: 'c', shareImage: hp('h-wrong', wrongFile) },
    { slug: 'h-icon-missing', name: 'H', tagline: 't', category: 'c', icon: hp('h-icon-missing', missingFile) },
  ];

  beforeAll(async () => {
    registerOgRoutes(hostedApp, {
      projects: hostedProjects,
      blogPosts: [],
      getHostedMedia: async (slug, file) => {
        calls.push(`${slug}/${file}`);
        return store[`${slug}/${file}`] ?? null;
      },
    });
    await hostedApp.ready();
  });
  afterAll(() => hostedApp.close());

  it('serves a hosted 1200x630 shareImage from the media store', async () => {
    const res = await hostedApp.inject({ method: 'GET', url: '/og/h-share.png?v=abc12345' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(Buffer.compare(res.rawPayload, shareBytes)).toBe(0);
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
    expect(calls).toContain(`h-share/${shareFile}`);
  });

  it('composites a hosted square icon into the generated card', async () => {
    const withIcon = await hostedApp.inject({ method: 'GET', url: '/og/h-icon.png?v=abc12345' });
    const plain = await hostedApp.inject({ method: 'GET', url: '/og/h-plain.png?v=abc12345' });
    expect(withIcon.statusCode).toBe(200);
    expect(withIcon.headers['cache-control']).toBe('public, max-age=86400');
    expect(calls).toContain(`h-icon/${iconFile}`);
    expect(Buffer.compare(withIcon.rawPayload, plain.rawPayload)).not.toBe(0);
    expect(Buffer.compare(withIcon.rawPayload, iconBytes)).not.toBe(0);
  });

  it.each(['h-missing', 'h-wrong', 'h-icon-missing'])(
    'serves the generated card with a short cache when hosted media for %s is missing or unusable',
    async slug => {
      const res = await hostedApp.inject({ method: 'GET', url: `/og/${slug}.png?v=abc12345` });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('image/png');
      expect(res.headers['cache-control']).toBe('public, max-age=60');
      expect(Buffer.compare(res.rawPayload, shareBytes)).not.toBe(0);
      expect(Buffer.compare(res.rawPayload, wrongBytes)).not.toBe(0);
    },
  );
});
