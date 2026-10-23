import type { FastifyInstance } from 'fastify';
import { getStripe } from '../services/stripe.js';
import { dbRun } from '../db.js';
import { hashIp } from './tools/_shared.js';
import { classifyVisitor } from '../services/analytics.js';
import { formatPrice, offerById, type AgentOffer } from '../../shared/agent-offers.js';
import { entryForPriceType } from '../../shared/product-catalog.js';
import { buildWebProductCheckoutParams } from './web-products.js';
import { countLiveOrders } from '../services/web-products.js';
import { availableOffers, isOfferAvailable, isOfferPriced, offerPriceId } from '../services/offer-availability.js';
import { webProductBySlug, type WebProduct } from '../../shared/web-products.js';

const RATE_WINDOW_MS = 60_000;
const SESSION_LIMIT = 10;
const OFFER_ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

const rateCounts = new Map<string, { count: number; windowStart: number }>();

function rateOk(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateCounts.get(key);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateCounts.set(key, { count: 1, windowStart: now });
    if (rateCounts.size > 5000) {
      for (const [k, v] of rateCounts) {
        if (now - v.windowStart > RATE_WINDOW_MS) rateCounts.delete(k);
      }
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>`
    + `<body style="font-family:system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem"><h1>${esc(title)}</h1>${body}</body></html>`;
}

function sendHtml(reply: any, status: number, html: string) {
  return reply
    .status(status)
    .header('Content-Type', 'text/html; charset=utf-8')
    .header('Cache-Control', 'no-store')
    .header('X-Robots-Tag', 'noindex')
    .send(html);
}

/** Founding coupon id when its env var is set and Stripe says it is still valid. */
async function foundingCouponId(product: WebProduct, stripe: any): Promise<string | undefined> {
  const id = product.foundingCouponEnvVar ? process.env[product.foundingCouponEnvVar] : undefined;
  if (!id) return undefined;
  try {
    const coupon = await stripe.coupons.retrieve(id);
    return coupon?.valid ? id : undefined;
  } catch (err: any) {
    console.error('[agent-buy] founding coupon lookup failed:', err?.message);
    return undefined;
  }
}

function sessionParams(offer: AgentOffer, priceId: string, publicUrl: string): Record<string, unknown> {
  const lineItems = [{ price: priceId, quantity: 1 }];
  const mode = offer.source.kind === 'price_catalog'
    ? entryForPriceType(offer.source.priceType)?.mode ?? 'payment'
    : 'payment';
  return {
    mode,
    line_items: lineItems,
    // The webhook only credits tokens when a Stripe customer exists.
    ...(mode === 'payment' ? { customer_creation: 'always' } : {}),
    metadata: { agent_buy: offer.id, agent_key: offer.agentKey ? '1' : '0' },
    success_url: `${publicUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${offer.pageUrl}?checkout=cancel`,
  };
}

export function registerAgentBuyRoutes(app: FastifyInstance): void {
  app.get('/buy/:offerId', async (req, reply) => {
    const offerId = (req.params as { offerId?: string }).offerId;
    const offer = typeof offerId === 'string' && OFFER_ID_RE.test(offerId) ? offerById(offerId) : undefined;
    if (!offer) {
      const open = await availableOffers();
      return sendHtml(reply, 404, page('Offer not found',
        `<p>No such offer. Available: ${open.map((o) => `<a href="/buy/${esc(o.id)}">${esc(o.id)}</a>`).join(', ') || 'none right now'}.</p>`));
    }

    // Never take money for something that cannot be delivered (e.g. a download whose zip is not stored).
    const notYet = () => sendHtml(reply, 503, page('Not available yet',
      `<p>${esc(offer.name)} is not on sale yet. See <a href="${esc(offer.pageUrl)}">${esc(offer.pageUrl)}</a> for updates.</p>`));

    const ua = String(req.headers['user-agent'] ?? '');
    const cls = classifyVisitor(ua);
    if (req.method === 'HEAD' || cls === 'search_crawler' || cls === 'ai_crawler') {
      if (!(await isOfferAvailable(offer))) return notYet();
      return sendHtml(reply, 200, page(offer.name,
        `<p>${esc(offer.summary)}</p><p>Price: ${esc(formatPrice(offer))}</p>`
        + `<p>To buy, open <a href="${esc(offer.buyUrl)}">${esc(offer.buyUrl)}</a> in a browser.</p>`));
    }

    if (!rateOk(`agent-buy:${req.ip}`, SESSION_LIMIT)) {
      return sendHtml(reply, 429, page('Too many requests', '<p>Try again in a minute.</p>'));
    }

    const unavailable = () => sendHtml(reply, 503, page('Checkout unavailable',
      `<p>Checkout is not available right now. Try again later or visit <a href="${esc(offer.pageUrl)}">${esc(offer.pageUrl)}</a>.</p>`));

    const stripe = getStripe();
    const priceId = offerPriceId(offer, process.env);
    // One-time web products charge amountCents inline; only catalog offers and monthly products need a price id.
    if (!stripe || !isOfferPriced(offer, process.env)) return unavailable();
    if (!(await isOfferAvailable(offer))) return notYet();

    const publicUrl = process.env.PUBLIC_URL || 'https://bilko.run';
    let url: string | null | undefined;
    try {
      let params: Record<string, unknown>;
      if (offer.source.kind === 'web_product') {
        const product = webProductBySlug(offer.source.slug)!;
        if (product.maxOrders !== undefined && (await countLiveOrders(product.slug)) >= product.maxOrders) {
          return sendHtml(reply, 409, page('Sold out',
            `<p>${esc(offer.name)} is sold out right now. See <a href="${esc(offer.pageUrl)}">${esc(offer.pageUrl)}</a> for updates.</p>`));
        }
        const base = buildWebProductCheckoutParams(product, {
          owner: false, ownerIp: false, priceId: priceId ?? undefined, testCents: null, publicUrl,
          couponId: await foundingCouponId(product, stripe),
        });
        params = { ...base, metadata: { ...base.metadata, agent_buy: offer.id } };
      } else {
        params = sessionParams(offer, priceId!, publicUrl);
      }
      const session = await stripe.checkout.sessions.create(params as any);
      url = session.url;
    } catch (err: any) {
      console.error('[agent-buy] checkout failed:', err?.message);
      return unavailable();
    }
    if (!url) return unavailable();

    try {
      await dbRun(
        'INSERT INTO funnel_events (event, ip_hash, tool, metadata, is_admin) VALUES (?, ?, ?, ?, ?)',
        'checkout_start', hashIp(req.ip), offer.id,
        JSON.stringify({ via: 'agent-buy', offer: offer.id }), 0,
      );
    } catch (err: any) {
      console.error('[agent-buy] funnel insert failed:', err?.message);
    }

    reply.header('Cache-Control', 'no-store');
    return reply.redirect(url, 302);
  });
}
