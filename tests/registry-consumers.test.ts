// @vitest-environment node
// The OG cards, /sitemap.xml and the external-url redirects read the Bilko-DB registry
// snapshot: same output as the bundled-file readers for the same data, and a registry edit
// (putProject/deleteProject + refreshRegistry) shows without a restart.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import Fastify, { type FastifyInstance } from 'fastify';
import { dbAll, dbRun, initDb } from '../server/db.js';
import { deleteProject, putProject } from '../server/services/registry-db.js';
import { getRegistrySnapshot, initRegistry, refreshRegistry } from '../server/registry-runtime.js';
import { loadOgProjects, resolveOg } from '../server/og-meta.js';
import { buildSitemapXml, registerSitemapRoutes } from '../server/routes/sitemap.js';
import { registerExternalProjectRedirects } from '../server/external-project-redirects.js';
import { PROJECTS } from '../src/data/projectsRegistry.js';
import { toCardProject } from '../shared/asset-versions.js';

const REPO_FILE = resolve(__dirname, '..', 'src/data/standalone-projects.json');
const ACTOR = 'test:registry-consumers';

function entry(slug: string, extra: Record<string, unknown> = {}) {
  return {
    slug,
    name: slug.toUpperCase(),
    tagline: `${slug} tagline`,
    category: 'Test',
    status: 'live',
    year: 2026,
    public: true,
    host: { kind: 'static-path', path: `/projects/${slug}/` },
    ...extra,
  };
}

async function resetRegistry(): Promise<void> {
  await dbRun('DELETE FROM bilko_db_projects');
  await dbRun('DELETE FROM bilko_db_project_log');
  await dbRun('DELETE FROM bilko_db_meta');
  await refreshRegistry();
}

async function publishedPosts(): Promise<{ slug: string; publishedAt: string }[]> {
  const rows = await dbAll<{ slug: string; published_at: string }>(
    "SELECT slug, published_at FROM blog_posts WHERE published = 1 AND datetime(published_at) <= datetime('now') ORDER BY published_at DESC",
  );
  return rows.map((r) => ({ slug: r.slug, publishedAt: String(r.published_at) }));
}

let dist: string;
beforeAll(async () => {
  await initDb();
  dist = mkdtempSync(join(tmpdir(), 'registry-consumers-'));
  writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');
});
afterAll(async () => {
  rmSync(dist, { recursive: true, force: true });
  await resetRegistry();
});

describe('same output as the bundled registry file for the same data', () => {
  beforeAll(async () => {
    await resetRegistry();
    await initRegistry({ file: REPO_FILE });
  });

  it('the snapshot holds the bundled file', () => {
    const raw = JSON.parse(readFileSync(REPO_FILE, 'utf-8')) as { slug: string }[];
    expect(getRegistrySnapshot().map((p) => p.slug)).toEqual(raw.map((p) => p.slug));
  });

  it('OG: loadOgProjects() equals the file reader', () => {
    expect(loadOgProjects()).toEqual(loadOgProjects(REPO_FILE));
  });

  it('sitemap: the route serves what buildSitemapXml makes from the bundled PROJECTS', async () => {
    const app = Fastify();
    registerSitemapRoutes(app, { distPath: dist });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/sitemap.xml' });
    await app.close();
    expect(res.statusCode).toBe(200);
    const expected = buildSitemapXml({
      projects: PROJECTS,
      posts: await publishedPosts(),
      isPublished: () => false,
      robotsTxt: 'User-agent: *\nAllow: /\n',
    });
    expect(res.body).toBe(expected);
  });

  it('redirects: every off-site external-url entry 302s to its host.url', async () => {
    const app = Fastify();
    registerExternalProjectRedirects(app);
    await app.ready();
    const external = PROJECTS.filter((p) => p.host.kind === 'external-url');
    for (const p of external) {
      if (p.host.kind !== 'external-url') continue;
      const self = /^https?:\/\/(www\.)?bilko\.run\//.test(p.host.url);
      const res = await app.inject({ method: 'GET', url: `/projects/${p.slug}` });
      if (self) expect(res.statusCode, p.slug).toBe(404);
      else {
        expect(res.statusCode, p.slug).toBe(302);
        expect(res.headers.location).toBe(p.host.url);
      }
    }
    await app.close();
  });
});

