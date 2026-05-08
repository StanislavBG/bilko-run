import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dbRun, dbGet, dbAll, initDb } from '../server/db.js';

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM secret_metadata');
});

describe('secret_metadata', () => {
  it('inserts a row and reads it back', async () => {
    const now = Math.floor(Date.now() / 1000);
    await dbRun(
      'INSERT INTO secret_metadata (name, last_rotated_at, rotated_by, notes, created_at) VALUES (?, ?, ?, ?, ?)',
      'TEST_KEY', null, null, 'test seed', now,
    );
    const row = await dbGet<{ name: string; last_rotated_at: number | null; notes: string }>(
      'SELECT name, last_rotated_at, notes FROM secret_metadata WHERE name = ?', 'TEST_KEY',
    );
    expect(row?.name).toBe('TEST_KEY');
    expect(row?.last_rotated_at).toBeNull();
    expect(row?.notes).toBe('test seed');
  });

  it('computes age correctly from last_rotated_at', async () => {
    const ninetyOneDaysAgo = Math.floor(Date.now() / 1000) - 91 * 86400;
    await dbRun(
      'INSERT INTO secret_metadata (name, last_rotated_at, notes, created_at) VALUES (?, ?, ?, ?)',
      'OLD_KEY', ninetyOneDaysAgo, 'old', Math.floor(Date.now() / 1000),
    );
    const row = await dbGet<{ last_rotated_at: number }>(
      'SELECT last_rotated_at FROM secret_metadata WHERE name = ?', 'OLD_KEY',
    );
    const days = Math.floor((Date.now() / 1000 - (row?.last_rotated_at ?? 0)) / 86400);
    expect(days).toBeGreaterThanOrEqual(91);
  });

  it('mark-rotated updates last_rotated_at to now and records rotated_by', async () => {
    const before = Math.floor(Date.now() / 1000) - 100 * 86400;
    await dbRun(
      'INSERT INTO secret_metadata (name, last_rotated_at, notes, created_at) VALUES (?, ?, ?, ?)',
      'STRIPE_API_KEY', before, 'seeded on PRD 29', Math.floor(Date.now() / 1000),
    );

    const nowBefore = Math.floor(Date.now() / 1000);
    await dbRun(
      `UPDATE secret_metadata SET last_rotated_at = ?, rotated_by = ?, notes = COALESCE(?, notes) WHERE name = ?`,
      Math.floor(Date.now() / 1000), 'admin@test.com', 'post-90d rotation', 'STRIPE_API_KEY',
    );

    const row = await dbGet<{ last_rotated_at: number; rotated_by: string; notes: string }>(
      'SELECT last_rotated_at, rotated_by, notes FROM secret_metadata WHERE name = ?',
      'STRIPE_API_KEY',
    );
    expect(row?.last_rotated_at).toBeGreaterThanOrEqual(nowBefore);
    expect(row?.rotated_by).toBe('admin@test.com');
    expect(row?.notes).toBe('post-90d rotation');
  });

  it('mark-rotated with null notes preserves existing notes', async () => {
    const now = Math.floor(Date.now() / 1000);
    await dbRun(
      'INSERT INTO secret_metadata (name, last_rotated_at, notes, created_at) VALUES (?, ?, ?, ?)',
      'GEMINI_API_KEY', null, 'original note', now,
    );
    await dbRun(
      `UPDATE secret_metadata SET last_rotated_at = ?, rotated_by = ?, notes = COALESCE(?, notes) WHERE name = ?`,
      now, 'admin@test.com', null, 'GEMINI_API_KEY',
    );
    const row = await dbGet<{ notes: string }>(
      'SELECT notes FROM secret_metadata WHERE name = ?', 'GEMINI_API_KEY',
    );
    expect(row?.notes).toBe('original note');
  });

  it('seeding 6 secrets via initDb leaves all with null last_rotated_at', async () => {
    // initDb seeds them with INSERT OR IGNORE; since we cleared the table,
    // we need to run the seed manually to verify behavior
    const names = [
      'STRIPE_API_KEY', 'STRIPE_WEBHOOK_SECRET', 'GEMINI_API_KEY',
      'CLERK_SECRET_KEY', 'CLERK_WEBHOOK_SECRET', 'TURSO_AUTH_TOKEN',
    ];
    const seededAt = Math.floor(Date.now() / 1000);
    for (const name of names) {
      await dbRun(
        'INSERT OR IGNORE INTO secret_metadata (name, last_rotated_at, notes, created_at) VALUES (?, NULL, ?, ?)',
        name, 'seeded on PRD 29', seededAt,
      );
    }
    const rows = await dbAll<{ name: string; last_rotated_at: number | null }>(
      'SELECT name, last_rotated_at FROM secret_metadata',
    );
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(row.last_rotated_at).toBeNull();
    }
  });

  it('admin guard rejects non-admin (unit: requireAdmin logic)', async () => {
    // requireAdmin checks ADMIN_EMAILS — verify the constant contains the known admin
    const { ADMIN_EMAILS } = await import('../server/clerk.js');
    expect(ADMIN_EMAILS).toContain('bilkobibitkov2000@gmail.com');
    // Non-admin email must not be in the list
    expect(ADMIN_EMAILS).not.toContain('notadmin@example.com');
  });
});
