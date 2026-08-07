/**
 * Server side of the paid Session Manager Field Manual.
 *
 * Responsibilities, and deliberately nothing else:
 *   1. Resolve the release bundle on disk and read its manifest.
 *   2. Answer "is this email entitled?" (one-time purchase of MANUAL_PRODUCT_KEY).
 *   3. Mint + verify short-lived signed download tokens.
 *
 * Why signed tokens at all: a browser `<a download>` / `window.location` can't
 * carry an `Authorization: Bearer` header, so the download endpoint can't use
 * Clerk directly. The authenticated endpoint mints a 5-minute HMAC token bound
 * to (email, version, assetId); the download endpoint verifies that instead.
 * The bundle itself lives under `data/manual/`, NOT `dist/`, so the static
 * plugin can never serve a chapter or PDF by guessed URL.
 */

import crypto from 'crypto';
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

/** Token lifetime. Long enough to click through a download, short enough to not be a share link. */
export const DOWNLOAD_TOKEN_TTL_MS = 5 * 60 * 1000;

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

// ── Signed download tokens ───────────────────────────────────────────────────

let _warnedAboutSecret = false;
/** Per-process fallback so a missing env var degrades to "tokens die on restart", not "no signing". */
const _ephemeralSecret = crypto.randomBytes(32).toString('hex');

function signingSecret(): string {
  const configured = process.env.MANUAL_DOWNLOAD_SECRET ?? process.env.CLERK_SECRET_KEY;
  if (configured) return configured;
  if (!_warnedAboutSecret) {
    _warnedAboutSecret = true;
    console.warn(
      '[manual] MANUAL_DOWNLOAD_SECRET not set — signing download tokens with a ' +
      'per-process key. Tokens issued before a restart or on another instance ' +
      'will be rejected. Set MANUAL_DOWNLOAD_SECRET in production.',
    );
  }
  return _ephemeralSecret;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface DownloadTokenClaims {
  email: string;
  version: string;
  assetId: string;
  exp: number;
}

export function mintDownloadToken(
  claims: Omit<DownloadTokenClaims, 'exp'>,
  now = Date.now(),
): string {
  const payload: DownloadTokenClaims = { ...claims, exp: now + DOWNLOAD_TOKEN_TTL_MS };
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf-8'));
  const sig = b64url(crypto.createHmac('sha256', signingSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyDownloadToken(
  token: string,
  expected: { version: string; assetId: string },
  now = Date.now(),
): DownloadTokenClaims | null {
  const [body, sig] = (token ?? '').split('.');
  if (!body || !sig) return null;

  const want = b64url(crypto.createHmac('sha256', signingSecret()).update(body).digest());
  // Length-mismatched inputs make timingSafeEqual throw, so guard before comparing.
  if (sig.length !== want.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;

  let claims: DownloadTokenClaims;
  try {
    claims = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'));
  } catch {
    return null;
  }

  if (typeof claims.exp !== 'number' || claims.exp < now) return null;
  // A token minted for one asset must never unlock another.
  if (claims.version !== expected.version || claims.assetId !== expected.assetId) return null;
  return claims;
}
