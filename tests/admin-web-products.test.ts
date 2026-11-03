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
import { registerAnalyticsRoutes } from '../server/routes/analytics.js';
import type { WebProduct } from '../shared/web-products.js';
import { claimSlot } from '../server/services/service-bookings.js';

const product: WebProduct = {
  slug: 'fixture-skills',
  name: 'Fixture Skills',
  productKey: 'wp_fixture_skills',
  priceEnvVar: 'STRIPE_PRICE_WP_FIXTURE_SKILLS',
  displayPrice: '$9',
  downloadLimit: 3,
  release: { version: '1.0.0', filename: 'fixture.zip', sha256: 'a'.repeat(64), bytes: 3 } as any,
};

const service: WebProduct = {
  slug: 'fixture-service',
  name: 'Fixture Service',
  productKey: 'wp_fixture_service',
  priceEnvVar: 'STRIPE_PRICE_WP_FIXTURE_SERVICE',
  displayPrice: '$99',
  downloadLimit: 0,
  release: null,
  kind: 'service',
} as any;

const app = Fastify({ logger: false });
registerAdminWebProductRoutes(app, { products: [product, service] });

const catalogApp = Fastify({ logger: false });
registerAdminWebProductRoutes(catalogApp);
registerAnalyticsRoutes(catalogApp);

const DAY = 86400000;
const dayStr = (ago: number) => new Date(Date.now() - ago * DAY).toISOString().slice(0, 10);
const ts = (ago: number) => `${dayStr(ago)} 12:00:00`;
const ms = (ago: number) => Date.now() - ago * DAY;

beforeAll(async () => {
  await initDb();
  await app.ready();
  await catalogApp.ready();
});

