import { createHash } from 'crypto';
import { readdirSync, readFileSync, statSync, utimesSync } from 'fs';
import { extname, join, sep } from 'path';

/**
 * Static-asset caching policy for the dist tree.
 *
 * Two defects this module fixes, both of which forced every static request to
 * be billed as Render origin egress:
 *
 *  1. `@fastify/static` was registered with no cache policy, so `@fastify/send`
 *     emitted `cache-control: public, max-age=0` on every file. Cloudflare
 *     reported `cf-cache-status: DYNAMIC` for the entire tree — nothing was
 *     edge-cached, and browsers revalidated on every page view.
 *
 *  2. `@fastify/send`'s default ETag is `W/"<size>-<mtime>"`. A git checkout on
 *     deploy rewrites every file's mtime whether or not its contents changed,
 *     so every deploy invalidated every ETag for every visitor. With published
 *     projects republishing on a 30-minute cron, that is ~48 full cache resets
 *     a day for assets that never changed.
 *
 * `normalizeStaticMtimes()` fixes (2) at the source: it rewrites each file's
 * mtime to a value derived from a hash of its *contents*, so send's size+mtime
 * ETag becomes content-addressed without having to reimplement send's
 * conditional-GET handling (send computes and compares its ETag internally,
 * before `setHeaders` ever runs, so an ETag written from `setHeaders` would
 * never produce a 304).
 *
 * `staticCacheControl()` fixes (1) via `setHeaders`. That only works because
 * the plugin is registered with `cacheControl: false`: `@fastify/static` calls
 * `setHeaders(reply.raw, ...)` and then `reply.headers(sendHeaders)`, and the
 * latter wins on key collisions — so send must be told not to emit its own
 * `Cache-Control` at all.
 */

/** Vite's content-hashed build output: `name-[hash].js`, `index-[hash].css`, … */
const HASHED_ASSET = /-([A-Za-z0-9_-]{8})\.[a-z0-9]+$/;

/**
 * True only for a build artifact whose filename encodes its content hash, so
 * that marking it immutable-for-a-year can never strand a stale copy.
 *
 * Two guards, both load-bearing:
 *  - the file must live under an `assets/` directory (Vite's default
 *    `assetsDir`), so a hand-published file that happens to end in eight word
 *    characters isn't swept in; and
 *  - the eight-character suffix must contain a digit, capital, `_` or `-`.
 *    Vite's hashes are base64url and effectively always do; ordinary English
 *    words don't. Without this, `data-extended.js` — a file regenerated on
 *    every publish — reads as content-hashed and gets cached for a year.
 */
function isImmutableAsset(filePath: string): boolean {
  const normalized = filePath.split(sep).join('/');
  if (!normalized.includes('/assets/')) return false;
  const hash = HASHED_ASSET.exec(normalized)?.[1];
  return hash !== undefined && /[A-Z0-9_-]/.test(hash);
}

const YEAR = 31536000;
const DAY = 86400;

const MEDIA_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp4', '.webm', '.mp3',
]);

/**
 * Cache lifetime for a file served out of the dist tree.
 *
 * - Content-hashed bundles are immutable: the filename changes when the bytes
 *   do, so a year is safe and a redeploy never re-downloads them.
 * - HTML is the version pointer for everything else. It must revalidate on
 *   every view, or a publish would not become visible until the TTL expired.
 *   Revalidation is cheap now that ETags survive deploys — a 304 with no body.
 * - Media rarely changes and is never the thing a publish needs to invalidate.
 * - Everything else (unhashed project bundles: `app.jsx`, `styles.css`,
 *   generated `data-*.js`) gets a short shared lifetime. Ten minutes bounds a
 *   publish's visible staleness well inside the 30-minute publish cron while
 *   still collapsing the ~40 asset requests of a page view down to one.
 */
export function staticCacheControl(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.html') return 'public, max-age=0, must-revalidate';
  if (isImmutableAsset(filePath)) return `public, max-age=${YEAR}, immutable`;
  if (MEDIA_EXT.has(ext)) return `public, max-age=${DAY}`;
  return 'public, max-age=600';
}

/**
 * `setHeaders` callback for `@fastify/static`.
 *
 * Typed structurally rather than as `ServerResponse`: the plugin hands its
 * callback a narrowed `SetHeadersResponse`, which exposes `setHeader` but not
 * the rest of the Node response surface.
 */
export function setStaticCacheHeaders(
  res: { setHeader(name: string, value: string): void },
  filePath: string,
): void {
  res.setHeader('Cache-Control', staticCacheControl(filePath));
}

/**
 * Deterministic mtime for a file, derived from its content hash.
 *
 * Mapped into a fixed 20-year window starting 2000-01-01 UTC so the value is
 * always a plausible past date (a future mtime confuses heuristic caches and
 * `If-Modified-Since` comparisons). The date itself is meaningless — it exists
 * only so that `size-mtime` identifies content rather than checkout time.
 */
function contentMtimeMs(contents: Buffer): number {
  const digest = createHash('sha1').update(contents).digest();
  const n = digest.readUInt32BE(0) * 0x10000 + digest.readUInt16BE(4); // 48 bits
  const EPOCH_2000 = 946684800000;
  const WINDOW = 20 * 365 * DAY * 1000;
  return EPOCH_2000 + (n % WINDOW);
}

export interface NormalizeResult {
  files: number;
  bytes: number;
  changed: number;
  ms: number;
}

/**
 * Rewrite every file's mtime under `root` to a content-derived value.
 *
 * Idempotent: a file whose mtime already matches its content hash is left
 * alone, so a redeploy of unchanged files is a no-op and their ETags — and
 * therefore every visitor's cached copy — survive.
 *
 * Runs once at boot, before the static plugin is registered. Cost is one full
 * read of the dist tree; failures on individual files are non-fatal (the file
 * just keeps its checkout mtime and behaves as it did before).
 */
export function normalizeStaticMtimes(root: string): NormalizeResult {
  const started = Date.now();
  const result: NormalizeResult = { files: 0, bytes: 0, changed: 0, ms: 0 };

  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const stat = statSync(full);
        const contents = readFileSync(full);
        result.files += 1;
        result.bytes += stat.size;
        const target = contentMtimeMs(contents);
        // Second resolution is all `Last-Modified`/`If-Modified-Since` carry,
        // and send's ETag reads getTime() — compare at ms but tolerate the
        // filesystem's own rounding.
        if (Math.abs(stat.mtimeMs - target) < 1) continue;
        const seconds = target / 1000;
        utimesSync(full, seconds, seconds);
        result.changed += 1;
      } catch {
        // Unreadable file — leave it as-is rather than failing boot.
      }
    }
  };

  walk(root);
  result.ms = Date.now() - started;
  return result;
}
