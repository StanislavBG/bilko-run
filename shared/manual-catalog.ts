/**
 * Single source of truth for the paid **Session Manager Field Manual** — the
 * $19.99 digital run-book sold at bilko.run/manual.
 *
 * The manual is a *versioned release bundle* authored in the session-manager
 * repo (`session-manager-operations/manual/`) and committed into this repo
 * under `data/manual/releases/<version>/`. The buyer gets the LATEST release,
 * forever — that's the product promise, so entitlement is never version-scoped.
 *
 * Keep this file pure data + pure functions — no fs, no Stripe SDK, no env
 * reads — so it loads identically in the browser bundle and the Fastify server.
 */

import { PRODUCT_KEYS, type ProductKey } from './product-catalog.js';

/**
 * The entitlement that unlocks the manual.
 *
 * Deliberately the ALREADY-WIRED `session_manager` one-time purchase
 * (`STRIPE_PRICE_SESSION_MANAGER`, $19.99) rather than a new SKU: the thing
 * that $19.99 buys IS the manual — the app itself is free on npm via
 * `npx claude-code-session-manager@latest`. Introducing a second price would
 * strand every existing buyer outside the product they already paid for.
 */
export const MANUAL_PRODUCT_KEY: ProductKey = PRODUCT_KEYS.SESSION_MANAGER;

/** The priceType the checkout endpoint accepts for the manual. */
export const MANUAL_PRICE_TYPE = 'session_manager' as const;

/** Display price. The authoritative amount lives in Stripe; this is copy. */
export const MANUAL_PRICE_LABEL = '$19.99';

export const MANUAL_TITLE = 'The Session Manager Field Manual';

/** A downloadable artifact of one release (PDF, EPUB, offline HTML bundle…). */
export interface ManualAsset {
  /** URL-safe id, unique within the release. Also the on-disk filename. */
  id: string;
  label: string;
  /** Filename on disk inside the release directory. */
  file: string;
  mime: string;
  bytes: number;
}

/** One chapter of the run-book — typically one Session Manager tab. */
export interface ManualChapter {
  slug: string;
  title: string;
  /** One-line summary, safe to show to NON-buyers on the sales page. */
  blurb: string;
  /**
   * Free preview chapters are readable without an entitlement — they're the
   * marketing sample. Everything else 402s for anyone who hasn't bought.
   */
  free?: boolean;
  /** Filename of the chapter's HTML body inside the release directory. */
  file: string;
  /** Screenshot/annotation assets this chapter references, for integrity checks. */
  figures?: string[];
}

/** `manifest.json` at the root of `data/manual/releases/<version>/`. */
export interface ManualManifest {
  version: string;
  /** ISO-8601 date the release was cut. */
  releasedAt: string;
  title: string;
  /** Short "what changed in this release" line, shown to returning buyers. */
  summary: string;
  /** Version of session-manager this release documents. */
  documentsAppVersion: string;
  chapters: ManualChapter[];
  assets: ManualAsset[];
}

/** Semver-ish comparator good enough for `MAJOR.MINOR.PATCH` release dirs. */
export function compareManualVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Newest version string from a list of release directory names. */
export function latestManualVersion(versions: readonly string[]): string | null {
  if (versions.length === 0) return null;
  return [...versions].sort(compareManualVersions).at(-1) ?? null;
}

/** A release dir name must be a plain semver triple — never a path segment. */
export function isValidManualVersion(v: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(v);
}

/** Chapter/asset ids are used to build file paths — keep them opaque and flat. */
export function isValidManualSlug(s: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(s);
}

/**
 * The non-entitled view of a manifest: chapter titles + blurbs, no bodies.
 * Drives the sales page's table-of-contents so the buyer sees exactly what
 * they get before paying.
 */
export interface ManualToc {
  version: string;
  releasedAt: string;
  title: string;
  summary: string;
  documentsAppVersion: string;
  chapters: Array<{ slug: string; title: string; blurb: string; free: boolean }>;
  assets: Array<{ id: string; label: string; bytes: number }>;
}

export function tocFromManifest(m: ManualManifest): ManualToc {
  return {
    version: m.version,
    releasedAt: m.releasedAt,
    title: m.title,
    summary: m.summary,
    documentsAppVersion: m.documentsAppVersion,
    chapters: m.chapters.map(c => ({ slug: c.slug, title: c.title, blurb: c.blurb, free: !!c.free })),
    assets: m.assets.map(a => ({ id: a.id, label: a.label, bytes: a.bytes })),
  };
}
