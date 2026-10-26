import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { WEB_PRODUCTS } from '../shared/web-products.js';

const OLD_ENV = process.env;
const sessionsCreate = vi.fn();
let stripeAvailable = true;
// slug@version pairs whose release bytes are "stored".
const stored = new Set<string>();
// slug@version of a catalog product's pinned release, so pin bumps leave these tests alone.
const pinned = (slug: string) => `${slug}@${WEB_PRODUCTS.find((p) => p.slug === slug)!.release!.version}`;

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
  afterAll(() => { process.env = OLD_ENV; vi.doUnmock("../shared/web-products.js"); });
  beforeEach(() => {
    // Fresh modules: isReleaseStored caches hits for the life of the process.
    vi.resetModules();
    vi.clearAllMocks();
    stripeAvailable = true;
    stored.clear();
    stored.add(pinned('launch-kit'));
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
    }
    expect(llms).toContain('https://bilko.run/buy/launch-kit');
    expect(llms).not.toContain('https://bilko.run/buy/agent-factory-kit');
    await a.close();
  });

  it('lists the download once its release is stored', async () => {
    stored.add(pinned('agent-factory-kit'));
    const a = await app();
    const ids = (await a.inject({ method: 'GET', url: '/api/offers' })).json().offers.map((o: { id: string }) => o.id);
    expect(ids).toEqual(expect.arrayContaining(['launch-kit', 'agent-factory-kit']));
    expect(await listOffersViaMcp(a)).toEqual(ids);
    await a.close();
  });

  it('lists only credit-priced menu offers when Stripe is not configured', async () => {
    stripeAvailable = false;
    stored.add(pinned('agent-factory-kit'));
    const a = await app();
    const offers = (await a.inject({ method: 'GET', url: '/api/offers' })).json().offers as { id: string; payWith: string }[];
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => o.payWith === 'credits')).toBe(true);
    expect(offers.map((o) => o.id)).toContain('ask-bilko');
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

describe('isOfferAvailable: price requirement by billing', () => {
  const offer = { id: 'x', source: { kind: 'web_product', slug: 'x-product' } } as any;
  const product = (extra: object) => ({
    slug: 'x-product', priceEnvVar: 'STRIPE_PRICE_WP_X', amountCents: 1900, ...extra,
  });

  async function load(p: object, isStored: boolean) {
    vi.resetModules();
    vi.doMock('../server/services/stripe.js', () => ({ getStripe: () => ({}) }));
    vi.doMock('../server/services/web-products.js', () => ({ isReleaseStored: async () => isStored }));
    vi.doMock('../shared/web-products.js', async (orig) => ({
      ...(await orig<typeof import('../shared/web-products.js')>()),
      webProductBySlug: () => p,
    }));
    return import('../server/services/offer-availability.js');
  }

  it('one-time download with a stored release and no price id is available', async () => {
    const m = await load(product({ release: { version: '1.0.0' } }), true);
    expect(m.isOfferPriced(offer, {})).toBe(true);
    expect(await m.isOfferAvailable(offer)).toBe(true);
  });

  it('one-time download without a stored release is not available', async () => {
    const m = await load(product({ release: { version: '1.0.0' } }), false);
    expect(await m.isOfferAvailable(offer)).toBe(false);
  });

  it('monthly product without a price id is not available, and is with one', async () => {
    const m = await load(product({ kind: 'service', billing: 'month' }), true);
    expect(m.isOfferPriced(offer, {})).toBe(false);
    expect(m.isOfferPriced(offer, { STRIPE_PRICE_WP_X: 'price_1' })).toBe(true);
  });
});

describe('isOfferAvailable: credits offers', () => {
  it('top-ups need Stripe; menu offers are always available', async () => {
    vi.resetModules();
    let stripe: object | null = null;
    vi.doMock('../server/services/stripe.js', () => ({ getStripe: () => stripe }));
    const m = await import('../server/services/offer-availability.js');
    const { offerById } = await import('../shared/agent-offers.js');
    const topup = offerById('credits-5')!;
    const menu = offerById('ask-bilko')!;
    expect(await m.isOfferAvailable(topup)).toBe(false);
    expect(await m.isOfferAvailable(menu)).toBe(true);
    stripe = {};
    expect(await m.isOfferAvailable(topup)).toBe(true);
    expect(await m.isOfferAvailable(menu)).toBe(true);
  });
});
