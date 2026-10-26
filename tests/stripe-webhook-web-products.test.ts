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
      amountCents: 900, displayPrice: '$9', downloadLimit: 5, release: null,
    }, {
      slug: 'hfh-fractional', name: 'HFH Fractional', productKey: 'wp_hfh_fractional',
      priceEnvVar: 'STRIPE_PRICE_WP_HFH_FRACTIONAL', defaultPriceId: 'price_wp_frac',
      amountCents: 25000, displayPrice: '$250', downloadLimit: 0, release: null,
      kind: 'service', billing: 'month', pageSlug: 'human-for-hire',
    }, {
      slug: 'hfh-session', name: 'HFH Session', productKey: 'wp_hfh_session',
      priceEnvVar: 'STRIPE_PRICE_WP_HFH_SESSION', defaultPriceId: 'price_wp_sess',
      amountCents: 15000, displayPrice: '$150', downloadLimit: 0, release: null,
      kind: 'service', pageSlug: 'human-for-hire',
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
const dbGet = vi.fn(async (..._args: unknown[]): Promise<unknown> => undefined);
vi.mock('../server/db.js', () => ({ dbRun, dbGet }));

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
      customer_details: { email: 'Buyer@Test.com' }, amount_total: 900, amount_subtotal: 900, currency: 'usd', ...obj,
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
    // singleFork shares one process across files: another file (agent-buy) can leak these price vars.
    delete process.env.STRIPE_PRICE_WP_DEMO_PACK;
    delete process.env.STRIPE_PRICE_WP_HFH_FRACTIONAL;
    delete process.env.STRIPE_PRICE_WP_HFH_SESSION;
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

  it('records a one-time order on matching amount_subtotal even when a coupon lowered the total', async () => {
    expect(await post({ amount_total: 450, amount_subtotal: 900 })).toBe(200);
    expect(recordOrder).toHaveBeenCalledWith(expect.objectContaining({ slug: 'demo-pack', amountTotal: 450 }));
    expect(listLineItems).not.toHaveBeenCalled();
  });

  it('records nothing for a one-time amount_subtotal mismatch', async () => {
    expect(await post({ customer: 'cus_1', amount_subtotal: 100 })).toBe(200);
    expect(recordOrder).not.toHaveBeenCalled();
    expect(saveOneTimePurchase).not.toHaveBeenCalled();
  });

  it('monthly still checks the line-item price id', async () => {
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_other' } }] });
    expect(await post({ mode: 'subscription', amount_subtotal: 25000, metadata: { web_product: 'hfh-fractional' } })).toBe(200);
    expect(recordOrder).not.toHaveBeenCalled();
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
    expect(res.headers.location).toBe('/projects/demo-pack/thanks/?session_id=cs_test_wp1&offer=demo-pack');
  });

  it('redirects a shared-page service product to its page slug with the offer', async () => {
    retrieve.mockResolvedValue({ payment_status: 'paid', metadata: { web_product: 'hfh-fractional' } });
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/checkout/success?session_id=cs_test_wp1' });
    await app.close();
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/projects/human-for-hire/thanks/?session_id=cs_test_wp1&offer=hfh-fractional');
  });

  it('records a subscription-mode service session and skips saveOneTimePurchase', async () => {
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_wp_frac' } }] });
    expect(await post({ mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', metadata: { web_product: 'hfh-fractional' } })).toBe(200);
    expect(recordOrder).toHaveBeenCalledWith(expect.objectContaining({ slug: 'hfh-fractional', email: 'buyer@test.com', paymentStatus: 'paid' }));
    expect(saveOneTimePurchase).not.toHaveBeenCalled();
  });

  it('records a one-time service session and still calls saveOneTimePurchase', async () => {
    expect(await post({ customer: 'cus_1', amount_subtotal: 15000, amount_total: 15000, metadata: { web_product: 'hfh-session' } })).toBe(200);
    expect(recordOrder).toHaveBeenCalledWith(expect.objectContaining({ slug: 'hfh-session' }));
    expect(saveOneTimePurchase).toHaveBeenCalledWith(expect.objectContaining({ product_key: 'wp_hfh_session' }));
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

  it('skips an expiry whose checkout_start row was flagged as the owner\'s after the fact', async () => {
    dbGet.mockResolvedValueOnce({ n: 1 });
    expect(await expire({ web_product: 'demo-pack', agent_buy: 'demo-pack' })).toBe(200);
    expect(dbGet).toHaveBeenCalledWith(expect.stringContaining('checkout_start'), 'cs_live_exp1');
    expect(funnelCalls('checkout_expired')).toHaveLength(0);
  });

  it('still records the expiry when the owner lookup fails', async () => {
    dbGet.mockRejectedValueOnce(new Error('db down'));
    expect(await expire({ web_product: 'demo-pack' })).toBe(200);
    expect(funnelCalls('checkout_expired')).toHaveLength(1);
  });

  it('records a recovered checkout when a completed session came from a recovery link', async () => {
    expect(await post({ recovered_from: 'cs_live_exp1' })).toBe(200);
    expect(recordOrder).toHaveBeenCalledOnce();
    expect(funnelCalls('checkout_recovered')).toHaveLength(1);
  });
});
