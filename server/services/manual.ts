/**
 * Server side of the paid Session Manager Field Manual.
 *
 * Responsibilities, and deliberately nothing else:
 *   1. Resolve the release bundle on disk and read its manifest.
 *   2. Answer "is this email entitled?" (one-time purchase of MANUAL_PRODUCT_KEY).
 *
 * There is deliberately NO download-token machinery here. Entitlement already
 * lives in one durable place — the `stripe_one_time_purchases` row that
 * `hasPurchased` reads — so every route, downloads included, checks that row
 * directly. An earlier revision signed short-lived HMAC download URLs because a
 * browser navigation can't carry an `Authorization` header; that bought nothing
 * except a `MANUAL_DOWNLOAD_SECRET` to configure, rotate, and keep in sync
 * across instances. The client now fetches the asset WITH its bearer token and
 * saves the blob (src/lib/manualClient.ts), so the header problem disappears
 * and so does the secret.
 *
 * The bundle lives under `data/manual/`, NOT `dist/`, so the static plugin can
 * never serve a chapter or PDF by guessed URL.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  MANUAL_PRODUCT_KEY,
  isValidManualVersion,
  isValidManualSlug,
  latestManualVersion,
  type ManualManifest,
  type ManualChapter,
  type ManualAsset,
} from '../../shared/manual-catalog.js';
import { hasPurchased } from './stripe.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Bundle location ──────────────────────────────────────────────────────────

/**
 * `__dirname` differs between local (`server/services/`) and Render
 * (`dist-server/server/services/`), same problem the static plugin solves in
 * server/index.ts. Try the same shape of candidates rather than guessing one.
 */
function manualRoot(): string {
  const candidates = [
    resolve(process.cwd(), 'data', 'manual'),
    resolve(__dirname, '..', '..', 'data', 'manual'),
    resolve(__dirname, '..', '..', '..', 'data', 'manual'),
  ];
  return candidates.find(existsSync) ?? candidates[0];
}

function releasesDir(): string {
  return join(manualRoot(), 'releases');
}

/** Every valid release version present on disk, oldest → newest. */
export function listManualVersions(): string[] {
  const dir = releasesDir();
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter(isValidManualVersion)
      .filter(v => existsSync(join(dir, v, 'manifest.json')))
      .sort((a, b) => (a === b ? 0 : latestManualVersion([a, b]) === b ? -1 : 1));
  } catch {
    return [];
  }
}

// Manifests are immutable once a release is cut, so cache by version forever.
const _manifestCache = new Map<string, ManualManifest>();

export function readManifest(version: string): ManualManifest | null {
  if (!isValidManualVersion(version)) return null;
  const cached = _manifestCache.get(version);
  if (cached) return cached;

  const file = join(releasesDir(), version, 'manifest.json');
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8')) as ManualManifest;
    // A manifest that disagrees with its own directory name would let a release
    // masquerade as another; trust the directory, which is what the URL names.
    parsed.version = version;
    _manifestCache.set(version, parsed);
    return parsed;
  } catch (err: any) {
    console.error(`[manual] manifest for ${version} is unreadable:`, err.message);
    return null;
  }
}

/** The release a buyer gets today. Null when no bundle has been published yet. */
export function latestManifest(): ManualManifest | null {
  const v = latestManualVersion(listManualVersions());
  return v ? readManifest(v) : null;
}

export function findChapter(m: ManualManifest, slug: string): ManualChapter | null {
  if (!isValidManualSlug(slug)) return null;
  return m.chapters.find(c => c.slug === slug) ?? null;
}

export function findAsset(m: ManualManifest, id: string): ManualAsset | null {
  if (!isValidManualSlug(id)) return null;
  return m.assets.find(a => a.id === id) ?? null;
}

/**
 * Resolve a file inside a release, refusing anything that escapes the release
 * directory. `file` always comes from the manifest (never a user path), but the
 * containment check is cheap and makes a bad manifest non-exploitable.
 */
export function resolveReleaseFile(version: string, file: string): string | null {
  if (!isValidManualVersion(version)) return null;
  const base = join(releasesDir(), version);
  const full = resolve(base, file);
  if (!full.startsWith(resolve(base) + '/')) return null;
  if (!existsSync(full) || !statSync(full).isFile()) return null;
  return full;
}

export function readChapterHtml(version: string, chapter: ManualChapter): string | null {
  const full = resolveReleaseFile(version, chapter.file);
  if (!full) return null;
  try {
    return readFileSync(full, 'utf-8');
  } catch {
    return null;
  }
}

// ── Entitlement ──────────────────────────────────────────────────────────────

/**
 * One-time purchase of MANUAL_PRODUCT_KEY = lifetime access to the LATEST
 * release. There is no per-version entitlement by design — "buy once, keep
 * getting updates" is the product.
 */
export async function isEntitledToManual(email: string): Promise<boolean> {
  const normalized = (email ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return hasPurchased(normalized, MANUAL_PRODUCT_KEY);
}
