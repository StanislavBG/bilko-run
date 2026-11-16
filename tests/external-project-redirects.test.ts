import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Fastify, { type FastifyInstance } from 'fastify';
import staticPlugin from '@fastify/static';
import { registerExternalProjectRedirects } from '../server/external-project-redirects';
import { registerBilkoProfileRoutes } from '../server/bilko-profile-routes';
import { PROJECTS } from '../src/data/projectsRegistry';
import type { Project } from '../src/data/projectsRegistry';

const EXT_URL = 'https://ext-fixture.example.com/app';

const base = { name: 'x', tagline: 'x', category: 'Tool', status: 'live', year: 2026 } as const;
const fixtures = [
  { ...base, slug: 'ext-fixture', host: { kind: 'external-url', url: EXT_URL } },
  { ...base, slug: 'static-fixture', host: { kind: 'static-path', path: '/projects/static-fixture/' } },
  { ...base, slug: 'self-fixture', host: { kind: 'external-url', url: 'https://bilko.run/projects/self-fixture/' } },
] as unknown as readonly Project[];

let dist: string;
let app: FastifyInstance;

beforeAll(async () => {
  dist = mkdtempSync(join(tmpdir(), 'ext-redir-'));
  mkdirSync(join(dist, 'projects', 'ext-fixture'), { recursive: true });
  writeFileSync(join(dist, 'projects', 'ext-fixture', 'tile.mp4'), 'mp4-bytes');
  mkdirSync(join(dist, 'projects', 'static-fixture'), { recursive: true });
  writeFileSync(join(dist, 'projects', 'static-fixture', 'index.html'), '<html>static-fixture</html>');
  mkdirSync(join(dist, 'projects', 'self-fixture'), { recursive: true });
  writeFileSync(join(dist, 'projects', 'self-fixture', 'index.html'), '<html>self-fixture</html>');
  app = Fastify();
  await app.register(staticPlugin, { root: dist, prefix: '/', redirect: true });
  registerExternalProjectRedirects(app, fixtures);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  rmSync(dist, { recursive: true, force: true });
});

describe('external-url project redirects', () => {
  for (const url of ['/projects/ext-fixture', '/projects/ext-fixture/', '/projects/ext-fixture/index.html']) {
    it(`GET ${url} 302s to host.url`, async () => {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe(EXT_URL);
      expect(res.headers['cache-control']).toBe('public, max-age=300');
    });
  }

  it('HEAD /projects/ext-fixture also 302s', async () => {
    const res = await app.inject({ method: 'HEAD', url: '/projects/ext-fixture' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(EXT_URL);
  });

  it('media under the slug is still served by static', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/ext-fixture/tile.mp4' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('mp4-bytes');
  });

  it('a static-path project still serves its index.html', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/static-fixture/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('static-fixture');
  });

  it('a self-pointing external-url entry gets no redirect', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/self-fixture/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('self-fixture');
  });

  it('boots alongside the host page routes with the real registry', async () => {
    // human-for-hire is external-url to https://bilko.run/book and its
    // /projects/ paths are owned by bilko-profile-routes; a duplicate
    // registration would crash production boot.
    const real = Fastify();
    registerExternalProjectRedirects(real, PROJECTS);
    registerBilkoProfileRoutes(real, '<html><head></head><body></body></html>');
    await real.ready();
    const res = await real.inject({ method: 'GET', url: '/projects/human-for-hire?ref=x' });
    expect(res.statusCode).toBe(301);
    expect(res.headers.location).toBe('/book?ref=x');
    await real.close();
  });
});
