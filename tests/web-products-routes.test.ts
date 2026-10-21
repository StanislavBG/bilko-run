import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import { initDb, dbAll } from '../server/db.js';
import { recordOrder, storeRelease, countSessionDownloads } from '../server/services/web-products.js';
import type { WebProduct } from '../shared/web-products.js';

const sessionsCreate = vi.fn();
const sessionsRetrieve = vi.fn();
const testCreate = vi.fn();
const testRetrieve = vi.fn();
const couponsRetrieve = vi.fn();
const testCouponsRetrieve = vi.fn();
const testMode = vi.hoisted(() => ({ configured: true, ownerEmail: null as string | null }));

vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => ({ checkout: { sessions: { create: sessionsCreate, retrieve: sessionsRetrieve } }, coupons: { retrieve: couponsRetrieve } }),
  getStripeTest: () => (testMode.configured
    ? { checkout: { sessions: { create: testCreate, retrieve: testRetrieve } }, coupons: { retrieve: testCouponsRetrieve } }
    : null),
}));

vi.mock('../server/clerk.js', async (orig) => ({
  ...(await orig<typeof import('../server/clerk.js')>()),
  verifyClerkToken: async (h: string | undefined) => (h ? testMode.ownerEmail : null),
}));

const BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04, 9, 8, 7, 255, 0, 128]);
const SHA = createHash('sha256').update(BYTES).digest('hex');
const PRICE = 'price_fixture_route';

const product: WebProduct = {
  slug: 'route-fixture',
  name: 'Route Fixture',
  productKey: 'wp_route_fixture',
  priceEnvVar: 'STRIPE_PRICE_WP_ROUTE_FIXTURE',
  defaultPriceId: PRICE,
  displayPrice: '$9',
  downloadLimit: 2,
  release: { version: '1.0.0', filename: 'route-fixture-1.0.0.zip', bytes: BYTES.length, sha256: SHA },
};

async function buildApp() {
  const { registerWebProductRoutes } = await import('../server/routes/web-products.js');
  const app = Fastify();
  registerWebProductRoutes(app, { products: [product] });
  return app;
}

function paidSession(over: Record<string, unknown> = {}) {
  return {
    status: 'complete',
    payment_status: 'paid',
    metadata: { web_product: product.slug },
    customer_details: { email: 'Jane@Example.com' },
    amount_total: 900,
    currency: 'usd',
    line_items: { data: [{ price: { id: PRICE } }] },
    ...over,
  };
}

beforeAll(async () => {
  await initDb();
  await storeRelease(product, '1.0.0', BYTES);
});

beforeEach(() => {
  sessionsCreate.mockReset();
  sessionsRetrieve.mockReset();
  testCreate.mockReset();
  testRetrieve.mockReset();
  couponsRetrieve.mockReset();
  testCouponsRetrieve.mockReset();
  testMode.configured = true;
  testMode.ownerEmail = null;
});

const checkoutStarts = async () =>
  (await dbAll<{ n: number }>(`SELECT COUNT(*) AS n FROM funnel_events WHERE event = 'checkout_start' AND tool = ?`, product.slug))[0].n;

