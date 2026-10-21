import Fastify from 'fastify';
import { describe, it, expect, beforeAll } from 'vitest';
import { registerSecurityHeaders } from '../server/security-headers.js';
import { registerOgRoutes } from '../server/og-routes.js';
import { loadOgProjects } from '../server/og-meta.js';
import { buildOfferJsonLd, injectJsonLd } from '../server/offer-jsonld.js';
import { AGENT_OFFERS, offerById } from '../shared/agent-offers.js';

const HTML = '<html><head><title>T</title></head><body><p>hi</p></body></html>';
const WITH_PRODUCT =
  '<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"X"}</script></head><body></body></html>';

const app = Fastify();
beforeAll(async () => {
  registerSecurityHeaders(app);
  registerOgRoutes(app, { projects: loadOgProjects(), blogPosts: [] });
  for (const p of ['launch-kit', 'git-viewer', 'page-roast', 'sudoku'])
    app.get(`/projects/${p}/`, async (_req, reply) => reply.type('text/html').send(HTML));
  app.get('/projects/launch-kit/dup', async (_req, reply) => reply.type('text/html').send(WITH_PRODUCT));
  await app.ready();
});

const blocks = (html: string): unknown[] =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(m => JSON.parse(m[1]));

describe('offer JSON-LD', () => {
  it('launch-kit gets a valid Product with price 9.00 USD and buy url', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/launch-kit/?utm=1' });
    const [p] = blocks(res.body) as any[];
    expect(p['@type']).toBe('Product');
    expect(p.offers.price).toBe('9.00');
    expect(p.offers.priceCurrency).toBe('USD');
    expect(p.offers.url).toBe('https://bilko.run/buy/launch-kit');
    expect(p.offers.availability).toBe('https://schema.org/InStock');
    expect(p.offers.priceSpecification).toBeUndefined();
  });

  it('git-viewer gets the P1M price specification', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/git-viewer/' });
    const [p] = blocks(res.body) as any[];
    expect(p.offers.priceSpecification).toMatchObject({ '@type': 'UnitPriceSpecification', billingDuration: 'P1M' });
  });

  it('page-roast gets both credit offers', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/page-roast/' });
    expect((blocks(res.body) as any[]).map(p => p.offers.price).sort()).toEqual(['1.00', '5.00']);
  });

  it('leaves unrelated pages without ld+json', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/sudoku/' });
    expect(res.body).not.toContain('application/ld+json');
  });

  it('does not duplicate an existing Product block', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/launch-kit/dup' });
    expect(res.body.match(/application\/ld\+json/g)).toHaveLength(1);
  });

  it('a </script> in a summary cannot break out', () => {
    const o = { ...offerById('launch-kit')!, summary: 'x</script><script>alert(1)</script>' };
    const block = buildOfferJsonLd([o]);
    expect(block.match(/<\/script>/g)).toHaveLength(1);
    expect(block).not.toContain('<script>alert');
    expect(JSON.parse(block.replace(/^<script[^>]*>|<\/script>$/g, ''))[0].description).toBe(o.summary);
  });

  it('injectJsonLd is a no-op without </head>', () => {
    expect(injectJsonLd('<p>x</p>', buildOfferJsonLd(AGENT_OFFERS))).toBe('<p>x</p>');
  });
});
