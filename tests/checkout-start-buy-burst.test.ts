import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { createHash } from 'node:crypto';
import { initDb, dbRun } from '../server/db.js';

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return { ...original, requireAdmin: vi.fn().mockResolvedValue('admin@t.dev') };
});

import { registerAdminWebProductRoutes } from '../server/routes/admin-web-products.js';
import type { WebProduct } from '../shared/web-products.js';

const product = { slug: 'burst-skills', name: 'B', productKey: 'wp_b', priceEnvVar: 'X', displayPrice: '$9', downloadLimit: 3, release: null } as any as WebProduct;
const app = Fastify({ logger: false });
registerAdminWebProductRoutes(app, { products: [product] });

const NOW = Date.parse('2026-11-25T12:00:00Z');
const T = Date.parse('2026-11-25T10:00:00Z');
const CREATED = '2026-11-25 10:00:00';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const IP = '203.0.113.50';
const HUMAN_IP = '198.51.100.50';

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await initDb();
  await app.ready();
});
afterAll(() => { vi.useRealTimers(); });

beforeEach(async () => {
  for (const t of ['page_views', 'page_hits', 'funnel_events', 'sessions', 'internal_devices']) await dbRun(`DELETE FROM ${t}`);
});

const start = (offer: string, ip: string, created = CREATED) =>
  dbRun(`INSERT INTO funnel_events (event, tool, created_at, is_bot, is_admin, metadata, ip_hash) VALUES ('checkout_start', ?, ?, 0, 0, ?, ?)`,
    offer, created, JSON.stringify({ via: 'agent-buy', offer }), sha(ip));
const hit = (offer: string, ip: string, ts: number, cls: string | null = 'human') =>
  dbRun(`INSERT INTO page_hits (ts_ms, date, path, status, is_bot, visitor_class, ip) VALUES (?, '2026-11-25', ?, 303, 0, ?, ?)`,
    ts, `/buy/${offer}`, cls, ip);
const list = async () => (await app.inject({ method: 'GET', url: '/api/admin/checkout-starts?days=7' })).json();
const wp = async () => (await app.inject({ method: 'GET', url: '/api/admin/web-products?days=7' })).json();

describe('agent-buy hit labels', () => {
  it('labels a five-offer burst automated and keeps the lone human start', async () => {
    const offers = ['o1', 'o2', 'o3', 'o4', 'o5'];
    for (const [i, o] of offers.entries()) {
      await start(o, IP);
      await hit(o, IP, T + 100 + i * 25, 'script');
    }
    await start('solo', HUMAN_IP);
    await hit('solo', HUMAN_IP, T + 100, 'human');
    const body = await list();
    const byTool = (t: string) => body.starts.find((r: any) => r.tool === t);
    for (const o of offers) {
      expect(byTool(o)).toMatchObject({ label: 'automated', counted: true });
      expect(byTool(o).labelReasons).toEqual(['buy_hit_script', 'buy_burst']);
    }
    expect(byTool('solo')).toMatchObject({ label: 'human', labelReasons: [] });
    expect(body.totals.counted).toEqual({ human: 1, automated: 5, unlabeled: 0 });
    expect(body.starts).toHaveLength(6);
    expect((await wp()).checkoutStartsAll).toEqual({ human: 1, automated: 5, unlabeled: 0 });
  });

  it('labels a burst of POST-only hits (no confirm-page GET) automated', async () => {
    const offers = ['p1', 'p2', 'p3', 'p4', 'p5'];
    for (const [i, o] of offers.entries()) {
      await start(o, IP);
      await dbRun(`INSERT INTO page_hits (ts_ms, date, path, status, is_bot, visitor_class, ip) VALUES (?, '2026-11-25', ?, 302, 0, 'script', ?)`,
        T + 100 + i * 25, `/buy/${o}`, IP);
    }
    const body = await list();
    for (const o of offers) {
      const r = body.starts.find((s: any) => s.tool === o);
      expect(r).toMatchObject({ label: 'automated', counted: true });
      expect(r.labelReasons).toContain('buy_burst');
    }
  });

  it('labels a human-class burst buy_burst only, and splits per product', async () => {
    await start('burst-skills', IP);
    await hit('burst-skills', IP, T + 100);
    await hit('other', IP, T + 400); // exactly 300 ms
    const body = await list();
    expect(body.starts[0]).toMatchObject({ label: 'automated', labelReasons: ['buy_burst'] });
    const p = (await wp()).products[0];
    expect(p).toMatchObject({ checkoutStarts: 1, checkoutStartsHuman: 0, checkoutStartsAutomated: 1 });
  });

  it('is not a burst at 301 ms or for the same offer twice', async () => {
    await start('a', IP);
    await hit('a', IP, T + 100);
    await hit('b', IP, T + 401);
    await start('c', HUMAN_IP);
    await hit('c', HUMAN_IP, T + 100);
    await hit('c', HUMAN_IP, T + 150);
    const body = await list();
    for (const r of body.starts) expect(r).toMatchObject({ label: 'human', labelReasons: [] });
    expect(body.totals.counted).toEqual({ human: 2, automated: 0, unlabeled: 0 });
  });

  it('uses is_bot when visitor_class is null', async () => {
    await start('a', IP);
    await dbRun(`INSERT INTO page_hits (ts_ms, date, path, status, is_bot, visitor_class, ip) VALUES (?, '2026-11-25', '/buy/a', 303, 1, NULL, ?)`, T + 100, IP);
    expect((await list()).starts[0]).toMatchObject({ label: 'automated', labelReasons: ['buy_hit_script'] });
  });
});
