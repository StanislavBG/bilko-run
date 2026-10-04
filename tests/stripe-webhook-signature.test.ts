import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import Stripe from 'stripe';

const WEBHOOK_SECRET = 'whsec_test_secret_abc123';
const signingStripe = new Stripe('sk_test_dummy', { apiVersion: '2024-12-18.acacia' as any });

const listLineItems = vi.fn();
const upsertCustomer = vi.fn(async () => {});
const saveOneTimePurchase = vi.fn(async () => {});
const creditTokens = vi.fn(async () => {});
const hasTokenAccount = vi.fn(async () => true);

const fakeStripe = {
  webhooks: signingStripe.webhooks,
  checkout: {
    sessions: {
      listLineItems,
    },
  },
};

vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => fakeStripe,
  isStripeConfigured: () => true,
  isAudienceDecoderConfigured: () => true,
  hasActiveSubscription: async () => false,
  hasPurchased: async () => false,
  getCustomerStripeId: async () => null,
  upsertCustomer,
  saveSubscription: async () => {},
  updateSubscriptionStatus: async () => {},
  updateSubscriptionPeriod: async () => {},
  saveOneTimePurchase,
  priceToPlanTier: () => 'pro',
  hasActiveSubscriptionLive: async () => false,
}));

vi.mock('../server/services/license.js', () => ({
  upsertLicenseKey: async (_email: string, _customerId: string | undefined, productKey: string) => `KEY-FOR-${productKey}`,
  getLicenseKeysForEmail: async () => [],
  validateLicenseKey: async () => ({ valid: false }),
}));

vi.mock('../server/services/tokens.js', () => ({
  creditTokens,
  grantFreeTokens: async () => {},
  hasTokenAccount,
}));

vi.mock('../server/db.js', () => ({
  dbRun: async () => {},
}));

// Mirrors server/index.ts's raw-body content parser — without it `req.rawBody`
// is never populated and signature verification can never see the real bytes.
async function buildApp() {
  const { registerStripeRoutes } = await import('../server/routes/stripe.js');
  const app = Fastify();
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    (req as any).rawBody = body;
    try {
      done(null, JSON.parse((body as Buffer).toString()));
    } catch (err) {
      done(err as Error, undefined);
    }
  });
  registerStripeRoutes(app);
  return app;
}

function rawPayload(): string {
  return JSON.stringify({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_tokens_webhook',
        mode: 'payment',
        client_reference_id: 'buyer@test.com',
        customer: 'cus_tokens_1',
        payment_intent: 'pi_tokens_1',
      },
    },
  });
}

describe('POST /api/stripe/webhook — production signature verification', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV, NODE_ENV: 'production', STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, STRIPE_PRICE_TOKENS: 'price_tokens_123' };
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_tokens_123' } }] });
    hasTokenAccount.mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('rejects a request with no stripe-signature header and grants no tokens', async () => {
    const app = await buildApp();
    const payload = rawPayload();

    const res = await app.inject({
      method: 'POST',
      url: '/api/stripe/webhook',
      headers: { 'content-type': 'application/json' },
      payload,
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
    expect(creditTokens).not.toHaveBeenCalled();
    expect(saveOneTimePurchase).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects a request with a wrong stripe-signature and grants no tokens', async () => {
    const app = await buildApp();
    const payload = rawPayload();

    const res = await app.inject({
      method: 'POST',
      url: '/api/stripe/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=deadbeefnotarealsignature' },
      payload,
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
    expect(creditTokens).not.toHaveBeenCalled();
    expect(saveOneTimePurchase).not.toHaveBeenCalled();
    await app.close();
  });

  it('accepts a request correctly signed with the configured secret', async () => {
    const app = await buildApp();
    const payload = rawPayload();
    const signature = signingStripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/stripe/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': signature },
      payload,
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(300);
    expect(saveOneTimePurchase).toHaveBeenCalledWith(expect.objectContaining({
      email: 'buyer@test.com',
      stripe_customer_id: 'cus_tokens_1',
    }));
    expect(creditTokens).toHaveBeenCalled();
    await app.close();
  });
});
