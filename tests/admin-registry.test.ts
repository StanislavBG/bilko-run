// @vitest-environment node
// Registry write API: list with versions, compare-and-set PUT, DELETE, audit log, scope guard,
// and that a write reaches /api/projects at once (refreshRegistry).
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import Fastify from 'fastify';

const { verifyTokenMock, getUserMock, createClerkClientMock } = vi.hoisted(() => ({
  verifyTokenMock: vi.fn(),
  getUserMock: vi.fn(),
  createClerkClientMock: vi.fn(),
}));

vi.mock('@clerk/backend', () => ({
  verifyToken: verifyTokenMock,
  createClerkClient: createClerkClientMock,
}));

import { initDb, dbRun } from '../server/db.js';
import { refreshRegistry } from '../server/registry-runtime.js';
import { mintAdminApiKey } from '../server/services/admin-api-keys.js';
import { registerAdminRegistryRoutes } from '../server/routes/admin-registry.js';
import { registerProjectCatalogRoutes } from '../server/routes/project-catalog.js';

const ADMIN_EMAIL = 'bilkobibitkov2000@gmail.com';
const CLERK_TOKEN = 'clerk-session-token';

const app = Fastify({ logger: false });
registerAdminRegistryRoutes(app);
registerProjectCatalogRoutes(app, { listOffers: async () => [] });

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

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
let registryKey = '';
let registryKeyId = 0;
let readKey = '';

async function resetRegistry(): Promise<void> {
  await dbRun('DELETE FROM bilko_db_projects');
  await dbRun('DELETE FROM bilko_db_project_log');
  await dbRun('DELETE FROM bilko_db_meta');
  await refreshRegistry();
}

beforeAll(async () => {
  process.env.CLERK_SECRET_KEY = 'test-secret';
  createClerkClientMock.mockReturnValue({ users: { getUser: getUserMock } });
  verifyTokenMock.mockImplementation(async (t: string) => {
    if (t === CLERK_TOKEN) return { sub: 'user_admin' };
    throw new Error('invalid token');
  });
  getUserMock.mockResolvedValue({ primaryEmailAddress: { emailAddress: ADMIN_EMAIL } });
  await initDb();
  await dbRun('DELETE FROM admin_api_keys');
  const reg = await mintAdminApiKey(ADMIN_EMAIL, 'mcp', 90, 'registry');
  registryKey = reg.key;
  registryKeyId = reg.id;
  readKey = (await mintAdminApiKey(ADMIN_EMAIL, 'ro', 90, 'read')).key;
  await app.ready();
});

beforeEach(resetRegistry);
afterAll(async () => {
  await resetRegistry();
  await dbRun('DELETE FROM admin_api_keys');
});

const put = (slug: string, payload: unknown, token = registryKey) =>
  app.inject({ method: 'PUT', url: `/api/admin/registry/${slug}`, headers: bearer(token), payload: payload as object });

describe('GET /api/admin/registry', () => {
  it('needs admin auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/registry' });
    expect(res.statusCode).toBe(403);
  });

  it('lists every entry, non-public included, with versions (read key allowed)', async () => {
    expect((await put('alpha', { entry: entry('alpha') })).statusCode).toBe(200);
    expect((await put('hidden', { entry: entry('hidden', { public: false }) })).statusCode).toBe(200);
    expect((await put('alpha', { entry: entry('alpha', { tagline: 'new' }) })).statusCode).toBe(200);
    const res = await app.inject({ method: 'GET', url: '/api/admin/registry', headers: bearer(readKey) });
    expect(res.statusCode).toBe(200);
    const projects = res.json().projects as Array<{ entry: { slug: string; tagline: string }; version: number }>;
    expect(projects.map((p) => [p.entry.slug, p.version])).toEqual([['alpha', 2], ['hidden', 1]]);
    expect(projects[0]!.entry.tagline).toBe('new');
  });
});

