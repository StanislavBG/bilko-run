/**
 * Complimentary entitlement grants — "this person paid" without a Stripe charge.
 *
 * Why this exists: every paid product on bilko.run gates on a row in
 * `stripe_one_time_purchases` (see `hasPurchased` in ./stripe.ts). That is the
 * right gate, but it means the ONLY way to give someone access used to be a
 * real card charge. Several legitimate cases need access with no sale:
 *
 *   - the owner QA-ing his own paid product (he can't buy from himself)
 *   - a reviewer or press copy
 *   - support recovery when a real payment landed but the webhook didn't
 *   - a refund where access should survive as a goodwill gesture
 *
 * The alternative — a hand-run INSERT against the live DB — leaves no record of
 * who granted what, or why. So a comp grant here writes TWO rows: the
 * entitlement row the product actually reads, and an audit row in `comp_grants`
 * holding the reason and the admin who issued it.
 *
 * ## Sentinel Stripe ids
 *
 * The entitlement row still needs `stripe_customer_id` /
 * `stripe_payment_intent_id` (both NOT NULL, the latter UNIQUE). Comps write
 * sentinels that cannot collide with real Stripe ids — Stripe's are `cus_…` and
 * `pi_…`, ours are `comp_…` — so a later reconciliation against Stripe can tell
 * at a glance that no money moved. The payment-intent sentinel is *derived from*
 * (productKey, email), which makes the UNIQUE index do the idempotency work:
 * granting the same person the same product twice is a no-op, but two different
 * comps never collide.
 */

import { dbAll, dbGet, dbRun } from '../db.js';
import { saveOneTimePurchase } from './stripe.js';
import type { ProductKey } from '../../shared/product-catalog.js';

/** Marks a row as a comp. Real Stripe customer ids start `cus_`, so no collision. */
export const COMP_CUSTOMER_ID = 'comp_grant';

/** Real Stripe payment-intent ids start `pi_`, so no collision. */
export const COMP_PAYMENT_INTENT_PREFIX = 'comp_grant:';

/** Deterministic sentinel: same (product, email) ⇒ same id ⇒ INSERT OR IGNORE is idempotent. */
export function compPaymentIntentId(productKey: string, email: string): string {
  return `${COMP_PAYMENT_INTENT_PREFIX}${productKey}:${email}`;
}

/** True if this purchase row is a comp rather than a real Stripe charge. */
export function isCompPurchase(paymentIntentId: string): boolean {
  return paymentIntentId.startsWith(COMP_PAYMENT_INTENT_PREFIX);
}

export interface CompGrantRow {
  email: string;
  product_key: string;
  reason: string;
  granted_by: string;
  created_at: number;
  revoked_at: number | null;
  revoked_by: string | null;
}

export interface GrantResult {
  ok: true;
  email: string;
  productKey: string;
  /** false when the entitlement already existed (re-grant, or a real purchase). */
  created: boolean;
}

/**
 * Grant `email` a comp entitlement to `productKey`.
 *
 * Idempotent: re-granting is a no-op on the entitlement and refreshes the audit
 * row's reason. Emails are lowercased on the way in because `hasPurchased` is an
 * exact-match query against an already-lowercased caller value — a row stored
 * with any uppercase would be silently unfindable.
 */
export async function grantComp(params: {
  email: string;
  productKey: ProductKey | string;
  reason: string;
  grantedBy: string;
}): Promise<GrantResult> {
  const email = params.email.trim().toLowerCase();
  const productKey = params.productKey.trim();
  if (!email || !email.includes('@')) throw new Error('A valid email is required.');
  if (!productKey) throw new Error('productKey is required.');
  if (!params.reason?.trim()) throw new Error('A reason is required — comps must be auditable.');

  const before = await dbGet<{ id: number }>(
    `SELECT id FROM stripe_one_time_purchases WHERE email = ? AND product_key = ? LIMIT 1`,
    email, productKey,
  );

  await saveOneTimePurchase({
    email,
    stripe_customer_id: COMP_CUSTOMER_ID,
    stripe_payment_intent_id: compPaymentIntentId(productKey, email),
    product_key: productKey,
  });

  await dbRun(
    `INSERT INTO comp_grants (email, product_key, reason, granted_by, created_at, revoked_at, revoked_by)
     VALUES (?, ?, ?, ?, ?, NULL, NULL)
     ON CONFLICT(email, product_key) DO UPDATE SET
       reason = excluded.reason,
       granted_by = excluded.granted_by,
       created_at = excluded.created_at,
       revoked_at = NULL,
       revoked_by = NULL`,
    email, productKey, params.reason.trim(), params.grantedBy.trim().toLowerCase(),
    Math.floor(Date.now() / 1000),
  );

  return { ok: true, email, productKey, created: !before };
}

/**
 * Revoke a comp. Deliberately refuses to touch a real Stripe purchase — if the
 * person actually paid, revoking access is a refund decision, not an admin poke.
 */
export async function revokeComp(params: {
  email: string;
  productKey: ProductKey | string;
  revokedBy: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const email = params.email.trim().toLowerCase();
  const productKey = params.productKey.trim();

  const row = await dbGet<{ stripe_payment_intent_id: string }>(
    `SELECT stripe_payment_intent_id FROM stripe_one_time_purchases WHERE email = ? AND product_key = ? LIMIT 1`,
    email, productKey,
  );
  if (!row) return { ok: false, reason: 'No entitlement found for that email and product.' };
  if (!isCompPurchase(row.stripe_payment_intent_id)) {
    return { ok: false, reason: 'That entitlement is a real Stripe purchase — refund it in Stripe instead.' };
  }

  await dbRun(
    `DELETE FROM stripe_one_time_purchases WHERE email = ? AND product_key = ?`,
    email, productKey,
  );
  await dbRun(
    `UPDATE comp_grants SET revoked_at = ?, revoked_by = ? WHERE email = ? AND product_key = ?`,
    Math.floor(Date.now() / 1000), params.revokedBy.trim().toLowerCase(), email, productKey,
  );
  return { ok: true };
}

/** Full audit log, newest first. Includes revoked grants — that's the point of an audit log. */
export async function listCompGrants(): Promise<CompGrantRow[]> {
  return dbAll<CompGrantRow>(
    `SELECT email, product_key, reason, granted_by, created_at, revoked_at, revoked_by
       FROM comp_grants ORDER BY created_at DESC`,
  );
}
