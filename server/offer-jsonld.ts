import { AGENT_OFFERS, type AgentOffer } from '../shared/agent-offers.js';

const JSONLD_BLOCK_RE = /<script\b[^>]*\btype\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/** Offers whose pageUrl path equals `path` (query already stripped). */
export function offersForPath(path: string, offers: readonly AgentOffer[] = AGENT_OFFERS): AgentOffer[] {
  return offers.filter(o => pathOf(o.pageUrl) === path);
}

function productFor(o: AgentOffer): Record<string, unknown> {
  const price = (o.amountCents / 100).toFixed(2);
  const currency = o.currency.toUpperCase();
  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    price,
    priceCurrency: currency,
    url: o.buyUrl,
    availability: 'https://schema.org/InStock',
  };
  if (o.billing === 'month') {
    offer.priceSpecification = {
      '@type': 'UnitPriceSpecification',
      price,
      priceCurrency: currency,
      billingDuration: 'P1M',
    };
  }
  return { '@type': 'Product', name: o.name, description: o.summary, url: o.pageUrl, offers: offer };
}

/** One `<script type="application/ld+json">` block: a Product per offer. `<` is escaped so no string can close the tag. */
export function buildOfferJsonLd(offers: readonly AgentOffer[]): string {
  const data = offers.map(o => ({ '@context': 'https://schema.org', ...productFor(o) }));
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

/** True when the page already carries a ld+json block declaring a Product. */
export function hasProductJsonLd(html: string): boolean {
  for (const m of html.matchAll(JSONLD_BLOCK_RE)) {
    if (/["']@type["']\s*:\s*(?:\[[^\]]*)?["']Product["']/.test(m[1])) return true;
  }
  return false;
}

export function injectJsonLd(html: string, json: string): string {
  if (!/<\/head>/i.test(html)) return html;
  return html.replace(/<\/head>/i, () => `    ${json}\n  </head>`);
}