describe('a changed snapshot shows after refreshRegistry()', () => {
  beforeEach(resetRegistry);

  it('OG: an OgContext built once at boot sees an added, edited and removed project', async () => {
    await putProject(entry('og-alpha'), ACTOR);
    await refreshRegistry();
    const ctx = { projects: loadOgProjects(), blogPosts: [] };
    expect(ctx.projects).toEqual(getRegistrySnapshot().map((p) => toCardProject(p as unknown as Record<string, unknown>)));
    expect(resolveOg('/projects/og-alpha/', ctx)?.description).toBe('og-alpha tagline');
    expect(resolveOg('/projects/og-beta/', ctx)).toBeNull();

    await putProject(entry('og-alpha', { tagline: 'edited tagline' }), ACTOR);
    await putProject(entry('og-beta'), ACTOR);
    await refreshRegistry();
    expect(resolveOg('/projects/og-alpha/', ctx)?.description).toBe('edited tagline');
    expect(resolveOg('/projects/og-beta/', ctx)?.title).toBe('OG-BETA — bilko.run');

    await deleteProject('og-alpha', ACTOR);
    await refreshRegistry();
    expect(resolveOg('/projects/og-alpha/', ctx)).toBeNull();
  });

  it('sitemap: a registry change drops the memo', async () => {
    mkdirSync(join(dist, 'projects', 'map-alpha'), { recursive: true });
    writeFileSync(join(dist, 'projects', 'map-alpha', 'index.html'), '<html></html>');
    mkdirSync(join(dist, 'projects', 'map-beta'), { recursive: true });
    writeFileSync(join(dist, 'projects', 'map-beta', 'index.html'), '<html></html>');
    await putProject(entry('map-alpha'), ACTOR);
    await refreshRegistry();

    const app = Fastify();
    registerSitemapRoutes(app, { distPath: dist });
    await app.ready();
    const first = (await app.inject({ method: 'GET', url: '/sitemap.xml' })).body;
    expect(first).toContain('<loc>https://bilko.run/projects/map-alpha/</loc>');
    expect(first).not.toContain('map-beta');

    // Unchanged registry: the memo still serves the same body.
    await refreshRegistry();
    expect((await app.inject({ method: 'GET', url: '/sitemap.xml' })).body).toBe(first);

    await putProject(entry('map-beta'), ACTOR);
    await deleteProject('map-alpha', ACTOR);
    await refreshRegistry();
    const second = (await app.inject({ method: 'GET', url: '/sitemap.xml' })).body;
    expect(second).toContain('<loc>https://bilko.run/projects/map-beta/</loc>');
    expect(second).not.toContain('map-alpha');
    await app.close();
  });

  it('redirects: a new or removed external-url slug takes effect without a restart', async () => {
    const app: FastifyInstance = Fastify();
    registerExternalProjectRedirects(app);
    await app.ready();
    const get = (url: string) => app.inject({ method: 'GET', url });
    expect((await get('/projects/ext-new/')).statusCode).toBe(404);

    await putProject(entry('ext-new', { host: { kind: 'external-url', url: 'https://ext-new.example.com/' } }), ACTOR);
    await refreshRegistry();
    for (const url of ['/projects/ext-new', '/projects/ext-new/', '/projects/ext-new/index.html?ref=x']) {
      const res = await get(url);
      expect(res.statusCode, url).toBe(302);
      expect(res.headers.location).toBe('https://ext-new.example.com/');
      expect(res.headers['cache-control']).toBe('public, max-age=300');
    }
    expect((await get('/projects/ext-new/tile.mp4')).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/projects/ext-new' })).statusCode).toBe(404);

    await putProject(entry('ext-new', { host: { kind: 'external-url', url: 'https://moved.example.com/' } }), ACTOR);
    await refreshRegistry();
    expect((await get('/projects/ext-new')).headers.location).toBe('https://moved.example.com/');

    await deleteProject('ext-new', ACTOR);
    await refreshRegistry();
    expect((await get('/projects/ext-new')).statusCode).toBe(404);
    await app.close();
  });
});
