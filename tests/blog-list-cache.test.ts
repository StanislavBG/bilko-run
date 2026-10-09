import Fastify from 'fastify';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.mock('../server/db.js', async (orig) => {
  const actual = await orig<typeof import('../server/db.js')>();
  return { ...actual, dbAll: vi.fn(actual.dbAll), dbGet: vi.fn(actual.dbGet) };
});
vi.mock('../server/clerk.js', () => ({ requireAdmin: async () => true }));

import { dbAll, dbGet, dbRun, initDb } from '../server/db.js';
import { registerBlogRoutes } from '../server/routes/blog.js';

const stamp = Date.now();
const soonSlug = `test-cache-soon-${stamp}`;
const adminSlug = `test-cache-admin-${stamp}`;

describe('Public blog list memo', () => {
  const app = Fastify();
  const list = async () => {
    const res = await app.inject({ method: 'GET', url: '/api/blog' });
    expect(res.statusCode).toBe(200);
    return res;
  };
  const slugs = (res: { json: () => unknown }) => (res.json() as Array<{ slug: string }>).map(p => p.slug);

  beforeAll(async () => {
    await initDb();
    registerBlogRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await dbRun('DELETE FROM blog_posts WHERE slug IN (?, ?)', soonSlug, adminSlug);
    await app.close();
  });

  it('serves a second GET within 60 s without touching the DB and sets Cache-Control', async () => {
    const first = await list();
    expect(first.headers['cache-control']).toBe('public, max-age=60');
    const calls = vi.mocked(dbAll).mock.calls.length + vi.mocked(dbGet).mock.calls.length;
    const second = await list();
    expect(vi.mocked(dbAll).mock.calls.length + vi.mocked(dbGet).mock.calls.length).toBe(calls);
    expect(second.json()).toEqual(first.json());
  });

  it('shows a scheduled post once its publish time passes', async () => {
    await app.inject({ method: 'GET', url: '/api/blog' });
    await dbRun(
      `INSERT INTO blog_posts (slug, title, excerpt, content, category, cover_image, published, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      soonSlug, 'Soon', 'e', 'c', 'build-log', null, 1, new Date(Date.now() + 2000).toISOString(),
    );
    // Force a fresh memo entry now that the scheduled post exists (the admin write path clears it).
    await app.inject({
      method: 'PUT', url: '/api/blog/admin/999999999',
      payload: { title: 't', excerpt: 'e', content: 'c', category: 'build-log', cover_image: null, published: false },
    });
    expect(slugs(await list())).not.toContain(soonSlug);
    await new Promise(r => setTimeout(r, 2300));
    expect(slugs(await list())).toContain(soonSlug);
  }, 15_000);

  it('admin create clears the memo', async () => {
    const before = await list();
    expect(slugs(before)).not.toContain(adminSlug);
    const created = await app.inject({
      method: 'POST', url: '/api/blog/admin/create',
      payload: { slug: adminSlug, title: 'Admin', content: 'c', published: true },
    });
    expect(created.statusCode).toBe(200);
    expect(slugs(await list())).toContain(adminSlug);
  });
});
