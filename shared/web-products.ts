/**
 * Single source of truth for "web products": paid downloads or bookable
 * services sold at /projects/<slug>/. The Stripe price id is resolved from an env var first,
 * then from a committed default. The release bytes are stored server-side
 * (never in the repo, which is public) and pinned by sha256 so the server can
 * verify what it serves.
 *
 * WEB_PRODUCTS is the only place a web product is declared; routes, the
 * webhook and the landing pages read from it.
 *
 * Keep this file pure data and pure functions — no fs, no env reads, no Stripe
 * SDK imports — so it can load cleanly in the browser bundle and on the server.
 */

export interface WebProductRelease {
  /** semver-ish `major.minor.patch` */
  version: string;
  /** download filename, a `.zip` */
  filename: string;
  bytes: number;
  /** lowercase hex sha256 of the stored zip */
  sha256: string;
}

export interface WebProduct {
  /** URL slug: /projects/<slug>/ */
  slug: string;
  name: string;
  /** product_key written on purchase; always 'wp_' + slug with '-' → '_' */
  productKey: string;
  /** env var holding the Stripe price id, STRIPE_PRICE_WP_* */
  priceEnvVar: string;
  /** public Stripe price id used when the env var is unset */
  defaultPriceId?: string;
  /** price in US cents; the source of truth for one-time Checkout (price_data) and webhook verification */
  amountCents: number;
  /** human price shown on the page, e.g. '$9'; must be the formatted amountCents */
  displayPrice: string;
  /** max downloads per purchase */
  downloadLimit: number;
  /** null until a release has been uploaded */
  release: WebProductRelease | null;
  /** 'download' (zip, default) or 'service' (bookable, no zip) */
  kind?: 'download' | 'service';
  /** 'one_time' (default) or 'month' (recurring; services only) */
  billing?: 'one_time' | 'month';
  /** landing page path under /projects/ when it differs from slug: one slug, or two
   *  joined by '/' for a page nested in another project's bundle; default slug */
  pageSlug?: string;
  /** env var holding the Stripe coupon id for the founding price, STRIPE_COUPON_WP_* */
  foundingCouponEnvVar?: string;
  /** human founding price shown on the page, e.g. '$125' */
  foundingDisplayPrice?: string;
  /** cap on total orders; unlimited when absent */
  maxOrders?: number;
  /** bookable sessions included per purchase (or per month when billed monthly) */
  sessionsPerMonth?: number;
  /** slugs of download products this purchase also entitles */
  includes?: readonly string[];
  /** free sign-in preview zip, pinned by sha256 like release; downloads only */
  preview?: WebProductRelease | null;
}

/** Hard cap on a stored release zip. */
export const MAX_RELEASE_BYTES = 5 * 1024 * 1024;

export const WEB_PRODUCTS: readonly WebProduct[] = [
  {
    slug: 'launch-kit',
    name: 'Bilko Launch Kit',
    productKey: 'wp_launch_kit',
    priceEnvVar: 'STRIPE_PRICE_WP_LAUNCH_KIT',
    defaultPriceId: 'price_1UPEUuR6w0VtQRLTqFklclrS',
    amountCents: 900,
    displayPrice: '$9',
    downloadLimit: 20,
    release: {
      version: '1.0.2',
      filename: 'bilko-launch-kit-1.0.2.zip',
      bytes: 32684,
      sha256: 'a42d69f41be74b8b5cd6cb6532f595a897b937ca5c5178209e433296a30e1c52',
    },
  },
  {
    slug: 'agent-factory-kit',
    name: 'Bilko Agent Factory Kit',
    productKey: 'wp_agent_factory_kit',
    priceEnvVar: 'STRIPE_PRICE_WP_AGENT_FACTORY_KIT',
    amountCents: 300,
    displayPrice: '$3',
    downloadLimit: 20,
    release: {
      version: '1.0.1',
      filename: 'bilko-agent-factory-kit-1.0.1.zip',
      bytes: 60144,
      sha256: '846f731e3c2d4ab906a48bd983ae2ba0356e6f069a759217ad4ca7db11cc31e6',
    },
    pageSlug: 'launch-kit/agent-factory-kit',
    preview: {
      version: '1.0.0',
      filename: 'agent-factory-kit-preview-1.0.0.zip',
      bytes: 3392,
      sha256: '9a21261fee8f61821b3ba7a9c01bb57c16771eaa33fd4a1e1bc4edee01d56e3d',
    },
  },
];

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const SESSION_ID_RE = /^cs_(live|test)_[A-Za-z0-9]{10,250}$/;
const VERSION_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const PRICE_ENV_RE = /^STRIPE_PRICE_WP_[A-Z0-9_]+$/;
const FILENAME_RE = /^[A-Za-z0-9._-]+\.zip$/;
const COUPON_ENV_RE = /^STRIPE_COUPON_WP_[A-Z0-9_]+$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

export function isValidWebProductSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && SLUG_RE.test(slug);
}

/** One slug, or two joined by '/' (a page nested in another project's bundle). */
function isValidPageSlug(path: string): boolean {
  const parts = path.split('/');
  return parts.length <= 2 && parts.every(isValidWebProductSlug);
}

export function isValidCheckoutSessionId(id: unknown): id is string {
  return typeof id === 'string' && SESSION_ID_RE.test(id);
}

export function isValidReleaseVersion(version: unknown): version is string {
  return typeof version === 'string' && VERSION_RE.test(version);
}

