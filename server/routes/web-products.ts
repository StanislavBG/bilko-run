import type { FastifyInstance } from 'fastify';
import { getStripe, getStripeTest, hasPurchased } from '../services/stripe.js';
import { ADMIN_EMAILS, verifyClerkToken } from '../clerk.js';
import { dbGet, dbRun } from '../db.js';
import { hashIp } from './tools/_shared.js';
import {
  countLiveOrders, countSessionDownloads, findOrder, getRelease, hasOrderForEmail, recordDownload, recordOrder,
  storeRelease,
  type WebProductOrder,
} from '../services/web-products.js';
import {
  MAX_RELEASE_BYTES, WEB_PRODUCTS, isValidCheckoutSessionId, isValidReleaseVersion, isValidWebProductSlug,
  productBilling, productKind, productPageSlug, productsIncluding, resolveWebProductPriceId, webProductBySlug, type WebProduct,
} from '../../shared/web-products.js';

const RATE_WINDOW_MS = 60_000;
const CHECKOUT_LIMIT = 10;
const DELIVERY_LIMIT = 30;
const UPLOAD_LIMIT = 5;

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

/** Reserved storage slug for a product's preview zip; never a catalog product. */
const previewSlug = (product: WebProduct): string => `${product.slug}--preview`;

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

export type Resolved =
  | { status: 'paid'; order: WebProductOrder }
  | { status: 'unpaid' }
  | { status: 'not_found' };

class StripeUnavailable extends Error {}

/** `$9` / `$9.50` → cents. Test-mode sessions use inline price_data built from it. */
export function displayPriceCents(displayPrice: string): number | null {
  const m = /^\$(\d{1,5})(?:\.(\d{2}))?$/.exec(displayPrice.trim());
  return m ? Number(m[1]) * 100 + Number(m[2] ?? 0) : null;
}

function bearerOrSessionCookie(req: any): string | undefined {
  const header: string | undefined = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header;
  const cookie: string = req.headers.cookie ?? '';
  const m = /(?:^|;\s*)__session=([^;]+)/.exec(cookie);
  return m ? `Bearer ${decodeURIComponent(m[1])}` : undefined;
}

