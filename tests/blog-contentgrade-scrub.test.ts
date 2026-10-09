import { describe, it, expect, beforeAll } from 'vitest';
import { dbGet, dbRun, initDb } from '../server/db.js';

const POST_1 = 'from-saas-to-host-decomposing-bilko-in-one-week';
const POST_2 = 'week-of-six-games';
const MIGRATION_ID = '2026-10-09-blog-drop-content-grade';

const OLD_1 =
  "The MCP commits to the host's `origin` and `content-grade` remotes in parallel — failure on one doesn't block the other — and Render auto-deploys within a minute.";
const OLD_2 = 'Render auto-deploys from `Content-Grade/master`, not `main`, and the webhook';

const content = async (slug: string) =>
  (await dbGet<{ content: string }>('SELECT content FROM blog_posts WHERE slug = ?', slug))!.content;

describe('blog ContentGrade scrub', () => {
  beforeAll(async () => {
    await initDb();
  });

  it('seeded posts do not mention ContentGrade', async () => {
    expect(await content(POST_1)).not.toMatch(/content.?grade/i);
    expect(await content(POST_2)).not.toMatch(/content.?grade/i);
  });

  it('corrects live rows still holding the old sentences, once', async () => {
    for (const [slug, old] of [[POST_1, OLD_1], [POST_2, OLD_2]] as const) {
      const c = await content(slug);
      const marker = slug === POST_1 ? 'The MCP commits to the host repo' : 'Render was auto-deploying from a different branch';
      const idx = c.indexOf(marker);
      expect(idx).toBeGreaterThan(-1);
      const newSentence = slug === POST_1
        ? "The MCP commits to the host repo's `origin` remote, and Render auto-deploys within a minute."
        : 'Render was auto-deploying from a different branch than we assumed, and the webhook';
      await dbRun('UPDATE blog_posts SET content = replace(content, ?, ?) WHERE slug = ?', newSentence, old, slug);
      expect(await content(slug)).toMatch(/content.?grade/i);
    }
    await dbRun('DELETE FROM data_migrations WHERE id = ?', MIGRATION_ID);
    await initDb();
    expect(await content(POST_1)).not.toMatch(/content.?grade/i);
    expect(await content(POST_2)).not.toMatch(/content.?grade/i);
    expect(await content(POST_1)).toContain('Render auto-deploys within a minute.');
  });
});