describe('web product routes', () => {
  it('404s unknown slug and 400s a malformed session id', async () => {
    const app = await buildApp();
    expect((await app.inject({ url: '/api/web-products/nope' })).statusCode).toBe(404);
    expect((await app.inject({ url: '/api/web-products/BAD_SLUG' })).statusCode).toBe(404);
    const bad = await app.inject({ url: `/api/web-products/${product.slug}/order?session_id=nope` });
    expect(bad.statusCode).toBe(400);
  });

  it('returns product info', async () => {
    const app = await buildApp();
    const res = await app.inject({ url: `/api/web-products/${product.slug}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.json()).toEqual({
      slug: product.slug, name: product.name, displayPrice: '$9', version: '1.0.0', available: true, previewAvailable: false,
    });
  });

  it('creates a checkout with metadata and thanks success_url', async () => {
    sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.test/x' });
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: `/api/web-products/${product.slug}/checkout` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ url: 'https://checkout.stripe.test/x' });
    const arg = sessionsCreate.mock.calls[0][0];
    expect(arg.mode).toBe('payment');
    expect(arg.line_items).toEqual([{ price: PRICE, quantity: 1 }]);
    expect(arg.customer_creation).toBe('always');
    expect(arg.allow_promotion_codes).toBe(true);
    expect(arg.metadata).toEqual({ web_product: product.slug });
    expect(arg.success_url).toBe(
      `https://bilko.run/projects/${product.slug}/thanks/?session_id={CHECKOUT_SESSION_ID}&offer=${product.slug}`,
    );
    expect(arg.cancel_url).toBe(`https://bilko.run/projects/${product.slug}/?checkout=cancel`);
    expect(arg.after_expiration).toEqual({ recovery: { enabled: true, allow_promotion_codes: true } });
    // Opt-in: consent_collection 400s until the Checkout ToS is accepted.
    expect(arg.consent_collection).toBeUndefined();
    process.env.STRIPE_CHECKOUT_PROMO_CONSENT = '1';
    try {
      await app.inject({ method: 'POST', url: `/api/web-products/${product.slug}/checkout` });
      expect(sessionsCreate.mock.calls[1][0].consent_collection).toEqual({ promotions: 'auto' });
    } finally {
      delete process.env.STRIPE_CHECKOUT_PROMO_CONSENT;
    }
    expect(testCreate).not.toHaveBeenCalled();
  });

  it('dryRun=1 checks wiring without creating a Stripe session', async () => {
    const app = await buildApp();
    const before = await checkoutStarts();
    const res = await app.inject({ method: 'POST', url: `/api/web-products/${product.slug}/checkout?dryRun=1` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, dryRun: true, url: null });
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(await checkoutStarts()).toBe(before);
  });

  it('routes a signed-in owner to Stripe test mode and logs no funnel row', async () => {
    testMode.ownerEmail = 'bilkobibitkov2000@gmail.com';
    testCreate.mockResolvedValue({ url: 'https://checkout.stripe.test/t' });
    const app = await buildApp();
    const before = await checkoutStarts();
    const res = await app.inject({
      method: 'POST', url: `/api/web-products/${product.slug}/checkout`,
      headers: { cookie: 'foo=1; __session=jwt.owner' },
    });
    expect(res.statusCode).toBe(200);
    expect(sessionsCreate).not.toHaveBeenCalled();
    const arg = testCreate.mock.calls[0][0];
    expect(arg.metadata).toEqual({ web_product: product.slug, test: 'true' });
    expect(arg.line_items[0].price_data.unit_amount).toBe(900);
    expect(await checkoutStarts()).toBe(before);
  });

  it('refuses an owner checkout when test mode is not configured (never falls back to live)', async () => {
    testMode.ownerEmail = 'bilkobibitkov2000@gmail.com';
    testMode.configured = false;
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: `/api/web-products/${product.slug}/checkout`,
      headers: { authorization: 'Bearer jwt.owner' },
    });
    expect(res.statusCode).toBe(409);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it('a non-admin signed-in user still gets a live session', async () => {
    testMode.ownerEmail = 'someone@example.com';
    sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.test/x' });
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: `/api/web-products/${product.slug}/checkout`,
      headers: { authorization: 'Bearer jwt.user' },
    });
    expect(res.statusCode).toBe(200);
    expect(testCreate).not.toHaveBeenCalled();
    expect(sessionsCreate).toHaveBeenCalledOnce();
  });

  it('delivers a test-mode order only via the test client and the server-set test marker', async () => {
    const app = await buildApp();
    const id = 'cs_test_ownerFixture1234567890';
    testRetrieve.mockResolvedValue(paidSession({ metadata: { web_product: product.slug }, line_items: { data: [] } }));
    const unmarked = await app.inject({ url: `/api/web-products/${product.slug}/order?session_id=${id}` });
    expect(unmarked.statusCode).toBe(404);
    testRetrieve.mockResolvedValue(paidSession({ metadata: { web_product: product.slug, test: 'true' }, line_items: { data: [] } }));
    const res = await app.inject({ url: `/api/web-products/${product.slug}/order?session_id=${id}` });
    expect(res.statusCode).toBe(200);
    expect(sessionsRetrieve).not.toHaveBeenCalled();
  });

  it('order paid via DB row, with masked email', async () => {
    await recordOrder({
      checkoutSessionId: 'cs_live_dbrow12345', slug: product.slug, email: 'jane@example.com',
      amountTotal: 900, currency: 'usd', paymentStatus: 'paid',
    });
    const app = await buildApp();
    const res = await app.inject({ url: `/api/web-products/${product.slug}/order?session_id=cs_live_dbrow12345` });
    expect(res.statusCode).toBe(200);
    expect(sessionsRetrieve).not.toHaveBeenCalled();
    expect(res.json()).toEqual({
      paid: true, slug: product.slug, name: product.name, version: '1.0.0',
      filename: 'route-fixture-1.0.0.zip', bytes: BYTES.length,
      downloadsUsed: 0, downloadsLimit: 2, email: 'j***@example.com',
    });
  });

  it('order paid via Stripe fallback is then recorded', async () => {
    sessionsRetrieve.mockResolvedValue(paidSession());
    const app = await buildApp();
    const url = `/api/web-products/${product.slug}/order?session_id=cs_live_fallback123`;
    const res = await app.inject({ url });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe('j***@example.com');
    expect(sessionsRetrieve).toHaveBeenCalledWith('cs_live_fallback123', { expand: ['line_items'] });
    const again = await app.inject({ url });
    expect(again.statusCode).toBe(200);
    expect(sessionsRetrieve).toHaveBeenCalledTimes(1);
  });

  it('402s an unpaid session', async () => {
    sessionsRetrieve.mockResolvedValue(paidSession({ status: 'open', payment_status: 'unpaid' }));
    const app = await buildApp();
    const res = await app.inject({ url: `/api/web-products/${product.slug}/order?session_id=cs_live_unpaid1234` });
    expect(res.statusCode).toBe(402);
    expect(res.json()).toEqual({ paid: false });
  });

  it("rejects another product's session", async () => {
    sessionsRetrieve.mockResolvedValue(paidSession({ metadata: { web_product: 'other-product' } }));
    const app = await buildApp();
    const res = await app.inject({ url: `/api/web-products/${product.slug}/order?session_id=cs_live_other12345` });
    expect(res.statusCode).toBe(404);
  });

  it('serves download bytes with headers, then caps at downloadLimit', async () => {
    await recordOrder({
      checkoutSessionId: 'cs_test_download1234567', slug: product.slug, email: 'jane@example.com',
      amountTotal: 900, currency: 'usd', paymentStatus: 'paid',
    });
    const app = await buildApp();
    const url = `/api/web-products/${product.slug}/download?session_id=cs_test_download1234567`;
    const res = await app.inject({ url });
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.equals(BYTES)).toBe(true);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toBe('attachment; filename="route-fixture-1.0.0.zip"');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect((await app.inject({ url })).statusCode).toBe(200);
    expect(await countSessionDownloads(product.slug, 'cs_test_download1234567')).toBe(2);
    expect((await app.inject({ url })).statusCode).toBe(429);
  });
});

