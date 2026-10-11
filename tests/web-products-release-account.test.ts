import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import { initDb, dbRun } from '../server/db.js';
import { recordOrder, getRelease, storeRelease } from '../server/services/web-products.js';
import { MAX_RELEASE_BYTES, type WebProduct } from '../shared/web-products.js';

const emailByToken: Record<string, string> = {
  'tok-buyer': 'buyer@example.com',
  'tok-comp': 'comp@example.com',
  'tok-other': 'other@example.com',
};

vi.mock('../server/clerk.js', async (orig) => ({
  ...(await orig<typeof import('../server/clerk.js')>()),
  verifyClerkToken: async (h: string | undefined) =>
    h?.startsWith('Bearer ') ? emailByToken[h.slice(7)] ?? null : null,
}));

vi.mock('../server/services/stripe.js', async (orig) => ({
  ...(await orig<typeof import('../server/services/stripe.js')>()),
  getStripe: () => null,
}));

const BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 250, 0, 99]);
const SHA = createHash('sha256').update(BYTES).digest('hex');

const product: WebProduct = {
  slug: 'acct-fixture',
  name: 'Account Fixture',
  productKey: 'wp_acct_fixture',
  priceEnvVar: 'STRIPE_PRICE_WP_ACCT_FIXTURE',
  defaultPriceId: 'price_acct_fixture',
  displayPrice: '$9',
  downloadLimit: 2,
  release: { version: '1.0.0', filename: 'acct-fixture-1.0.0.zip', bytes: BYTES.length, sha256: SHA },
};

async function buildApp() {
  const { registerWebProductRoutes } = await import('../server/routes/web-products.js');
  const app = Fastify();
  registerWebProductRoutes(app, { products: [product] });
  return app;
}

const put = (app: Awaited<ReturnType<typeof buildApp>>, version: string, body: Buffer, type = 'application/zip') =>
  app.inject({
    method: 'PUT',
    url: `/api/web-products/${product.slug}/releases/${version}`,
    headers: { 'content-type': type },
    payload: body,
  });

const download = (app: Awaited<ReturnType<typeof buildApp>>, token?: string) =>
  app.inject({
    method: 'GET',
    url: `/api/web-products/${product.slug}/account-download`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

beforeAll(async () => {
  await initDb();
});

describe('release upload', () => {
  it('rejects mismatched bytes with 422 and stores nothing', async () => {
    const app = await buildApp();
    const res = await put(app, '1.0.0', Buffer.from('not the zip'));
    expect(res.statusCode).toBe(422);
    expect(await getRelease(product.slug, '1.0.0')).toBeNull();
  });

  it('404s an undeclared version and an invalid version', async () => {
    const app = await buildApp();
    expect((await put(app, '9.9.9', BYTES)).statusCode).toBe(404);
    expect((await put(app, 'latest', BYTES)).statusCode).toBe(404);
  });

  it('413s oversize bodies', async () => {
    const app = await buildApp();
    const res = await put(app, '1.0.0', Buffer.alloc(MAX_RELEASE_BYTES + 1024, 1), 'application/octet-stream');
    expect(res.statusCode).toBe(413);
  });

  it('stores once (201) then 409 on repeat', async () => {
    const app = await buildApp();
    const first = await put(app, '1.0.0', BYTES);
    expect(first.statusCode).toBe(201);
    expect(first.json()).toEqual({ stored: true, sha256: SHA, bytes: BYTES.length });
    expect((await put(app, '1.0.0', BYTES)).statusCode).toBe(409);
    expect((await getRelease(product.slug, '1.0.0'))?.content.equals(BYTES)).toBe(true);
  });
});

describe('account download', () => {
  beforeAll(async () => {
    await initDb();
    await storeRelease(product, '1.0.0', BYTES);
    await recordOrder({
      checkoutSessionId: 'cs_test_acct_1', slug: product.slug, email: 'Buyer@Example.com',
      amountTotal: 900, currency: 'usd', paymentStatus: 'paid',
    });
    await dbRun(
      'INSERT INTO stripe_one_time_purchases (email, stripe_customer_id, stripe_payment_intent_id, product_key) VALUES (?, ?, ?, ?)',
      'comp@example.com', 'cus_comp', 'pi_comp_acct', product.productKey,
    );
  });

  it('401 without a token', async () => {
    const app = await buildApp();
    expect((await download(app)).statusCode).toBe(401);
  });

  it('402 for a signed-in non-buyer', async () => {
    const app = await buildApp();
    expect((await download(app, 'tok-other')).statusCode).toBe(402);
  });

  it('200 bytes for an email with an order row', async () => {
    const app = await buildApp();
    const res = await download(app, 'tok-buyer');
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.equals(BYTES)).toBe(true);
    expect(res.headers['content-type']).toBe('application/zip');
  });

  it('200 bytes for a comp-grant email with no order row', async () => {
    const app = await buildApp();
    const res = await download(app, 'tok-comp');
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.equals(BYTES)).toBe(true);
  });
});
