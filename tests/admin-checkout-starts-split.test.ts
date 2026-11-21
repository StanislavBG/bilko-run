import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun } from '../server/db.js';

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return { ...original, requireAdmin: vi.fn().mockResolvedValue('admin@t.dev') };
});

import { registerAdminWebProductRoutes } from '../server/routes/admin-web-products.js';
import type { WebProduct } from '../shared/web-products.js';

const product: WebProduct = {
  slug: 'split-skills',
  name: 'Split Skills',
  productKey: 'wp_split_skills',
  priceEnvVar: 'STRIPE_PRICE_WP_SPLIT_SKILLS',
  displayPrice: '$9',
  downloadLimit: 3,
  release: null,
} as any;

const app = Fastify({ logger: false });
registerAdminWebProductRoutes(app, { products: [product] });

const DAY = 86400000;
const dayStr = (ago: number) => new Date(Date.now() - ago * DAY).toISOString().slice(0, 10);
const ts = (ago: number) => `${dayStr(ago)} 12:00:00`;

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  for (const t of ['page_views', 'page_hits', 'funnel_events', 'web_product_orders', 'web_product_downloads', 'web_product_releases', 'internal_devices']) {
    await dbRun(`DELETE FROM ${t}`);
  }
  // Bot-flagged page views: one by visitor id, one by session id.
  await dbRun('INSERT INTO page_views (path, date, visitor_id, session_id, is_bot) VALUES (?, ?, ?, ?, 1)', '/projects/x/', dayStr(0), 'bot-v', 's-a');
  await dbRun('INSERT INTO page_views (path, date, visitor_id, session_id, is_bot) VALUES (?, ?, ?, ?, 1)', '/projects/x/', dayStr(0), 'other-v', 'bot-s');
  // A human page view for the human visitor (must not flag it).
  await dbRun('INSERT INTO page_views (path, date, visitor_id, session_id, is_bot) VALUES (?, ?, ?, ?, 0)', '/projects/x/', dayStr(0), 'human-v', 'human-s');

  const fe = (tool: string, opts: { visitor?: string; session?: string; bot?: number; admin?: number; ago?: number }) =>
    dbRun('INSERT INTO funnel_events (event, tool, created_at, visitor_id, session_id, is_bot, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)',
      'checkout_start', tool, ts(opts.ago ?? 0), opts.visitor ?? null, opts.session ?? null, opts.bot ?? 0, opts.admin ?? 0);
  // split-skills: 2 human, 1 is_bot, 1 bot visitor, 1 bot session => 2 human / 3 automated.
  await fe('split-skills', { visitor: 'human-v', session: 'human-s' });
  await fe('split-skills', {});
  await fe('split-skills', { visitor: 'x', bot: 1 });
  await fe('split-skills', { visitor: 'bot-v' });
  await fe('split-skills', { visitor: 'nv', session: 'bot-s' });
  // Owner row: excluded from everything by default.
  await fe('split-skills', { admin: 1 });
  // Outside the window.
  await fe('split-skills', { bot: 1, ago: 40 });
  // Another tool (an agent offer): 1 human, 1 automated.
  await fe('agent-offer', { visitor: 'h2' });
  await fe('agent-offer', { visitor: 'y', bot: 1 });
  // A non-checkout event is never counted.
  await dbRun('INSERT INTO funnel_events (event, tool, created_at, is_bot) VALUES (?, ?, ?, 1)', 'page_view', 'split-skills', ts(0));

  const hit = (path: string, cls: string | null, bot: number, opts: { admin?: number; ago?: number; visitor?: string } = {}) =>
    dbRun(`INSERT INTO page_hits (ts_ms, date, path, status, is_bot, visitor_class, is_admin, visitor_id)
           VALUES (?, ?, ?, 302, ?, ?, ?, ?)`,
      Date.now() - (opts.ago ?? 0) * DAY, dayStr(opts.ago ?? 0), path, bot, cls, opts.admin ?? 0, opts.visitor ?? null);
  await hit('/coffee', 'human', 0);
  await hit('/coffee', 'human', 0);
  await hit('/coffee', 'browser-bot', 1);
  await hit('/coffee', 'script', 1);
  await hit('/coffee', 'agent', 0);
  await hit('/coffee', 'human', 0, { admin: 1 });
  await hit('/coffee', 'human', 0, { ago: 40 });
  await hit('/coffee/x', 'human', 0);
  await hit('/', 'human', 0);
});

describe('GET /api/admin/web-products checkout-start split', () => {
  it('splits per-product starts into human and automated without changing the total', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/web-products?days=7' });
    expect(res.statusCode).toBe(200);
    const p = res.json().products[0];
    expect(p.checkoutStarts).toBe(5);
    expect(p.checkoutStartsHuman).toBe(2);
    expect(p.checkoutStartsAutomated).toBe(3);
    expect(p.checkoutStartsHuman + p.checkoutStartsAutomated).toBe(p.checkoutStarts);
  });

  it('splits every checkout_start in the window and the /coffee redirects', async () => {
    const body = (await app.inject({ method: 'GET', url: '/api/admin/web-products?days=7' })).json();
    expect(body.checkoutStartsAll).toEqual({ human: 3, automated: 4 });
    expect(body.coffeeRedirects).toEqual({ human: 2, automated: 3 });
  });

  it('includes owner rows when exclude_self=0', async () => {
    const body = (await app.inject({ method: 'GET', url: '/api/admin/web-products?days=7&exclude_self=0' })).json();
    const p = body.products[0];
    expect(p.checkoutStarts).toBe(6);
    expect(p.checkoutStartsHuman).toBe(3);
    expect(p.checkoutStartsAutomated).toBe(3);
    expect(body.checkoutStartsAll).toEqual({ human: 4, automated: 4 });
    expect(body.coffeeRedirects).toEqual({ human: 3, automated: 3 });
  });
});
