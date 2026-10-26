import type { FastifyInstance } from 'fastify';
import {
  getStripe, isStripeConfigured, isAudienceDecoderConfigured,
  hasActiveSubscription, hasPurchased,
  getCustomerStripeId, upsertCustomer,
  saveSubscription, updateSubscriptionStatus, updateSubscriptionPeriod,
  saveOneTimePurchase, priceToPlanTier,
} from '../services/stripe.js';
import { creditTokens, grantFreeTokens, hasTokenAccount } from '../services/tokens.js';
import { dbGet, dbRun } from '../db.js';
import { mintAgentApiKey } from '../services/agent-api-keys.js';
import {
  PRODUCT_KEYS,
  COFFEE_PAYMENT_LINK_DEFAULT,
  entryForPriceType,
  entryForPriceId,
  type PriceType,
} from '../../shared/product-catalog.js';
import { WEB_PRODUCTS, webProductBySlug, resolveWebProductPriceId, productPageSlug, productBilling } from '../../shared/web-products.js';
import { recordOrder } from '../services/web-products.js';
import { creditWallet } from '../services/wallet.js';
import { pppBonusCents } from '../../shared/ppp-bonus.js';
import { WALLET_TOPUP_CENTS } from '../../shared/bilko-menu.js';

/**
 * Same-origin guard for caller-supplied redirect URLs (checkout success/cancel,
 * billing-portal return). Anything not on PUBLIC_URL's origin falls back, so a
 * Stripe-hosted page can never bounce a customer off-site.
 */

/** funnel_events row for a web-product checkout outcome (expired / recovered). */
async function recordCheckoutOutcome(event: 'checkout_expired' | 'checkout_recovered', slug: string, session: any): Promise<void> {
  try {
    await dbRun(
      'INSERT INTO funnel_events (event, tool, metadata) VALUES (?, ?, ?)',
      event, slug,
      JSON.stringify({ session: session.id, recovered_from: session.recovered_from ?? null, hasRecoveryUrl: !!session.after_expiration?.recovery?.url }),
    );
  } catch (err: any) {
    console.error(`[stripe_webhook] ${event} insert failed:`, err?.message);
  }
}

/**
 * True when this session's checkout_start row is flagged as the owner's (is_admin = 1). Covers
 * sessions flagged after they were created, which carry no owner_ip metadata in Stripe.
 */
async function ownerStartedCheckout(sessionId: string): Promise<boolean> {
  try {
    const row = await dbGet<{ n: number }>(
      `SELECT 1 AS n FROM funnel_events
        WHERE event = 'checkout_start' AND is_admin = 1 AND json_valid(metadata)
          AND json_extract(metadata, '$.checkout_session_id') = ? LIMIT 1`,
      sessionId,
    );
    return !!row;
  } catch {
    return false;
  }
}

