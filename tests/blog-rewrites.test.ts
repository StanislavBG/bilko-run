import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { dbGet, dbRun, initDb, applyBlogRewrites } from '../server/db.js';
import { BLOG_REWRITES } from '../server/blog-rewrites/index.js';
import { analyzeReadability } from '../scripts/blog-readability';

const SKILL_DIR = join(__dirname, '../.claude/skills/blog-from-git');

let config: any;

beforeAll(async () => {
  await initDb();
  config = yaml.load(readFileSync(join(SKILL_DIR, 'blog.config.yaml'), 'utf-8'));
});

describe('applyBlogRewrites', () => {
  it('updates title/excerpt/content once, leaves published_at unchanged, and a second application changes nothing', async () => {
    const SLUG = 'blog-rewrites-test-stub-post';
    const MIGRATION = '2026-01-01-blog-rewrites-test-stub';
    const ORIGINAL_PUBLISHED_AT = '2026-01-01T00:00:00.000Z';

    await dbRun('DELETE FROM blog_posts WHERE slug = ?', SLUG);
    await dbRun('DELETE FROM data_migrations WHERE id = ?', MIGRATION);
    await dbRun(
      `INSERT INTO blog_posts (slug, title, excerpt, content, category, published, published_at) VALUES (?, ?, ?, ?, ?, 1, ?)`,
      SLUG, 'Original Title', 'Original excerpt.', 'Original content.', 'build-log', ORIGINAL_PUBLISHED_AT,
    );

    const stub = {
      slug: SLUG,
      migrationId: MIGRATION,
      title: 'Rewritten Title',
      excerpt: 'Rewritten excerpt.',
      content: 'Rewritten content.',
    };

    const post = async () =>
      (await dbGet<{ title: string; excerpt: string; content: string; published_at: string }>(
        'SELECT title, excerpt, content, published_at FROM blog_posts WHERE slug = ?',
        SLUG,
      ))!;

    await applyBlogRewrites([stub]);
    const first = await post();
    expect(first.title).toBe(stub.title);
    expect(first.excerpt).toBe(stub.excerpt);
    expect(first.content).toBe(stub.content);
    expect(first.published_at).toBe(ORIGINAL_PUBLISHED_AT);

    // A later, owner-made edit must not be clobbered by a migration that already ran.
    await dbRun('UPDATE blog_posts SET title = ? WHERE slug = ?', 'Manually changed title', SLUG);
    await applyBlogRewrites([stub]);
    const second = await post();
    expect(second.title).toBe('Manually changed title');

    await dbRun('DELETE FROM blog_posts WHERE slug = ?', SLUG);
    await dbRun('DELETE FROM data_migrations WHERE id = ?', MIGRATION);
  });
});

describe('BLOG_REWRITES', () => {
  it('every entry passes readability, has a unique 2026- migrationId, an existing seeded slug, and a title under 60 chars', async () => {
    const thresholds = {
      maxFkGrade: config.readability.max_fk_grade,
      maxAvgSentenceWords: config.readability.max_avg_sentence_words,
      longSentenceWords: config.readability.long_sentence_words,
      maxLongSentences: config.readability.max_long_sentences,
      jargonBlocklist: config.readability.jargon_blocklist,
    };

    const seenMigrationIds = new Set<string>();
    for (const r of BLOG_REWRITES) {
      const report = analyzeReadability(r.content, thresholds);
      expect(report.pass).toBe(true);

      expect(r.migrationId.startsWith('2026-')).toBe(true);
      expect(seenMigrationIds.has(r.migrationId)).toBe(false);
      seenMigrationIds.add(r.migrationId);

      const seeded = await dbGet('SELECT slug FROM blog_posts WHERE slug = ?', r.slug);
      expect(seeded).toBeDefined();

      expect(r.title.length).toBeLessThan(60);
    }
  });
});
