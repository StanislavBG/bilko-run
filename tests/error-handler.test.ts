import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';

const billingCreate = vi.fn(async () => {
  throw new Error('No such customer: cus_secret_stripe_detail');
});

vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => ({ billingPortal: { sessions: { create: billingCreate } } }),
  isStripeConfigured: () => true,
  isAudienceDecoderConfigured: () => true,
  hasActiveSubscription: async () => false,
  hasPurchased: async () => false,
  getCustomerStripeId: async () => 'cus_1',
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
vi.mock('../server/db.js', () => ({ dbRun: async () => {} }));

// Mirrors the handler registered in server/index.ts (importing index boots the server).
import { readFileSync } from 'fs';
import { resolve } from 'path';

async function buildApp() {
  const src = readFileSync(resolve(__dirname, '../server/index.ts'), 'utf8');
  expect(src).toContain('app.setErrorHandler');
  const app = Fastify();
  app.setErrorHandler((err: any, req, reply) => {
    const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
    if (status >= 400 && status < 500) {
      return reply.status(status).send({ error: err.validation ? 'Invalid request.' : (err.message || 'Bad request.') });
    }
    console.error(`[error] ${req.method} ${req.url}:`, err);
    return reply.status(500).send({ error: 'Something went wrong. Please try again.' });
  });
  return app;
}

describe('global error handler', () => {
  it('hides internal error detail on uncaught route errors', async () => {
    const app = await buildApp();
    app.get('/boom', async () => { throw new Error('secret detail'); });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('secret detail');
    expect(res.json()).toEqual({ error: 'Something went wrong. Please try again.' });
    spy.mockRestore();
  });

  it('billing-portal failure does not echo the Stripe message', async () => {
    const { registerStripeRoutes } = await import('../server/routes/stripe.js');
    const app = await buildApp();
    registerStripeRoutes(app);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.inject({
      method: 'POST', url: '/api/stripe/billing-portal',
      payload: { email: 'a@b.co' },
    });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('cus_secret_stripe_detail');
    expect(res.body).not.toContain('No such customer');
    spy.mockRestore();
  });
});
