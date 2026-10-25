import Stripe from 'stripe';
import { dbGet, dbRun } from '../db.js';
import { entryForPriceId } from '../../shared/product-catalog.js';

const stripeKey = process.env.STRIPE_SECRET_KEY;
let _stripe: Stripe | null = null;
let _stripeTest: Stripe | null = null;

/**
 * A live key outside production is how ~25 localhost "dev" checkouts ended up
 * in the live Stripe account (2026-03). Dev and tests get no live client unless
 * STRIPE_ALLOW_LIVE_IN_DEV=1 is set on purpose; use a sk_test_ key instead.
 */
export function liveKeyBlocked(key: string | undefined, env: Record<string, string | undefined> = process.env): boolean {
  return !!key?.startsWith('sk_live_') && env.NODE_ENV !== 'production' && env.STRIPE_ALLOW_LIVE_IN_DEV !== '1';
}

export function getStripe(): Stripe | null {
  if (!_stripe && stripeKey) {
    if (liveKeyBlocked(stripeKey)) {
      console.warn('[stripe] live key refused outside production (set STRIPE_ALLOW_LIVE_IN_DEV=1 to override)');
      return null;
    }
    _stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' as any });
  }
  return _stripe;
}

/**
 * Test-mode (or sandbox) client for owner checkouts, from STRIPE_TEST_SECRET_KEY.
 * Only sk_test_ keys are accepted so owner tests can never land in live mode.
 */
export function getStripeTest(): Stripe | null {
  const key = process.env.STRIPE_TEST_SECRET_KEY;
  if (!_stripeTest && key?.startsWith('sk_test_')) {
    _stripeTest = new Stripe(key, { apiVersion: '2024-12-18.acacia' as any });
  }
  return _stripeTest;
}

export function isStripeConfigured(): boolean {
  return !!stripeKey;
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
    `INSERT INTO stripe_subscriptions (email, stripe_customer_id, stripe_subscription_id, plan_tier, status, current_period_end) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(stripe_subscription_id) DO UPDATE SET plan_tier = excluded.plan_tier, status = excluded.status, current_period_end = excluded.current_period_end, updated_at = datetime('now')`,
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
    `SELECT plan_tier FROM stripe_subscriptions WHERE email = ? AND status = 'active' AND plan_tier IN ('pro', 'business', 'team') ORDER BY created_at DESC LIMIT 1`,
    email,
  );
  const tier = row?.plan_tier;
  if (tier === 'team' || tier === 'business' || tier === 'pro') return tier;
  return 'free';
}

export async function hasActiveSubscription(email: string): Promise<boolean> {
  return (await getSubscriptionTier(email)) !== 'free';
}

/** plan_tier for the $5/yr Git Viewer subscription. It is NOT a site-wide plan: it never sets isPro. */
export const GIT_VIEWER_TIER = 'git_viewer';

// Map Stripe price IDs to plan tiers. Any git_viewer price (env override,
// default, or a legacy id such as the retired $5/mo price) maps to git_viewer:
// an unmatched price falls through to 'pro', which would unlock every AI tool.
export function priceToPlanTier(priceId: string): string {
  if (entryForPriceId(priceId, process.env)?.priceType === 'git_viewer') return GIT_VIEWER_TIER;
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

interface SubStatus { isPro: boolean; tier: string; gitViewer: boolean }

const _subCache = new Map<string, SubStatus & { expiresAt: number }>();
const SUB_CACHE_TTL_MS = 5 * 60 * 1000;
const SUB_CACHE_ERROR_TTL_MS = 60 * 1000;
const SUB_CACHE_MAX = 5000;

function setSubCache(email: string, entry: SubStatus & { expiresAt: number }): void {
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

async function hasGitViewerSubscriptionDb(email: string): Promise<boolean> {
  const row = await dbGet<{ id: number }>(
    `SELECT id FROM stripe_subscriptions WHERE email = ? AND status = 'active' AND plan_tier = ? LIMIT 1`,
    email, GIT_VIEWER_TIER,
  );
  return !!row;
}

async function subStatusFromDb(email: string): Promise<SubStatus> {
  const tier = await getSubscriptionTier(email);
  return { isPro: tier !== 'free', tier, gitViewer: await hasGitViewerSubscriptionDb(email) };
}

/**
 * Live subscription state. `isPro`/`tier` describe the site-wide plan
 * (pro/business/team) only; a Git Viewer subscription sets `gitViewer` and
 * leaves `isPro` false, so $5/yr never unlocks the AI tools.
 */
export async function getActiveSubscriptionLive(email: string): Promise<SubStatus> {
  const cached = _subCache.get(email);
  if (cached && cached.expiresAt > Date.now()) {
    return { isPro: cached.isPro, tier: cached.tier, gitViewer: cached.gitViewer };
  }

  const stripe = getStripe();
  if (!stripe) return subStatusFromDb(email);

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
    setSubCache(email, { isPro: false, tier: 'free', gitViewer: false, expiresAt: Date.now() + SUB_CACHE_ERROR_TTL_MS });
    return { isPro: false, tier: 'free', gitViewer: false };
  }

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 10,
    });
    let isPro = false;
    let tier = 'free';
    let gitViewer = false;
    for (const sub of subscriptions.data) {
      const priceId = sub.items?.data[0]?.price?.id ?? '';
      const subTier = priceToPlanTier(priceId);
      if (subTier === GIT_VIEWER_TIER) gitViewer = true;
      else if (!isPro) { isPro = true; tier = subTier; }
      // UPSERT on stripe_subscription_id: backfills rows a missed webhook never wrote.
      await saveSubscription({
        email,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        plan_tier: subTier,
        status: 'active',
        current_period_end: sub.current_period_end,
      });
    }
    setSubCache(email, { isPro, tier, gitViewer, expiresAt: Date.now() + SUB_CACHE_TTL_MS });
    return { isPro, tier, gitViewer };
  } catch (err) {
    console.error('[stripe] Live subscription check failed, falling back to DB:', err);
    const status = await subStatusFromDb(email);
    setSubCache(email, { ...status, expiresAt: Date.now() + SUB_CACHE_ERROR_TTL_MS });
    return status;
  }
}
