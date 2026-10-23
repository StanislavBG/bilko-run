// Which offers can be bought and delivered right now. The agent-facing listings
// (/llms.txt, /api/offers, /mcp, offer JSON-LD) and /buy show only these, so an
// offer is never advertised before its Stripe price is configured or, for
// downloads, before the zip it promises is stored.
import { getStripe } from './stripe.js';
import { isReleaseStored } from './web-products.js';
import { AGENT_OFFERS, type AgentOffer } from '../../shared/agent-offers.js';
import { entryForPriceType } from '../../shared/product-catalog.js';
import {
  WEB_PRODUCTS, productKind, resolveWebProductPriceId, webProductBySlug, type WebProduct,
} from '../../shared/web-products.js';

export function offerPriceId(offer: AgentOffer, env: Record<string, string | undefined>): string | undefined {
  if (offer.source.kind === 'web_product') {
    const product = webProductBySlug(offer.source.slug);
    return product ? resolveWebProductPriceId(product, env) : undefined;
  }
  const entry = entryForPriceType(offer.source.priceType);
  return entry ? env[entry.envVar] || entry.defaultPriceId : undefined;
}

/** Every zip the purchase promises is stored: a download's own release, or the downloads a service includes. */
export async function isDeliverable(product: WebProduct, list: readonly WebProduct[] = WEB_PRODUCTS): Promise<boolean> {
  const zips = productKind(product) === 'download'
    ? [product]
    : (product.includes ?? []).map((slug) => webProductBySlug(slug, list));
  try {
    for (const p of zips) {
      if (!p?.release || !(await isReleaseStored(p.slug, p.release.version))) return false;
    }
  } catch (err: any) {
    console.error('[offer-availability] release lookup failed:', err?.message);
    return false;
  }
  return true;
}

export async function isOfferAvailable(offer: AgentOffer): Promise<boolean> {
  if (!getStripe() || !offerPriceId(offer, process.env)) return false;
  if (offer.source.kind !== 'web_product') return true;
  const product = webProductBySlug(offer.source.slug);
  return !!product && isDeliverable(product);
}

export async function availableOffers(offers: readonly AgentOffer[] = AGENT_OFFERS): Promise<AgentOffer[]> {
  const ok = await Promise.all(offers.map(isOfferAvailable));
  return offers.filter((_, i) => ok[i]);
}
