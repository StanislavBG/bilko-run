import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';

const listLineItems = vi.fn();
const retrieve = vi.fn();
const saveOneTimePurchase = vi.fn(async () => {});
const recordOrder = vi.fn(async () => {});
const dbRun = vi.fn(async (..._args: unknown[]) => {});

vi.mock('../shared/web-products.js', async (orig) => {
  const actual = await orig<typeof import('../shared/web-products.js')>();
  return {
    ...actual,
    WEB_PRODUCTS: [{
      slug: 'demo-pack', name: 'Demo Pack', productKey: 'wp_demo_pack',
      priceEnvVar: 'STRIPE_PRICE_WP_DEMO_PACK', defaultPriceId: 'price_wp_demo',
      displayPrice: '$9', downloadLimit: 5, release: null,
    }],
  };
});

vi.mock('../server/services/web-products.js', () => ({ recordOrder }));

vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => ({ checkout: { sessions: { listLineItems, retrieve } } }),
  isStripeConfigured: () => true,
  isAudienceDecoderConfigured: () => true,
  hasActiveSubscription: async () => false,
  hasPurchased: async () => false,
  getCustomerStripeId: async () => null,
  upsertCustomer: async () => {},
  saveSubscription: async () => {},
  updateSubscriptionStatus: async () => {},
  updateSubscriptionPeriod: async () => {},
  saveOneTimePurchase,
  priceToPlanTier: () => 'pro',
  hasActiveSubscriptionLive: async () => false,
}));
vi.mock('../server/services/tokens.js', () => ({
  creditTokens: async () => {}, grantFreeTokens: async () => {}, hasTokenAccount: async () => true,
}));
vi.mock('../server/db.js', () => ({ dbRun }));

async function build() {
  const { registerStripeRoutes } = await import('../server/routes/stripe.js');
  const app = Fastify();
  registerStripeRoutes(app);
  return app;
}

async function post(obj: Record<string, unknown>) {
  const app = await build();
  const res = await app.inject({
    method: 'POST', url: '/api/stripe/webhook',
    payload: { type: 'checkout.session.completed', data: { object: {
      id: 'cs_test_wp1', mode: 'payment', payment_status: 'paid', metadata: { web_product: 'demo-pack' },
      customer_details: { email: 'Buyer@Test.com' }, amount_total: 900, currency: 'usd', ...obj,
    } } },
  });
  await app.close();
  return res.statusCode;
}

describe('webhook web-product orders', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV, NODE_ENV: 'test' };
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_PRICE_WP_DEMO_PACK;
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_wp_demo' } }] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = OLD_ENV;
    vi.restoreAllMocks();
  });

  it('records a verified order without a customer id', async () => {
    expect(await post({})).toBe(200);
    expect(recordOrder).toHaveBeenCalledWith({
      checkoutSessionId: 'cs_test_wp1', slug: 'demo-pack', email: 'buyer@test.com',
      amountTotal: 900, currency: 'usd', paymentStatus: 'paid',
    });
    expect(saveOneTimePurchase).not.toHaveBeenCalled();
  });

  it('writes the legacy purchase row when a customer exists', async () => {
    expect(await post({ customer: 'cus_1' })).toBe(200);
    expect(saveOneTimePurchase).toHaveBeenCalledWith(expect.objectContaining({
      product_key: 'wp_demo_pack', stripe_payment_intent_id: 'cs_test_wp1',
    }));
  });

  it('records nothing for a wrong price', async () => {
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_other' } }] });
    expect(await post({ customer: 'cus_1' })).toBe(200);
    expect(recordOrder).not.toHaveBeenCalled();
    expect(saveOneTimePurchase).not.toHaveBeenCalled();
  });

  it('records nothing for an unpaid session', async () => {
    expect(await post({ payment_status: 'unpaid', customer: 'cus_1' })).toBe(200);
    expect(recordOrder).not.toHaveBeenCalled();
    expect(saveOneTimePurchase).not.toHaveBeenCalled();
  });

  it('records a 100%-off session with no PaymentIntent', async () => {
    expect(await post({ payment_status: 'no_payment_required', amount_total: 0, payment_intent: null, customer: 'cus_1' })).toBe(200);
    expect(recordOrder).toHaveBeenCalledWith(expect.objectContaining({ paymentStatus: 'no_payment_required', amountTotal: 0 }));
    expect(saveOneTimePurchase).toHaveBeenCalledWith(expect.objectContaining({ stripe_payment_intent_id: 'cs_test_wp1' }));
  });

  it('is idempotent on replay (one order row)', async () => {
    const rows = new Map<string, unknown>();
    recordOrder.mockImplementation(async (o: any) => { if (!rows.has(o.checkoutSessionId)) rows.set(o.checkoutSessionId, o); });
    expect(await post({})).toBe(200);
    expect(await post({})).toBe(200);
    expect(rows.size).toBe(1);
  });

  it('redirects /checkout/success to the product thanks page', async () => {
    retrieve.mockResolvedValue({ payment_status: 'no_payment_required', metadata: { web_product: 'demo-pack' } });
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/checkout/success?session_id=cs_test_wp1' });
    await app.close();
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/projects/demo-pack/thanks/?session_id=cs_test_wp1');
  });

  it('does not redirect for an unknown metadata slug', async () => {
    retrieve.mockResolvedValue({ payment_status: 'unpaid', metadata: { web_product: '../evil' } });
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/checkout/success?session_id=cs_test_wp1' });
    await app.close();
    expect(res.statusCode).toBe(402);
  });

  async function expire(metadata: Record<string, string>) {
    const app = await build();
    const res = await app.inject({
      method: 'POST', url: '/api/stripe/webhook',
      payload: { type: 'checkout.session.expired', data: { object: { id: 'cs_live_exp1', metadata } } },
    });
    await app.close();
    return res.statusCode;
  }
  const funnelCalls = (event: string) => dbRun.mock.calls.filter((c) => String(c[0]).includes('funnel_events') && c[1] === event);

  it('records a real visitor\'s expired web-product checkout for the funnel', async () => {
    expect(await expire({ web_product: 'demo-pack' })).toBe(200);
    expect(funnelCalls('checkout_expired')).toHaveLength(1);
    expect(funnelCalls('checkout_expired')[0][2]).toBe('demo-pack');
  });

  it('skips owner and test-mode expirations and unknown products', async () => {
    await expire({ web_product: 'demo-pack', test: 'true' });
    await expire({ web_product: 'demo-pack', owner_ip: 'true' });
    await expire({ web_product: 'nope' });
    expect(funnelCalls('checkout_expired')).toHaveLength(0);
  });

  it('records a recovered checkout when a completed session came from a recovery link', async () => {
    expect(await post({ recovered_from: 'cs_live_exp1' })).toBe(200);
    expect(recordOrder).toHaveBeenCalledOnce();
    expect(funnelCalls('checkout_recovered')).toHaveLength(1);
  });
});
