import Stripe from 'stripe';
import { getDb } from '../db.js';

const stripeKey = process.env.STRIPE_SECRET_KEY;
let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!_stripe && stripeKey) {
    _stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!stripeKey && !!process.env.STRIPE_PRICE_CONTENTGRADE_PRO;
}

export function isAudienceDecoderConfigured(): boolean {
  return !!stripeKey && !!process.env.STRIPE_PRICE_AUDIENCEDECODER;
}

// ── Customer management ──────────────────────────────────────────────────────

export function upsertCustomer(email: string, stripeCustomerId: string): void {
  getDb().prepare(`
    INSERT INTO stripe_customers (email, stripe_customer_id)
    VALUES (?, ?)
    ON CONFLICT(email) DO UPDATE SET stripe_customer_id = excluded.stripe_customer_id
  `).run(email, stripeCustomerId);
}

export function getCustomerStripeId(email: string): string | null {
  const row = getDb().prepare('SELECT stripe_customer_id FROM stripe_customers WHERE email = ?').get(email) as { stripe_customer_id: string } | undefined;
  return row?.stripe_customer_id ?? null;
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export function saveSubscription(params: {
  email: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan_tier: string;
  status: string;
  current_period_end: number;
}): void {
  getDb().prepare(`
    INSERT INTO stripe_subscriptions
      (email, stripe_customer_id, stripe_subscription_id, plan_tier, status, current_period_end)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(stripe_subscription_id) DO UPDATE SET
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      updated_at = datetime('now')
  `).run(
    params.email,
    params.stripe_customer_id,
    params.stripe_subscription_id,
    params.plan_tier,
    params.status,
    params.current_period_end,
  );
}

export function updateSubscriptionStatus(stripeSubId: string, status: string): void {
  getDb().prepare("UPDATE stripe_subscriptions SET status = ?, updated_at = datetime('now') WHERE stripe_subscription_id = ?").run(status, stripeSubId);
}

export function updateSubscriptionPeriod(stripeSubId: string, status: string, currentPeriodEnd: number): void {
  getDb().prepare("UPDATE stripe_subscriptions SET status = ?, current_period_end = ?, updated_at = datetime('now') WHERE stripe_subscription_id = ?").run(status, currentPeriodEnd, stripeSubId);
}

export function hasActiveSubscription(email: string): boolean {
  const row = getDb().prepare(`
    SELECT status FROM stripe_subscriptions
    WHERE email = ? AND status = 'active'
    ORDER BY created_at DESC LIMIT 1
  `).get(email) as { status: string } | undefined;
  return row?.status === 'active';
}

export function getSubscriptionTier(email: string): 'free' | 'pro' | 'business' | 'team' {
  const row = getDb().prepare(`
    SELECT plan_tier FROM stripe_subscriptions
    WHERE email = ? AND status = 'active'
    ORDER BY created_at DESC LIMIT 1
  `).get(email) as { plan_tier: string } | undefined;
  const tier = row?.plan_tier;
  if (tier === 'team' || tier === 'business' || tier === 'pro') return tier;
  return 'free';
}

// Map Stripe price IDs to plan tiers
export function priceToPlanTier(priceId: string): string {
  const proBiz = process.env.STRIPE_PRICE_CONTENTGRADE_BUSINESS;
  const proTeam = process.env.STRIPE_PRICE_CONTENTGRADE_TEAM;
  if (proBiz && priceId === proBiz) return 'business';
  if (proTeam && priceId === proTeam) return 'team';
  return 'pro'; // default — $9/mo Pro
}

// ── One-time purchases ───────────────────────────────────────────────────────

export function saveOneTimePurchase(params: {
  email: string;
  stripe_customer_id: string;
  stripe_payment_intent_id: string;
  product_key: string;
}): void {
  getDb().prepare(`
    INSERT OR IGNORE INTO stripe_one_time_purchases
      (email, stripe_customer_id, stripe_payment_intent_id, product_key)
    VALUES (?, ?, ?, ?)
  `).run(params.email, params.stripe_customer_id, params.stripe_payment_intent_id, params.product_key);
}

export function hasPurchased(email: string, productKey: string): boolean {
  const row = getDb().prepare(`
    SELECT id FROM stripe_one_time_purchases
    WHERE email = ? AND product_key = ?
    LIMIT 1
  `).get(email, productKey) as { id: number } | undefined;
  return !!row;
}

// ── Live subscription verification ───────────────────────────────────────────
// Checks Stripe API directly on each request. 5-minute in-memory cache per email
// prevents hammering the Stripe API. Falls back to DB if Stripe is unreachable.

const _subCache = new Map<string, { isPro: boolean; tier: string; expiresAt: number }>();
const SUB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SUB_CACHE_ERROR_TTL_MS = 60 * 1000; // 1 minute on error

export async function hasActiveSubscriptionLive(email: string): Promise<boolean> {
  const result = await getActiveSubscriptionLive(email);
  return result.isPro;
}

export async function getActiveSubscriptionLive(email: string): Promise<{ isPro: boolean; tier: string }> {
  const cached = _subCache.get(email);
  if (cached && cached.expiresAt > Date.now()) {
    return { isPro: cached.isPro, tier: cached.tier };
  }

  const stripe = getStripe();
  if (!stripe) {
    const active = hasActiveSubscription(email);
    const tier = active ? getSubscriptionTier(email) : 'free';
    return { isPro: active, tier };
  }

  let customerId = getCustomerStripeId(email);

  // If customer not in local DB (common after Render cold start wipes /tmp/contentgrade.db),
  // look up directly in Stripe by email and repopulate the local DB.
  if (!customerId) {
    try {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        upsertCustomer(email, customerId);
        console.log(`[stripe] Repopulated customer from Stripe for ${email}`);
      }
    } catch (lookupErr) {
      console.error('[stripe] Customer email lookup failed:', lookupErr);
    }
  }

  if (!customerId) {
    _subCache.set(email, { isPro: false, tier: 'free', expiresAt: Date.now() + SUB_CACHE_ERROR_TTL_MS });
    return { isPro: false, tier: 'free' };
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });
    const isPro = subscriptions.data.length > 0;
    let tier = 'free';
    if (isPro) {
      const priceId = subscriptions.data[0]?.items?.data[0]?.price?.id ?? '';
      tier = priceToPlanTier(priceId);
      // Repopulate subscription record if missing (DB wipe recovery)
      if (!hasActiveSubscription(email)) {
        saveSubscription({
          email,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptions.data[0].id,
          plan_tier: tier,
          status: 'active',
          current_period_end: subscriptions.data[0].current_period_end,
        });
      }
    }
    _subCache.set(email, { isPro, tier, expiresAt: Date.now() + SUB_CACHE_TTL_MS });
    return { isPro, tier };
  } catch (err) {
    console.error('[stripe] Live subscription check failed, falling back to DB:', err);
    const active = hasActiveSubscription(email);
    const tier = active ? getSubscriptionTier(email) : 'free';
    _subCache.set(email, { isPro: active, tier, expiresAt: Date.now() + SUB_CACHE_ERROR_TTL_MS });
    return { isPro: active, tier };
  }
}
