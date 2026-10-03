import Fastify from 'fastify';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { dbRun, initDb } from '../server/db.js';
import { registerBlogRoutes } from '../server/routes/blog.js';

const pastSlug = `test-scheduled-past-${Date.now()}`;
const futureSlug = `test-scheduled-future-${Date.now()}`;

describe('Scheduled blog post publishing', () => {
  const app = Fastify();

  beforeAll(async () => {
    await initDb();
    registerBlogRoutes(app);
    await app.ready();

    const pastDate = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const futureDate = new Date(Date.now() + 2 * 86_400_000).toISOString();

    await dbRun(
      `INSERT INTO blog_posts (slug, title, excerpt, content, category, cover_image, published, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      pastSlug, 'Past Post', 'excerpt', 'content', 'build-log', null, 1, pastDate,
    );
    await dbRun(
      `INSERT INTO blog_posts (slug, title, excerpt, content, category, cover_image, published, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      futureSlug, 'Future Post', 'excerpt', 'content', 'build-log', null, 1, futureDate,
    );
  });

  afterAll(async () => {
    await dbRun('DELETE FROM blog_posts WHERE slug = ?', pastSlug);
    await dbRun('DELETE FROM blog_posts WHERE slug = ?', futureSlug);
    await app.close();
  });

  it('list endpoint includes the past post but not the future post', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/blog' });
    expect(res.statusCode).toBe(200);
    const posts = res.json() as Array<{ slug: string }>;
    const slugs = posts.map((p) => p.slug);
    expect(slugs).toContain(pastSlug);
    expect(slugs).not.toContain(futureSlug);
  });

  it('single-post endpoint returns the past post', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/blog/${pastSlug}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().slug).toBe(pastSlug);
  });

  it('single-post endpoint 404s for the future post', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/blog/${futureSlug}` });
    expect(res.statusCode).toBe(404);
  });
});
