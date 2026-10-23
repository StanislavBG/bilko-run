import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

const sessionsCreate = vi.fn();
let stripeAvailable = true;
vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => (stripeAvailable ? { checkout: { sessions: { create: sessionsCreate } } } : null),
}));

const dbGet = vi.fn(async (..._a: unknown[]): Promise<unknown> => undefined);
vi.mock('../server/db.js', () => ({ dbGet, dbRun: vi.fn(), dbTransaction: vi.fn(), txGet: vi.fn(), txRun: vi.fn() }));

vi.mock('../server/clerk.js', () => ({
  requireAuth: async (req: any, reply: any) => {
    if (req.headers.authorization === 'Bearer clerk-ok') return 'Buyer@Example.com';
    reply.status(401).send({ error: 'Authentication required' });
    return null;
  },
}));
vi.mock('../server/services/agent-api-keys.js', () => ({
  verifyAgentApiKey: async (k: string) => (k === 'bkk_good' ? 'agent@example.com' : null),
}));

let n = 0;
const nextIp = () => `10.2.${Math.floor(n / 250)}.${(n++ % 250) + 1}`;

async function buildApp() {
  const { registerWalletRoutes } = await import('../server/routes/wallet.js');
  const app = Fastify();
  registerWalletRoutes(app);
  return app;
}
const post = (app: any, body: unknown, auth = 'Bearer clerk-ok', ip = nextIp()) =>
  app.inject({ method: 'POST', url: '/api/wallet/topup', payload: body as any, headers: { authorization: auth }, remoteAddress: ip });
const get = (app: any, auth?: string) =>
  app.inject({ method: 'GET', url: '/api/wallet', headers: auth ? { authorization: auth } : {}, remoteAddress: nextIp() });

describe('wallet routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripeAvailable = true;
    process.env.PUBLIC_URL = 'https://bilko.run';
    dbGet.mockResolvedValue({ balance_cents: 450 });
    sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_1' });
  });

  it('GET returns balance for Clerk and agent key, no-store', async () => {
    const app = await buildApp();
    for (const auth of ['Bearer clerk-ok', 'Bearer bkk_good']) {
      const res = await get(app, auth);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ balanceCents: 450, balance: '$4.50' });
      expect(res.headers['cache-control']).toBe('private, no-store');
    }
    await app.close();
  });

  it('GET is 401 with no auth or an invalid key', async () => {
    const app = await buildApp();
    expect((await get(app)).statusCode).toBe(401);
    expect((await get(app, 'Bearer bkk_bad')).statusCode).toBe(401);
    await app.close();
  });

  it.each([300, 500, 1000])('POST %i creates a tagged payment checkout', async (cents) => {
    const app = await buildApp();
    const res = await post(app, { cents });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_1' });
    expect(sessionsCreate).toHaveBeenCalledWith({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: cents, product_data: { name: `Bilko Credits $${cents / 100}` } } }],
      customer_creation: 'always',
      customer_email: 'Buyer@Example.com',
      client_reference_id: 'Buyer@Example.com',
      metadata: { wallet_topup: String(cents), wallet_email: 'Buyer@Example.com' },
      success_url: 'https://bilko.run/pricing?topup=success',
      cancel_url: 'https://bilko.run/pricing?topup=cancel',
    });
    await app.close();
  });

  it('POST rejects other amounts with 400', async () => {
    const app = await buildApp();
    for (const body of [{ cents: 400 }, { cents: '500' }, {}, { cents: -300 }]) {
      expect((await post(app, body)).statusCode).toBe(400);
    }
    expect(sessionsCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it('POST is 401 without Clerk session, including agent keys', async () => {
    const app = await buildApp();
    expect((await post(app, { cents: 500 }, 'Bearer nope')).statusCode).toBe(401);
    expect((await post(app, { cents: 500 }, 'Bearer bkk_good')).statusCode).toBe(401);
    expect(sessionsCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it('POST is 503 when Stripe is unconfigured', async () => {
    stripeAvailable = false;
    const app = await buildApp();
    expect((await post(app, { cents: 500 })).statusCode).toBe(503);
    await app.close();
  });

  it('POST rate limits to 10 a minute per IP', async () => {
    const app = await buildApp();
    const ip = nextIp();
    for (let i = 0; i < 10; i++) expect((await post(app, { cents: 500 }, 'Bearer clerk-ok', ip)).statusCode).toBe(200);
    expect((await post(app, { cents: 500 }, 'Bearer clerk-ok', ip)).statusCode).toBe(429);
    await app.close();
  });
});
