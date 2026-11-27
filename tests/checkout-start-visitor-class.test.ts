// checkout_start rows carry is_bot from the request user agent (label only:
// the checkout itself is identical for scripts and people).
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const OLD_ENV = process.env;

const sessionsCreate = vi.fn();
const couponsRetrieve = vi.fn();

vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => ({ checkout: { sessions: { create: sessionsCreate } }, coupons: { retrieve: couponsRetrieve } }),
  getStripeTest: () => null,
  hasPurchased: async () => false,
}));

const dbRun = vi.fn(async (..._a: unknown[]) => {});
const dbGet = vi.fn(async (..._a: unknown[]): Promise<unknown> => undefined);
vi.mock('../server/db.js', async (orig) => ({
  ...(await orig<typeof import('../server/db.js')>()),
  dbRun,
  dbGet,
}));

const CURL_UA = 'curl/8.5.0';
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
let ipCounter = 0;
const nextIp = () => `10.9.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

/** The single checkout_start INSERT, as a column -> value map. */
function checkoutStartRow(): Record<string, unknown> {
  const calls = dbRun.mock.calls.filter((c) => String(c[0]).includes('INSERT INTO funnel_events') && c[1] === 'checkout_start');
  expect(calls).toHaveLength(1);
  const [sql, ...values] = calls[0] as [string, ...unknown[]];
  const cols = /\(([^)]*)\)\s*VALUES/i.exec(sql)![1].split(',').map((s) => s.trim());
  expect(cols).toHaveLength(values.length);
  return Object.fromEntries(cols.map((c, i) => [c, values[i]]));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = {
    ...OLD_ENV,
    PUBLIC_URL: 'https://bilko.run',
    STRIPE_PRICE_WP_LAUNCH_KIT: 'price_launch_kit',
  };
  dbGet.mockImplementation(async (sql: unknown) => (String(sql).includes('web_product_releases') ? { ok: 1 } : undefined));
  couponsRetrieve.mockResolvedValue({ id: 'coupon_founding', valid: true });
  sessionsCreate.mockResolvedValue({ id: 'cs_test_vc', url: 'https://checkout.stripe.com/c/pay/cs_test_vc' });
});
afterAll(() => { process.env = OLD_ENV; });

describe('POST /api/web-products/:slug/checkout checkout_start is_bot', () => {
  async function start(ua: string | null) {
    const { registerWebProductRoutes } = await import('../server/routes/web-products.js');
    const app = Fastify();
    registerWebProductRoutes(app);
    const headers: Record<string, string> = ua === null ? {} : { 'user-agent': ua };
    const res = await app.inject({ method: 'POST', url: '/api/web-products/launch-kit/checkout', headers, remoteAddress: nextIp() });
    await app.close();
    return res;
  }

  it('a curl start stores is_bot 1 and still gets the checkout url', async () => {
    const res = await start(CURL_UA);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_vc' });
    expect(checkoutStartRow().is_bot).toBe(1);
  });

  it('a desktop Chrome start stores is_bot 0', async () => {
    const res = await start(CHROME_UA);
    expect(res.statusCode).toBe(200);
    expect(checkoutStartRow().is_bot).toBe(0);
  });

  it('a missing user agent counts as not human', async () => {
    const res = await start(null);
    expect(res.statusCode).toBe(200);
    expect(checkoutStartRow().is_bot).toBe(1);
  });

  it('Stripe params do not depend on the user agent', async () => {
    await start(CURL_UA);
    await start(CHROME_UA);
    expect(sessionsCreate).toHaveBeenCalledTimes(2);
    expect(sessionsCreate.mock.calls[0][0]).toEqual(sessionsCreate.mock.calls[1][0]);
  });
});

describe('/buy/:offer checkout_start is_bot', () => {
  async function start(ua: string | null, method: 'GET' | 'POST' = 'POST') {
    const { registerAgentBuyRoutes } = await import('../server/routes/agent-buy.js');
    const app = Fastify();
    registerAgentBuyRoutes(app);
    const headers: Record<string, string> = ua === null ? {} : { 'user-agent': ua };
    const res = await app.inject({ method, url: '/buy/launch-kit', headers, remoteAddress: nextIp() });
    await app.close();
    return res;
  }

  // /buy only opens a live session for a human browser POST (opensCheckout); curl and a
  // missing UA get the info page before any session or checkout_start row exists.
  // That gate predates is_bot and stays as is, so a script never reaches the INSERT here.
  it('a curl request gets the info page and stores no checkout_start row', async () => {
    const res = await start(CURL_UA);
    expect(res.statusCode).toBe(200);
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(dbRun.mock.calls.filter((c) => c[1] === 'checkout_start')).toHaveLength(0);
  });

  it('a desktop Chrome start stores is_bot 0 and redirects to Stripe', async () => {
    const res = await start(CHROME_UA);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('https://checkout.stripe.com/c/pay/cs_test_vc');
    expect(checkoutStartRow().is_bot).toBe(0);
  });

  it('a missing user agent counts as not human: info page, no row', async () => {
    const res = await start(null);
    expect(res.statusCode).toBe(200);
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(dbRun.mock.calls.filter((c) => c[1] === 'checkout_start')).toHaveLength(0);
  });
});
