import type { FastifyInstance } from 'fastify';
import { getStripe } from '../services/stripe.js';
import { dbRun } from '../db.js';
import { hashIp } from './tools/_shared.js';
import {
  countSessionDownloads, findOrder, getRelease, recordDownload, recordOrder,
  type WebProductOrder,
} from '../services/web-products.js';
import {
  WEB_PRODUCTS, isValidCheckoutSessionId, isValidWebProductSlug,
  resolveWebProductPriceId, webProductBySlug, type WebProduct,
} from '../../shared/web-products.js';

const RATE_WINDOW_MS = 60_000;
const CHECKOUT_LIMIT = 10;
const DELIVERY_LIMIT = 30;

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

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

type Resolved =
  | { status: 'paid'; order: WebProductOrder }
  | { status: 'unpaid' }
  | { status: 'not_found' };

class StripeUnavailable extends Error {}

async function resolvePaidOrder(product: WebProduct, sessionId: string): Promise<Resolved> {
  const existing = await findOrder(product.slug, sessionId);
  if (existing) return { status: 'paid', order: existing };

  const stripe = getStripe();
  const priceId = resolveWebProductPriceId(product, process.env);
  if (!stripe || !priceId) throw new StripeUnavailable('stripe or price unconfigured');

  let session: any;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });
  } catch (err: any) {
    if (err?.code === 'resource_missing') return { status: 'not_found' };
    console.error('[web-products] stripe retrieve failed:', err?.message);
    throw new StripeUnavailable('stripe retrieve failed');
  }

  if (session?.metadata?.web_product !== product.slug) return { status: 'not_found' };
  const paidOk = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
  if (session.status !== 'complete' || !paidOk) return { status: 'unpaid' };
  const items: any[] = session.line_items?.data ?? [];
  if (!items.some((li) => li?.price?.id === priceId)) return { status: 'not_found' };

  const email: string = (session.customer_details?.email ?? session.customer_email ?? '').trim().toLowerCase();
  const input = {
    checkoutSessionId: sessionId,
    slug: product.slug,
    email,
    amountTotal: session.amount_total ?? null,
    currency: session.currency ?? null,
    paymentStatus: session.payment_status ?? null,
  };
  await recordOrder(input);
  return {
    status: 'paid',
    order: {
      checkout_session_id: sessionId,
      slug: product.slug,
      email,
      amount_total: input.amountTotal,
      currency: input.currency,
      payment_status: input.paymentStatus,
      created_at: Date.now(),
    },
  };
}

