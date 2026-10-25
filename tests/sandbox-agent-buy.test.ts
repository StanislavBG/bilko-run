/**
 * Opt-in Stripe TEST-mode check of the /buy/:offerId agent checkout URLs.
 * Skipped unless STRIPE_SANDBOX_KEY is set; refuses anything but sk_test_ keys.
 *
 *   STRIPE_SANDBOX_KEY=$(stripe config --list | sed -n "s/^test_mode_api_key = '\(.*\)'/\1/p") \
 *     pnpm vitest run tests/sandbox-agent-buy.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { AGENT_OFFERS, type AgentOffer } from '../shared/agent-offers.js';
import { entryForPriceType } from '../shared/product-catalog.js';
import { webProductBySlug } from '../shared/web-products.js';

const KEY = process.env.STRIPE_SANDBOX_KEY;
if (KEY && !KEY.startsWith('sk_test_')) {
  throw new Error('STRIPE_SANDBOX_KEY must be a test-mode key (sk_test_...); refusing to run against live mode');
}

const HUMAN_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

function priceEnvVar(offer: AgentOffer): string {
  if (offer.source.kind === 'web_product') return webProductBySlug(offer.source.slug)!.priceEnvVar;
  return entryForPriceType(offer.source.priceType)!.envVar;
}

describe.skipIf(!KEY)('sandbox: /buy/:offerId -> Stripe test-mode Checkout', () => {
  let stripe: Stripe;
  let app: FastifyInstance;
  const priceIds = new Map<string, string>();

  async function ensurePrice(offer: AgentOffer): Promise<string> {
    const lookup_key = `bilko-sandbox-${offer.id}`;
    const existing = await stripe.prices.list({ lookup_keys: [lookup_key], active: true, limit: 1 });
    const found = existing.data[0];
    const interval = offer.billing === 'one_time' ? null : offer.billing;
    if (found && found.unit_amount === offer.amountCents && (found.recurring?.interval ?? null) === interval) return found.id;
    const product = await stripe.products.create({ name: `[sandbox] ${offer.name}`, metadata: { offer: offer.id } });
    const price = await stripe.prices.create({
      product: product.id,
      currency: offer.currency,
      unit_amount: offer.amountCents,
      lookup_key,
      transfer_lookup_key: true,
      ...(interval ? { recurring: { interval } } : {}),
    });
    return price.id;
  }

  beforeAll(async () => {
    // The route's Stripe client reads STRIPE_SECRET_KEY at module load, so set env first.
    process.env.STRIPE_SECRET_KEY = KEY!;
    process.env.PUBLIC_URL = 'https://bilko.run';
    stripe = new Stripe(KEY!, { apiVersion: '2024-12-18.acacia' as any });
    for (const offer of AGENT_OFFERS) {
      const id = await ensurePrice(offer);
      priceIds.set(offer.id, id);
      process.env[priceEnvVar(offer)] = id;
    }
    const { registerAgentBuyRoutes } = await import('../server/routes/agent-buy.js');
    app = Fastify();
    registerAgentBuyRoutes(app);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it.each(AGENT_OFFERS.map((o) => [o.id, o] as const))('%s redirects to a valid test Checkout session', async (_id, offer) => {
    const res = await app.inject({
      method: 'GET',
      url: `/buy/${offer.id}`,
      headers: { 'user-agent': HUMAN_UA },
      remoteAddress: `10.9.0.${AGENT_OFFERS.indexOf(offer) + 1}`,
    });
    expect(res.statusCode).toBe(302);
    const location = String(res.headers.location);
    expect(location.startsWith('https://checkout.stripe.com/')).toBe(true);

    const sessionId = location.match(/cs_(?:test|live)_[A-Za-z0-9]+/)?.[0];
    expect(sessionId).toMatch(/^cs_test_/);

    const session = await stripe.checkout.sessions.retrieve(sessionId!, { expand: ['line_items'] });
    const priceId = priceIds.get(offer.id)!;
    const mode = offer.billing === 'one_time' ? 'payment' : 'subscription';
    expect(session.livemode).toBe(false);
    expect(session.mode).toBe(mode);
    expect(session.line_items?.data).toHaveLength(1);
    expect(session.line_items!.data[0].price?.id).toBe(priceId);
    expect(session.line_items!.data[0].amount_total).toBe(offer.amountCents);

    if (offer.source.kind === 'web_product') {
      expect(session.metadata).toMatchObject({ web_product: offer.source.slug, agent_buy: offer.id });
    } else {
      expect(session.metadata).toMatchObject({ agent_buy: offer.id, agent_key: offer.agentKey ? '1' : '0' });
    }

    console.log(`[sandbox-agent-buy] offer=${offer.id} session=${sessionId!.slice(0, 16)}... price=${priceId} mode=${session.mode}`);
  }, 30_000);
});
