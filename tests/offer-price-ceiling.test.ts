import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { AGENT_OFFERS, formatPrice } from '../shared/agent-offers.js';
import { WEB_PRODUCTS, productBilling } from '../shared/web-products.js';
import { MENU_ITEMS, MENU_PRICE_CEILING_CENTS } from '../shared/bilko-menu.js';

// Stub the availability check: every offer counts as buyable and deliverable.
vi.mock('../server/services/offer-availability.js', async () => {
  const { AGENT_OFFERS: all } = await import('../shared/agent-offers.js');
  return {
    availableOffers: async () => [...all],
    isOfferAvailable: async () => true,
  };
});
vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => null,
  getStripeTest: () => null,
  hasPurchased: async () => false,
}));
vi.mock('../server/db.js', () => ({
  dbRun: vi.fn(async () => {}),
  dbAll: vi.fn(async () => []),
  dbGet: vi.fn(async () => undefined),
}));

const DECISION = 'D-2026-10-20-14';

describe(`offer price ceiling (${DECISION})`, () => {
  it(`every offer is at most the menu ceiling (${DECISION})`, () => {
    const over = [
      ...AGENT_OFFERS.filter((o) => o.amountCents > MENU_PRICE_CEILING_CENTS).map((o) => `offer ${o.id}=${o.amountCents}`),
      ...WEB_PRODUCTS.filter((p) => productBilling(p) === 'one_time' && p.amountCents > MENU_PRICE_CEILING_CENTS)
        .map((p) => `web product ${p.slug}=${p.amountCents}`),
    ];
    expect(over, `${DECISION}: no offer may exceed ${MENU_PRICE_CEILING_CENTS} cents`).toEqual([]);
  });

  it('retired hfh-* ids never return and offer ids are unique', () => {
    expect(AGENT_OFFERS.filter((o) => o.id.startsWith('hfh-')).map((o) => o.id)).toEqual([]);
    expect(WEB_PRODUCTS.filter((p) => p.slug.startsWith('hfh-')).map((p) => p.slug)).toEqual([]);
    const ids = AGENT_OFFERS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offer amounts equal their source catalogs', () => {
    for (const o of AGENT_OFFERS) {
      if (o.source.kind === 'web_product') {
        const slug = o.source.slug;
        const p = WEB_PRODUCTS.find((w) => w.slug === slug);
        expect(p, `web product ${slug}`).toBeDefined();
        expect(o.amountCents, o.id).toBe(p!.amountCents);
      } else if (o.source.kind === 'menu') {
        const itemId = o.source.itemId;
        const item = MENU_ITEMS.find((i) => i.id === itemId);
        expect(item, `menu item ${itemId}`).toBeDefined();
        expect(o.amountCents, o.id).toBe(item!.priceCents);
      } else if (o.source.kind === 'wallet_topup') {
        expect(o.amountCents, o.id).toBe(o.source.cents);
      }
    }
  });

  it('agent listings show exactly AGENT_OFFERS at AGENT_OFFERS prices', async () => {
    const { buildOffersPayload, registerProjectCatalogRoutes } = await import('../server/routes/project-catalog.js');
    const { buildLlmsTxt, registerAgentStorefrontRoutes } = await import('../server/routes/agent-storefront.js');
    const { buildOfferJsonLd } = await import('../server/offer-jsonld.js');

    const app = Fastify();
    registerProjectCatalogRoutes(app);
    registerAgentStorefrontRoutes(app);
    await app.ready();

    const expected = AGENT_OFFERS.map((o) => ({ id: o.id, amount: o.amountCents / 100 }));

    // JSON payload, built directly and via the live route.
    const direct = buildOffersPayload().offers.map((o) => ({ id: o.id, amount: o.amount }));
    expect(direct).toEqual(expected);
    const viaRoute = (await app.inject({ method: 'GET', url: '/api/offers' })).json().offers
      .map((o: { id: string; amount: number }) => ({ id: o.id, amount: o.amount }));
    expect(viaRoute).toEqual(expected);

    // llms.txt '## Buy' lines, built directly and via the live route.
    const buyLines = (txt: string) => {
      const section = txt.split('## Buy\n')[1].split('\n## ')[0];
      return section.split('\n').filter((l) => l.startsWith('- ')).map((l) => {
        const m = l.match(/^- \[.* — (.+?)\]\(https:\/\/bilko\.run\/buy\/([^)]+)\)/);
        expect(m, l).not.toBeNull();
        return { id: m![2], price: m![1] };
      });
    };
    const expectedLines = AGENT_OFFERS.map((o) => ({ id: o.id, price: formatPrice(o) }));
    expect(buyLines(buildLlmsTxt())).toEqual(expectedLines);
    const res = await app.inject({ method: 'GET', url: '/llms.txt' });
    expect(buyLines(res.body)).toEqual(expectedLines);

    // JSON-LD
    const html = buildOfferJsonLd(AGENT_OFFERS);
    const data = JSON.parse(html.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')) as
      { offers: { price: string; url: string } }[];
    expect(data.map((d) => ({ id: d.offers.url.split('/buy/')[1], amount: Number(d.offers.price) })))
      .toEqual(expected);

    await app.close();
  });
});
