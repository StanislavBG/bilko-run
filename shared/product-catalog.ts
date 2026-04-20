/**
 * Single source of truth for Stripe products and their mapping to env-var
 * price IDs, used by BOTH the frontend tool registry (to declare which tool
 * grants which product) and the backend Stripe flow (checkout + webhook).
 *
 * Keep this file pure data — no Stripe SDK imports, no runtime side effects —
 * so it can load cleanly in either environment.
 */

/** Stripe product keys — the set of `product_key` values in `stripe_one_time_purchases`. */
export const PRODUCT_KEYS = {
  PAGEROAST_TOKENS: 'pageroast_tokens',
  PAGEROAST_TOKEN_SINGLE: 'pageroast_token_single',
  AUDIENCEDECODER_REPORT: 'audiencedecoder_report',
  CONTENTGRADE_PRO: 'contentgrade_pro',
  CONTENTGRADE_BUSINESS: 'contentgrade_business',
  CONTENTGRADE_TEAM: 'contentgrade_team',
} as const;

export type ProductKey = typeof PRODUCT_KEYS[keyof typeof PRODUCT_KEYS];

/** User-selectable checkout price types (drives the Stripe create-checkout flow). */
export type PriceType =
  | 'contentgrade_pro'
  | 'contentgrade_business'
  | 'contentgrade_team'
  | 'pageroast_tokens'
  | 'pageroast_token_single'
  | 'audiencedecoder_report';

/** Token bundles — Stripe credits this many app tokens when the purchase clears. */
export const TOKENS_PER_BUNDLE = 7;
export const TOKENS_PER_SINGLE = 1;

export interface PriceCatalogEntry {
  /** priceType the checkout endpoint accepts */
  priceType: PriceType;
  /** env var holding the Stripe price ID */
  envVar: string;
  /** product_key written to `stripe_one_time_purchases` */
  productKey: ProductKey;
  mode: 'subscription' | 'payment';
  /** Tokens credited on checkout — undefined means no token grant. */
  tokenAmount?: number;
}

export const PRICE_CATALOG: readonly PriceCatalogEntry[] = [
  { priceType: 'contentgrade_pro',       envVar: 'STRIPE_PRICE_CONTENTGRADE_PRO',      productKey: PRODUCT_KEYS.CONTENTGRADE_PRO,       mode: 'subscription' },
  { priceType: 'contentgrade_business',  envVar: 'STRIPE_PRICE_CONTENTGRADE_BUSINESS', productKey: PRODUCT_KEYS.CONTENTGRADE_BUSINESS,  mode: 'subscription' },
  { priceType: 'contentgrade_team',      envVar: 'STRIPE_PRICE_CONTENTGRADE_TEAM',     productKey: PRODUCT_KEYS.CONTENTGRADE_TEAM,      mode: 'subscription' },
  { priceType: 'pageroast_tokens',       envVar: 'STRIPE_PRICE_TOKENS',                productKey: PRODUCT_KEYS.PAGEROAST_TOKENS,       mode: 'payment', tokenAmount: TOKENS_PER_BUNDLE },
  { priceType: 'pageroast_token_single', envVar: 'STRIPE_PRICE_TOKEN_SINGLE',          productKey: PRODUCT_KEYS.PAGEROAST_TOKENS,       mode: 'payment', tokenAmount: TOKENS_PER_SINGLE },
  { priceType: 'audiencedecoder_report', envVar: 'STRIPE_PRICE_AUDIENCEDECODER',       productKey: PRODUCT_KEYS.AUDIENCEDECODER_REPORT, mode: 'payment' },
];

/** Lookup by priceType (what the frontend checkout request declares). */
export function entryForPriceType(priceType: PriceType): PriceCatalogEntry | undefined {
  return PRICE_CATALOG.find(e => e.priceType === priceType);
}

/**
 * Lookup by resolved Stripe price ID (what the webhook sees on the line item).
 * `env` is passed in rather than read directly so this module stays dependency-free.
 */
export function entryForPriceId(
  priceId: string | undefined,
  env: Record<string, string | undefined>,
): PriceCatalogEntry | undefined {
  if (!priceId) return undefined;
  return PRICE_CATALOG.find(e => env[e.envVar] === priceId);
}
