import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';

const listLineItems = vi.fn();
const saveOneTimePurchase = vi.fn(async () => {});
const creditTokens = vi.fn(async () => {});

vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => ({ checkout: { sessions: { listLineItems } } }),
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
  creditTokens,
  grantFreeTokens: async () => {},
  hasTokenAccount: async () => true,
}));

vi.mock('../server/db.js', () => ({ dbRun: async () => {} }));

async function post(): Promise<number> {
  const { registerStripeRoutes } = await import('../server/routes/stripe.js');
  const app = Fastify();
  registerStripeRoutes(app);
  const res = await app.inject({
    method: 'POST',
    url: '/api/stripe/webhook',
    payload: {
      type: 'checkout.session.completed',
      data: { object: {
        id: 'cs_test_attr', mode: 'payment', client_reference_id: 'buyer@test.com',
        customer: 'cus_attr_1', payment_intent: 'pi_attr_1',
      } },
    },
  });
  await app.close();
  return res.statusCode;
}

describe('webhook one-time purchase attribution', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV, NODE_ENV: 'test', STRIPE_PRICE_AUDIENCEDECODER: 'price_ad_1' };
    delete process.env.STRIPE_WEBHOOK_SECRET;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = OLD_ENV;
    vi.restoreAllMocks();
  });

  it('records an unknown price as unattributed and logs the price id', async () => {
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_unknown_9' } }] });
    expect(await post()).toBe(200);
    expect(saveOneTimePurchase).toHaveBeenCalledWith(expect.objectContaining({ product_key: 'unattributed' }));
    expect(creditTokens).not.toHaveBeenCalled();
    expect((console.error as any).mock.calls.flat().join(' ')).toContain('price_unknown_9');
  });

  it('records unattributed when the line-item lookup throws', async () => {
    listLineItems.mockRejectedValue(new Error('stripe down'));
    expect(await post()).toBe(200);
    expect(saveOneTimePurchase).toHaveBeenCalledWith(expect.objectContaining({ product_key: 'unattributed' }));
    expect(creditTokens).not.toHaveBeenCalled();
  });

  it('still attributes a known AudienceDecoder price', async () => {
    listLineItems.mockResolvedValue({ data: [{ price: { id: 'price_ad_1' } }] });
    expect(await post()).toBe(200);
    expect(saveOneTimePurchase).toHaveBeenCalledWith(expect.objectContaining({ product_key: 'audiencedecoder_report' }));
  });
});
