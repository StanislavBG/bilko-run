import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const OLD_ENV = process.env;
const sessionsCreate = vi.fn();
let stripeAvailable = true;
// slug@version pairs whose release bytes are "stored".
const stored = new Set<string>();

vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => (stripeAvailable ? { checkout: { sessions: { create: sessionsCreate } }, coupons: { retrieve: vi.fn() } } : null),
  getStripeTest: () => null,
  hasPurchased: async () => false,
}));

vi.mock('../server/db.js', () => ({
  dbRun: vi.fn(async () => {}),
  dbAll: vi.fn(async () => []),
  dbGet: vi.fn(async (sql: string, slug: string, version: string) => {
    if (sql.includes('web_product_releases')) return stored.has(`${slug}@${version}`) ? { ok: 1 } : undefined;
    return undefined;
  }),
}));

const HUMAN_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
let ip = 0;

async function app() {
  const { registerProjectCatalogRoutes } = await import('../server/routes/project-catalog.js');
  const { registerAgentStorefrontRoutes } = await import('../server/routes/agent-storefront.js');
  const { registerAgentBuyRoutes } = await import('../server/routes/agent-buy.js');
  const { registerWebProductRoutes } = await import('../server/routes/web-products.js');
  const a = Fastify();
  registerProjectCatalogRoutes(a);
  registerAgentStorefrontRoutes(a);
  registerAgentBuyRoutes(a);
  registerWebProductRoutes(a);
  await a.ready();
  return a;
}

async function listOffersViaMcp(a: Awaited<ReturnType<typeof app>>): Promise<string[]> {
  const res = await a.inject({
    method: 'POST', url: '/mcp',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_offers', arguments: {} } },
  });
  return JSON.parse(res.json().result.content[0].text).offers.map((o: { id: string }) => o.id);
}

describe('offers are listed only when they can be bought and delivered', () => {
  afterAll(() => { process.env = OLD_ENV; });
  beforeEach(() => {
    // Fresh modules: isReleaseStored caches hits for the life of the process.
    vi.resetModules();
    vi.clearAllMocks();
    stripeAvailable = true;
    stored.clear();
    stored.add('launch-kit@1.0.1');
    process.env = {
      ...OLD_ENV,
      PUBLIC_URL: 'https://bilko.run',
      STRIPE_PRICE_WP_LAUNCH_KIT: 'price_launch_kit',
      STRIPE_PRICE_WP_AGENT_FACTORY_KIT: 'price_afk',
      STRIPE_PRICE_WP_HFH_FACTORY_SETUP: 'price_hfh_factory',
    };
    sessionsCreate.mockResolvedValue({ id: 'cs_test_abc', url: 'https://checkout.stripe.com/c/pay/cs_test_abc' });
  });

  it('a download without a stored release is absent from /api/offers, /llms.txt and /mcp list_offers', async () => {
    const a = await app();
    const viaApi = (await a.inject({ method: 'GET', url: '/api/offers' })).json().offers.map((o: { id: string }) => o.id);
    const llms = (await a.inject({ method: 'GET', url: '/llms.txt' })).body;
    const viaMcp = await listOffersViaMcp(a);
    for (const ids of [viaApi, viaMcp]) {
      expect(ids).toContain('launch-kit');
      expect(ids).not.toContain('agent-factory-kit');
      // Agent Factory Setup includes the Kit, so it cannot be delivered either.
      expect(ids).not.toContain('hfh-factory-setup');
      // No price configured.
      expect(ids).not.toContain('hfh-unstick');
    }
    expect(llms).toContain('https://bilko.run/buy/launch-kit');
    expect(llms).not.toContain('https://bilko.run/buy/agent-factory-kit');
    expect(llms).not.toContain('https://bilko.run/buy/hfh-factory-setup');
    await a.close();
  });

  it('lists the download once its release is stored', async () => {
    stored.add('agent-factory-kit@1.0.0');
    const a = await app();
    const ids = (await a.inject({ method: 'GET', url: '/api/offers' })).json().offers.map((o: { id: string }) => o.id);
    expect(ids).toEqual(expect.arrayContaining(['launch-kit', 'agent-factory-kit', 'hfh-factory-setup']));
    expect(await listOffersViaMcp(a)).toEqual(ids);
    await a.close();
  });

  it('lists nothing when Stripe is not configured', async () => {
    stripeAvailable = false;
    stored.add('agent-factory-kit@1.0.0');
    const a = await app();
    expect((await a.inject({ method: 'GET', url: '/api/offers' })).json().offers).toEqual([]);
    await a.close();
  });

  it('/buy and checkout refuse an undeliverable download without creating a Stripe session', async () => {
    const a = await app();
    const human = await a.inject({ method: 'GET', url: '/buy/agent-factory-kit', headers: { 'user-agent': HUMAN_UA }, remoteAddress: `10.7.0.${++ip}` });
    expect(human.statusCode).toBe(503);
    expect(human.body).toContain('not on sale yet');
    expect(human.body).toContain('https://bilko.run/projects/launch-kit/agent-factory-kit/');
    const crawler = await a.inject({ method: 'HEAD', url: '/buy/agent-factory-kit', remoteAddress: `10.7.0.${++ip}` });
    expect(crawler.statusCode).toBe(503);
    const service = await a.inject({ method: 'GET', url: '/buy/hfh-factory-setup', headers: { 'user-agent': HUMAN_UA }, remoteAddress: `10.7.0.${++ip}` });
    expect(service.statusCode).toBe(503);
    const checkout = await a.inject({ method: 'POST', url: '/api/web-products/agent-factory-kit/checkout?dryRun=1', remoteAddress: `10.7.0.${++ip}` });
    expect(checkout.statusCode).toBe(503);
    expect(checkout.json()).toEqual({ error: 'not_available_yet' });
    expect(sessionsCreate).not.toHaveBeenCalled();

    const kit = await a.inject({ method: 'GET', url: '/buy/launch-kit', headers: { 'user-agent': HUMAN_UA }, remoteAddress: `10.7.0.${++ip}` });
    expect(kit.statusCode).toBe(302);
    expect(sessionsCreate).toHaveBeenCalledTimes(1);
    await a.close();
  });
});