describe('PUT /api/admin/registry/:slug', () => {
  it('creates, answers { slug, version }, and /api/projects shows it immediately', async () => {
    const res = await put('fresh', { entry: entry('fresh') });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ slug: 'fresh', version: 1 });
    const cat = await app.inject({ method: 'GET', url: '/api/projects' });
    const slugs = (cat.json().projects as Array<{ slug: string }>).map((p) => p.slug);
    expect(slugs).toContain('fresh');

    expect((await put('fresh', { entry: entry('fresh', { name: 'Renamed' }) })).json()).toEqual({ slug: 'fresh', version: 2 });
    const cat2 = await app.inject({ method: 'GET', url: '/api/projects' });
    expect((cat2.json().projects as Array<{ slug: string; name: string }>).find((p) => p.slug === 'fresh')?.name).toBe('Renamed');
  });

  it('accepts an admin Clerk session', async () => {
    const res = await put('viasession', { entry: entry('viasession') }, CLERK_TOKEN);
    expect(res.statusCode).toBe(200);
  });

  it('honors ifVersion: match writes, mismatch is 409 version_mismatch with the current version', async () => {
    expect((await put('cas', { entry: entry('cas'), ifVersion: 0 })).json()).toEqual({ slug: 'cas', version: 1 });
    const stale = await put('cas', { entry: entry('cas', { name: 'X' }), ifVersion: 0 });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ error: 'version_mismatch', version: 1 });
    expect((await put('cas', { entry: entry('cas', { name: 'Y' }), ifVersion: 1 })).json()).toEqual({ slug: 'cas', version: 2 });
  });

  it('400 on an invalid entry, with issues', async () => {
    const res = await put('bad', { entry: { slug: 'bad' } });
    expect(res.statusCode).toBe(400);
    expect(Array.isArray(res.json().issues)).toBe(true);
    expect(res.json().issues.length).toBeGreaterThan(0);
  });

  it('400 when entry.slug differs from the URL slug', async () => {
    const res = await put('one', { entry: entry('two') });
    expect(res.statusCode).toBe(400);
    expect(res.json().issues.join(' ')).toMatch(/slug/);
  });

  it('400 on a non-integer ifVersion or missing entry', async () => {
    expect((await put('x', { entry: entry('x'), ifVersion: 'a' })).statusCode).toBe(400);
    expect((await put('x', {})).statusCode).toBe(400);
  });

  it('a read-scope key cannot write', async () => {
    const res = await put('nope', { entry: entry('nope') }, readKey);
    expect(res.statusCode).toBe(403);
    const del = await app.inject({ method: 'DELETE', url: '/api/admin/registry/nope', headers: bearer(readKey) });
    expect(del.statusCode).toBe(403);
    const list = await app.inject({ method: 'GET', url: '/api/admin/registry', headers: bearer(readKey) });
    expect(list.json().projects).toEqual([]);
  });

  it('no auth is refused', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/admin/registry/anon', payload: { entry: entry('anon') } });
    expect(res.statusCode).toBe(403);
  });
});

describe('DELETE /api/admin/registry/:slug', () => {
  it('deletes, refreshes the catalog, then 404s', async () => {
    await put('gone', { entry: entry('gone') });
    const res = await app.inject({ method: 'DELETE', url: '/api/admin/registry/gone', headers: bearer(registryKey) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    const cat = await app.inject({ method: 'GET', url: '/api/projects' });
    expect((cat.json().projects as Array<{ slug: string }>).map((p) => p.slug)).not.toContain('gone');
    const again = await app.inject({ method: 'DELETE', url: '/api/admin/registry/gone', headers: bearer(registryKey) });
    expect(again.statusCode).toBe(404);
  });

  it('honors ifVersion', async () => {
    await put('keep', { entry: entry('keep') });
    const stale = await app.inject({ method: 'DELETE', url: '/api/admin/registry/keep?ifVersion=5', headers: bearer(registryKey) });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ error: 'version_mismatch', version: 1 });
    const body = await app.inject({
      method: 'DELETE', url: '/api/admin/registry/keep', headers: bearer(registryKey), payload: { ifVersion: 1 },
    });
    expect(body.statusCode).toBe(200);
  });
});

describe('GET /api/admin/registry/log', () => {
  it('answers newest-first rows, filtered by slug, capped at 100', async () => {
    expect((await put('aaa', { entry: entry('aaa') })).statusCode).toBe(200);
    expect((await put('bbb', { entry: entry('bbb') })).statusCode).toBe(200);
    await app.inject({ method: 'DELETE', url: '/api/admin/registry/aaa', headers: bearer(registryKey) });

    const all = await app.inject({ method: 'GET', url: '/api/admin/registry/log', headers: bearer(readKey) });
    expect(all.statusCode).toBe(200);
    const rows = all.json().rows as Array<{ slug: string; action: string; actor: string }>;
    expect(rows.map((r) => [r.slug, r.action])).toEqual([['aaa', 'delete'], ['bbb', 'put'], ['aaa', 'put']]);
    expect(rows[0]!.actor).toBe(`key:${registryKeyId}`);

    const onlyA = await app.inject({ method: 'GET', url: '/api/admin/registry/log?slug=aaa', headers: bearer(readKey) });
    expect((onlyA.json().rows as Array<{ action: string }>).map((r) => r.action)).toEqual(['delete', 'put']);

    for (let i = 0; i < 105; i++) {
      await dbRun(
        'INSERT INTO bilko_db_project_log (slug, action, before_json, after_json, actor, at) VALUES (?, ?, ?, ?, ?, ?)',
        'bulk', 'put', null, '{}', 'test', i,
      );
    }
    const capped = await app.inject({ method: 'GET', url: '/api/admin/registry/log', headers: bearer(readKey) });
    expect(capped.json().rows).toHaveLength(100);
  });

  it('needs admin auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/registry/log' });
    expect(res.statusCode).toBe(403);
  });
});
