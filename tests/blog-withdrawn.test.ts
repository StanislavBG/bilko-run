import { describe, it, expect, beforeAll } from 'vitest';
import { dbGet, dbRun, initDb } from '../server/db.js';
import { loadWithdrawnSlugs } from '../server/blog-posts.js';

const SLUG = 'a-minesweeper-that-never-makes-you-guess';
const MIGRATION_ID = `blog-withdraw:${SLUG}`;

const published = async () =>
  (await dbGet<{ published: number }>('SELECT published FROM blog_posts WHERE slug = ?', SLUG))!.published;

describe('blog withdrawn.txt', () => {
  beforeAll(async () => {
    await initDb();
  });

  it('lists the slug', () => {
    expect(loadWithdrawnSlugs()).toContain(SLUG);
  });

  it('unpublishes the live row once', async () => {
    await dbRun(
      `INSERT OR IGNORE INTO blog_posts (slug, title, excerpt, content, category, published, published_at)
       VALUES (?, 't', 'e', 'c', 'x', 1, '2026-11-05T00:00:00.000Z')`,
      SLUG,
    );
    await dbRun('UPDATE blog_posts SET published = 1 WHERE slug = ?', SLUG);
    await dbRun('DELETE FROM data_migrations WHERE id = ?', MIGRATION_ID);
    await initDb();
    expect(await published()).toBe(0);
    await dbRun('UPDATE blog_posts SET published = 1 WHERE slug = ?', SLUG);
    await initDb();
    expect(await published()).toBe(1);
  });
});
