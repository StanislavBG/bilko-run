import { describe, it, expect } from 'vitest';
import { AGENT_OFFERS, offerById, formatPrice } from '../shared/agent-offers';
import { WEB_PRODUCTS, webProductBySlug, productBilling } from '../shared/web-products';
import { displayPriceCents } from '../server/routes/web-products';
import { entryForPriceType } from '../shared/product-catalog';

describe('agent offers', () => {
  it('has the expected offers with unique kebab-case ids', () => {
    const ids = AGENT_OFFERS.map(o => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(ids).toEqual(['launch-kit', 'agent-factory-kit', 'git-viewer', 'pageroast-credits-7', 'pageroast-credit-1',
      'hfh-unstick', 'hfh-factory-setup', 'hfh-fractional']);
  });

  it('uses https://bilko.run/buy/<id> for every buyUrl', () => {
    for (const o of AGENT_OFFERS) expect(o.buyUrl).toBe(`https://bilko.run/buy/${o.id}`);
  });

  it('web_product sources resolve and match displayPrice', () => {
    for (const o of AGENT_OFFERS) {
      if (o.source.kind !== 'web_product') continue;
      const p = webProductBySlug(o.source.slug, WEB_PRODUCTS);
      expect(p).toBeDefined();
      expect(o.amountCents).toBe(displayPriceCents(p!.displayPrice));
      expect(o.billing).toBe(productBilling(p!));
    }
  });

  it('price_catalog sources resolve and never use the retired session_manager type', () => {
    for (const o of AGENT_OFFERS) {
      if (o.source.kind !== 'price_catalog') continue;
      expect(o.source.priceType).not.toBe('session_manager');
      expect(entryForPriceType(o.source.priceType)).toBeDefined();
    }
  });

  it('formats prices and flags agent keys', () => {
    expect(formatPrice(offerById('launch-kit')!)).toBe('$9');
    expect(formatPrice(offerById('git-viewer')!)).toBe('$5/month');
    expect(formatPrice(offerById('pageroast-credit-1')!)).toBe('$1');
    expect(offerById('nope')).toBeUndefined();
    expect(offerById('pageroast-credits-7')!.agentKey).toBe(true);
    expect(offerById('git-viewer')!.whatYouGet).toMatch(/same email/i);
  });

  it('lists the agent factory kit with honest copy', () => {
    const o = offerById('agent-factory-kit')!;
    expect(o.source).toEqual({ kind: 'web_product', slug: 'agent-factory-kit' });
    expect(webProductBySlug('agent-factory-kit', WEB_PRODUCTS)).toBeDefined();
    expect(o.buyUrl).toBe('https://bilko.run/buy/agent-factory-kit');
    const text = JSON.stringify(o);
    expect(text).not.toMatch(/by anthropic|official/i);
    expect(text).not.toMatch(/guarantee/i);
  });

  it('never leaks the owner real name in offer text', () => {
    for (const o of AGENT_OFFERS) {
      expect(JSON.stringify(o).toLowerCase()).not.toContain('stanislav');
    }
  });
});