export function registerWebProductRoutes(
  app: FastifyInstance,
  opts: { products?: readonly WebProduct[] } = {},
): void {
  const products = opts.products ?? WEB_PRODUCTS;
  const lookup = (slug: unknown): WebProduct | undefined =>
    isValidWebProductSlug(slug) ? webProductBySlug(slug, products) : undefined;

  app.get('/api/web-products/:slug', async (req, reply) => {
    const product = lookup((req.params as { slug?: string }).slug);
    reply.header('Cache-Control', 'no-store');
    if (!product) {
      reply.status(404);
      return { error: 'Not found' };
    }
    let available = false;
    if (product.release) {
      const stored = await getRelease(product.slug, product.release.version);
      available = !!stored && !!resolveWebProductPriceId(product, process.env) && !!getStripe();
    }
    return {
      slug: product.slug,
      name: product.name,
      displayPrice: product.displayPrice,
      version: product.release?.version ?? null,
      available,
    };
  });

  app.post('/api/web-products/:slug/checkout', async (req, reply) => {
    const product = lookup((req.params as { slug?: string }).slug);
    if (!product) {
      reply.status(404);
      return { error: 'Not found' };
    }
    if (!rateOk(`wp-checkout:${req.ip}`, CHECKOUT_LIMIT)) {
      reply.status(429);
      return { error: 'Too many requests. Try again in a minute.' };
    }
    const stripe = getStripe();
    const priceId = resolveWebProductPriceId(product, process.env);
    if (!stripe || !priceId) {
      reply.status(503);
      return { error: 'Checkout is not available right now.' };
    }

    const publicUrl = process.env.PUBLIC_URL || 'https://bilko.run';
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        customer_creation: 'always',
        allow_promotion_codes: true,
        metadata: { web_product: product.slug },
        success_url: `${publicUrl}/projects/${product.slug}/thanks/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${publicUrl}/projects/${product.slug}/?checkout=cancel`,
      });
      try {
        await dbRun(
          'INSERT INTO funnel_events (event, ip_hash, tool, metadata) VALUES (?, ?, ?, ?)',
          'checkout_start', hashIp(req.ip), product.slug,
          JSON.stringify({ path: `/projects/${product.slug}/` }),
        );
      } catch (err: any) {
        console.error('[web-products] funnel insert failed:', err?.message);
      }
      return { url: session.url };
    } catch (err: any) {
      console.error('[web-products] checkout failed:', err?.message);
      reply.status(502);
      return { error: 'Checkout failed. Please try again.' };
    }
  });

  // Shared preamble for order + download. Returns the paid order, or null after
  // setting the reply status.
  async function authorize(req: any, reply: any): Promise<{ product: WebProduct; order: WebProductOrder; sessionId: string } | null> {
    const product = lookup(req.params?.slug);
    if (!product) {
      reply.status(404).send({ error: 'Not found' });
      return null;
    }
    const sessionId = req.query?.session_id;
    if (!isValidCheckoutSessionId(sessionId)) {
      reply.status(400).send({ error: 'Invalid session id' });
      return null;
    }
    if (!rateOk(`wp-delivery:${req.ip}`, DELIVERY_LIMIT)) {
      reply.status(429).send({ error: 'Too many requests. Try again in a minute.' });
      return null;
    }
    let result: Resolved;
    try {
      result = await resolvePaidOrder(product, sessionId);
    } catch (err: any) {
      if (!(err instanceof StripeUnavailable)) console.error('[web-products] verify failed:', err?.message);
      reply.status(502).send({ error: 'Could not verify the order. Try again shortly.' });
      return null;
    }
    if (result.status === 'not_found') {
      reply.status(404).send({ error: 'Order not found' });
      return null;
    }
    if (result.status === 'unpaid') {
      reply.status(402).send({ paid: false });
      return null;
    }
    return { product, order: result.order, sessionId };
  }

  app.get('/api/web-products/:slug/order', async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    const auth = await authorize(req, reply);
    if (!auth) return reply;
    const { product, order, sessionId } = auth;
    const decl = product.release;
    return {
      paid: true,
      slug: product.slug,
      name: product.name,
      version: decl?.version ?? null,
      filename: decl?.filename ?? null,
      bytes: decl?.bytes ?? null,
      downloadsUsed: await countSessionDownloads(product.slug, sessionId),
      downloadsLimit: product.downloadLimit,
      email: maskEmail(order.email),
    };
  });

  app.get('/api/web-products/:slug/download', async (req, reply) => {
    const auth = await authorize(req, reply);
    if (!auth) return reply;
    const { product, order, sessionId } = auth;
    if ((await countSessionDownloads(product.slug, sessionId)) >= product.downloadLimit) {
      return reply.status(429).send({ error: 'Download limit reached for this purchase.' });
    }
    const release = product.release ? await getRelease(product.slug, product.release.version) : null;
    if (!release || !product.release) {
      return reply.status(404).send({ error: 'Release not available' });
    }
    await recordDownload({
      slug: product.slug,
      version: product.release.version,
      checkoutSessionId: sessionId,
      email: order.email || null,
      via: 'session',
      ipHash: hashIp(req.ip),
    });
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="${release.filename}"`)
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .send(release.content);
  });
}
