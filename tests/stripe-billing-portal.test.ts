import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';

const portalCreate = vi.fn(async () => ({ url: 'https://billing.stripe.test/p/session/x' }));

vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => ({ billingPortal: { sessions: { create: portalCreate } } }),
  isStripeConfigured: () => true,
  isAudienceDecoderConfigured: () => true,
  hasActiveSubscription: async () => false,
  hasPurchased: async () => false,
  getCustomerStripeId: async () => 'cus_existing',
  upsertCustomer: async () => {},
  saveSubscription: async () => {},
  updateSubscriptionStatus: async () => {},
  updateSubscriptionPeriod: async () => {},
  saveOneTimePurchase: async () => {},
  priceToPlanTier: () => 'pro',
}));

vi.mock('../server/services/tokens.js', () => ({
  creditTokens: async () => {},
  grantFreeTokens: async () => {},
  hasTokenAccount: async () => false,
}));

vi.mock('../server/db.js', () => ({ dbRun: async () => {} }));

const OLD_ENV = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...OLD_ENV, PUBLIC_URL: 'https://bilko.run' };
});
afterEach(() => { process.env = OLD_ENV; });

describe('safeUrl', () => {
  it('keeps same-origin URLs and falls back for foreign, malformed or missing ones', async () => {
    const { safeUrl } = await import('../server/routes/stripe.js');
    const same = 'https://bilko.run/projects/git-viewer/?u=octocat';
    expect(safeUrl(same, 'fb')).toBe(same);
    expect(safeUrl('https://evil.example/', 'fb')).toBe('fb');
    expect(safeUrl('https://bilko.run.evil.example/', 'fb')).toBe('fb');
    expect(safeUrl('http://bilko.run/', 'fb')).toBe('fb');
    expect(safeUrl('//evil.example/', 'fb')).toBe('fb');
    expect(safeUrl('javascript:alert(1)', 'fb')).toBe('fb');
    expect(safeUrl(undefined, 'fb')).toBe('fb');
  });
});

describe('POST /api/stripe/billing-portal return_url', () => {
  async function portal(returnUrl: string) {
    const { registerStripeRoutes } = await import('../server/routes/stripe.js');
    const app = Fastify();
    registerStripeRoutes(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/stripe/billing-portal',
      payload: { email: 'a@b.co', returnUrl },
    });
    await app.close();
    return res;
  }

  it('replaces a foreign-origin returnUrl with PUBLIC_URL', async () => {
    const res = await portal('https://evil.example/');
    expect(res.statusCode).toBe(200);
    expect(portalCreate).toHaveBeenCalledWith({ customer: 'cus_existing', return_url: 'https://bilko.run' });
  });

  it('preserves a same-origin returnUrl', async () => {
    const url = 'https://bilko.run/projects/git-viewer/?u=octocat';
    const res = await portal(url);
    expect(res.statusCode).toBe(200);
    expect(portalCreate).toHaveBeenCalledWith({ customer: 'cus_existing', return_url: url });
  });
});
