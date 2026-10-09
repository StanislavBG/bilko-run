import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { entryForPriceType, PRODUCT_KEYS } from '../shared/product-catalog.js';

const listLineItems = vi.fn();
const sessionsRetrieve = vi.fn();
const sessionsCreate = vi.fn(async () => ({ url: 'https://checkout.stripe.test/c/pay/cs_test_new' }));
const customersCreate = vi.fn(async () => ({ id: 'cus_new' }));

vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        retrieve: sessionsRetrieve,
        listLineItems,
        create: sessionsCreate,
      },
    },
    customers: { create: customersCreate },
  }),
  isStripeConfigured: () => true,
  isAudienceDecoderConfigured: () => true,
  hasActiveSubscription: async () => false,
  hasPurchased: async () => false,
  getCustomerStripeId: async () => null,
  upsertCustomer: async () => {},
  saveSubscription: async () => {},
  updateSubscriptionStatus: async () => {},
  updateSubscriptionPeriod: async () => {},
  saveOneTimePurchase: async () => {},
  priceToPlanTier: () => 'pro',
  hasActiveSubscriptionLive: async () => false,
}));

vi.mock('../server/services/tokens.js', () => ({
  creditTokens: async () => {},
  grantFreeTokens: async () => {},
  hasTokenAccount: async () => false,
}));

vi.mock('../server/db.js', () => ({
  dbRun: async () => {},
}));

async function buildApp() {
  const { registerStripeRoutes } = await import('../server/routes/stripe.js');
  const app = Fastify();
  registerStripeRoutes(app);
  return app;
}

const SESSION_ID = 'cs_test_123';

describe('product catalog: session_manager', () => {
  it('resolves the session_manager catalog entry', () => {
    const entry = entryForPriceType('session_manager');
    expect(entry).toBeDefined();
    expect(entry?.productKey).toBe(PRODUCT_KEYS.SESSION_MANAGER);
    expect(entry?.mode).toBe('payment');
    expect(entry?.envVar).toBe('STRIPE_PRICE_SESSION_MANAGER');
  });
});

describe('create-checkout-session: the Field Manual is free', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      STRIPE_PRICE_SESSION_MANAGER: 'price_session_manager_123',
      STRIPE_PRICE_PUBLICTRADES_COFFEE: 'price_coffee_123',
    };
  });

  it('refuses to start a new session_manager checkout with a 410, before touching Stripe', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/stripe/create-checkout-session',
      payload: { email: 'a@b.co', priceType: 'session_manager' },
    });

    expect(res.statusCode).toBe(410);
    expect(res.json().error).toContain('/products/session-manager/manual');
    expect(res.body).not.toMatch(/\$\s?\d/);
    expect(customersCreate).not.toHaveBeenCalled();
    expect(sessionsCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it('answers the 410 even without an email, so no request shape reaches checkout', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/stripe/create-checkout-session',
      payload: { priceType: 'session_manager' },
    });
    expect(res.statusCode).toBe(410);
    expect(sessionsCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it('still creates checkouts for the products that are for sale', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/stripe/create-checkout-session',
      payload: { email: 'a@b.co', priceType: 'publictrades_coffee' },
    });
    expect(res.statusCode).toBe(200);
    expect(sessionsCreate).toHaveBeenCalledOnce();
    await app.close();
  });

  it('keeps the catalog entry, so a late payment still resolves (see below)', () => {
    expect(entryForPriceType('session_manager')?.envVar).toBe('STRIPE_PRICE_SESSION_MANAGER');
  });
});

describe('/checkout/success product resolution', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV, STRIPE_PRICE_SESSION_MANAGER: 'price_session_manager_123' };
    sessionsRetrieve.mockResolvedValue({
      payment_status: 'paid',
      client_reference_id: 'buyer@test.com',
      customer: 'cus_123',
    });
  });

  it('thanks the buyer without minting a license when the line item matches the Session Manager price', async () => {
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_session_manager_123' } }] });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: `/checkout/success?session_id=${SESSION_ID}` });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Thanks for your support');
    // The manual is free as of 2.0.1: a late payment is thanked and sent to the
    // free reader, not told it "unlocked" anything or sent to a purchase lookup.
    expect(res.body).toContain('free for everyone');
    expect(res.body).toContain('href="/products/session-manager/manual"');
    expect(res.body).not.toMatch(/unlocked|Find your purchase|my-manual/);
    await app.close();
  });

  it('shows the generic thank-you and mints no license when the price cannot be resolved', async () => {
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_unknown_999' } }] });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: `/checkout/success?session_id=${SESSION_ID}` });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Thanks for your support');
    expect(res.body).not.toMatch(/license key/i);
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(String(errSpy.mock.calls[0][0])).toContain('price_unknown_999');
    errSpy.mockRestore();
    await app.close();
  });

  it('shows the generic thank-you and mints no license when line item resolution throws', async () => {
    listLineItems.mockRejectedValue(new Error('Stripe API error'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: `/checkout/success?session_id=${SESSION_ID}` });

    expect(res.statusCode).toBe(200);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
    await app.close();
  });

  it('shows the generic thank-you for a subscription-mode session without minting a license', async () => {
    sessionsRetrieve.mockResolvedValue({
      payment_status: 'paid',
      mode: 'subscription',
      client_reference_id: 'buyer@test.com',
      customer: 'cus_123',
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: `/checkout/success?session_id=${SESSION_ID}` });

    expect(res.statusCode).toBe(200);
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(String(errSpy.mock.calls[0][0])).toContain(SESSION_ID);
    errSpy.mockRestore();
    await app.close();
  });
});

describe('retired ContentGrade surfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...process.env, STRIPE_PRICE_PUBLICTRADES_COFFEE: 'price_coffee_123' };
  });

  it('redirects /upgrade to / with a 302', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/upgrade' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');
    await app.close();
  });

  it('no longer serves /my-license, license-key or validate-license', async () => {
    const app = await buildApp();
    expect((await app.inject({ method: 'GET', url: '/my-license' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/stripe/license-key?email=a@b.co' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/api/stripe/validate-license', payload: { key: 'CG-x' } })).statusCode).toBe(404);
    await app.close();
  });

  it('rejects create-checkout-session with no priceType (400) and creates nothing', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/stripe/create-checkout-session', payload: { email: 'a@b.co' } });
    expect(res.statusCode).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects contentgrade_* priceTypes with 400', async () => {
    const app = await buildApp();
    for (const priceType of ['contentgrade_pro', 'contentgrade_business', 'contentgrade_team']) {
      const res = await app.inject({ method: 'POST', url: '/api/stripe/create-checkout-session', payload: { email: 'a@b.co', priceType } });
      expect(res.statusCode).toBe(400);
    }
    expect(sessionsCreate).not.toHaveBeenCalled();
    await app.close();
  });
});
