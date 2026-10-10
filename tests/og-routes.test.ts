import Fastify from 'fastify';
import { describe, it, expect, beforeAll } from 'vitest';
import { registerSecurityHeaders } from '../server/security-headers.js';
import { registerOgRoutes } from '../server/og-routes.js';
import { loadOgProjects } from '../server/og-meta.js';
import { initDb } from '../server/db.js';

const HTML =
  '<html><head><title>Old</title><meta property="og:title" content="Page Roast"></head><body><script src="/a.js"></script></body></html>';

const projects = loadOgProjects();
const app = Fastify();

beforeAll(async () => {
  await initDb();
  registerSecurityHeaders(app);
  registerOgRoutes(app, { projects, blogPosts: [] });
  app.get('/projects/page-roast/', async (_req, reply) => reply.type('text/html').send(HTML));
  app.get('/products/session-manager', async (_req, reply) => reply.type('text/html').send(HTML));
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
    expect(res.body).toContain('https://bilko.run/og/page-roast.png');
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
});
