/**
 * Single source of truth for the **Session Manager Field Manual**, read at
 * bilko.run/products/session-manager/manual. It is free — every chapter and
 * every download — as of release 2.0.1; before that it was a one-time purchase.
 *
 * The manual is a *versioned release bundle* authored in the session-manager
 * repo (`session-manager-operations/manual/`) and committed into this repo
 * under `data/manual/releases/<version>/`. Readers always get the LATEST release.
 *
 * Keep this file pure data + pure functions — no fs, no Stripe SDK, no env
 * reads — so it loads identically in the browser bundle and the Fastify server.
 */

import { PRODUCT_KEYS, type ProductKey } from './product-catalog.js';

/**
 * The entitlement a pre-2.0.1 purchase recorded: the `session_manager`
 * one-time purchase (`STRIPE_PRICE_SESSION_MANAGER`). Nothing is sold any
 * more, but it stays wired: existing buyers keep their rows, the chapter
 * route still honours them for any chapter a release marks non-free, and
 * checkout-success resolves a late or in-flight payment to this key instead
 * of falling through to its contentgrade_pro fallback.
 */
export const MANUAL_PRODUCT_KEY: ProductKey = PRODUCT_KEYS.SESSION_MANAGER;

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
  /** One-line summary; public, shown in the table of contents. */
  blurb: string;
  /**
   * Readable by anyone. Every chapter is free from 2.0.1 on; a chapter a
   * release leaves non-free 402s unless the reader has a pre-2.0.1 purchase.
   */
  free?: boolean;
  /** Filename of the chapter's HTML body inside the release directory. */
  file: string;
  /** Screenshot/annotation assets this chapter references, for integrity checks. */
  figures?: string[];
  /** Part/section heading this chapter groups under in the reader nav, if any. */
  part?: string;
}

/** `manifest.json` at the root of `data/manual/releases/<version>/`. */
export interface ManualManifest {
  version: string;
  /** ISO-8601 date the release was cut. */
  releasedAt: string;
  title: string;
  /** Short "what changed in this release" line, shown under the reader's title. */
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
 * The public view of a manifest: chapter titles + blurbs, no bodies and no
 * file paths. Drives the reader's table of contents.
 */
export interface ManualToc {
  version: string;
  releasedAt: string;
  title: string;
  summary: string;
  documentsAppVersion: string;
  chapters: Array<{ slug: string; title: string; blurb: string; free: boolean; part?: string }>;
  assets: Array<{ id: string; label: string; bytes: number }>;
}

/** Formats a `YYYY-MM-DD` release date for display without any local-timezone day shift. */
export function formatManualReleaseDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, { timeZone: 'UTC' });
}

export function tocFromManifest(m: ManualManifest): ManualToc {
  return {
    version: m.version,
    releasedAt: m.releasedAt,
    title: m.title,
    summary: m.summary,
    documentsAppVersion: m.documentsAppVersion,
    chapters: m.chapters.map(c => ({ slug: c.slug, title: c.title, blurb: c.blurb, free: !!c.free, ...(c.part ? { part: c.part } : {}) })),
    assets: m.assets.map(a => ({ id: a.id, label: a.label, bytes: a.bytes })),
  };
}
