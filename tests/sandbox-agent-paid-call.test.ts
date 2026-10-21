// @vitest-environment node
/**
 * Opt-in Stripe TEST-mode proof of the full agent purchase loop:
 * GET /buy/pageroast-credits-7 -> pay test Checkout (4242) -> signed
 * checkout.session.completed webhook credits 7 tokens -> /checkout/success reveals a
 * bkk_ key -> POST /api/demos/page-roast and MCP roast_page each spend 1 credit.
 * Only the Gemini roast call (roastPage) is mocked.
 *
 *   STRIPE_SANDBOX_KEY=$(stripe config --list | sed -n "s/^test_mode_api_key = '\(.*\)'/\1/p") \
 *     timeout 240 pnpm vitest run tests/sandbox-agent-paid-call.test.ts
 */
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { chromium, type Browser } from '@playwright/test';

vi.mock('@bilkobibitkov/page-roast', () => ({
  roastPage: vi.fn(async () => ({ scores: { total_score: 71, grade: 'C', roast: 'meh' } })),
}));

import { roastPage } from '@bilkobibitkov/page-roast';
import { AGENT_OFFERS } from '../shared/agent-offers.js';
import { entryForPriceType } from '../shared/product-catalog.js';
import { initDb } from '../server/db.js';
import { getTokenBalance } from '../server/services/tokens.js';

const KEY = process.env.STRIPE_SANDBOX_KEY;
if (KEY && !KEY.startsWith('sk_test_')) {
  throw new Error('STRIPE_SANDBOX_KEY must be a test-mode key (sk_test_...); refusing to run against live mode');
}

const OFFER_ID = 'pageroast-credits-7';
const WEBHOOK_SECRET = 'whsec_local_sandbox_paid_call';
const HUMAN_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

