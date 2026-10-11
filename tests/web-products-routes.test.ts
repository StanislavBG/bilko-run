import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import { initDb } from '../server/db.js';
import { recordOrder, storeRelease, countSessionDownloads } from '../server/services/web-products.js';
import type { WebProduct } from '../shared/web-products.js';

const sessionsCreate = vi.fn();
const sessionsRetrieve = vi.fn();

vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => ({ checkout: { sessions: { create: sessionsCreate, retrieve: sessionsRetrieve } } }),
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
});

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
      slug: product.slug, name: product.name, displayPrice: '$9', version: '1.0.0', available: true,
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
      `https://bilko.run/projects/${product.slug}/thanks/?session_id={CHECKOUT_SESSION_ID}`,
    );
    expect(arg.cancel_url).toBe(`https://bilko.run/projects/${product.slug}/?checkout=cancel`);
  });

  it('order paid via DB row, with masked email', async () => {
    await recordOrder({
      checkoutSessionId: 'cs_test_dbrow12345', slug: product.slug, email: 'jane@example.com',
      amountTotal: 900, currency: 'usd', paymentStatus: 'paid',
    });
    const app = await buildApp();
    const res = await app.inject({ url: `/api/web-products/${product.slug}/order?session_id=cs_test_dbrow12345` });
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
    const url = `/api/web-products/${product.slug}/order?session_id=cs_test_fallback123`;
    const res = await app.inject({ url });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe('j***@example.com');
    expect(sessionsRetrieve).toHaveBeenCalledWith('cs_test_fallback123', { expand: ['line_items'] });
    const again = await app.inject({ url });
    expect(again.statusCode).toBe(200);
    expect(sessionsRetrieve).toHaveBeenCalledTimes(1);
  });

  it('402s an unpaid session', async () => {
    sessionsRetrieve.mockResolvedValue(paidSession({ status: 'open', payment_status: 'unpaid' }));
    const app = await buildApp();
    const res = await app.inject({ url: `/api/web-products/${product.slug}/order?session_id=cs_test_unpaid1234` });
    expect(res.statusCode).toBe(402);
    expect(res.json()).toEqual({ paid: false });
  });

  it("rejects another product's session", async () => {
    sessionsRetrieve.mockResolvedValue(paidSession({ metadata: { web_product: 'other-product' } }));
    const app = await buildApp();
    const res = await app.inject({ url: `/api/web-products/${product.slug}/order?session_id=cs_test_other12345` });
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
