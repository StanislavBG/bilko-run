import type { FastifyInstance } from 'fastify';
import {
  getStripe, isStripeConfigured, isAudienceDecoderConfigured,
  hasActiveSubscription, hasPurchased,
  getCustomerStripeId, upsertCustomer,
  saveSubscription, updateSubscriptionStatus, updateSubscriptionPeriod,
  saveOneTimePurchase, priceToPlanTier, hasActiveSubscriptionLive,
} from '../services/stripe.js';
import { upsertLicenseKey, getLicenseKeysForEmail, validateLicenseKey } from '../services/license.js';
import { creditTokens, grantFreeTokens, hasTokenAccount, TOKENS_PER_BUNDLE } from '../services/tokens.js';

function successHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — Content-Grade</title>
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
    <p><a href="https://content-grade.onrender.com">← Back to Content-Grade</a></p>
  </div>
</body>
</html>`;
}

export function registerStripeRoutes(app: FastifyInstance): void {
  app.post('/api/stripe/create-checkout-session', async (req, reply) => {
    const body = req.body as {
      email?: string;
      priceType?: 'contentgrade_pro' | 'contentgrade_business' | 'contentgrade_team' | 'audiencedecoder_report' | 'pageroast_tokens';
      successUrl?: string;
      cancelUrl?: string;
    } | null;

    const email = (body?.email ?? '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      reply.status(400);
      return { error: 'Valid email required.' };
    }

    const priceType = body?.priceType ?? 'contentgrade_pro';
    const stripe = getStripe();

    if (!stripe) {
      reply.status(503);
      return { error: 'Stripe not configured' };
    }

    let priceId: string | undefined;
    let mode: 'subscription' | 'payment';

    if (priceType === 'contentgrade_pro') {
      priceId = process.env.STRIPE_PRICE_CONTENTGRADE_PRO;
      mode = 'subscription';
    } else if (priceType === 'contentgrade_business') {
      priceId = process.env.STRIPE_PRICE_CONTENTGRADE_BUSINESS;
      mode = 'subscription';
    } else if (priceType === 'contentgrade_team') {
      priceId = process.env.STRIPE_PRICE_CONTENTGRADE_TEAM;
      mode = 'subscription';
    } else if (priceType === 'pageroast_tokens') {
      priceId = process.env.STRIPE_PRICE_TOKENS;
      mode = 'payment';
    } else {
      priceId = process.env.STRIPE_PRICE_AUDIENCEDECODER;
      mode = 'payment';
    }

    if (!priceId) {
      reply.status(503);
      return { error: 'Stripe not configured — price ID missing' };
    }

    try {
      let stripeCustomerId = getCustomerStripeId(email);
      if (!stripeCustomerId) {
        const stripeCustomer = await stripe.customers.create({ email });
        stripeCustomerId = stripeCustomer.id;
        upsertCustomer(email, stripeCustomerId);
      }

      const publicUrl = process.env.PUBLIC_URL || 'https://content-grade.onrender.com';
      const defaultSuccessUrl = priceType === 'pageroast_tokens'
        ? `${publicUrl}/projects/page-roast?tokens=purchased`
        : `${publicUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
      const session = await stripe.checkout.sessions.create({
        mode,
        customer: stripeCustomerId,
        client_reference_id: email,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: body?.successUrl ?? defaultSuccessUrl,
        cancel_url: body?.cancelUrl ?? `${publicUrl}?checkout=cancel`,
      });

      return { url: session.url };
    } catch (err: any) {
      reply.status(500);
      return { error: `Checkout failed: ${err.message}` };
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

    let event: any;
    try {
      if (webhookSecret && rawBody && sig) {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } else {
        if (!webhookSecret) console.warn('[Stripe] STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev mode)');
        event = req.body;
      }
    } catch (err: any) {
      reply.status(400);
      return { error: `Webhook signature failed: ${err.message}` };
    }

    try {
      const data = event.data?.object as any;

      if (event.type === 'checkout.session.completed') {
        const email = ((data.client_reference_id ?? data.customer_email ?? data.customer_details?.email ?? '') as string).toLowerCase();
        const stripeCustomerId = data.customer as string;

        if (!email) {
          console.error('[stripe_webhook] checkout.session.completed missing customer email — session:', data.id, '— license key NOT generated');
        }

        if (email && stripeCustomerId) {
          upsertCustomer(email, stripeCustomerId);
        }

        if (data.mode === 'subscription' && email && stripeCustomerId) {
          // Resolve plan tier from the Stripe price ID on the checkout line items
          let planTier = 'pro';
          try {
            const stripe = getStripe()!;
            const lineItems = await stripe.checkout.sessions.listLineItems(data.id, { limit: 1 });
            const priceId = lineItems.data[0]?.price?.id;
            if (priceId) planTier = priceToPlanTier(priceId);
          } catch { /* default to pro */ }
          saveSubscription({
            email,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: data.subscription as string,
            plan_tier: planTier,
            status: 'active',
            current_period_end: 0,
          });
          // Generate and store license key for CLI pro access
          const licenseKey = upsertLicenseKey(email, stripeCustomerId, 'contentgrade_pro');
          console.log(`[stripe] License key issued for ${email}: ${licenseKey.slice(0, 10)}...`);
        } else if (data.mode === 'payment' && email && stripeCustomerId) {
          // Determine which one-time product was purchased
          let productKey = 'audiencedecoder_report';
          try {
            const s = getStripe()!;
            const lineItems = await s.checkout.sessions.listLineItems(data.id, { limit: 1 });
            const purchasedPriceId = lineItems.data[0]?.price?.id;
            if (purchasedPriceId === process.env.STRIPE_PRICE_TOKENS) {
              productKey = 'pageroast_tokens';
            }
          } catch { /* default to audiencedecoder */ }

          saveOneTimePurchase({
            email,
            stripe_customer_id: stripeCustomerId,
            stripe_payment_intent_id: data.payment_intent as string,
            product_key: productKey,
          });

          if (productKey === 'pageroast_tokens') {
            if (!hasTokenAccount(email)) grantFreeTokens(email, 0);
            creditTokens(email, TOKENS_PER_BUNDLE, data.payment_intent as string);
            console.log(`[stripe] Credited ${TOKENS_PER_BUNDLE} tokens for ${email}`);
          }
        }
      } else if (event.type === 'customer.subscription.updated') {
        updateSubscriptionPeriod(data.id, data.status, data.current_period_end);
      } else if (event.type === 'customer.subscription.deleted') {
        updateSubscriptionStatus(data.id, 'canceled');
      } else if (event.type === 'invoice.payment_failed') {
        if (data.subscription) {
          updateSubscriptionStatus(data.subscription, 'past_due');
        }
      }
    } catch (err: any) {
      console.error('[stripe_webhook]', err);
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

    const customerId = getCustomerStripeId(email);
    if (!customerId) {
      reply.status(404);
      return { error: 'No Stripe customer found for this email. Please use the email you used to subscribe.' };
    }

    try {
      const publicUrl = process.env.PUBLIC_URL || 'https://content-grade.onrender.com';
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: body?.returnUrl ?? publicUrl,
      });
      return { url: session.url };
    } catch (err: any) {
      reply.status(500);
      return { error: `Billing portal failed: ${err.message}` };
    }
  });

  // Returns the license key for a Pro subscriber — used by CLI activate flow
  app.get('/api/stripe/license-key', async (req, reply) => {
    const query = req.query as { email?: string };
    const email = (query.email ?? '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      reply.status(400);
      return { error: 'Valid email required.' };
    }

    const isActive = await hasActiveSubscriptionLive(email);
    if (!isActive) {
      reply.status(403);
      return { error: 'No active Content-Grade Pro subscription found for this email.' };
    }

    // Retroactively generate a key for subscribers who paid before this feature existed
    const customerId = getCustomerStripeId(email);
    const licenseKey = upsertLicenseKey(email, customerId ?? undefined, 'contentgrade_pro');

    return { licenseKey, email };
  });

  // Validates a license key — used by CLI to confirm key is genuine
  app.post('/api/stripe/validate-license', async (req, reply) => {
    const body = req.body as { key?: string } | null;
    const key = (body?.key ?? '').trim();
    if (!key) {
      reply.status(400);
      return { error: 'key required' };
    }

    const result = validateLicenseKey(key);
    if (!result.valid) {
      reply.status(403);
      return { valid: false, error: 'Invalid or revoked license key.' };
    }

    return { valid: true, email: result.email, productKey: result.productKey };
  });

  // Post-checkout success page — Stripe redirects here after payment.
  // Retrieves the session, looks up (or generates) the license key, and presents it to the customer.
  app.get('/checkout/success', async (req, reply) => {
    const query = req.query as { session_id?: string };
    const sessionId = (query.session_id ?? '').trim();

    if (!sessionId) {
      reply.type('text/html').status(400);
      return successHtml('Something went wrong', '<p>No checkout session found. Please contact support at content-grade.onrender.com.</p>');
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

      const customerId = typeof session.customer === 'string' ? session.customer : undefined;
      const licenseKey = upsertLicenseKey(email, customerId, 'contentgrade_pro');

      reply.type('text/html');
      return successHtml('You\'re now Pro 🎉', `
        <p>Payment confirmed for <strong>${email}</strong>.</p>
        <p>Your license key:</p>
        <pre style="background:#111;color:#7fff7f;padding:16px;border-radius:6px;font-size:1.1em;letter-spacing:0.05em">${licenseKey}</pre>
        <p>Activate it in your terminal:</p>
        <pre style="background:#111;color:#ccc;padding:12px;border-radius:6px">content-grade activate ${licenseKey}</pre>
        <p style="font-size:0.9em;color:#888">
          Retrieve it any time: <a href="/my-license?email=${encodeURIComponent(email)}">/my-license?email=${encodeURIComponent(email)}</a>
        </p>
      `);
    } catch (err: any) {
      console.error('[checkout_success]', err.message);
      reply.type('text/html').status(500);
      return successHtml('Error retrieving order', '<p>We could not load your order details. Please contact support with your Stripe receipt.</p>');
    }
  });

  // Self-service license key retrieval page — for users who paid via static Stripe link
  // and weren't redirected to /checkout/success, or who lost their key.
  app.get('/my-license', async (req, reply) => {
    const query = req.query as { email?: string };
    const email = (query.email ?? '').trim().toLowerCase();

    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      // Email provided — look up their key
      const isActive = await hasActiveSubscriptionLive(email);
      if (!isActive) {
        reply.type('text/html');
        return successHtml('No active subscription found', `
          <p>No active Content-Grade Pro subscription was found for <strong>${email}</strong>.</p>
          <p>If you just paid, it can take up to a minute for the webhook to process. Try again shortly.</p>
          <p>If you believe this is an error, contact support with your Stripe receipt.</p>
          <p><a href="/my-license">Try a different email</a></p>
        `);
      }
      const customerId = getCustomerStripeId(email);
      const licenseKey = upsertLicenseKey(email, customerId ?? undefined, 'contentgrade_pro');
      reply.type('text/html');
      return successHtml('Your Content-Grade Pro License', `
        <p>Active Pro subscription confirmed for <strong>${email}</strong>.</p>
        <p>Your license key:</p>
        <pre style="background:#111;color:#7fff7f;padding:16px;border-radius:6px;font-size:1.1em;letter-spacing:0.05em">${licenseKey}</pre>
        <p>Activate it in your terminal:</p>
        <pre style="background:#111;color:#ccc;padding:12px;border-radius:6px">content-grade activate ${licenseKey}</pre>
        <p style="font-size:0.9em;color:#888">
          Bookmark this page to retrieve your key any time.<br>
          Replace the email in the URL: <code>/my-license?email=${encodeURIComponent(email)}</code>
        </p>
      `);
    }

    // No email — show the form
    reply.type('text/html');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Retrieve License Key — Content-Grade</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0d0d0d;color:#e8e8e8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
    .card{max-width:480px;width:90%;background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:40px}
    h1{margin-top:0;font-size:1.5em}
    input{width:100%;box-sizing:border-box;padding:10px 14px;background:#111;border:1px solid #444;border-radius:6px;color:#e8e8e8;font-size:1em;margin:8px 0 16px}
    button{width:100%;padding:12px;background:#7fff7f;color:#000;border:none;border-radius:6px;font-size:1em;font-weight:600;cursor:pointer}
    button:hover{background:#5fdf5f}
    p{color:#aaa;font-size:0.9em}
    a{color:#7fc4ff}
  </style>
</head>
<body>
  <div class="card">
    <h1>Retrieve Your License Key</h1>
    <p>Enter the email address you used when purchasing Content-Grade Pro.</p>
    <form method="GET" action="/my-license">
      <input type="email" name="email" placeholder="you@example.com" required autofocus/>
      <button type="submit">Get My License Key</button>
    </form>
    <p style="margin-top:24px">
      Don't have Pro yet? <a href="/upgrade">Upgrade for $9/mo →</a>
    </p>
  </div>
</body>
</html>`;
  });

  // Upgrade redirect — CLI rate-limit messages point here for a clean, stable URL
  app.get('/upgrade', async (_req, reply) => {
    const proLink = process.env.STRIPE_PAYMENT_LINK_CONTENTGRADE_PRO
      ?? 'https://buy.stripe.com/4gM14p87GeCh9vn9ks8k80a'; // Pro $9/mo direct checkout
    return reply.redirect(proLink, 302);
  });

  app.get('/api/stripe/subscription-status', async (req, reply) => {
    const query = req.query as { email?: string };
    const email = (query.email ?? '').trim().toLowerCase();
    if (!email) {
      reply.status(400);
      return { error: 'email required' };
    }

    const keys = getLicenseKeysForEmail(email);
    const activeLicenseKey = keys.find(k => k.status === 'active')?.key ?? null;

    return {
      active: hasActiveSubscription(email),
      audiencedecoder: hasPurchased(email, 'audiencedecoder_report'),
      plan: hasActiveSubscription(email) ? 'contentgrade_pro' : null,
      licenseKey: activeLicenseKey,
      configured: isStripeConfigured(),
      audienceDecoderConfigured: isAudienceDecoderConfigured(),
    };
  });
}
