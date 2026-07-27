import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { entryForPriceType, PRODUCT_KEYS } from '../shared/product-catalog.js';

const listLineItems = vi.fn();
const sessionsRetrieve = vi.fn();
const upsertLicenseKey = vi.fn(async (_email: string, _customerId: string | undefined, productKey: string) => `KEY-FOR-${productKey}`);

vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        retrieve: sessionsRetrieve,
        listLineItems,
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
  saveOneTimePurchase: async () => {},
  priceToPlanTier: () => 'pro',
  hasActiveSubscriptionLive: async () => false,
}));

vi.mock('../server/services/license.js', () => ({
  upsertLicenseKey,
  getLicenseKeysForEmail: async () => [],
  validateLicenseKey: async () => ({ valid: false }),
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

  it('issues a session_manager-keyed license when the line item matches the Session Manager price', async () => {
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_session_manager_123' } }] });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: `/checkout/success?session_id=${SESSION_ID}` });

    expect(res.statusCode).toBe(200);
    expect(upsertLicenseKey).toHaveBeenCalledWith('buyer@test.com', 'cus_123', PRODUCT_KEYS.SESSION_MANAGER);
    expect(res.body).toContain('Thanks for your support');
    await app.close();
  });

  it('falls back to contentgrade_pro only when the price cannot be resolved', async () => {
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_unknown_999' } }] });
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: `/checkout/success?session_id=${SESSION_ID}` });

    expect(res.statusCode).toBe(200);
    expect(upsertLicenseKey).toHaveBeenCalledWith('buyer@test.com', 'cus_123', PRODUCT_KEYS.CONTENTGRADE_PRO);
    await app.close();
  });

  it('falls back to contentgrade_pro when line item resolution throws', async () => {
    listLineItems.mockRejectedValue(new Error('Stripe API error'));
    const app = await buildApp();

    const res = await app.inject({ method: 'GET', url: `/checkout/success?session_id=${SESSION_ID}` });

    expect(res.statusCode).toBe(200);
    expect(upsertLicenseKey).toHaveBeenCalledWith('buyer@test.com', 'cus_123', PRODUCT_KEYS.CONTENTGRADE_PRO);
    await app.close();
  });

  it('does not mis-issue contentgrade_pro when a different one-time product resolves', async () => {
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_session_manager_123' } }] });
    const app = await buildApp();

    await app.inject({ method: 'GET', url: `/checkout/success?session_id=${SESSION_ID}` });

    expect(upsertLicenseKey).not.toHaveBeenCalledWith('buyer@test.com', 'cus_123', PRODUCT_KEYS.CONTENTGRADE_PRO);
    await app.close();
  });
});
