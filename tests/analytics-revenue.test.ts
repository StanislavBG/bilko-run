import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun } from '../server/db.js';

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return {
    ...original,
    verifyClerkToken: vi.fn().mockResolvedValue(null),
    requireAdmin: vi.fn().mockImplementation(async () => 'admin@t.dev'),
  };
});
vi.mock('../server/registry-runtime.js', () => ({
  getRegistrySnapshot: () => [
    { slug: 'live-tool', public: true },
    { slug: 'hidden-tool', public: false },
    { slug: 'unlisted-tool' },
  ],
}));

import { registerAnalyticsRoutes } from '../server/routes/analytics.js';

const app = Fastify({ logger: false });
registerAnalyticsRoutes(app);
const DAY = 86400000;

async function order(id: string, ago: number, cents: number) {
  await dbRun(
    'INSERT INTO web_product_orders (checkout_session_id, slug, email, amount_total, currency, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id, 'p', 'b@t.dev', cents, 'usd', 'paid', Date.now() - ago * DAY,
  );
}

beforeAll(async () => { await initDb(); await app.ready(); });
beforeEach(async () => {
  await dbRun('DELETE FROM web_product_orders');
  await dbRun('DELETE FROM funnel_events');
});

describe('GET /api/analytics/stats revenue', () => {
  it('sums live orders in the window, excludes cs_test_, and windows the prior period', async () => {
    await order('cs_live_a', 1, 4900);
    await order('cs_live_b', 6, 1000);
    await order('cs_test_c', 2, 99900); // test mode: never counted
    await order('cs_live_prior', 9, 2500); // 7-14 days ago: prior window
    await order('cs_live_old', 30, 7777); // outside both
    const body = (await app.inject({ method: 'GET', url: '/api/analytics/stats?days=7' })).json();
    expect(body.revenue).toEqual({ orders: 2, cents: 5900 });
    expect(body.revenue_prior).toEqual({ orders: 1, cents: 2500 });
  });

  it('no longer serves /api/analytics/revenue', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/analytics/revenue' });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/analytics/funnels', () => {
  it('keeps only public registry slugs in the per-tool rollup; drop-off stays global', async () => {
    for (const tool of ['live-tool', 'hidden-tool', 'unlisted-tool', 'retired-tool']) {
      await dbRun("INSERT INTO funnel_events (event, tool, visitor_id) VALUES ('view_tool', ?, 'v')", tool);
    }
    const body = (await app.inject({ method: 'GET', url: '/api/analytics/funnels' })).json();
    expect(body.funnels.map((f: { tool: string }) => f.tool)).toEqual(['live-tool']);
    expect(body.dropOff).toEqual([{ event: 'view_tool', n: 4, visitors: 1 }]);
  });
});
