import { describe, it, expect, beforeAll } from 'vitest';
import { dbGet, dbRun, initDb } from '../server/db.js';
import { BILKO_CONTACT_EMAIL } from '../shared/bilko-profile.js';

const POST = 'outdoorhours-week-2-from-fixed-rules-to-rule-engine';
const MIGRATION_ID = '2026-11-02-blog-contact-address';

const content = async () =>
  (await dbGet<{ content: string }>('SELECT content FROM blog_posts WHERE slug = ?', POST))!.content;

describe('blog contact address', () => {
  beforeAll(async () => {
    await initDb();
  });

  it('moves the live row off the dead address, once', async () => {
    await dbRun('UPDATE blog_posts SET content = replace(content, ?, ?) WHERE slug = ?', BILKO_CONTACT_EMAIL, 'bilko@bilko.run', POST);
    expect(await content()).toContain('bilko@bilko.run');
    await dbRun('DELETE FROM data_migrations WHERE id = ?', MIGRATION_ID);
    await initDb();
    expect(await content()).not.toContain('bilko@bilko.run');
    expect((await content()).split(BILKO_CONTACT_EMAIL)).toHaveLength(3);
  });
});
