/**
 * Server side of the Session Manager Field Manual (free as of release 2.0.1).
 *
 * Responsibilities, and deliberately nothing else:
 *   1. Resolve the release bundle on disk and read its manifest.
 *   2. Answer "does this email hold a pre-2.0.1 purchase?" (MANUAL_PRODUCT_KEY),
 *      which the chapter route still honours for any chapter a release marks
 *      non-free.
 *
 * The bundle lives under `data/manual/`, NOT `dist/`, so only the manual
 * routes serve it: a chapter or asset is reachable solely through the
 * manifest, never by a guessed static URL.
 */

import { existsSync } from 'fs';
import { access, readFile, readdir, stat } from 'fs/promises';
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

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Every valid release version present on disk, oldest → newest. */
export async function listManualVersions(): Promise<string[]> {
  const dir = releasesDir();
  try {
    const names = (await readdir(dir)).filter(isValidManualVersion);
    const withManifest = await Promise.all(
      names.map(async v => ((await exists(join(dir, v, 'manifest.json'))) ? v : null)),
    );
    return withManifest
      .filter((v): v is string => v !== null)
      .sort((a, b) => (a === b ? 0 : latestManualVersion([a, b]) === b ? -1 : 1));
  } catch {
    return [];
  }
}

// The bundle only changes on deploy, so the latest release is resolved once per
// process. A miss (no bundle yet) is not memoized, so a later publish is seen.
let _latestVersion: Promise<string | null> | null = null;

function latestVersion(): Promise<string | null> {
  if (!_latestVersion) {
    _latestVersion = listManualVersions().then(vs => {
      const v = latestManualVersion(vs);
      if (!v) _latestVersion = null;
      return v;
    });
  }
  return _latestVersion;
}

// Manifests are immutable once a release is cut, so cache by version forever.
const _manifestCache = new Map<string, ManualManifest>();

export async function readManifest(version: string): Promise<ManualManifest | null> {
  if (!isValidManualVersion(version)) return null;
  const cached = _manifestCache.get(version);
  if (cached) return cached;

  const file = join(releasesDir(), version, 'manifest.json');
  try {
    const parsed = JSON.parse(await readFile(file, 'utf-8')) as ManualManifest;
    // A manifest that disagrees with its own directory name would let a release
    // masquerade as another; trust the directory, which is what the URL names.
    parsed.version = version;
    _manifestCache.set(version, parsed);
    return parsed;
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      console.error(`[manual] manifest for ${version} is unreadable:`, err.message);
    }
    return null;
  }
}

/** The release every reader gets today. Null when no bundle has been published yet. */
export async function latestManifest(): Promise<ManualManifest | null> {
  const v = await latestVersion();
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
export async function resolveReleaseFile(version: string, file: string): Promise<string | null> {
  if (!isValidManualVersion(version)) return null;
  const base = join(releasesDir(), version);
  const full = resolve(base, file);
  if (!full.startsWith(resolve(base) + '/')) return null;
  try {
    if (!(await stat(full)).isFile()) return null;
  } catch {
    return null;
  }
  return full;
}

// Release files are immutable, so chapter bodies are kept in memory. Total size
// is capped; past the cap a file is read straight from disk without caching.
const FILE_CACHE_MAX_BYTES = 20 * 1024 * 1024;
const _fileCache = new Map<string, Buffer>();
let _fileCacheBytes = 0;

async function readCached(full: string): Promise<Buffer> {
  const hit = _fileCache.get(full);
  if (hit) return hit;
  const buf = await readFile(full);
  if (_fileCacheBytes + buf.length <= FILE_CACHE_MAX_BYTES && !_fileCache.has(full)) {
    _fileCache.set(full, buf);
    _fileCacheBytes += buf.length;
  }
  return buf;
}

export async function readChapterHtml(version: string, chapter: ManualChapter): Promise<string | null> {
  const full = await resolveReleaseFile(version, chapter.file);
  if (!full) return null;
  try {
    return (await readCached(full)).toString('utf-8');
  } catch {
    return null;
  }
}

// ── Entitlement ──────────────────────────────────────────────────────────────

/**
 * Whether this email holds a one-time purchase of MANUAL_PRODUCT_KEY, bought
 * before the manual went free. Never version-scoped: a buyer's row covers
 * the LATEST release.
 */
export async function isEntitledToManual(email: string): Promise<boolean> {
  const normalized = (email ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return hasPurchased(normalized, MANUAL_PRODUCT_KEY);
}
