import { describe, it, expect } from 'vitest';
import { getDb } from '../server/db.js';

describe('Database', () => {
  it('initializes without errors', () => {
    const db = getDb();
    expect(db).toBeDefined();
  });

  it('has all required tables', () => {
    const db = getDb();
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as Array<{ name: string }>;
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

  it('seeds Wall of Shame with sample roasts', () => {
    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as n FROM roast_history').get() as { n: number };
    expect(count.n).toBeGreaterThanOrEqual(6);
  });

  it('uses WAL mode in non-memory DB', () => {
    // In-memory DBs use 'memory' journal mode, WAL only applies to file-based DBs
    const db = getDb();
    const mode = db.pragma('journal_mode') as Array<{ journal_mode: string }>;
    expect(['wal', 'memory']).toContain(mode[0].journal_mode);
  });
});