export function webProductBySlug(
  slug: string,
  list: readonly WebProduct[] = WEB_PRODUCTS,
): WebProduct | undefined {
  return list.find((p) => p.slug === slug);
}

/** Env var wins; falls back to the committed default (may be undefined). */
export function resolveWebProductPriceId(
  product: WebProduct,
  env: Record<string, string | undefined>,
): string | undefined {
  return env[product.priceEnvVar] || product.defaultPriceId;
}

export function productKind(p: WebProduct): 'download' | 'service' {
  return p.kind ?? 'download';
}

export function productBilling(p: WebProduct): 'one_time' | 'month' {
  return p.billing ?? 'one_time';
}

/** One-time products are charged amountCents inline (price_data); only monthly ones need a Stripe price id. */
export function isWebProductPriced(p: WebProduct, env: Record<string, string | undefined>): boolean {
  return productBilling(p) === 'one_time' || !!resolveWebProductPriceId(p, env);
}

export function productPageSlug(p: WebProduct): string {
  return p.pageSlug ?? p.slug;
}

/** Products whose purchase also entitles the given download slug. */
export function productsIncluding(
  slug: string,
  list: readonly WebProduct[] = WEB_PRODUCTS,
): WebProduct[] {
  return list.filter((p) => p.includes?.includes(slug));
}

export function webProductForPriceId(
  priceId: string | undefined,
  env: Record<string, string | undefined>,
  list: readonly WebProduct[] = WEB_PRODUCTS,
): WebProduct | undefined {
  if (!priceId) return undefined;
  return list.find((p) => resolveWebProductPriceId(p, env) === priceId);
}

/** Cents → '$9' / '$9.50'. */
export function formatAmountCents(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const rem = cents % 100;
  return rem === 0 ? `$${dollars}` : `$${dollars}.${String(rem).padStart(2, '0')}`;
}

function isIntInRange(n: unknown, min: number, max: number): boolean {
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
}

/** One message per problem; empty array means the catalog is valid. */
export function validateWebProducts(list: readonly WebProduct[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const p of list) {
    const tag = `[${p.slug}]`;
    if (seen.has(p.slug)) problems.push(`${tag} duplicate slug`);
    seen.add(p.slug);
    if (!isValidWebProductSlug(p.slug)) problems.push(`${tag} invalid slug`);
    const expectedKey = 'wp_' + p.slug.replace(/-/g, '_');
    if (p.productKey !== expectedKey) {
      problems.push(`${tag} productKey must be ${expectedKey}`);
    }
    if (!PRICE_ENV_RE.test(p.priceEnvVar)) {
      problems.push(`${tag} priceEnvVar must match ${PRICE_ENV_RE}`);
    }
    if (typeof p.amountCents !== 'number' || !Number.isInteger(p.amountCents) || p.amountCents <= 0) {
      problems.push(`${tag} amountCents must be a positive integer`);
    } else if (p.displayPrice !== formatAmountCents(p.amountCents)) {
      problems.push(`${tag} displayPrice must be ${formatAmountCents(p.amountCents)} to match amountCents`);
    }
    const isService = productKind(p) === 'service';
    if (!isIntInRange(p.downloadLimit, isService ? 0 : 1, 100)) {
      problems.push(`${tag} downloadLimit must be an integer in ${isService ? 0 : 1}..100`);
    }
    if (isService && p.release !== null) problems.push(`${tag} service release must be null`);
    if (p.billing === 'month' && !isService) problems.push(`${tag} billing month is for services only`);
    if (p.pageSlug !== undefined && !isValidPageSlug(p.pageSlug)) {
      problems.push(`${tag} invalid pageSlug`);
    }
    if (p.foundingCouponEnvVar !== undefined) {
      if (!COUPON_ENV_RE.test(p.foundingCouponEnvVar)) {
        problems.push(`${tag} foundingCouponEnvVar must match ${COUPON_ENV_RE}`);
      }
      if (!p.foundingDisplayPrice) problems.push(`${tag} foundingCouponEnvVar requires foundingDisplayPrice`);
    }
    if (p.maxOrders !== undefined && !isIntInRange(p.maxOrders, 1, 100)) {
      problems.push(`${tag} maxOrders must be an integer in 1..100`);
    }
    if (p.sessionsPerMonth !== undefined && !isIntInRange(p.sessionsPerMonth, 1, 100)) {
      problems.push(`${tag} sessionsPerMonth must be an integer in 1..100`);
    }
    for (const [label, r] of [['release', p.release], ['preview', p.preview]] as const) {
      if (!r) continue;
      if (!isValidReleaseVersion(r.version)) problems.push(`${tag} ${label} version invalid`);
      if (!FILENAME_RE.test(r.filename)) problems.push(`${tag} ${label} filename invalid`);
      if (!isIntInRange(r.bytes, 1, MAX_RELEASE_BYTES)) {
        problems.push(`${tag} ${label} bytes must be an integer in 1..${MAX_RELEASE_BYTES}`);
      }
      if (!SHA256_RE.test(r.sha256)) problems.push(`${tag} ${label} sha256 invalid`);
    }
    if (p.preview && isService) problems.push(`${tag} preview is for download products only`);
    for (const slug of p.includes ?? []) {
      const target = list.find((q) => q.slug === slug);
      if (slug === p.slug) problems.push(`${tag} includes cannot include itself`);
      else if (!target) problems.push(`${tag} includes unknown product ${slug}`);
      else if (productKind(target) !== 'download') {
        problems.push(`${tag} includes ${slug} must be a download product`);
      }
    }
  }
  return problems;
}
