import { describe, it, expect, beforeAll } from 'vitest';
import { dbGet, dbAll, initDb } from '../server/db.js';

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
});