describe('service products', () => {
  const svc = (over: Partial<WebProduct> = {}): WebProduct => ({
    slug: 'svc-fixture', name: 'Svc Fixture', productKey: 'wp_svc_fixture',
    priceEnvVar: 'STRIPE_PRICE_WP_SVC_FIXTURE', defaultPriceId: 'price_svc',
    displayPrice: '$750', downloadLimit: 0, release: null, kind: 'service',
    billing: 'month', pageSlug: 'svc-page', ...over,
  });
  async function appFor(p: WebProduct) {
    const { registerWebProductRoutes } = await import('../server/routes/web-products.js');
    const app = Fastify();
    registerWebProductRoutes(app, { products: [p] });
    return app;
  }
  let ipSeq = 0;
  const post = (app: any, p: WebProduct) =>
    app.inject({ method: 'POST', url: `/api/web-products/${p.slug}/checkout`, remoteAddress: `10.9.0.${++ipSeq}` });

  it('builds subscription params on the shared page', async () => {
    const { buildWebProductCheckoutParams } = await import('../server/routes/web-products.js');
    const p = svc();
    const params: any = buildWebProductCheckoutParams(p, {
      owner: false, ownerIp: false, priceId: 'price_svc', testCents: 75000, publicUrl: 'https://bilko.run',
    });
    expect(params.mode).toBe('subscription');
    expect(params.customer_creation).toBeUndefined();
    expect(params.line_items).toEqual([{ price: 'price_svc', quantity: 1 }]);
    expect(params.success_url).toBe('https://bilko.run/projects/svc-page/thanks/?session_id={CHECKOUT_SESSION_ID}&offer=svc-fixture');
    expect(params.cancel_url).toBe('https://bilko.run/projects/svc-page/?checkout=cancel');
    expect(params.metadata).toEqual({ web_product: 'svc-fixture' });
  });

  it('nested pageSlug points success and cancel at the nested page', async () => {
    const { buildWebProductCheckoutParams } = await import('../server/routes/web-products.js');
    const p: WebProduct = { ...svc(), kind: 'download', billing: undefined, pageSlug: 'launch-kit/agent-factory-kit' };
    const params: any = buildWebProductCheckoutParams(p, {
      owner: false, ownerIp: false, priceId: 'price_x', testCents: 1900, publicUrl: 'https://bilko.run',
    });
    expect(params.success_url).toBe('https://bilko.run/projects/launch-kit/agent-factory-kit/thanks/?session_id={CHECKOUT_SESSION_ID}&offer=svc-fixture');
    expect(params.cancel_url).toBe('https://bilko.run/projects/launch-kit/agent-factory-kit/?checkout=cancel');
  });

  it('owner test sessions use inline recurring price_data', async () => {
    testMode.ownerEmail = 'bilkobibitkov2000@gmail.com';
    testCreate.mockResolvedValue({ url: 'https://t/x' });
    const p = svc();
    const res = await (await appFor(p)).inject({
      method: 'POST', url: `/api/web-products/${p.slug}/checkout`,
      headers: { authorization: 'Bearer jwt.owner' },
    });
    expect(res.statusCode).toBe(200);
    const arg = testCreate.mock.calls[0][0];
    expect(arg.mode).toBe('subscription');
    expect(arg.line_items[0].price_data.recurring).toEqual({ interval: 'month' });
    expect(arg.line_items[0].price_data.unit_amount).toBe(75000);
    expect(arg.customer_creation).toBeUndefined();
  });

  it('applies a valid founding coupon and drops allow_promotion_codes', async () => {
    process.env.STRIPE_COUPON_WP_SVC = 'coupon_live';
    try {
      couponsRetrieve.mockResolvedValue({ id: 'coupon_live', valid: true });
      sessionsCreate.mockResolvedValue({ url: 'https://c/x' });
      const p = svc({ billing: 'one_time', foundingCouponEnvVar: 'STRIPE_COUPON_WP_SVC', foundingDisplayPrice: '$125' });
      const res = await post(await appFor(p), p);
      expect(res.statusCode).toBe(200);
      const arg = sessionsCreate.mock.calls[0][0];
      expect(couponsRetrieve).toHaveBeenCalledWith('coupon_live');
      expect(arg.mode).toBe('payment');
      expect(arg.discounts).toEqual([{ coupon: 'coupon_live' }]);
      expect(arg.allow_promotion_codes).toBeUndefined();
    } finally {
      delete process.env.STRIPE_COUPON_WP_SVC;
    }
  });

  it('falls back to full price when the coupon is invalid or errors', async () => {
    process.env.STRIPE_COUPON_WP_SVC = 'coupon_live';
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const p = svc({ billing: 'one_time', foundingCouponEnvVar: 'STRIPE_COUPON_WP_SVC', foundingDisplayPrice: '$125' });
      sessionsCreate.mockResolvedValue({ url: 'https://c/x' });
      couponsRetrieve.mockResolvedValueOnce({ id: 'coupon_live', valid: false });
      expect((await post(await appFor(p), p)).statusCode).toBe(200);
      let arg = sessionsCreate.mock.calls[0][0];
      expect(arg.discounts).toBeUndefined();
      expect(arg.allow_promotion_codes).toBe(true);
      couponsRetrieve.mockRejectedValueOnce(new Error('boom'));
      expect((await post(await appFor(p), p)).statusCode).toBe(200);
      arg = sessionsCreate.mock.calls[1][0];
      expect(arg.discounts).toBeUndefined();
      expect(arg.allow_promotion_codes).toBe(true);
    } finally {
      err.mockRestore();
      delete process.env.STRIPE_COUPON_WP_SVC;
    }
  });

  it('409 sold_out at the order cap without calling Stripe; GET reports it', async () => {
    const p = svc({ slug: 'svc-capped', productKey: 'wp_svc_capped', maxOrders: 1 });
    await recordOrder({ checkoutSessionId: 'cs_test_ignoredTestOrder1', slug: p.slug, email: 'a@b.co', amountTotal: 1, currency: 'usd', paymentStatus: 'paid' });
    sessionsCreate.mockResolvedValue({ url: 'https://c/x' });
    const app = await appFor(p);
    expect((await post(app, p)).statusCode).toBe(200); // test-mode order does not count
    await recordOrder({ checkoutSessionId: 'cs_live_realOrderNumber1', slug: p.slug, email: 'a@b.co', amountTotal: 1, currency: 'usd', paymentStatus: 'paid' });
    sessionsCreate.mockClear();
    const res = await post(app, p);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'sold_out' });
    expect(sessionsCreate).not.toHaveBeenCalled();
    const info = await app.inject({ url: `/api/web-products/${p.slug}` });
    expect(info.json()).toMatchObject({ soldOut: true, available: true });
  });

  it('GET returns the service shape', async () => {
    process.env.STRIPE_COUPON_WP_SVC = 'coupon_live';
    try {
      couponsRetrieve.mockResolvedValue({ id: 'coupon_live', valid: true, max_redemptions: 5, times_redeemed: 2 });
      const p = svc({ slug: 'svc-shape', productKey: 'wp_svc_shape', foundingCouponEnvVar: 'STRIPE_COUPON_WP_SVC', foundingDisplayPrice: '$125' });
      const res = await (await appFor(p)).inject({ url: `/api/web-products/${p.slug}` });
      expect(res.json()).toMatchObject({
        kind: 'service', billing: 'month', pageSlug: 'svc-page',
        foundingDisplayPrice: '$125', foundingRemaining: 3, soldOut: false, available: true,
      });
    } finally {
      delete process.env.STRIPE_COUPON_WP_SVC;
    }
  });

  it('service download/order routes 404', async () => {
    const p = svc({ slug: 'svc-dl', productKey: 'wp_svc_dl' });
    const app = await appFor(p);
    const sid = 'cs_live_abcdefghij12345';
    expect((await app.inject({ url: `/api/web-products/${p.slug}/download?session_id=${sid}` })).statusCode).toBe(404);
    expect((await app.inject({ url: `/api/web-products/${p.slug}/order?session_id=${sid}` })).statusCode).toBe(404);
  });
});