beforeEach(async () => {
  adminOk.value = true;
  for (const t of ['page_views', 'funnel_events', 'web_product_orders', 'web_product_downloads', 'web_product_releases', 'service_bookings']) {
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
  await fe('fixture-skills', 0, 'checkout_expired');
  await fe('fixture-skills', 1, 'checkout_expired');
  await fe('fixture-skills', 1, 'checkout_recovered');
  // Owner traffic: an admin page view and an owner-IP checkout start.
  await dbRun('INSERT INTO page_views (path, date, visitor_id, is_bot, is_admin) VALUES (?, ?, ?, 0, 1)', '/projects/fixture-skills/', dayStr(0), 'owner');
  await dbRun('INSERT INTO funnel_events (event, tool, created_at, is_admin) VALUES (?, ?, ?, 1)', 'checkout_start', 'fixture-skills', ts(0));

  const order = (id: string, ago: number, amount: number, slug = 'fixture-skills') =>
    dbRun('INSERT INTO web_product_orders (checkout_session_id, slug, email, amount_total, currency, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, slug, 'b@t.dev', amount, 'usd', 'paid', ms(ago));
  await order('cs_1', 0.5, 900);
  await order('cs_2', 1.5, 900);
  await order('cs_old', 40, 900);
  await order('cs_other', 0.5, 500, 'other');
  await order('cs_test_owner1', 0.5, 900);

  const dl = (session: string, ago: number) =>
    dbRun('INSERT INTO web_product_downloads (slug, version, checkout_session_id, via, created_at) VALUES (?, ?, ?, ?, ?)',
      'fixture-skills', '1.0.0', session, 'session', ms(ago));
  await dl('cs_1', 0.5);
  await dl('cs_1', 0.4);
  await dl('cs_2', 1.5);
  await dl('cs_test_owner1', 0.5);

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
    expect(body.products).toHaveLength(2);
    const p = body.products[0];
    expect(p).toMatchObject({
      slug: 'fixture-skills', name: 'Fixture Skills', displayPrice: '$9', version: '1.0.0', releaseStored: true,
      views: 3, uniqueVisitors: 2, checkoutStarts: 2, orders: 2, revenueCents: 1800,
      downloads: 3, uniqueDownloadSessions: 2,
    });
    expect(p.lastOrderAt).toBeGreaterThan(0);
    expect(p.lastDownloadAt).toBeGreaterThan(0);
    expect(p).toMatchObject({ checkoutsExpired: 2, checkoutsRecovered: 1 });
    expect(body.excludeSelf).toBe(true);
  });

  it('exclude_self=0 counts owner views and checkout starts, but never test-mode orders', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/web-products?days=7&exclude_self=0' });
    const p = res.json().products[0];
    expect(p).toMatchObject({ views: 4, checkoutStarts: 3, orders: 2, revenueCents: 1800, downloads: 3 });
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

  it('service entries carry upcoming bookings and a null release; downloads are unchanged', async () => {
    const upcoming = Date.now() + DAY;
    const stale = Date.now() - 3 * DAY;
    const claim = (n: string, startMs: number) => claimSlot({
      pageSlug: 'fixture-service', slug: 'fixture-service', checkoutSessionId: `cs_live_${n.repeat(12)}`,
      startMs, endMs: startMs + 1800000, email: 'Buyer@T.dev', intake: { goal: n }, sessionsPerMonth: 10,
    });
    expect((await claim('a', upcoming)).status).toBe('ok');
    expect((await claim('b', stale)).status).toBe('ok');
    // A booking for another product on the same page must not show under this one.
    expect((await claimSlot({
      pageSlug: 'fixture-service', slug: 'other-product', checkoutSessionId: `cs_live_${'c'.repeat(12)}`,
      startMs: upcoming + 3600000, endMs: upcoming + 3600000 + 1800000, email: 'x@t.dev', intake: {}, sessionsPerMonth: 10,
    })).status).toBe('ok');
    const body = (await app.inject({ method: 'GET', url: '/api/admin/web-products' })).json();
    const svc = body.products.find((e: any) => e.slug === 'fixture-service');
    expect(svc.release).toBeNull();
    expect(svc.bookings).toEqual([{
      slug: 'fixture-service', startMs: upcoming, endMs: upcoming + 1800000,
      email: 'buyer@t.dev', intake: { goal: 'a' }, createdAt: expect.any(Number),
    }]);
    const dl = body.products.find((e: any) => e.slug === 'fixture-skills');
    expect(dl).not.toHaveProperty('bookings');
    expect(dl).not.toHaveProperty('release');
  });

  it('reports nulls and zeros for a product with no activity', async () => {
    for (const t of ['page_views', 'funnel_events', 'web_product_orders', 'web_product_downloads', 'web_product_releases']) {
      await dbRun(`DELETE FROM ${t}`);
    }
    const p = (await app.inject({ method: 'GET', url: '/api/admin/web-products' })).json().products[0];
    expect(p).toMatchObject({ views: 0, orders: 0, releaseStored: false, lastOrderAt: null, lastDownloadAt: null });
  });
});

describe('views of a product sold from a host route', () => {
  const addView = (path: string, visitor: string, bot = 0, admin = 0) =>
    dbRun('INSERT INTO page_views (path, date, visitor_id, is_bot, is_admin) VALUES (?, ?, ?, ?, ?)', path, dayStr(0), visitor, bot, admin);
  const entry = async (slug: string, query = '') => {
    const res = await catalogApp.inject({ method: 'GET', url: `/api/admin/web-products?days=7${query}` });
    return res.json().products.find((p: any) => p.slug === slug);
  };

  it('counts a beacon hit on /bilko', async () => {
    const uuid = '123e4567-e89b-42d3-a456-426614174000';
    const post = await catalogApp.inject({
      method: 'POST', url: '/api/analytics/pageview',
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
      },
      payload: JSON.stringify({ path: '/bilko', referrer: '', screen: '1280x720', visitor_id: uuid, session_id: uuid }),
    });
    expect(post.statusCode).toBeLessThan(300);
    const res = await catalogApp.inject({ method: 'GET', url: '/api/admin/web-products?days=7' });
    const body = res.json();
    expect(body.products.find((p: any) => p.slug === 'bilko-hour')).toMatchObject({ views: 1, uniqueVisitors: 1 });
    expect(body.daily.find((r: any) => r.slug === 'bilko-hour' && r.date === dayStr(0))).toMatchObject({ views: 1 });
  });

  it('counts the page and its aliases, not look-alikes, bots or the retired path', async () => {
    for (const [i, path] of ['/bilko', '/hire', '/human-for-hire', '/bilko/'].entries()) await addView(path, `ok${i}`);
    for (const [i, path] of ['/bilkos', '/bilko/extra', '/hire-me', '/projects/bilko-hour/', '/projects/human-for-hire/'].entries()) await addView(path, `no${i}`);
    await addView('/bilko', 'bot', 1);
    expect(await entry('bilko-hour')).toMatchObject({ views: 4, uniqueVisitors: 4 });
  });

  it('counts an is_admin row only with exclude_self=0', async () => {
    await addView('/bilko', 'v1');
    await addView('/bilko', 'owner', 0, 1);
    expect((await entry('bilko-hour')).views).toBe(1);
    expect((await entry('bilko-hour', '&exclude_self=0')).views).toBe(2);
  });

  it('leaves every other product filter alone', async () => {
    await addView('/projects/launch-kit/', 'k1');
    await addView('/bilko', 'h1');
    expect(await entry('launch-kit')).toMatchObject({ views: 1 });
    expect((await entry('agent-factory-kit')).views).toBe(0);
    expect((await entry('bilko-hour')).views).toBe(1);
    await dbRun('DELETE FROM page_views');
    await addView('/bilko', 'h2');
    expect((await entry('launch-kit')).views).toBe(0);
    expect((await entry('agent-factory-kit')).views).toBe(0);
  });

  it('still counts a /projects/<slug>/ row for a service with no pageSlug', async () => {
    await addView('/projects/fixture-service/', 's1');
    const res = await app.inject({ method: 'GET', url: '/api/admin/web-products?days=7' });
    expect(res.json().products.find((p: any) => p.slug === 'fixture-service').views).toBe(1);
  });
});