/** Signed-in owner (Clerk header or same-origin __session cookie). */
async function isOwnerRequest(req: any): Promise<boolean> {
  const email = await verifyClerkToken(bearerOrSessionCookie(req));
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

/** Signed-out owner: this IP produced an admin page hit in the last 30 days. */
async function ipSeenAsAdmin(ip: string): Promise<boolean> {
  try {
    const row = await dbGet<{ n: number }>(
      'SELECT 1 AS n FROM page_hits WHERE ip = ? AND is_admin = 1 AND ts_ms >= ? LIMIT 1',
      ip, Date.now() - 30 * 86_400_000,
    );
    return !!row;
  } catch {
    return false;
  }
}

export async function resolvePaidOrder(product: WebProduct, sessionId: string): Promise<Resolved> {
  const existing = await findOrder(product.slug, sessionId);
  if (existing) return { status: 'paid', order: existing };

  // Owner test checkouts live in Stripe test mode; their ids say so.
  const isTest = sessionId.startsWith('cs_test_');
  const stripe = isTest ? getStripeTest() : getStripe();
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
  // Test sessions carry inline price_data (no live price id in test mode), so
  // they are matched on the server-set test marker instead.
  if (isTest ? session.metadata?.test !== 'true' : !items.some((li) => li?.price?.id === priceId)) {
    return { status: 'not_found' };
  }

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

export interface CheckoutParamsInput {
  owner: boolean;
  ownerIp: boolean;
  priceId: string;
  testCents: number | null;
  publicUrl: string;
  couponId?: string;
}

/** Stripe Checkout create params for a web product (shared by the checkout route and /buy). */
export function buildWebProductCheckoutParams(
  product: WebProduct,
  { owner, ownerIp, priceId, testCents, publicUrl, couponId }: CheckoutParamsInput,
): Record<string, any> {
  const monthly = productBilling(product) === 'month';
  const page = productPageSlug(product);
  const metadata: Record<string, string> = { web_product: product.slug };
  if (owner) metadata.test = 'true';
  if (ownerIp) metadata.owner_ip = 'true';
  return {
    mode: monthly ? 'subscription' : 'payment',
    line_items: owner
      ? [{
        price_data: {
          currency: 'usd',
          unit_amount: testCents!,
          product_data: { name: `${product.name} (test)` },
          ...(monthly ? { recurring: { interval: 'month' } } : {}),
        },
        quantity: 1,
      }]
      : [{ price: priceId, quantity: 1 }],
    ...(monthly ? {} : { customer_creation: 'always' }),
    // Stripe forbids discounts together with allow_promotion_codes.
    ...(couponId ? { discounts: [{ coupon: couponId }] } : { allow_promotion_codes: true }),
    // Abandoned-checkout recovery: on expiry Stripe mints a recovery URL.
    // Stripe only emails it when promotional consent is collected, which
    // errors until the Checkout ToS is accepted in the Dashboard
    // (settings/checkout) — so consent is opt-in via env, not hardcoded.
    ...(process.env.STRIPE_CHECKOUT_PROMO_CONSENT === '1' ? { consent_collection: { promotions: 'auto' as const } } : {}),
    after_expiration: { recovery: { enabled: true, allow_promotion_codes: true } },
    metadata,
    success_url: `${publicUrl}/projects/${page}/thanks/?session_id={CHECKOUT_SESSION_ID}&offer=${product.slug}`,
    cancel_url: `${publicUrl}/projects/${page}/?checkout=cancel`,
  };
}

/** Founding coupon id for the mode, if its env var is set and Stripe says it is still valid. */
async function foundingCoupon(
  product: WebProduct, stripe: any, owner: boolean,
): Promise<{ id: string; remaining: number | null } | null> {
  const envVar = product.foundingCouponEnvVar;
  if (!envVar) return null;
  const id = process.env[owner ? `${envVar}_TEST` : envVar];
  if (!id || !stripe) return null;
  try {
    const coupon = await stripe.coupons.retrieve(id);
    if (!coupon?.valid) return null;
    const remaining = typeof coupon.max_redemptions === 'number'
      ? Math.max(0, coupon.max_redemptions - (coupon.times_redeemed ?? 0))
      : null;
    return { id, remaining };
  } catch (err: any) {
    console.error('[web-products] founding coupon lookup failed:', err?.message);
    return null;
  }
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
    if (productKind(product) === 'service') {
      const sold = product.maxOrders !== undefined && (await countLiveOrders(product.slug)) >= product.maxOrders;
      const stripe = getStripe();
      const coupon = await foundingCoupon(product, stripe, false);
      return {
        slug: product.slug,
        name: product.name,
        displayPrice: product.displayPrice,
        kind: 'service',
        billing: productBilling(product),
        pageSlug: productPageSlug(product),
        foundingDisplayPrice: product.foundingDisplayPrice ?? null,
        foundingRemaining: coupon?.remaining ?? null,
        soldOut: sold,
        available: !!resolveWebProductPriceId(product, process.env) && !!stripe,
      };
    }
    let available = false;
    const previewAvailable = !!product.preview
      && !!(await getRelease(previewSlug(product), product.preview.version));
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
      previewAvailable,
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
    const owner = await isOwnerRequest(req);
    const stripe = owner ? getStripeTest() : getStripe();
    const priceId = resolveWebProductPriceId(product, process.env);
    const testCents = displayPriceCents(product.displayPrice);
    if (owner && (!stripe || !testCents)) {
      // Live mode is reserved for real buyers; never fall back to it for the owner.
      reply.status(409);
      return { error: 'Owner checkouts run in Stripe test mode, which is not configured (STRIPE_TEST_SECRET_KEY).' };
    }
    if (!stripe || !priceId) {
      reply.status(503);
      return { error: 'Checkout is not available right now.' };
    }
    // Deploy smokes: prove the route, price and Stripe client are wired without
    // creating a live session that later shows up as an abandoned checkout.
    const q = req.query as { dryRun?: string } | undefined;
    if (q?.dryRun === '1') return { ok: true, dryRun: true, url: null };

    if (product.maxOrders !== undefined && (await countLiveOrders(product.slug)) >= product.maxOrders) {
      reply.status(409);
      return { error: 'sold_out' };
    }

    const ownerIp = !owner && await ipSeenAsAdmin(req.ip);
    const publicUrl = process.env.PUBLIC_URL || 'https://bilko.run';
    try {
      const coupon = await foundingCoupon(product, stripe, owner);
      const session = await stripe.checkout.sessions.create(buildWebProductCheckoutParams(product, {
        owner, ownerIp, priceId, testCents, publicUrl, couponId: coupon?.id,
      }) as any);
      if (!owner) {
        try {
          await dbRun(
            'INSERT INTO funnel_events (event, ip_hash, tool, metadata, is_admin) VALUES (?, ?, ?, ?, ?)',
            'checkout_start', hashIp(req.ip), product.slug,
            JSON.stringify({ path: `/projects/${productPageSlug(product)}/` }), ownerIp ? 1 : 0,
          );
        } catch (err: any) {
          console.error('[web-products] funnel insert failed:', err?.message);
        }
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
    if (productKind(product) === 'service' && !product.includes?.length) {
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
    // A paid session of the product itself, or of any product that includes it, entitles the download.
    let result: Resolved = { status: 'not_found' };
    let failure: unknown = null;
    for (const candidate of [product, ...productsIncluding(product.slug, products)]) {
      let r: Resolved;
      try {
        r = await resolvePaidOrder(candidate, sessionId);
      } catch (err) {
        failure ??= err;
        continue;
      }
      if (r.status === 'paid') {
        result = r;
        failure = null;
        break;
      }
      if (r.status === 'unpaid') result = r;
    }
    if (failure) {
      if (!(failure instanceof StripeUnavailable)) console.error('[web-products] verify failed:', (failure as Error)?.message);
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
    const included = product.includes
      ? product.includes.flatMap((slug) => {
        const inc = lookup(slug);
        return inc?.release
          ? [{ slug: inc.slug, name: inc.name, downloadUrl: `/api/web-products/${inc.slug}/download?session_id=${sessionId}` }]
          : [];
      })
      : undefined;
    return {
      ...(included ? { included } : {}),
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

  // Content-addressed release fill. No auth on purpose: anyone may PUT, but the
  // server stores bytes only if they exactly match the sha256 and size committed
  // in shared/web-products.ts, and only once. That keeps the paid zip out of the
  // public repo without a deploy secret — an attacker can only upload the bytes
  // we already declared. The zip parser is scoped to this plugin so the global
  // JSON/rawBody parsers elsewhere are untouched.
  app.register(async (scope) => {
    scope.addContentTypeParser(
      ['application/zip', 'application/octet-stream'],
      { parseAs: 'buffer', bodyLimit: MAX_RELEASE_BYTES },
      (_req, body, done) => done(null, body),
    );
    scope.put('/api/web-products/:slug/releases/:version', async (req, reply) => {
      const { slug, version } = req.params as { slug?: string; version?: string };
      const product = lookup(slug);
      if (!product || !isValidReleaseVersion(version)) {
        reply.status(404);
        return { error: 'Not found' };
      }
      if (!rateOk(`wp-upload:${req.ip}`, UPLOAD_LIMIT)) {
        reply.status(429);
        return { error: 'Too many requests. Try again in a minute.' };
      }
      const body = req.body;
      const isPreview = (req.query as { kind?: string } | undefined)?.kind === 'preview';
      if (isPreview && !product.preview) {
        reply.status(404);
        return { error: 'Not found' };
      }
      const target = isPreview
        ? { ...product, slug: previewSlug(product), release: product.preview ?? null }
        : product;
      const decl = target.release;
      const result = Buffer.isBuffer(body) ? await storeRelease(target, version, body) : 'mismatch';
      if (result === 'undeclared') {
        reply.status(404);
        return { error: 'Not found' };
      }
      if (result === 'mismatch') {
        reply.status(422);
        return { error: 'Bytes do not match the declared release.' };
      }
      if (result === 'exists') {
        reply.status(409);
        return { error: 'Release already stored.' };
      }
      reply.status(201);
      return { stored: true, sha256: decl!.sha256, bytes: decl!.bytes };
    });
  });

  // Re-download for buyers who lost their session link: Clerk-authenticated, and
  // entitled by a recorded order for the email or a purchase/comp-grant row.
  app.get('/api/web-products/:slug/account-download', async (req, reply) => {
    const product = lookup((req.params as { slug?: string }).slug);
    if (!product) return reply.status(404).send({ error: 'Not found' });
    if (!rateOk(`wp-account:${req.ip}`, DELIVERY_LIMIT)) {
      return reply.status(429).send({ error: 'Too many requests. Try again in a minute.' });
    }
    const email = await verifyClerkToken(req.headers.authorization);
    if (!email) return reply.status(401).send({ error: 'Sign in required.' });
    let entitled = false;
    for (const p of [product, ...productsIncluding(product.slug, products)]) {
      if ((await hasOrderForEmail(p.slug, email)) || (await hasPurchased(email, p.productKey))) {
        entitled = true;
        break;
      }
    }
    if (!entitled) return reply.status(402).send({ paid: false });
    const release = product.release ? await getRelease(product.slug, product.release.version) : null;
    if (!release || !product.release) {
      return reply.status(404).send({ error: 'Release not available' });
    }
    await recordDownload({
      slug: product.slug,
      version: product.release.version,
      checkoutSessionId: null,
      email,
      via: 'account',
      ipHash: hashIp(req.ip),
    });
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="${release.filename}"`)
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .send(release.content);
  });

  // Free sign-in preview: any signed-in visitor, no purchase needed.
  app.get('/api/web-products/:slug/preview', async (req, reply) => {
    const product = lookup((req.params as { slug?: string }).slug);
    if (!product) return reply.status(404).send({ error: 'Not found' });
    if (!rateOk(`wp-preview:${req.ip}`, DELIVERY_LIMIT)) {
      return reply.status(429).send({ error: 'Too many requests. Try again in a minute.' });
    }
    const email = await verifyClerkToken(bearerOrSessionCookie(req));
    if (!email) return reply.status(401).send({ error: 'Sign in required.' });
    const decl = product.preview;
    const stored = decl ? await getRelease(previewSlug(product), decl.version) : null;
    if (!decl || !stored) return reply.status(404).send({ error: 'Preview not available' });
    await recordDownload({
      slug: previewSlug(product),
      version: decl.version,
      checkoutSessionId: null,
      email,
      via: 'preview',
      ipHash: hashIp(req.ip),
    });
    return reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="${stored.filename}"`)
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .send(stored.content);
  });
}
