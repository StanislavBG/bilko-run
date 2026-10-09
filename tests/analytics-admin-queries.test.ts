import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun, dbAll } from '../server/db.js';

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return {
    ...original,
    verifyClerkToken: vi.fn().mockResolvedValue(null),
    requireAdmin: vi.fn().mockImplementation(async () => 'bilkobibitkov2000@gmail.com'),
  };
});

import { registerAnalyticsRoutes } from '../server/routes/analytics.js';

const app = Fastify({ logger: false });
registerAnalyticsRoutes(app);

const DAY = 86400000;
const dayStr = (ago: number) => new Date(Date.now() - ago * DAY).toISOString().slice(0, 10);
// created_at columns are TEXT 'YYYY-MM-DD HH:MM:SS' (CURRENT_TIMESTAMP format)
const ts = (ago: number, time = '12:00:00') => `${dayStr(ago)} ${time}`;

// Days ago -> rows seeded that day (today, 1 day ago, 2 days ago)
const PV: Array<[number, number]> = [[0, 3], [1, 2], [2, 4]];

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  for (const t of ['page_views', 'token_balances', 'token_transactions', 'user_roasts', 'roast_history']) {
    await dbRun(`DELETE FROM ${t}`);
  }
  for (const [ago, n] of PV) {
    for (let i = 0; i < n; i++) {
      await dbRun('INSERT INTO page_views (path, date, email, is_bot) VALUES (?, ?, ?, 0)', '/x', dayStr(ago), `u${i}@t.dev`);
    }
  }
  // One row older than the 7-day window
  await dbRun('INSERT INTO page_views (path, date, is_bot) VALUES (?, ?, 0)', '/old', dayStr(20));
  await dbRun('INSERT INTO token_balances (email, balance, created_at) VALUES (?, ?, ?)', 'a@t.dev', 5, ts(2, '00:00:00'));
  await dbRun('INSERT INTO token_balances (email, balance, created_at) VALUES (?, ?, ?)', 'b@t.dev', 1, ts(0, '23:59:59'));
  await dbRun('INSERT INTO token_balances (email, balance, created_at) VALUES (?, ?, ?)', 'old@t.dev', 0, ts(30));
  for (const [email, ago] of [['a@t.dev', 0], ['a@t.dev', 1], ['b@t.dev', 2], ['old@t.dev', 30]] as const) {
    await dbRun('INSERT INTO user_roasts (email, url, score, grade, roast, result_json, created_at) VALUES (?, ?, 1, ?, ?, ?, ?)',
      email, 'http://x', 'A', 'r', '{}', ts(ago));
  }
  await dbRun('INSERT INTO token_transactions (email, amount, reason, created_at) VALUES (?, 7, ?, ?)', 'a@t.dev', 'stripe_purchase', ts(1));
  await dbRun('INSERT INTO token_transactions (email, amount, reason, created_at) VALUES (?, 1, ?, ?)', 'a@t.dev', 'stripe_purchase', ts(0));
  await dbRun('INSERT INTO token_transactions (email, amount, reason, created_at) VALUES (?, 3, ?, ?)', 'a@t.dev', 'spend', ts(0));
});

describe('GET /api/analytics/stats (range-filtered queries)', () => {
  it('returns the same counts the date()-wrapped queries produced', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/analytics/stats?days=7' });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    const expectedViews = PV.reduce((s, [, n]) => s + n, 0);
    expect(body.views).toBe(expectedViews);
    expect(body.todayViews).toBe(3);
    expect(body.byDay.map((r: any) => r.views)).toEqual([4, 2, 3]);

    // signups / roasts within window: a (2d ago 00:00:00) and b (today 23:59:59) — boundary rows included
    expect(body.signupsByDay.reduce((s: number, r: any) => s + r.signups, 0)).toBe(2);
    expect(body.roastsByDay.reduce((s: number, r: any) => s + r.roasts, 0)).toBe(3);
    expect(body.activityFeed.filter((r: any) => r.type === 'signup')).toHaveLength(2);
    expect(body.activityFeed.filter((r: any) => r.type === 'purchase')).toHaveLength(2);
    expect(body.activityFeed.filter((r: any) => r.type === 'roast')).toHaveLength(3);
  });

  it('computes topUsers (roasts, last_roast, purchased) via grouped join', async () => {
    const body = (await app.inject({ method: 'GET', url: '/api/analytics/stats?days=7' })).json();
    const byEmail = Object.fromEntries(body.topUsers.map((u: any) => [u.email, u]));
    expect(body.topUsers[0].email).toBe('a@t.dev');
    expect(byEmail['a@t.dev']).toMatchObject({ credits: 5, roasts: 2, purchased: 8, last_roast: ts(0) });
    expect(byEmail['b@t.dev']).toMatchObject({ credits: 1, roasts: 1, purchased: null });
    expect(byEmail['old@t.dev']).toMatchObject({ roasts: 1 });
  });

  it('uses an index for the main pageview count query', async () => {
    const plan = await dbAll<{ detail: string }>(
      'EXPLAIN QUERY PLAN SELECT COUNT(*) as n FROM page_views WHERE date >= ? AND is_bot = 0', dayStr(7));
    expect(plan.map(r => r.detail).join('\n')).toMatch(/USING (COVERING )?INDEX/);
  });

  it('uses an index for the created_at range filter on stripe_one_time_purchases', async () => {
    const plan = await dbAll<{ detail: string }>(
      'EXPLAIN QUERY PLAN SELECT COUNT(*) FROM stripe_one_time_purchases WHERE created_at >= ?', dayStr(7));
    expect(plan.map(r => r.detail).join('\n')).toMatch(/USING (COVERING )?INDEX/);
  });
});
