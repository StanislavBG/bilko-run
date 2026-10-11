import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { entryForPriceType, entryForPriceId, PRODUCT_KEYS, COFFEE_PAYMENT_LINK_DEFAULT } from '../shared/product-catalog.js';

const listLineItems = vi.fn();
const sessionsRetrieve = vi.fn();
const sessionsCreate = vi.fn();
const saveOneTimePurchase = vi.fn(async () => {});

vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        retrieve: sessionsRetrieve,
        listLineItems,
        create: sessionsCreate,
      },
    },
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
  saveOneTimePurchase,
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

describe('product catalog: publictrades_coffee', () => {
  it('resolves the publictrades_coffee catalog entry', () => {
    const entry = entryForPriceType('publictrades_coffee');
    expect(entry).toBeDefined();
    expect(entry?.productKey).toBe(PRODUCT_KEYS.PUBLICTRADES_COFFEE);
    expect(entry?.mode).toBe('payment');
    expect(entry?.envVar).toBe('STRIPE_PRICE_PUBLICTRADES_COFFEE');
    expect(entry?.tokenAmount).toBeUndefined();
  });

  it('maps a configured price ID back to publictrades_coffee', () => {
    const env = { STRIPE_PRICE_PUBLICTRADES_COFFEE: 'price_coffee_123' };
    const entry = entryForPriceId('price_coffee_123', env);
    expect(entry?.productKey).toBe(PRODUCT_KEYS.PUBLICTRADES_COFFEE);
  });

  it('resolves the default coffee price with no env set', () => {
    const entry = entryForPriceId('price_1U2LEcR6w0VtQRLThguPtRCI', {});
    expect(entry?.productKey).toBe(PRODUCT_KEYS.PUBLICTRADES_COFFEE);
  });

  it('env price still resolves and unknown prices do not', () => {
    const env = { STRIPE_PRICE_PUBLICTRADES_COFFEE: 'price_env_override' };
    expect(entryForPriceId('price_env_override', env)?.productKey).toBe(PRODUCT_KEYS.PUBLICTRADES_COFFEE);
    expect(entryForPriceId('price_unknown_zzz', env)).toBeUndefined();
    expect(entryForPriceId('price_unknown_zzz', {})).toBeUndefined();
  });
});

describe('GET /coffee', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV };
    delete process.env.STRIPE_PAYMENT_LINK_PUBLICTRADES_COFFEE;
    delete process.env.STRIPE_PRICE_PUBLICTRADES_COFFEE;
  });

  it('redirects to the payment link when configured', async () => {
    process.env.STRIPE_PAYMENT_LINK_PUBLICTRADES_COFFEE = 'https://buy.stripe.com/test_coffee';
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/coffee' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('https://buy.stripe.com/test_coffee');
    await app.close();
  });

  it('redirects to the committed default payment link when nothing is configured', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: '/coffee' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('https://buy.stripe.com/eVq6oJ73C65L6jbaow8k80d');
    expect(COFFEE_PAYMENT_LINK_DEFAULT).toBe('https://buy.stripe.com/eVq6oJ73C65L6jbaow8k80d');
    await app.close();
  });
});

describe('webhook: checkout.session.completed for publictrades_coffee', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV, STRIPE_PRICE_PUBLICTRADES_COFFEE: 'price_coffee_123', NODE_ENV: 'test' };
    delete process.env.STRIPE_WEBHOOK_SECRET;
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_coffee_123' } }] });
  });

  it('records the purchase under product key publictrades_coffee via entryForPriceId, no special-casing', async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/stripe/webhook',
      payload: {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_coffee_webhook',
            mode: 'payment',
            client_reference_id: 'tipper@test.com',
            customer: 'cus_789',
            payment_intent: 'pi_coffee_123',
          },
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(saveOneTimePurchase).toHaveBeenCalledWith(expect.objectContaining({
      email: 'tipper@test.com',
      product_key: PRODUCT_KEYS.PUBLICTRADES_COFFEE,
    }));
    await app.close();
  });
});

describe('/checkout/success for publictrades_coffee', () => {
  const OLD_ENV = process.env;
  const SESSION_ID = 'cs_test_coffee';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV, STRIPE_PRICE_PUBLICTRADES_COFFEE: 'price_coffee_123' };
    sessionsRetrieve.mockResolvedValue({
      payment_status: 'paid',
      client_reference_id: 'tipper@test.com',
      customer: 'cus_456',
    });
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_coffee_123' } }] });
  });

  it('renders a thank-you body, not license-key/Pro copy', async () => {
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: `/checkout/success?session_id=${SESSION_ID}` });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Thanks for your support');
    expect(res.body).not.toContain('You&#39;re now Pro');
    expect(res.body).not.toContain('Your license key');
    await app.close();
  });

  it('renders coffee-specific thanks for the default coffee price', async () => {
    delete process.env.STRIPE_PRICE_PUBLICTRADES_COFFEE;
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_1U2LEcR6w0VtQRLThguPtRCI' } }] });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: `/checkout/success?session_id=${SESSION_ID}` });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Thanks for the coffee');
    expect(res.body).toContain('https://bilko.run/');
    await app.close();
  });
});
