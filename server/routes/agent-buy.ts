import type { FastifyInstance } from 'fastify';
import { getStripe } from '../services/stripe.js';
import { dbRun } from '../db.js';
import { hashIp } from './tools/_shared.js';
import { classifyVisitor } from '../services/analytics.js';
import { MENU_ITEMS, WALLET_TOPUP_CENTS } from '../../shared/bilko-menu.js';
import { formatPrice, offerById, type AgentOffer } from '../../shared/agent-offers.js';
import { entryForPriceType } from '../../shared/product-catalog.js';
import { buildWebProductCheckoutParams, ipSeenAsAdmin } from './web-products.js';
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

function topupParams(offer: AgentOffer & { source: { kind: 'wallet_topup'; cents: number } }, publicUrl: string): Record<string, unknown> {
  const cents = offer.source.cents;
  return {
    mode: 'payment',
    line_items: [{ price_data: { currency: 'usd', unit_amount: cents, product_data: { name: offer.name } }, quantity: 1 }],
    customer_creation: 'always',
    metadata: { wallet_topup: String(cents), agent_buy: offer.id, agent_key: '1' },
    success_url: `${publicUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${offer.pageUrl}?checkout=cancel`,
  };
}

function menuInstructions(offer: AgentOffer): string {
  const id = offer.source.kind === 'menu' ? offer.source.itemId : offer.id;
  const item = MENU_ITEMS.find((i) => i.id === id);
  const topups = WALLET_TOPUP_CENTS.map((c) => `<a href="/buy/credits-${c / 100}">${esc(`$${c / 100}`)}</a>`).join(' · ');
  return `<p>${esc(offer.summary)}</p><p>${esc(offer.whatYouGet)}</p><p>Price: ${esc(formatPrice(offer))} in Bilko Credits.</p>`
    + `<p>Top up your wallet: ${topups}. A top-up gives you a bkk_ agent key.</p>`
    + `<p>To order, POST <code>https://bilko.run/api/menu/${esc(id)}/order</code> with your bkk_ key`
    + `${item?.intake.length ? ` and fields: ${item.intake.map((f) => esc(f.key)).join(', ')}` : ''}, or use the MCP tool <code>order_menu_item</code>.</p>`;
}

/**
 * Only a person in a browser can finish Stripe Checkout, so only a browser GET opens a live
 * session. HEAD, crawlers, AI fetchers (ChatGPT-User), HTTP clients (curl, fetch, python-requests)
 * and headless browsers get the info page instead.
 */
function opensCheckout(method: string, ua: string): boolean {
  return method === 'GET' && ua.startsWith('Mozilla/') && classifyVisitor(ua) === 'human';
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

    if (offer.source.kind === 'menu') {
      return sendHtml(reply, 200, page(offer.name, menuInstructions(offer)));
    }

    // ?dryRun=1 runs every check a browser GET would (Stripe, price, stock) without a session.
    const dryRun = (req.query as { dryRun?: string } | undefined)?.dryRun === '1';
    const info = (note = '') => sendHtml(reply, 200, page(offer.name,
      `<p>${esc(offer.summary)}</p><p>Price: ${esc(formatPrice(offer))}</p>${note}`
      + `<p>To buy, open <a href="${esc(offer.buyUrl)}">${esc(offer.buyUrl)}</a> in a browser.</p>`
      + `<p>Product page: <a href="${esc(offer.pageUrl)}">${esc(offer.pageUrl)}</a></p>`));

    if (!dryRun && !opensCheckout(req.method, String(req.headers['user-agent'] ?? ''))) {
      if (!(await isOfferAvailable(offer))) return notYet();
      return info();
    }

    if (!dryRun && !rateOk(`agent-buy:${req.ip}`, SESSION_LIMIT)) {
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
    const product = offer.source.kind === 'web_product' ? webProductBySlug(offer.source.slug)! : undefined;
    let session: { id: string; url?: string | null };
    let ownerIp = false;
    try {
      if (product?.maxOrders !== undefined && (await countLiveOrders(product.slug)) >= product.maxOrders) {
        return sendHtml(reply, 409, page('Sold out',
          `<p>${esc(offer.name)} is sold out right now. See <a href="${esc(offer.pageUrl)}">${esc(offer.pageUrl)}</a> for updates.</p>`));
      }
      if (dryRun) return info('<p>Dry run: checkout is ready. No Stripe session was created.</p>');

      // Same owner flag as POST /api/web-products/:slug/checkout: keeps the owner's own clicks out of /admin.
      ownerIp = await ipSeenAsAdmin(req.ip);
      let params: Record<string, unknown>;
      if (product) {
        const base = buildWebProductCheckoutParams(product, {
          owner: false, ownerIp, priceId: priceId ?? undefined, testCents: null, publicUrl,
          couponId: await foundingCouponId(product, stripe),
        });
        params = { ...base, metadata: { ...base.metadata, agent_buy: offer.id } };
      } else if (offer.source.kind === 'wallet_topup') {
        params = topupParams(offer as any, publicUrl);
      } else {
        params = sessionParams(offer, priceId!, publicUrl);
      }
      session = await stripe.checkout.sessions.create(params as any);
    } catch (err: any) {
      console.error('[agent-buy] checkout failed:', err?.message);
      return unavailable();
    }
    const url = session.url;
    if (!url) return unavailable();

    try {
      await dbRun(
        'INSERT INTO funnel_events (event, ip_hash, tool, metadata, is_admin) VALUES (?, ?, ?, ?, ?)',
        'checkout_start', hashIp(req.ip), offer.id,
        JSON.stringify({ via: 'agent-buy', offer: offer.id, checkout_session_id: session.id }), ownerIp ? 1 : 0,
      );
    } catch (err: any) {
      console.error('[agent-buy] funnel insert failed:', err?.message);
    }

    reply.header('Cache-Control', 'no-store');
    return reply.redirect(url, 302);
  });
}
