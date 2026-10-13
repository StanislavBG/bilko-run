import Fastify from 'fastify';
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
const svgPng = (w: number, h: number) =>
  Buffer.from(new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#123456"/></svg>`).render().asPng());
const goodPng = svgPng(1200, 630);
mkdirSync(join(staticRoot, 'projects', 'share-ok'), { recursive: true });
mkdirSync(join(staticRoot, 'projects', 'share-other'), { recursive: true });
writeFileSync(join(staticRoot, 'projects', 'share-ok', 'og.png'), goodPng);
writeFileSync(join(staticRoot, 'projects', 'share-ok', 'small.png'), svgPng(600, 315));
writeFileSync(join(staticRoot, 'projects', 'share-ok', 'fake.png'), Buffer.from('not a png at all, just text'));
writeFileSync(join(staticRoot, 'projects', 'share-other', 'og.png'), goodPng);

const mk = (slug: string, shareImage: string) => ({ slug, name: slug, tagline: 't', category: 'c', shareImage });
const projects = [
  ...loadOgProjects(),
  mk('share-ok', '/projects/share-ok/og.png'),
  mk('share-small', '/projects/share-ok/small.png'),
  mk('share-fake', '/projects/share-ok/fake.png'),
  mk('share-missing', '/projects/share-ok/missing.png'),
  mk('share-escape', '/projects/share-ok/../share-other/og.png'),
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
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
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
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
    expect(Buffer.compare(res.rawPayload, goodPng)).toBe(0);
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
