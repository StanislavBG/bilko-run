/**
 * Single source of truth for "web products": paid downloads sold at
 * /projects/<slug>/. The Stripe price id is resolved from an env var first,
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
  /** human price shown on the page, e.g. '$9' */
  displayPrice: string;
  /** max downloads per purchase */
  downloadLimit: number;
  /** null until a release has been uploaded */
  release: WebProductRelease | null;
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
    displayPrice: '$9',
    downloadLimit: 20,
    release: {
      version: '1.0.0',
      filename: 'bilko-launch-kit-1.0.0.zip',
      bytes: 33920,
      sha256: 'f74e8e96d7f9eb138d1c60af5e01441a57a44741dbf047a23a572925092efa4e',
    },
  },
];

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const SESSION_ID_RE = /^cs_(live|test)_[A-Za-z0-9]{10,250}$/;
const VERSION_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const PRICE_ENV_RE = /^STRIPE_PRICE_WP_[A-Z0-9_]+$/;
const FILENAME_RE = /^[A-Za-z0-9._-]+\.zip$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

export function isValidWebProductSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && SLUG_RE.test(slug);
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

export function webProductForPriceId(
  priceId: string | undefined,
  env: Record<string, string | undefined>,
  list: readonly WebProduct[] = WEB_PRODUCTS,
): WebProduct | undefined {
  if (!priceId) return undefined;
  return list.find((p) => resolveWebProductPriceId(p, env) === priceId);
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
    if (!isIntInRange(p.downloadLimit, 1, 100)) {
      problems.push(`${tag} downloadLimit must be an integer in 1..100`);
    }
    const r = p.release;
    if (r) {
      if (!isValidReleaseVersion(r.version)) problems.push(`${tag} release version invalid`);
      if (!FILENAME_RE.test(r.filename)) problems.push(`${tag} release filename invalid`);
      if (!isIntInRange(r.bytes, 1, MAX_RELEASE_BYTES)) {
        problems.push(`${tag} release bytes must be an integer in 1..${MAX_RELEASE_BYTES}`);
      }
      if (!SHA256_RE.test(r.sha256)) problems.push(`${tag} release sha256 invalid`);
    }
  }
  return problems;
}