describe.skipIf(!KEY)('sandbox: full agent purchase loop (test mode)', () => {
  let stripe: Stripe;
  let app: FastifyInstance;
  let browser: Browser | undefined;
  const email = `sandbox+${Date.now()}@example.com`;
  let sessionId = '';
  let checkoutUrl = '';
  let apiKey = '';
  let baseline = 0;
  const log: string[] = [];

  async function ensurePrice(): Promise<string> {
    const offer = AGENT_OFFERS.find((o) => o.id === OFFER_ID)!;
    const lookup_key = `bilko-sandbox-${offer.id}`;
    const existing = await stripe.prices.list({ lookup_keys: [lookup_key], active: true, limit: 1 });
    const found = existing.data[0];
    if (found && found.unit_amount === offer.amountCents && !found.recurring) return found.id;
    const product = await stripe.products.create({ name: `[sandbox] ${offer.name}`, metadata: { offer: offer.id } });
    const price = await stripe.prices.create({
      product: product.id, currency: offer.currency, unit_amount: offer.amountCents,
      lookup_key, transfer_lookup_key: true,
    });
    return price.id;
  }

  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY = KEY!;
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.PUBLIC_URL = 'https://bilko.run';
    stripe = new Stripe(KEY!, { apiVersion: '2024-12-18.acacia' as any });
    const offer = AGENT_OFFERS.find((o) => o.id === OFFER_ID)!;
    const priceId = await ensurePrice();
    process.env[entryForPriceType((offer.source as any).priceType)!.envVar] = priceId;

    await initDb();
    const { registerStripeRoutes } = await import('../server/routes/stripe.js');
    const { registerAgentBuyRoutes } = await import('../server/routes/agent-buy.js');
    const { registerPageRoastRoutes } = await import('../server/routes/tools/page-roast.js');
    const { registerProjectCatalogRoutes } = await import('../server/routes/project-catalog.js');
    app = Fastify();
    // Mirrors server/index.ts's raw-body parser so webhook signatures verify.
    app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
      (req as any).rawBody = body;
      try { done(null, (body as Buffer).length ? JSON.parse((body as Buffer).toString()) : {}); }
      catch (err) { done(err as Error, undefined); }
    });
    registerStripeRoutes(app);
    registerAgentBuyRoutes(app);
    registerPageRoastRoutes(app);
    registerProjectCatalogRoutes(app);
    await app.ready();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await app?.close();
    for (const l of log) console.log(`[sandbox-paid-call] ${l}`);
  });

  it('GET /buy redirects to a test Checkout session', async () => {
    const res = await app.inject({
      method: 'GET', url: `/buy/${OFFER_ID}`,
      headers: { 'user-agent': HUMAN_UA }, remoteAddress: '10.9.1.1',
    });
    expect(res.statusCode).toBe(302);
    checkoutUrl = String(res.headers.location);
    sessionId = checkoutUrl.match(/cs_test_[A-Za-z0-9]+/)?.[0] ?? '';
    expect(sessionId).toMatch(/^cs_test_/);
    log.push(`session=${sessionId.slice(0, 16)}...`);
  }, 30_000);

  it('pays the Checkout with card 4242 in headless Chromium', async () => {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(20_000);
    try {
      await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.locator('#email, input[name="email"]').first().fill(email);
      const field = async (sel: string, value: string) => {
        const direct = page.locator(sel).first();
        if (await direct.count()) { await direct.fill(value); return; }
        for (const frame of page.frames()) {
          const l = frame.locator(sel).first();
          if (await l.count()) { await l.fill(value); return; }
        }
        throw new Error(`checkout field not found: ${sel}`);
      };
      // Accordion layout: pick the Card method to reveal the card fields.
      await page.locator('#payment-method-label-card').first().click({ timeout: 20_000, force: true });
      await page.locator('input[name="cardNumber"]').first().waitFor({ timeout: 30_000 });
      await field('input[name="cardNumber"]', '4242424242424242');
      await field('input[name="cardExpiry"]', '12 / 34');
      await field('input[name="cardCvc"]', '123');
      const name = page.locator('input[name="billingName"]').first();
      if (await name.count()) await name.fill('Sandbox Buyer');
      const zip = page.locator('input[name="billingPostalCode"]').first();
      if (await zip.count()) await zip.fill('94105');
      // Opt out of Link so no phone number is required.
      const link = page.locator('input[name="enableStripePass"]').first();
      if (await link.count() && await link.isChecked()) await link.uncheck({ force: true });
      await page.locator('button[type="submit"], .SubmitButton').first().click();
      await page.waitForURL(/bilko\.run\/checkout\/success/, { timeout: 60_000 }).catch(() => {});
    } catch (err: any) {
      throw new Error(`HEADLESS_CHECKOUT_BLOCKED: ${err.message}. Pay manually with card 4242: ${checkoutUrl}`);
    } finally {
      await page.close();
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      throw new Error(`HEADLESS_CHECKOUT_BLOCKED: payment_status=${session.payment_status}. Pay manually with card 4242: ${checkoutUrl}`);
    }
    expect(session.customer_details?.email).toBe(email);
  }, 120_000);

  it('signed webhook credits 7 tokens', async () => {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    baseline = await getTokenBalance(email);
    const payload = JSON.stringify({
      id: 'evt_sandbox_paid_call', object: 'event', type: 'checkout.session.completed',
      data: { object: session },
    });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    const res = await app.inject({
      method: 'POST', url: '/api/stripe/webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': header },
      payload,
    });
    expect(res.statusCode).toBe(200);
    expect(await getTokenBalance(email)).toBe(baseline + 7);
    log.push(`balance before webhook=${baseline} after=${baseline + 7}`);
  }, 30_000);

  it('/checkout/success reveals a bkk_ key exactly once', async () => {
    const url = `/checkout/success?session_id=${sessionId}`;
    const first = await app.inject({ method: 'GET', url });
    expect(first.statusCode).toBe(200);
    const m = first.body.match(/bkk_[A-Za-z0-9_-]+/);
    expect(m).toBeTruthy();
    apiKey = m![0];
    log.push(`key prefix=${apiKey.slice(0, 8)}...`);

    const second = await app.inject({ method: 'GET', url });
    expect(second.statusCode).toBe(200);
    expect(second.body).not.toMatch(/bkk_[A-Za-z0-9_-]+/);
    expect(second.body).toContain('already shown');
  }, 30_000);

  it('POST /api/demos/page-roast with the key spends 1 credit', async () => {
    const before = await getTokenBalance(email);
    const res = await app.inject({
      method: 'POST', url: '/api/demos/page-roast',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      payload: { url: 'https://example.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(await getTokenBalance(email)).toBe(before - 1);
    expect(roastPage).toHaveBeenCalledTimes(1);
    log.push(`api roast balance ${before} -> ${before - 1}`);
  }, 30_000);

  it('MCP roast_page with the key spends 1 more credit', async () => {
    const before = await getTokenBalance(email);
    const res = await app.inject({
      method: 'POST', url: '/mcp',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${apiKey}`,
      },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'roast_page', arguments: { url: 'example.com' } } },
    });
    expect(res.statusCode).toBe(200);
    const result = res.json().result as { isError?: boolean };
    expect(result.isError).toBeFalsy();
    expect(await getTokenBalance(email)).toBe(before - 1);
    expect(roastPage).toHaveBeenCalledTimes(2);
    log.push(`mcp roast balance ${before} -> ${before - 1}`);
  }, 30_000);
});
