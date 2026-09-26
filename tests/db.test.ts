import { describe, it, expect, beforeAll } from 'vitest';
import { dbGet, dbAll, dbRun, initDb } from '../server/db.js';

beforeAll(async () => {
  // Use local file DB (TURSO_DATABASE_URL unset in dev)
  await initDb();
});

describe('Database', () => {
  it('initializes without errors', async () => {
    // initDb already ran in beforeAll — just verify we can query
    const row = await dbGet<{ n: number }>('SELECT 1 as n');
    expect(row).toBeDefined();
    expect(row!.n).toBe(1);
  });

  it('has all required tables', async () => {
    const tables = await dbAll<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    const names = tables.map(t => t.name);

    expect(names).toContain('token_balances');
    expect(names).toContain('token_transactions');
    expect(names).toContain('roast_history');
    expect(names).toContain('user_roasts');
    expect(names).toContain('page_views');
    expect(names).toContain('social_roast_rivals');
    expect(names).toContain('social_roast_queue');
    expect(names).toContain('stripe_customers');
    expect(names).toContain('stripe_subscriptions');
  });

  it('seeds Wall of Shame with sample roasts', async () => {
    const count = await dbGet<{ n: number }>('SELECT COUNT(*) as n FROM roast_history');
    expect(count).toBeDefined();
    expect(count!.n).toBeGreaterThanOrEqual(6);
  });

  it('corrects the old "$19.99 manual" post everywhere it shows, once, and never over an owner edit', async () => {
    const SLUG = 'the-app-stays-free-the-manual-is-19-99';
    const MIGRATION = '2026-09-25-blog-manual-now-free';
    const NOTE = '**Update, 2026-09-25:**';
    const AUGUST_TITLE = 'The App Stays Free, The Manual Is $19.99';
    const AUGUST_EXCERPT = `Session Manager's marketing page said "Buy Now — $19.99" under the app itself, implying the free, MIT-licensed tool was the paid product. It wasn't. The manual is.`;
    const post = async () =>
      (await dbGet<{ title: string; excerpt: string; content: string }>('SELECT title, excerpt, content FROM blog_posts WHERE slug = ?', SLUG))!;
    const notes = (content: string) => content.split(NOTE).length - 1;
    // What a reader sees first (the /blog card and share text use the title;
    // the post page shows the excerpt above the body) never quotes a live price.
    const expectCorrected = (p: { title: string; excerpt: string; content: string }) => {
      expect(p.title).toBe('The App Stays Free, The Manual Was $19.99 (Now Free)');
      expect(p.title).not.toMatch(/Manual Is \$/);
      expect(p.excerpt.endsWith('The manual is.')).toBe(false);
      expect(p.excerpt).toContain('the manual is free too');
      expect(p.content.startsWith(NOTE)).toBe(true);
      expect(notes(p.content)).toBe(1);
      expect(p.content).toContain('/products/session-manager/manual');
    };

    // Fresh database: the seed already carries all three corrections.
    expectCorrected(await post());

    // Production holds the August row (INSERT OR IGNORE never rewrites it) and
    // has never run the migration: one boot corrects it, a second changes nothing.
    await dbRun('DELETE FROM data_migrations WHERE id = ?', MIGRATION);
    await dbRun(
      'UPDATE blog_posts SET title = ?, excerpt = ?, content = substr(content, instr(content, ?)) WHERE slug = ?',
      AUGUST_TITLE, AUGUST_EXCERPT, '[Session Manager]', SLUG,
    );
    expect((await post()).content.startsWith('[Session Manager]')).toBe(true);
    await initDb();
    expectCorrected(await post());
    await initDb();
    expectCorrected(await post());
    expect(await dbGet('SELECT id FROM data_migrations WHERE id = ?', MIGRATION)).toBeDefined();

    // The owner then edits the post through the blog admin (routes/blog.ts):
    // later boots must not put the note or the excerpt back.
    const edited = { excerpt: 'Owner-edited excerpt.', content: 'Owner-edited body, note removed.' };
    await dbRun('UPDATE blog_posts SET excerpt = ?, content = ? WHERE slug = ?', edited.excerpt, edited.content, SLUG);
    await initDb();
    const after = await post();
    expect(after.excerpt).toBe(edited.excerpt);
    expect(after.content).toBe(edited.content);

    // Tests share the on-disk local database (server/db.ts ignores
    // CONTENTGRADE_DB_PATH), so leave the post as a fresh boot seeds it.
    await dbRun('DELETE FROM blog_posts WHERE slug = ?', SLUG);
    await dbRun('DELETE FROM data_migrations WHERE id = ?', MIGRATION);
    await initDb();
    expectCorrected(await post());
  });
});
