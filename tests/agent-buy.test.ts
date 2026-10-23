import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const OLD_ENV = process.env;

const sessionsCreate = vi.fn();
const couponsRetrieve = vi.fn();
const dbGet = vi.fn(async (..._a: unknown[]): Promise<unknown> => undefined);
let stripeAvailable = true;

vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => (stripeAvailable ? { checkout: { sessions: { create: sessionsCreate } }, coupons: { retrieve: couponsRetrieve } } : null),
  getStripeTest: () => null,
  hasPurchased: async () => false,
}));

const dbRun = vi.fn(async () => {});
vi.mock('../server/db.js', () => ({
  dbRun,
  dbGet,
}));

const HUMAN_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
let ipCounter = 0;
const nextIp = () => `10.1.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

async function buildApp() {
  const { registerAgentBuyRoutes } = await import('../server/routes/agent-buy.js');
  const app = Fastify();
  registerAgentBuyRoutes(app);
  return app;
}

function get(app: Awaited<ReturnType<typeof buildApp>>, url: string, headers: Record<string, string> = {}, ip = nextIp()) {
  return app.inject({ method: 'GET', url, headers: { 'user-agent': HUMAN_UA, ...headers }, remoteAddress: ip });
}

describe('GET /buy/:offerId', () => {
  afterEach(() => { process.env = OLD_ENV; });
  afterAll(() => { process.env = OLD_ENV; });

  beforeEach(() => {
    vi.clearAllMocks();
    stripeAvailable = true;
    process.env = {
      ...OLD_ENV,
      PUBLIC_URL: 'https://bilko.run',
      STRIPE_PRICE_TOKENS: 'price_tokens_7',
      STRIPE_PRICE_TOKEN_SINGLE: 'price_token_1',
      STRIPE_PRICE_WP_LAUNCH_KIT: 'price_launch_kit',
      STRIPE_PRICE_GITVIEWER: 'price_git_viewer',
    };
    dbGet.mockResolvedValue(undefined);
    couponsRetrieve.mockResolvedValue({ id: 'coupon_founding', valid: true });
    sessionsCreate.mockResolvedValue({ id: 'cs_test_abc', url: 'https://checkout.stripe.com/c/pay/cs_test_abc' });
  });

  it('launch-kit creates a web-product payment session and 302s', async () => {
    const app = await buildApp();
    const res = await get(app, '/buy/launch-kit');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('https://checkout.stripe.com/c/pay/cs_test_abc');
    expect(sessionsCreate).toHaveBeenCalledTimes(1);
    expect(sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'payment',
      line_items: [{ price_data: { currency: 'usd', unit_amount: 900, product_data: { name: 'Bilko Launch Kit' } }, quantity: 1 }],
      customer_creation: 'always',
      allow_promotion_codes: true,
      metadata: { web_product: 'launch-kit', agent_buy: 'launch-kit' },
      success_url: 'https://bilko.run/projects/launch-kit/thanks/?session_id={CHECKOUT_SESSION_ID}&offer=launch-kit',
      cancel_url: 'https://bilko.run/projects/launch-kit/?checkout=cancel',
    }));
    await app.close();
  });

  it('agent-factory-kit charges $3 inline even when its price env var is unset', async () => {
    delete process.env.STRIPE_PRICE_WP_AGENT_FACTORY_KIT;
    const app = await buildApp();
    const res = await get(app, '/buy/agent-factory-kit');
    expect(res.statusCode).toBe(302);
    const params = sessionsCreate.mock.calls[0][0];
    expect(params.mode).toBe('payment');
    expect(params.line_items).toEqual([{ price_data: { currency: 'usd', unit_amount: 300, product_data: { name: 'Bilko Agent Factory Kit' } }, quantity: 1 }]);
    await app.close();
  });

  it('retired hfh-unstick offer returns 404 and creates no session', async () => {
    const app = await buildApp();
    const res = await get(app, '/buy/hfh-unstick');
    expect(res.statusCode).toBe(404);
    expect(sessionsCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it('git-viewer creates a subscription session without customer_creation', async () => {
    const app = await buildApp();
    const res = await get(app, '/buy/git-viewer');
    expect(res.statusCode).toBe(302);
    const params = sessionsCreate.mock.calls[0][0];
    expect(params).toMatchObject({
      mode: 'subscription',
      line_items: [{ price: 'price_git_viewer', quantity: 1 }],
      metadata: { agent_buy: 'git-viewer', agent_key: '0' },
      success_url: 'https://bilko.run/checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://bilko.run/projects/git-viewer/?checkout=cancel',
    });
    expect(params).not.toHaveProperty('customer_creation');
    await app.close();
  });

  it.each([
    ['pageroast-credits-7', 'price_tokens_7'],
    ['pageroast-credit-1', 'price_token_1'],
  ])('%s creates a payment session with customer_creation always', async (id, price) => {
    const app = await buildApp();
    const res = await get(app, `/buy/${id}`);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('https://checkout.stripe.com/c/pay/cs_test_abc');
    expect(sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'payment',
      line_items: [{ price, quantity: 1 }],
      customer_creation: 'always',
      metadata: { agent_buy: id, agent_key: '1' },
      success_url: 'https://bilko.run/checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://bilko.run/projects/page-roast/?checkout=cancel',
    }));
    await app.close();
  });

  it('records a best-effort checkout_start funnel event', async () => {
    const app = await buildApp();
    await get(app, '/buy/launch-kit');
    const call = dbRun.mock.calls.find((c: any[]) => String(c[0]).includes('funnel_events'));
    expect(call).toBeDefined();
    expect(call).toContain('checkout_start');
    expect(call!.some((a: unknown) => typeof a === 'string' && a.includes('"via":"agent-buy"') && a.includes('"offer":"launch-kit"'))).toBe(true);
    await app.close();
  });

  it('still redirects when the funnel insert fails', async () => {
    dbRun.mockRejectedValueOnce(new Error('db down'));
    const app = await buildApp();
    const res = await get(app, '/buy/launch-kit');
    expect(res.statusCode).toBe(302);
    await app.close();
  });

  it.each([
    ['Googlebot/2.1 (+http://www.google.com/bot.html)'],
    ['Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)'],
  ])('crawler UA gets an info page and no session (%s)', async (ua) => {
    const app = await buildApp();
    const res = await get(app, '/buy/launch-kit', { 'user-agent': ua });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-robots-tag']).toContain('noindex');
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Bilko Launch Kit');
    expect(res.body).toContain('$9');
    expect(res.body).toContain('https://bilko.run/buy/launch-kit');
    expect(sessionsCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it('HEAD requests create no session', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'HEAD', url: '/buy/launch-kit', headers: { 'user-agent': HUMAN_UA }, remoteAddress: nextIp() });
    expect(res.statusCode).toBe(200);
    expect(sessionsCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it('AI user agents and scripts get the redirect', async () => {
    const app = await buildApp();
    const ai = await get(app, '/buy/launch-kit', { 'user-agent': 'ChatGPT-User/1.0' });
    const script = await get(app, '/buy/launch-kit', { 'user-agent': 'curl/8.0' });
    expect(ai.statusCode).toBe(302);
    expect(script.statusCode).toBe(302);
    await app.close();
  });

  it('unknown or malformed offer id is a 404 HTML page', async () => {
    const app = await buildApp();
    for (const url of ['/buy/nope', '/buy/Not%20Valid', '/buy/..%2Fx']) {
      const res = await get(app, url);
      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toContain('text/html');
    }
    expect(sessionsCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it('503 HTML when Stripe is unavailable', async () => {
    stripeAvailable = false;
    const app = await buildApp();
    const res = await get(app, '/buy/launch-kit');
    expect(res.statusCode).toBe(503);
    expect(res.headers['content-type']).toContain('text/html');
    await app.close();
  });

  it('503 HTML when the price id is unavailable', async () => {
    delete process.env.STRIPE_PRICE_TOKENS;
    const app = await buildApp();
    const res = await get(app, '/buy/pageroast-credits-7');
    expect(res.statusCode).toBe(503);
    expect(sessionsCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it('503 HTML when Stripe session creation throws', async () => {
    sessionsCreate.mockRejectedValueOnce(new Error('boom'));
    const app = await buildApp();
    const res = await get(app, '/buy/launch-kit');
    expect(res.statusCode).toBe(503);
    expect(res.body).not.toContain('boom');
    await app.close();
  });

  it('rate limits to 10 sessions per minute per IP', async () => {
    const app = await buildApp();
    const ip = nextIp();
    for (let i = 0; i < 10; i++) {
      expect((await get(app, '/buy/launch-kit', {}, ip)).statusCode).toBe(302);
    }
    expect((await get(app, '/buy/launch-kit', {}, ip)).statusCode).toBe(429);
    expect((await get(app, '/buy/launch-kit', {}, nextIp())).statusCode).toBe(302);
    await app.close();
  });
});
