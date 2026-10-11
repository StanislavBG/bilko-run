import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun } from '../server/db.js';

const adminOk = vi.hoisted(() => ({ value: true }));

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return {
    ...original,
    requireAdmin: vi.fn().mockImplementation(async (_req: unknown, reply: any) => {
      if (adminOk.value) return 'admin@t.dev';
      reply.status(403).send({ error: 'Forbidden' });
      return null;
    }),
  };
});

import { registerAdminWebProductRoutes } from '../server/routes/admin-web-products.js';
import type { WebProduct } from '../shared/web-products.js';

const product: WebProduct = {
  slug: 'fixture-skills',
  name: 'Fixture Skills',
  productKey: 'wp_fixture_skills',
  priceEnvVar: 'STRIPE_PRICE_WP_FIXTURE_SKILLS',
  displayPrice: '$9',
  downloadLimit: 3,
  release: { version: '1.0.0', filename: 'fixture.zip', sha256: 'a'.repeat(64), bytes: 3 } as any,
};

const app = Fastify({ logger: false });
registerAdminWebProductRoutes(app, { products: [product] });

const DAY = 86400000;
const dayStr = (ago: number) => new Date(Date.now() - ago * DAY).toISOString().slice(0, 10);
const ts = (ago: number) => `${dayStr(ago)} 12:00:00`;
const ms = (ago: number) => Date.now() - ago * DAY;

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  adminOk.value = true;
  for (const t of ['page_views', 'funnel_events', 'web_product_orders', 'web_product_downloads', 'web_product_releases']) {
    await dbRun(`DELETE FROM ${t}`);
  }
  const pv = (path: string, ago: number, visitor: string, bot: number) =>
    dbRun('INSERT INTO page_views (path, date, visitor_id, is_bot) VALUES (?, ?, ?, ?)', path, dayStr(ago), visitor, bot);
  await pv('/projects/fixture-skills/', 0, 'v1', 0);
  await pv('/projects/fixture-skills/', 0, 'v1', 0);
  await pv('/projects/fixture-skills/index.html', 1, 'v2', 0);
  await pv('/projects/fixture-skills/', 1, 'bot', 1);
  await pv('/projects/other/', 1, 'v3', 0);
  await pv('/projects/fixture-skills/', 20, 'v4', 0);

  const fe = (tool: string, ago: number, event = 'checkout_start') =>
    dbRun('INSERT INTO funnel_events (event, tool, created_at) VALUES (?, ?, ?)', event, tool, ts(ago));
  await fe('fixture-skills', 0);
  await fe('fixture-skills', 1);
  await fe('fixture-skills', 20);
  await fe('other', 0);
  await fe('fixture-skills', 0, 'page_view');

  const order = (id: string, ago: number, amount: number, slug = 'fixture-skills') =>
    dbRun('INSERT INTO web_product_orders (checkout_session_id, slug, email, amount_total, currency, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, slug, 'b@t.dev', amount, 'usd', 'paid', ms(ago));
  await order('cs_1', 0.5, 900);
  await order('cs_2', 1.5, 900);
  await order('cs_old', 40, 900);
  await order('cs_other', 0.5, 500, 'other');

  const dl = (session: string, ago: number) =>
    dbRun('INSERT INTO web_product_downloads (slug, version, checkout_session_id, via, created_at) VALUES (?, ?, ?, ?, ?)',
      'fixture-skills', '1.0.0', session, 'session', ms(ago));
  await dl('cs_1', 0.5);
  await dl('cs_1', 0.4);
  await dl('cs_2', 1.5);

  await dbRun('INSERT INTO web_product_releases (slug, version, filename, sha256, bytes, content, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    'fixture-skills', '1.0.0', 'fixture.zip', 'a'.repeat(64), 3, Buffer.from('zip'), Date.now());
});

describe('GET /api/admin/web-products', () => {
  it('rejects non-admins', async () => {
    adminOk.value = false;
    const res = await app.inject({ method: 'GET', url: '/api/admin/web-products' });
    expect(res.statusCode).toBe(403);
  });

  it('returns per-product funnel counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/web-products?days=7' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.days).toBe(7);
    expect(body.products).toHaveLength(1);
    const p = body.products[0];
    expect(p).toMatchObject({
      slug: 'fixture-skills', name: 'Fixture Skills', displayPrice: '$9', version: '1.0.0', releaseStored: true,
      views: 3, uniqueVisitors: 2, checkoutStarts: 2, orders: 2, revenueCents: 1800,
      downloads: 3, uniqueDownloadSessions: 2,
    });
    expect(p.lastOrderAt).toBeGreaterThan(0);
    expect(p.lastDownloadAt).toBeGreaterThan(0);
  });

  it('returns a daily series for the window', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/web-products?days=7' });
    const daily = res.json().daily as Array<Record<string, any>>;
    expect(daily.every((r) => r.slug === 'fixture-skills')).toBe(true);
    const total = (k: string) => daily.reduce((s, r) => s + r[k], 0);
    expect(total('views')).toBe(3);
    expect(total('checkoutStarts')).toBe(2);
    expect(total('orders')).toBe(2);
    expect(total('downloads')).toBe(3);
    expect(daily.find((r) => r.date === dayStr(1))?.views).toBe(1);
  });

  it('widens the window and clamps days', async () => {
    const wide = (await app.inject({ method: 'GET', url: '/api/admin/web-products?days=365' })).json();
    expect(wide.products[0]).toMatchObject({ views: 4, checkoutStarts: 3, orders: 3 });
    expect((await app.inject({ method: 'GET', url: '/api/admin/web-products?days=9999' })).json().days).toBe(365);
    expect((await app.inject({ method: 'GET', url: '/api/admin/web-products?days=0' })).json().days).toBe(1);
    expect((await app.inject({ method: 'GET', url: '/api/admin/web-products' })).json().days).toBe(30);
  });

  it('reports nulls and zeros for a product with no activity', async () => {
    for (const t of ['page_views', 'funnel_events', 'web_product_orders', 'web_product_downloads', 'web_product_releases']) {
      await dbRun(`DELETE FROM ${t}`);
    }
    const p = (await app.inject({ method: 'GET', url: '/api/admin/web-products' })).json().products[0];
    expect(p).toMatchObject({ views: 0, orders: 0, releaseStored: false, lastOrderAt: null, lastDownloadAt: null });
  });
});
