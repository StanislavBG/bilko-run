import Stripe from 'stripe';
import { dbGet, dbRun } from '../db.js';

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

export async function upsertCustomer(email: string, stripeCustomerId: string): Promise<void> {
  await dbRun(
    `INSERT INTO stripe_customers (email, stripe_customer_id) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET stripe_customer_id = excluded.stripe_customer_id`,
    email, stripeCustomerId,
  );
}

export async function getCustomerStripeId(email: string): Promise<string | null> {
  const row = await dbGet<{ stripe_customer_id: string }>('SELECT stripe_customer_id FROM stripe_customers WHERE email = ?', email);
  return row?.stripe_customer_id ?? null;
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export async function saveSubscription(params: {
  email: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan_tier: string;
  status: string;
  current_period_end: number;
}): Promise<void> {
  await dbRun(
    `INSERT INTO stripe_subscriptions (email, stripe_customer_id, stripe_subscription_id, plan_tier, status, current_period_end) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(stripe_subscription_id) DO UPDATE SET status = excluded.status, current_period_end = excluded.current_period_end, updated_at = datetime('now')`,
    params.email, params.stripe_customer_id, params.stripe_subscription_id,
    params.plan_tier, params.status, params.current_period_end,
  );
}

export async function updateSubscriptionStatus(stripeSubId: string, status: string): Promise<void> {
  await dbRun("UPDATE stripe_subscriptions SET status = ?, updated_at = datetime('now') WHERE stripe_subscription_id = ?", status, stripeSubId);
}

export async function updateSubscriptionPeriod(stripeSubId: string, status: string, currentPeriodEnd: number): Promise<void> {
  await dbRun("UPDATE stripe_subscriptions SET status = ?, current_period_end = ?, updated_at = datetime('now') WHERE stripe_subscription_id = ?", status, currentPeriodEnd, stripeSubId);
}

export async function getSubscriptionTier(email: string): Promise<'free' | 'pro' | 'business' | 'team'> {
  const row = await dbGet<{ plan_tier: string }>(
    `SELECT plan_tier FROM stripe_subscriptions WHERE email = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    email,
  );
  const tier = row?.plan_tier;
  if (tier === 'team' || tier === 'business' || tier === 'pro') return tier;
  return 'free';
}

export async function hasActiveSubscription(email: string): Promise<boolean> {
  return (await getSubscriptionTier(email)) !== 'free';
}

// Map Stripe price IDs to plan tiers
export function priceToPlanTier(priceId: string): string {
  const proBiz = process.env.STRIPE_PRICE_CONTENTGRADE_BUSINESS;
  const proTeam = process.env.STRIPE_PRICE_CONTENTGRADE_TEAM;
  if (proBiz && priceId === proBiz) return 'business';
  if (proTeam && priceId === proTeam) return 'team';
  return 'pro';
}

// ── One-time purchases ───────────────────────────────────────────────────────

export async function saveOneTimePurchase(params: {
  email: string;
  stripe_customer_id: string;
  stripe_payment_intent_id: string;
  product_key: string;
}): Promise<void> {
  await dbRun(
    `INSERT OR IGNORE INTO stripe_one_time_purchases (email, stripe_customer_id, stripe_payment_intent_id, product_key) VALUES (?, ?, ?, ?)`,
    params.email, params.stripe_customer_id, params.stripe_payment_intent_id, params.product_key,
  );
}

export async function hasPurchased(email: string, productKey: string): Promise<boolean> {
  const row = await dbGet<{ id: number }>(
    `SELECT id FROM stripe_one_time_purchases WHERE email = ? AND product_key = ? LIMIT 1`,
    email, productKey,
  );
  return !!row;
}

// ── Live subscription verification ───────────────────────────────────────────

const _subCache = new Map<string, { isPro: boolean; tier: string; expiresAt: number }>();
const SUB_CACHE_TTL_MS = 5 * 60 * 1000;
const SUB_CACHE_ERROR_TTL_MS = 60 * 1000;
const SUB_CACHE_MAX = 5000;

function setSubCache(email: string, entry: { isPro: boolean; tier: string; expiresAt: number }): void {
  if (_subCache.size >= SUB_CACHE_MAX) {
    // Evict first expired entry, or oldest if none expired (Map preserves insertion order).
    const now = Date.now();
    let evicted = false;
    for (const [k, v] of _subCache) {
      if (v.expiresAt <= now) { _subCache.delete(k); evicted = true; break; }
    }
    if (!evicted) _subCache.delete(_subCache.keys().next().value as string);
  }
  _subCache.set(email, entry);
}

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
    const tier = await getSubscriptionTier(email);
    return { isPro: tier !== 'free', tier };
  }

  let customerId = await getCustomerStripeId(email);

  if (!customerId) {
    try {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        await upsertCustomer(email, customerId);
        console.log(`[stripe] Repopulated customer from Stripe for ${email}`);
      }
    } catch (lookupErr) {
      console.error('[stripe] Customer email lookup failed:', lookupErr);
    }
  }

  if (!customerId) {
    setSubCache(email, { isPro: false, tier: 'free', expiresAt: Date.now() + SUB_CACHE_ERROR_TTL_MS });
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
      if ((await getSubscriptionTier(email)) === 'free') {
        await saveSubscription({
          email,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptions.data[0].id,
          plan_tier: tier,
          status: 'active',
          current_period_end: subscriptions.data[0].current_period_end,
        });
      }
    }
    setSubCache(email, { isPro, tier, expiresAt: Date.now() + SUB_CACHE_TTL_MS });
    return { isPro, tier };
  } catch (err) {
    console.error('[stripe] Live subscription check failed, falling back to DB:', err);
    const tier = await getSubscriptionTier(email);
    const isPro = tier !== 'free';
    setSubCache(email, { isPro, tier, expiresAt: Date.now() + SUB_CACHE_ERROR_TTL_MS });
    return { isPro, tier };
  }
}