export function safeUrl(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const allowedOrigin = new URL(process.env.PUBLIC_URL || 'https://bilko.run').origin;
  try { return new URL(raw).origin === allowedOrigin ? raw : fallback; } catch { return fallback; }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function successHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — Bilko.run</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0d0d0d;color:#e8e8e8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
    .card{max-width:600px;width:90%;background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:40px}
    h1{margin-top:0;font-size:1.6em}
    pre{overflow-x:auto;white-space:pre-wrap;word-break:break-all}
    a{color:#7fc4ff}
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    ${body}
    <p><a href="https://bilko.run">← Back to Bilko.run</a></p>
  </div>
</body>
</html>`;
}

export function registerStripeRoutes(app: FastifyInstance): void {
  app.post('/api/stripe/create-checkout-session', async (req, reply) => {
    const body = req.body as {
      email?: string;
      priceType?: PriceType;
      successUrl?: string;
      cancelUrl?: string;
    } | null;

    // The Field Manual is free since release 2.0.1, so a NEW checkout for it
    // must never start — not from a tab still running a pre-free bundle, not
    // from a direct POST. Its PRICE_CATALOG entry stays only so a late or
    // in-flight payment still resolves at /checkout/success and in the webhook.
    if (body?.priceType === 'session_manager') {
      reply.status(410);
      return { error: 'The Field Manual is free now. Read it at /products/session-manager/manual.' };
    }

    const email = (body?.email ?? '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      reply.status(400);
      return { error: 'Valid email required.' };
    }

    const priceType = body?.priceType;
    const catalogEntry = priceType ? entryForPriceType(priceType) : undefined;
    if (!priceType || !catalogEntry) {
      reply.status(400);
      return { error: 'Valid priceType required.' };
    }

    const stripe = getStripe();
    if (!stripe) {
      reply.status(503);
      return { error: 'Stripe not configured' };
    }

    const priceId = process.env[catalogEntry.envVar] || catalogEntry.defaultPriceId;
    const mode = catalogEntry.mode;

    if (!priceId) {
      reply.status(503);
      return { error: 'Stripe not configured — price ID missing' };
    }

    try {
      let stripeCustomerId = await getCustomerStripeId(email);
      if (!stripeCustomerId) {
        const stripeCustomer = await stripe.customers.create({ email });
        stripeCustomerId = stripeCustomer.id;
        await upsertCustomer(email, stripeCustomerId);
      }

      const publicUrl = process.env.PUBLIC_URL || 'https://bilko.run';
      const defaultSuccessUrl = (priceType === 'pageroast_tokens' || priceType === 'pageroast_token_single')
        ? `${publicUrl}/projects/page-roast?tokens=purchased`
        : `${publicUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
      const session = await stripe.checkout.sessions.create({
        mode,
        customer: stripeCustomerId,
        client_reference_id: email,
        line_items: [{ price: priceId, quantity: 1 }],
        // Lets Stripe's own "Add promotion code" field appear at checkout. This
        // is how the full purchase → webhook → entitlement flow gets tested in
        // production without editing the live price: create a 100%-off coupon,
        // redeem it once, and every downstream step (payment_intent, the
        // checkout.session.completed webhook, the stripe_one_time_purchases
        // row, the entitlement lookup) runs exactly as it does for a paying buyer.
        // Dropping the price to $0 instead would NOT be equivalent — Stripe
        // skips payment collection entirely for a zero-amount line item, so the
        // paid path never actually executes.
        allow_promotion_codes: true,
        success_url: safeUrl(body?.successUrl, defaultSuccessUrl),
        cancel_url: safeUrl(body?.cancelUrl, `${publicUrl}?checkout=cancel`),
      });

      return { url: session.url };
    } catch (err: any) {
      console.error('[checkout] session creation failed:', err.message);
      reply.status(500);
      return { error: 'Checkout failed. Please try again.' };
    }
  });

  app.post('/api/stripe/webhook', async (req, reply) => {
    const stripe = getStripe();
    if (!stripe) {
      reply.status(503);
      return { error: 'Stripe not configured' };
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const rawBody = (req as any).rawBody as Buffer | undefined;
    const sig = req.headers['stripe-signature'] as string | undefined;

    const isProd = process.env.NODE_ENV === 'production';
    let event: any;
    try {
      if (webhookSecret && rawBody && sig) {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } else if (isProd) {
        console.error('[Stripe] CRITICAL: Webhook received without signature verification in production');
        reply.status(400);
        return { error: 'Webhook signature required.' };
      } else {
        console.warn('[Stripe] STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev mode)');
        event = req.body;
      }
    } catch (err: any) {
      reply.status(400);
      return { error: 'Webhook signature verification failed.' };
    }

    try {
      const data = event.data?.object as any;

      if (event.type === 'checkout.session.completed') {
        const email = ((data.client_reference_id ?? data.customer_email ?? data.customer_details?.email ?? '') as string).toLowerCase();
        const stripeCustomerId = data.customer as string;

        if (!email) {
          console.error('[stripe_webhook] checkout.session.completed missing customer email — session:', data.id);
        }

        if (email && stripeCustomerId) {
          await upsertCustomer(email, stripeCustomerId);
        }

        // Web products (paid downloads) are dispatched first and never fall through
        // to the generic branches below, which would book them as 'unattributed'.
        const wpSlug = typeof data.metadata?.web_product === 'string' ? data.metadata.web_product : '';
        const webProduct = wpSlug ? webProductBySlug(wpSlug, WEB_PRODUCTS) : undefined;

        // Wallet top-ups are handled first and never fall through to the generic branches.
        if (typeof data.metadata?.wallet_topup === 'string' && data.metadata.wallet_topup) {
          const cents = Number(data.metadata.wallet_topup);
          const walletEmail = ((data.metadata.wallet_email ?? data.customer_details?.email ?? '') as string).trim().toLowerCase();
          const centsOk = (WALLET_TOPUP_CENTS as readonly number[]).includes(cents);
          const paid = data.payment_status === 'paid';
          if (!paid || !centsOk || data.amount_subtotal !== cents || !walletEmail) {
            console.error(
              `[stripe_webhook] wallet top-up session ${data.id} not credited — ` +
              `payment_status=${data.payment_status} centsAllowed=${centsOk} subtotalMatch=${data.amount_subtotal === cents} ` +
              `email=${walletEmail ? 'present' : 'missing'}`,
            );
          } else {
            // Stripe API failures here throw to the outer catch -> 500 -> Stripe retries.
            let country: string | null = null;
            if (data.payment_intent) {
              const pi: any = await stripe.paymentIntents.retrieve(data.payment_intent as string, { expand: ['latest_charge'] });
              country = pi?.latest_charge?.payment_method_details?.card?.country ?? null;
            }
            if (!country) country = data.customer_details?.address?.country ?? null;
            await creditWallet(walletEmail, cents, 'topup', 'topup:' + data.id);
            const bonus = pppBonusCents(country, cents);
            if (bonus > 0) {
              const cc = String(country).trim().toUpperCase();
              await creditWallet(walletEmail, bonus, 'ppp_bonus:' + cc, 'ppp:' + data.id);
            }
          }
        } else if (webProduct) {
          const paidOk = data.payment_status === 'paid' || data.payment_status === 'no_payment_required';
          let priceOk = false;
          if (paidOk) {
            if (productBilling(webProduct) === 'month') {
              const lineItems = await stripe.checkout.sessions.listLineItems(data.id, { limit: 1 });
              const seenPriceId = lineItems.data[0]?.price?.id;
              priceOk = !!seenPriceId && seenPriceId === resolveWebProductPriceId(webProduct, process.env);
            } else {
              // One-time products are priced inline; subtotal is pre-discount so coupons still pass.
              priceOk = data.amount_subtotal === webProduct.amountCents;
            }
          }
          const wpEmail = ((data.customer_details?.email ?? data.customer_email ?? '') as string).trim().toLowerCase();
          if (!paidOk || !priceOk || !wpEmail) {
            console.error(
              `[stripe_webhook] web product ${webProduct.slug} session ${data.id} not recorded — ` +
              `payment_status=${data.payment_status} priceMatch=${priceOk} email=${wpEmail ? 'present' : 'missing'}`,
            );
          } else {
            await recordOrder({
              checkoutSessionId: data.id,
              slug: webProduct.slug,
              email: wpEmail,
              amountTotal: data.amount_total ?? null,
              currency: data.currency ?? null,
              paymentStatus: data.payment_status,
            });
            // Subscription-mode (monthly service) orders are not one-time purchases.
            if (stripeCustomerId && data.mode !== 'subscription') {
              await saveOneTimePurchase({
                email: wpEmail,
                stripe_customer_id: stripeCustomerId,
                stripe_payment_intent_id: (data.payment_intent ?? data.id) as string,
                product_key: webProduct.productKey,
              });
            }
            if (data.recovered_from) await recordCheckoutOutcome('checkout_recovered', webProduct.slug, data);
          }
        } else if (data.mode === 'subscription' && email && stripeCustomerId) {
          let planTier = 'pro';
          try {
            const stripe = getStripe()!;
            const lineItems = await stripe.checkout.sessions.listLineItems(data.id, { limit: 1 });
            const priceId = lineItems.data[0]?.price?.id;
            if (priceId) planTier = priceToPlanTier(priceId);
          } catch { /* default to pro */ }
          await saveSubscription({
            email,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: data.subscription as string,
            plan_tier: planTier,
            status: 'active',
            current_period_end: 0,
          });
        } else if (data.mode === 'payment' && email && stripeCustomerId) {
          // 'unattributed' matches no entitlement check (hasPurchased compares exact keys),
          // so an unmatched price records the sale without granting any product.
          let productKey: string = 'unattributed';
          let tokenAmount = 0;
          try {
            const s = getStripe()!;
            const lineItems = await s.checkout.sessions.listLineItems(data.id, { limit: 1 });
            const seenPriceId = lineItems.data[0]?.price?.id;
            const matched = entryForPriceId(seenPriceId, process.env);
            if (matched) {
              productKey = matched.productKey;
              tokenAmount = matched.tokenAmount ?? 0;
            } else {
              // entryForPriceId matches on the STRIPE_PRICE_* env vars, so a live
              // price that is only reachable via a STRIPE_PAYMENT_LINK_* env var
              // resolves to NOTHING and silently books the sale as an
              // AudienceDecoder report. Never let that pass quietly.
              console.error(
                `[stripe_webhook] price ${seenPriceId} matches no STRIPE_PRICE_* env var — ` +
                `recording as ${productKey}, no entitlement granted. If this is a payment-link product, its ` +
                `STRIPE_PRICE_* var must ALSO be set for attribution to work.`,
              );
            }
          } catch (err: any) {
            console.error(
              `[stripe_webhook] line-item lookup failed for session ${data.id} — ` +
              `recording as ${productKey}, no entitlement granted:`, err?.message,
            );
          }

          await saveOneTimePurchase({
            email,
            stripe_customer_id: stripeCustomerId,
            stripe_payment_intent_id: data.payment_intent as string,
            product_key: productKey,
          });

          if (productKey === PRODUCT_KEYS.PAGEROAST_TOKENS && tokenAmount > 0) {
            if (!(await hasTokenAccount(email))) await grantFreeTokens(email, 0);
            await creditTokens(email, tokenAmount, data.payment_intent as string);
            console.log(`[stripe] Credited ${tokenAmount} tokens for ${email}`);
          }

          // Mark most recent analytics session for this email as purchased (server-side attribution).
          try {
            await dbRun(
              `UPDATE sessions SET purchased = 1
               WHERE session_id = (SELECT session_id FROM sessions WHERE email = ? ORDER BY started_at DESC LIMIT 1)`,
              email,
            );
          } catch { /* analytics best-effort */ }
        }
      } else if (event.type === 'checkout.session.expired') {
        // Abandoned web-product checkouts feed the admin funnel. Owner/test
        // sessions are skipped so the funnel only counts real visitors.
        const wpSlug = typeof data.metadata?.web_product === 'string' ? data.metadata.web_product : '';
        const meta = data.metadata ?? {};
        if (wpSlug && webProductBySlug(wpSlug, WEB_PRODUCTS) && meta.test !== 'true' && meta.owner_ip !== 'true'
          && !(await ownerStartedCheckout(String(data.id)))) {
          await recordCheckoutOutcome('checkout_expired', wpSlug, data);
        }
      } else if (event.type === 'customer.subscription.updated') {
        await updateSubscriptionPeriod(data.id, data.status, data.current_period_end);
      } else if (event.type === 'customer.subscription.deleted') {
        await updateSubscriptionStatus(data.id, 'canceled');
      } else if (event.type === 'invoice.payment_failed') {
        if (data.subscription) {
          await updateSubscriptionStatus(data.subscription, 'past_due');
        }
      }
    } catch (err: any) {
      // Return 500 so Stripe retries. creditTokens is idempotent on payment_intent_id
      // and saveOneTimePurchase UPSERTs on the same key, so retries are safe.
      console.error('[stripe_webhook]', err);
      reply.status(500);
      return { error: 'webhook processing failed' };
    }

    return { received: true };
  });

  app.post('/api/stripe/billing-portal', async (req, reply) => {
    const body = req.body as { email?: string; returnUrl?: string } | null;
    const email = (body?.email ?? '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      reply.status(400);
      return { error: 'Valid email required.' };
    }

    const stripe = getStripe();
    if (!stripe) {
      reply.status(503);
      return { error: 'Stripe not configured' };
    }

    const customerId = await getCustomerStripeId(email);
    if (!customerId) {
      reply.status(404);
      return { error: 'No Stripe customer found for this email. Please use the email you used to subscribe.' };
    }

    try {
      const publicUrl = process.env.PUBLIC_URL || 'https://bilko.run';
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: safeUrl(body?.returnUrl, publicUrl),
      });
      return { url: session.url };
    } catch (err: any) {
      console.error('[billing-portal] session creation failed:', err.message);
      reply.status(500);
      return { error: 'Billing portal failed. Please try again.' };
    }
  });

  // Post-checkout success page — Stripe redirects here after payment.
  // Retrieves the session, looks up (or generates) the license key, and presents it to the customer.
  app.get('/checkout/success', async (req, reply) => {
    const query = req.query as { session_id?: string };
    const sessionId = (query.session_id ?? '').trim();

    if (!sessionId) {
      reply.type('text/html').status(400);
      return successHtml('Something went wrong', '<p>No checkout session found. Please contact support at bilko.run.</p>');
    }

    const stripe = getStripe();
    if (!stripe) {
      reply.type('text/html').status(503);
      return successHtml('Configuration error', '<p>Payment system unavailable. Please contact support.</p>');
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // Web-product buyers go to the product's own thanks page. Checked before
      // payment_status so 100%-off (no_payment_required) sessions don't dead-end.
      const wpMeta = (session.metadata as Record<string, string> | null)?.web_product;
      const wpProduct = typeof wpMeta === 'string' ? webProductBySlug(wpMeta, WEB_PRODUCTS) : undefined;
      if (wpProduct) {
        return reply.redirect(`/projects/${productPageSlug(wpProduct)}/thanks/?session_id=${encodeURIComponent(sessionId)}&offer=${encodeURIComponent(wpProduct.slug)}`, 302);
      }

      const walletTopup = (session.metadata as Record<string, string> | null)?.wallet_topup;
      const isWalletTopup = typeof walletTopup === 'string' && walletTopup !== '';

      if (session.payment_status !== 'paid') {
        reply.type('text/html').status(402);
        return successHtml('Payment pending', '<p>Your payment has not completed yet. Please wait a moment and refresh.</p>');
      }

      const email = ((session.client_reference_id ?? session.customer_email ?? (session.customer_details as any)?.email ?? '') as string).toLowerCase();
      if (!email) {
        reply.type('text/html').status(400);
        return successHtml('Email not found', '<p>We couldn\'t identify your account. Please contact support with your Stripe receipt.</p>');
      }

      // Resolve the actually-purchased product from the session's line item, same
      // pattern as the webhook handler above — do NOT hardcode a product key here.
      // No license key is ever minted: subscription sessions (legacy ContentGrade)
      // and unresolved prices both get the generic thank-you page.
      let productKey: string | null = null;
      if (isWalletTopup) {
        // Wallet top-up: no product line item to resolve.
      } else if (session.mode === 'subscription') {
        console.error(`[checkout_success] subscription-mode session ${sessionId} — showing generic thank-you`);
      } else {
        try {
          const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 });
          const seenPriceId = lineItems.data[0]?.price?.id;
          const matched = entryForPriceId(seenPriceId, process.env);
          if (matched) productKey = matched.productKey;
          else {
            console.error(
              `[checkout_success] price ${seenPriceId} (session ${sessionId}) matches no STRIPE_PRICE_* env var — ` +
              `showing generic thank-you. Payment-link products need their STRIPE_PRICE_* var set too.`,
            );
          }
        } catch (err: any) {
          console.error('[checkout_success] line item resolution failed for session', sessionId, ':', err.message);
        }
      }

      const title = 'Thanks for your support 🎉';

      // Wallet top-ups bought through /buy get an agent API key, shown once.
      if (isWalletTopup) {
        let keyHtml = '';
        if ((session.metadata as Record<string, string> | null)?.agent_key === '1') {
          try {
            const minted = await mintAgentApiKey(((session.metadata as Record<string, string>).wallet_email || email).trim().toLowerCase(), 'Bilko Credits', { checkoutSessionId: session.id });
            if ('alreadyMinted' in minted) {
              keyHtml = `<p>Your agent API key was already shown for this purchase. To mint a new one, <code>POST /api/agent-keys</code> while signed in.</p>`;
            } else {
              const k = escHtml(minted.key);
              const curl = `curl https://bilko.run/api/wallet -H 'Authorization: Bearer ${k}'`;
              const mcp = escHtml(JSON.stringify({
                mcpServers: { bilko: { url: 'https://bilko.run/mcp', headers: { Authorization: `Bearer ${minted.key}` } } },
              }, null, 2));
              keyHtml = `
        <p>Your agent API key (<strong>shown only once</strong> — copy it now):</p>
        <pre style="background:#111;color:#7fff7f;padding:16px;border-radius:6px;overflow-x:auto">${k}</pre>
        <p>Check your balance (<code>GET https://bilko.run/api/wallet</code>):</p>
        <pre style="background:#111;color:#7fff7f;padding:16px;border-radius:6px;overflow-x:auto;white-space:pre-wrap">${curl}</pre>
        <p>Or add this to your MCP client config:</p>
        <pre style="background:#111;color:#7fff7f;padding:16px;border-radius:6px;overflow-x:auto">${mcp}</pre>`;
            }
          } catch (err: any) {
            console.error('[checkout_success] agent key mint failed for session', sessionId, ':', err.message);
            keyHtml = `<p style="font-size:0.9em;color:#888">We couldn't create an agent API key automatically — create one while signed in via <code>POST /api/agent-keys</code>.</p>`;
          }
        }
        reply.type('text/html').header('Cache-Control', 'private, no-store').header('Referrer-Policy', 'no-referrer');
        return successHtml(title, `
        <p>Your Bilko Credits top-up is confirmed for <strong>${escHtml(email)}</strong>. Credits appear in your wallet shortly. Thank you!</p>${keyHtml}`);
      }

      // Agent-buy sessions (GET /buy/pageroast-*) get an agent API key, shown once.
      const isAgentBuy = (session.metadata as Record<string, string> | null)?.agent_key === '1'
        && productKey === PRODUCT_KEYS.PAGEROAST_TOKENS;
      if (isAgentBuy) {
        let keyHtml: string;
        try {
          const minted = await mintAgentApiKey(email, 'PageRoast credits', { checkoutSessionId: session.id });
          if ('alreadyMinted' in minted) {
            keyHtml = `<p>Your agent API key was already shown for this purchase. To mint a new one, <code>POST /api/agent-keys</code> while signed in.</p>`;
          } else {
            const k = escHtml(minted.key);
            const curl = `curl -X POST https://bilko.run/api/demos/page-roast -H 'Authorization: Bearer ${k}' -H 'content-type: application/json' -d '{"url":"https://example.com"}'`;
            const mcp = escHtml(JSON.stringify({
              mcpServers: { bilko: { url: 'https://bilko.run/mcp', headers: { Authorization: `Bearer ${minted.key}` } } },
            }, null, 2));
            keyHtml = `
        <p>Your agent API key (<strong>shown only once</strong> — copy it now):</p>
        <pre style="background:#111;color:#7fff7f;padding:16px;border-radius:6px;overflow-x:auto">${k}</pre>
        <p>Call the API directly:</p>
        <pre style="background:#111;color:#7fff7f;padding:16px;border-radius:6px;overflow-x:auto;white-space:pre-wrap">${curl}</pre>
        <p>Or add this to your MCP client config and call the tool <code>roast_page</code>:</p>
        <pre style="background:#111;color:#7fff7f;padding:16px;border-radius:6px;overflow-x:auto">${mcp}</pre>`;
          }
        } catch (err: any) {
          console.error('[checkout_success] agent key mint failed for session', sessionId, ':', err.message);
          keyHtml = `<p style="font-size:0.9em;color:#888">We couldn't create an agent API key automatically — create one while signed in via <code>POST /api/agent-keys</code>.</p>`;
        }
        reply.type('text/html').header('Cache-Control', 'private, no-store').header('Referrer-Policy', 'no-referrer');
        return successHtml(title, `
        <p>Your payment is confirmed for <strong>${escHtml(email)}</strong>. Thank you!</p>${keyHtml}`);
      }

      // The Field Manual is free as of 2.0.1, so nothing sells it any more. A
      // session_manager payment reaching this page is a late or in-flight one:
      // thank the buyer and send them to the free reader.
      const body = productKey === PRODUCT_KEYS.SESSION_MANAGER
        ? `
        <p>Your payment is confirmed for <strong>${escHtml(email)}</strong> — thank you for buying <strong>The Session Manager Field Manual</strong>.</p>
        <p>The manual is now free for everyone: every chapter, plus the PDF and offline editions, with no sign-in needed.</p>
        <p><a href="/products/session-manager/manual" style="display:inline-block;background:#7fff7f;color:#000;padding:12px 20px;border-radius:6px;font-weight:600;text-decoration:none">Read the manual →</a></p>
        <p style="font-size:0.9em;color:#888">The app itself is free too — launch it any time with:</p>
        <pre style="background:#111;color:#7fff7f;padding:16px;border-radius:6px;font-size:1.1em">npx claude-code-session-manager@latest</pre>`
        : productKey === PRODUCT_KEYS.PUBLICTRADES_COFFEE
        ? `
        <p>Thanks for the coffee ☕ — it keeps the free tools on bilko.run running.</p>
        <p style="font-size:0.9em;color:#888">Receipt on file for <strong>${escHtml(email)}</strong>.</p>
        <p><a href="https://bilko.run/">Back to bilko.run →</a></p>`
        : `
        <p>Your payment is confirmed for <strong>${escHtml(email)}</strong>. Thank you!</p>
        <p style="font-size:0.9em;color:#888">Receipt on file for <strong>${escHtml(email)}</strong>.</p>`;

      reply.type('text/html');
      return successHtml(title, body);
    } catch (err: any) {
      console.error('[checkout_success]', err.message);
      reply.type('text/html').status(500);
      return successHtml('Error retrieving order', '<p>We could not load your order details. Please contact support with your Stripe receipt.</p>');
    }
  });

  // Retired: old CLI messages still link here, so keep the path and send it home.
  app.get('/upgrade', async (_req, reply) => reply.redirect('/', 302));

  // Coffee-tip redirect — the shared Bilko tip jar. A stable top-level URL
  // other projects (the social-signals-trader dashboard, the
  // claude-code-session-manager npm `funding` field) point a plain <a href>
  // at, so the path must never change. Must never 404/5xx: when nothing is
  // resolvable, show a 200 "temporarily unavailable" page instead. Defaults are
  // the live Stripe product prod_V2Q4ego2oijqo4; env vars override them.
  app.get('/coffee', async (_req, reply) => {
    const paymentLink = process.env.STRIPE_PAYMENT_LINK_PUBLICTRADES_COFFEE || COFFEE_PAYMENT_LINK_DEFAULT;
    if (paymentLink) {
      return reply.redirect(paymentLink, 302);
    }

    const priceId = process.env.STRIPE_PRICE_PUBLICTRADES_COFFEE || entryForPriceType('publictrades_coffee')?.defaultPriceId;
    const stripe = getStripe();
    if (priceId && stripe) {
      try {
        const publicUrl = process.env.PUBLIC_URL || 'https://bilko.run';
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${publicUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${publicUrl}?checkout=cancel`,
        });
        if (session.url) {
          return reply.redirect(session.url, 302);
        }
      } catch (err: any) {
        console.error('[coffee] checkout session creation failed:', err.message);
      }
    }

    reply.type('text/html');
    return successHtml('Tipping is temporarily unavailable', '<p>This link isn\'t configured yet — check back soon.</p>');
  });

  app.get('/api/stripe/subscription-status', async (req, reply) => {
    const query = req.query as { email?: string };
    const email = (query.email ?? '').trim().toLowerCase();
    if (!email) {
      reply.status(400);
      return { error: 'email required' };
    }

    const active = await hasActiveSubscription(email);

    return {
      active,
      audiencedecoder: await hasPurchased(email, PRODUCT_KEYS.AUDIENCEDECODER_REPORT),
      plan: active ? 'pro' : null,
      configured: isStripeConfigured(),
      audienceDecoderConfigured: isAudienceDecoderConfigured(),
    };
  });
}