describe('included downloads', () => {
  const HOST_PRICE = 'price_fixture_host';
  const host: WebProduct = {
    slug: 'route-host',
    name: 'Route Host',
    productKey: 'wp_route_host',
    priceEnvVar: 'STRIPE_PRICE_WP_ROUTE_HOST',
    defaultPriceId: HOST_PRICE,
    displayPrice: '$225',
    downloadLimit: 0,
    release: null,
    kind: 'service',
    billing: 'one_time',
    pageSlug: 'route-host-page',
    includes: [product.slug],
  };
  const other: WebProduct = { ...host, slug: 'route-other', name: 'Route Other', productKey: 'wp_route_other', priceEnvVar: 'STRIPE_PRICE_WP_ROUTE_OTHER', defaultPriceId: 'price_fixture_other', includes: undefined };

  async function app2(list: WebProduct[]) {
    const { registerWebProductRoutes } = await import('../server/routes/web-products.js');
    const a = Fastify();
    registerWebProductRoutes(a, { products: list });
    return a;
  }
  const hostSession = (over: Record<string, unknown> = {}) => paidSession({
    metadata: { web_product: host.slug },
    line_items: { data: [{ price: { id: HOST_PRICE } }] },
    ...over,
  });

  it('serves the included zip for a paid session of the including product, counted against the included slug', async () => {
    sessionsRetrieve.mockResolvedValue(hostSession());
    const app = await app2([product, host]);
    const sid = 'cs_live_includeddl00001';
    const res = await app.inject({ url: `/api/web-products/${product.slug}/download?session_id=${sid}` });
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.equals(BYTES)).toBe(true);
    expect(await countSessionDownloads(product.slug, sid)).toBe(1);
    await app.inject({ url: `/api/web-products/${product.slug}/download?session_id=${sid}` });
    expect((await app.inject({ url: `/api/web-products/${product.slug}/download?session_id=${sid}` })).statusCode).toBe(429);
  });

  it('order of the including product lists included downloads', async () => {
    sessionsRetrieve.mockResolvedValue(hostSession());
    const app = await app2([product, host]);
    const sid = 'cs_live_includedord0001';
    const res = await app.inject({ url: `/api/web-products/${host.slug}/order?session_id=${sid}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().included).toEqual([
      { slug: product.slug, name: product.name, downloadUrl: `/api/web-products/${product.slug}/download?session_id=${sid}` },
    ]);
  });

  it('included is [] when the included product has no release; plain products keep their shape', async () => {
    sessionsRetrieve.mockResolvedValue(hostSession());
    const app = await app2([{ ...product, release: null }, host]);
    const res = await app.inject({ url: `/api/web-products/${host.slug}/order?session_id=cs_live_includednor0001` });
    expect(res.json().included).toEqual([]);
    sessionsRetrieve.mockResolvedValue(paidSession());
    const plain = await (await app2([product, host])).inject({ url: `/api/web-products/${product.slug}/order?session_id=cs_live_plainshape00001` });
    expect(plain.json()).not.toHaveProperty('included');
  });

  it('unpaid and unknown sessions of the including product keep 402 / 404', async () => {
    const app = await app2([product, host]);
    sessionsRetrieve.mockResolvedValue(hostSession({ payment_status: 'unpaid' }));
    expect((await app.inject({ url: `/api/web-products/${product.slug}/download?session_id=cs_live_includedunp0001` })).statusCode).toBe(402);
    sessionsRetrieve.mockRejectedValue(Object.assign(new Error('x'), { code: 'resource_missing' }));
    expect((await app.inject({ url: `/api/web-products/${product.slug}/download?session_id=cs_live_includedunk0001` })).statusCode).toBe(404);
  });

  it('a session of a product that does not include S cannot download S', async () => {
    sessionsRetrieve.mockResolvedValue(hostSession({
      metadata: { web_product: other.slug },
      line_items: { data: [{ price: { id: 'price_fixture_other' } }] },
    }));
    const app = await app2([product, host, other]);
    const res = await app.inject({ url: `/api/web-products/${product.slug}/download?session_id=cs_live_notincluded0001` });
    expect(res.statusCode).toBe(404);
  });
});

