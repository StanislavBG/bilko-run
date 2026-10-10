import type { FastifyInstance } from 'fastify';
import {
  getStripe, isStripeConfigured, isAudienceDecoderConfigured,
  hasActiveSubscription, hasPurchased,
  getCustomerStripeId, upsertCustomer,
  saveSubscription, updateSubscriptionStatus, updateSubscriptionPeriod,
  saveOneTimePurchase, priceToPlanTier,
} from '../services/stripe.js';
import { creditTokens, grantFreeTokens, hasTokenAccount } from '../services/tokens.js';
import { dbRun } from '../db.js';
import {
  PRODUCT_KEYS,
  entryForPriceType,
  entryForPriceId,
  type PriceType,
} from '../../shared/product-catalog.js';

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

    const priceId = process.env[catalogEntry.envVar];
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
      const allowedOrigin = new URL(publicUrl).origin;
      const safeUrl = (raw: string | undefined, fallback: string): string => {
        if (!raw) return fallback;
        try { return new URL(raw).origin === allowedOrigin ? raw : fallback; } catch { return fallback; }
      };
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

        if (data.mode === 'subscription' && email && stripeCustomerId) {
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
        return_url: body?.returnUrl ?? publicUrl,
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
      if (session.mode === 'subscription') {
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
  // configured yet, show a 200 "temporarily unavailable" page instead.
  app.get('/coffee', async (_req, reply) => {
    const paymentLink = process.env.STRIPE_PAYMENT_LINK_PUBLICTRADES_COFFEE;
    if (paymentLink) {
      return reply.redirect(paymentLink, 302);
    }

    const priceId = process.env.STRIPE_PRICE_PUBLICTRADES_COFFEE;
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
