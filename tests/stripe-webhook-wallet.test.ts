import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';

const retrieve = vi.fn();
const piRetrieve = vi.fn();
const mintAgentApiKey = vi.fn();
const ledger = new Map<string, { email: string; cents: number; reason: string }>();
const creditWallet = vi.fn(async (email: string, cents: number, reason: string, ref: string) => {
  if (ledger.has(ref)) return { credited: false, balanceCents: 0 };
  ledger.set(ref, { email, cents, reason });
  return { credited: true, balanceCents: cents };
});

vi.mock('../server/services/wallet.js', () => ({ creditWallet }));
vi.mock('../server/services/agent-api-keys.js', () => ({ mintAgentApiKey }));
vi.mock('../server/services/web-products.js', () => ({ recordOrder: async () => {} }));
vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => ({
    checkout: { sessions: { listLineItems: vi.fn(), retrieve } },
    paymentIntents: { retrieve: piRetrieve },
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
  saveOneTimePurchase: vi.fn(async () => {}),
  priceToPlanTier: () => 'pro',
  hasActiveSubscriptionLive: async () => false,
}));
vi.mock('../server/services/tokens.js', () => ({
  creditTokens: async () => {}, grantFreeTokens: async () => {}, hasTokenAccount: async () => true,
}));
vi.mock('../server/db.js', () => ({ dbRun: vi.fn(async () => {}) }));

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
      id: 'cs_test_w1', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_1',
      metadata: { wallet_topup: '500', wallet_email: 'Buyer@Test.com' },
      customer_details: { email: 'other@test.com' }, amount_total: 500, amount_subtotal: 500, ...obj,
    } } },
  });
  await app.close();
  return res.statusCode;
}

const piWithCountry = (country: string) => ({ latest_charge: { payment_method_details: { card: { country } } } });

describe('webhook wallet top-ups', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    vi.clearAllMocks();
    ledger.clear();
    process.env = { ...OLD_ENV, NODE_ENV: 'test' };
    delete process.env.STRIPE_WEBHOOK_SECRET;
    piRetrieve.mockResolvedValue(piWithCountry('US'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = OLD_ENV;
    vi.restoreAllMocks();
  });

  it('credits a paid top-up with no bonus for a US card', async () => {
    expect(await post({})).toBe(200);
    expect(piRetrieve).toHaveBeenCalledWith('pi_1', { expand: ['latest_charge'] });
    expect(ledger.get('topup:cs_test_w1')).toEqual({ email: 'buyer@test.com', cents: 500, reason: 'topup' });
    expect(ledger.size).toBe(1);
  });

  it('adds a +100% bonus for an IN card', async () => {
    piRetrieve.mockResolvedValue(piWithCountry('IN'));
    expect(await post({})).toBe(200);
    expect(ledger.get('topup:cs_test_w1')?.cents).toBe(500);
    expect(ledger.get('ppp:cs_test_w1')).toEqual({ email: 'buyer@test.com', cents: 500, reason: 'ppp_bonus:IN' });
  });

  it('falls back to the billing address country', async () => {
    piRetrieve.mockResolvedValue({ latest_charge: null });
    expect(await post({ customer_details: { email: 'x@test.com', address: { country: 'IN' } } })).toBe(200);
    expect(ledger.get('ppp:cs_test_w1')?.cents).toBe(500);
  });

  it('does not double credit on replay', async () => {
    piRetrieve.mockResolvedValue(piWithCountry('IN'));
    await post({});
    await post({});
    expect(ledger.size).toBe(2);
  });

  it('ignores an amount mismatch', async () => {
    expect(await post({ amount_subtotal: 100 })).toBe(200);
    expect(creditWallet).not.toHaveBeenCalled();
  });

  it('ignores an unpaid session', async () => {
    expect(await post({ payment_status: 'unpaid' })).toBe(200);
    expect(creditWallet).not.toHaveBeenCalled();
  });

  it('returns 500 when the Stripe API fails so Stripe retries', async () => {
    piRetrieve.mockRejectedValue(new Error('stripe down'));
    expect(await post({})).toBe(500);
    expect(creditWallet).not.toHaveBeenCalled();
  });

  it('mints the success-page key once', async () => {
    retrieve.mockResolvedValue({
      id: 'cs_test_w1', payment_status: 'paid', mode: 'payment',
      metadata: { wallet_topup: '500', agent_key: '1', wallet_email: 'buyer@test.com' },
      customer_details: { email: 'buyer@test.com' },
    });
    mintAgentApiKey.mockResolvedValueOnce({ key: 'bkk_abc123' }).mockResolvedValueOnce({ alreadyMinted: true });
    const app = await build();
    const first = await app.inject({ method: 'GET', url: '/checkout/success?session_id=cs_test_w1' });
    const second = await app.inject({ method: 'GET', url: '/checkout/success?session_id=cs_test_w1' });
    await app.close();
    expect(mintAgentApiKey).toHaveBeenCalledWith('buyer@test.com', 'Bilko Credits', { checkoutSessionId: 'cs_test_w1' });
    expect(first.body).toContain('bkk_abc123');
    expect(first.body).toContain('https://bilko.run/api/wallet');
    expect(first.body).toContain('mcpServers');
    expect(second.body).not.toContain('bkk_abc123');
    expect(second.body).toContain('already shown');
  });
});
