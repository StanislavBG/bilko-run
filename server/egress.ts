import type { FastifyInstance, FastifyReply } from 'fastify';
import { readdirSync } from 'fs';
import { join } from 'path';
import { dbRun, dbAll } from './db.js';

// Per-route egress accounting.
//
// Why this exists: the observability dashboard could tell you how many times a
// route was hit and how big each app's *static bundle* was, but nothing
// measured API response bytes. So a route that answers 40 requests a day with
// 300 MB apiece looked identical to one answering 40 requests with 3 KB. That
// mattered the moment the project-feedback GET started returning inline
// base64 screenshots (up to 2 MB per item, up to 1000 items a page) — the
// most expensive endpoint on the host was also the least visible one.
//
// Design constraints:
//   - Key on the ROUTE PATTERN (`/api/projects/:slug/feedback`), never the
//     resolved URL. Keying on the URL makes cardinality unbounded and turns
//     the meter itself into the problem.
//   - Never write to the DB on the request path. Requests accumulate in a
//     process-local map, flushed on a timer. Losing the tail of a bucket on a
//     Render restart is fine: this is capacity signal, not billing.
//   - Never let a metering failure fail a request. Every path swallows.
//   - Never record a wrong zero. A missing row reads as "not measured yet";
//     a zero-byte row for a route that actually shipped megabytes reads as
//     "this is free" — the second is strictly worse, so a stream with no
//     Content-Length gets counted by watching what's actually written to the
//     socket, not skipped.

const FLUSH_MS = 60_000;

interface Bucket { requests: number; bytes: number }

// key: `${date}\0${method}\0${route}`
const pending = new Map<string, Bucket>();
let timer: NodeJS.Timeout | null = null;

export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function recordEgress(date: string, method: string, route: string, bytes: number): void {
  const key = `${date}\0${method}\0${route}`;
  const b = pending.get(key);
  if (b) { b.requests += 1; b.bytes += bytes; }
  else pending.set(key, { requests: 1, bytes });
}

// Concurrent callers (the 60s timer AND /api/admin/egress, which flushes
// on every hit) must never run pruneAssetOverflow's SELECT-then-DELETE
// against overlapping state — that races into double-folding the same
// overflow rows into `_rest`. Collapsing concurrent calls onto one in-flight
// promise makes every flush cycle run start-to-finish before the next one
// reads the table, without needing DB-level locking.
let flushInFlight: Promise<void> | null = null;

export async function flushEgress(): Promise<void> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    try {
      await Promise.all([flushRoutes(), flushAssets()]);
    } finally {
      flushInFlight = null;
    }
  })();
  return flushInFlight;
}

async function flushRoutes(): Promise<void> {
  if (!pending.size) return;
  const batch = [...pending.entries()];
  pending.clear();
  for (const [key, b] of batch) {
    const [date, method, route] = key.split('\0');
    try {
      await dbRun(
        `INSERT INTO api_egress_daily (date, method, route, requests, bytes)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (date, method, route) DO UPDATE SET
           requests = requests + excluded.requests,
           bytes    = bytes    + excluded.bytes`,
        date, method, route, b.requests, b.bytes,
      );
    } catch {
      // Don't re-queue: a persistently failing write would grow `pending`
      // without bound. A dropped minute is an acceptable loss here.
    }
  }
}

// Byte count of whatever Fastify is about to write. Strings are measured in
// UTF-8 bytes, not characters — base64 image payloads are ASCII so the two
// agree there, but non-ASCII feedback text would otherwise undercount.
function byteLengthOfChunk(chunk: unknown, encoding?: unknown): number {
  if (chunk == null) return 0;
  if (Buffer.isBuffer(chunk)) return chunk.length;
  if (chunk instanceof Uint8Array) return chunk.byteLength;
  if (typeof chunk === 'string') {
    return Buffer.byteLength(chunk, typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf8');
  }
  return 0;
}

// Wrap this response's raw write/end so a stream response (no known
// Content-Length up front — createReadStream, sendFile) still gets a real
// byte count instead of the 0 a payload-shape check would return. Wrapping
// the ServerResponse instance (not the shared keep-alive socket) means this
// only ever counts bytes for THIS response, so concurrent requests on the
// same connection can't cross-contaminate each other's count.
function countWrittenBytes(reply: FastifyReply): () => number {
  const raw = reply.raw as unknown as {
    write: (...args: unknown[]) => boolean;
    end: (...args: unknown[]) => unknown;
  };
  let bytes = 0;
  const origWrite = raw.write.bind(raw);
  const origEnd = raw.end.bind(raw);
  raw.write = (chunk?: unknown, encoding?: unknown, ...rest: unknown[]) => {
    try { bytes += byteLengthOfChunk(chunk, encoding); } catch { /* never break the real write */ }
    return origWrite(chunk, encoding, ...rest);
  };
  raw.end = (chunk?: unknown, encoding?: unknown, ...rest: unknown[]) => {
    try { if (typeof chunk !== 'function') bytes += byteLengthOfChunk(chunk, encoding); } catch { /* never break the real end */ }
    return origEnd(chunk, encoding, ...rest);
  };
  return () => bytes;
}

function contentLengthOf(reply: { getHeader(name: string): unknown }): number {
  const h = reply.getHeader('content-length');
  if (typeof h === 'number') return h;
  if (typeof h === 'string') return parseInt(h, 10) || 0;
  return 0;
}

// Static asset egress, bucketed by /projects/<slug>/ — a second metering path
// alongside the /api/* one above, because static traffic is where the bill
// actually goes. PNGs are already compressed and transfer byte-for-byte, while
// JSON/JS gets brotli'd ~3-24x by Render's edge, so on-disk size is a bad
// proxy: a 2.58 MB sprite transfers 2.58 MB, while outdoor-hours' 2.01 MB
// hourly JSON transfers ~87 KB on the wire. Only actual transferred bytes
// tell you who is burning bandwidth (see the game-academy sprite incident
// this meter was built to stop repeating).
const STATIC_ROUTE_PREFIX = 'static:';
// Bounded key for /api/* requests that matched no route (404s, probing) — one
// row total, never one per attempted URL.
const API_NOTFOUND_ROUTE = 'api:_notfound';
let knownSlugs: Set<string> | null = null;

// Called once at boot with the built dist root, so unrecognised /projects/<x>/
// paths bucket into `static:_other` instead of minting a fresh key per guess —
// keeps cardinality bounded to the actual set of published apps.
export function setStaticKnownSlugs(distRoot: string): void {
  try {
    knownSlugs = new Set(
      readdirSync(join(distRoot, 'projects'), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name),
    );
  } catch {
    knownSlugs = new Set();
  }
}

function slugForPath(path: string): string {
  const PREFIX = '/projects/';
  if (!path.startsWith(PREFIX)) return '_host';
  const slug = path.slice(PREFIX.length).split('/')[0];
  if (!slug) return '_host';
  if (knownSlugs) return knownSlugs.has(slug) ? slug : '_other';
  // No known-slug set registered (e.g. tests) — fall back to a shape check so
  // an adversarial path still can't mint arbitrary keys.
  return /^[a-z0-9-]+$/i.test(slug) ? slug : '_other';
}

// ── Per-asset (per-file) heavy-hitter tracking ──────────────────────────────
//
// static:<slug> answers "which PROJECT is heavy"; this answers "which FILE
// under that project is heavy" (the game-academy sprite incident: per-project
// granularity said "game-academy is 116.5 MB", not "these 10 PNGs over 2 MB
// are why" — finding that took manual `du` + `curl`). Keying on the resolved
// URL is exactly the unbounded-cardinality trap this meter's design
// constraints warn against, so this is capped two ways:
//   1. In-memory accumulation caps at ASSET_CARDINALITY_CAP distinct
//      (date, slug, path) keys at any moment; once hit, new paths fold into
//      that slug's `_rest` bucket immediately instead of minting a key.
//   2. On every flush, static_asset_daily is pruned back down to the top
//      ASSET_TOP_N rows per (date, slug) by bytes, with the overflow folded
//      into a `_rest` row — so the table never holds more than
//      ASSET_TOP_N + 1 rows per (date, slug) for longer than one flush
//      interval (60s), regardless of how many distinct files were requested
//      that day.
const ASSET_TOP_N = 50;
const ASSET_CARDINALITY_CAP = 500;
const ASSET_REST_PATH = '_rest';

const pendingAssets = new Map<string, Bucket>(); // key: `${date}\0${slug}\0${path}`

function recordAsset(date: string, slug: string, path: string, bytes: number): void {
  let key = `${date}\0${slug}\0${path}`;
  if (!pendingAssets.has(key) && pendingAssets.size >= ASSET_CARDINALITY_CAP) {
    key = `${date}\0${slug}\0${ASSET_REST_PATH}`;
  }
  const b = pendingAssets.get(key);
  if (b) { b.requests += 1; b.bytes += bytes; }
  else pendingAssets.set(key, { requests: 1, bytes });
}

async function flushAssets(): Promise<void> {
  if (!pendingAssets.size) return;
  const batch = [...pendingAssets.entries()];
  pendingAssets.clear();

  const touched = new Set<string>(); // `${date}\0${slug}`
  for (const [key, b] of batch) {
    const [date, slug, path] = key.split('\0');
    touched.add(`${date}\0${slug}`);
    try {
      await dbRun(
        `INSERT INTO static_asset_daily (date, slug, path, requests, bytes)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (date, slug, path) DO UPDATE SET
           requests = requests + excluded.requests,
           bytes    = bytes    + excluded.bytes`,
        date, slug, path, b.requests, b.bytes,
      );
    } catch {
      // Same tradeoff as flushRoutes: don't re-queue, don't grow unbounded.
    }
  }

  for (const pair of touched) {
    const [date, slug] = pair.split('\0');
    try {
      await pruneAssetOverflow(date, slug);
    } catch {
      // A failed prune just means the table is briefly over-bound for this
      // (date, slug) until the next flush retries it — never fail a response.
    }
  }
}

// Keeps static_asset_daily bounded to ASSET_TOP_N + 1 rows per (date, slug):
// the top ASSET_TOP_N paths by bytes, plus one `_rest` row absorbing the rest.
async function pruneAssetOverflow(date: string, slug: string): Promise<void> {
  const rows = await dbAll<{ path: string; requests: number; bytes: number }>(
    `SELECT path, requests, bytes FROM static_asset_daily
      WHERE date = ? AND slug = ? AND path != ?
      ORDER BY bytes DESC`,
    date, slug, ASSET_REST_PATH,
  );
  if (rows.length <= ASSET_TOP_N) return;

  const overflow = rows.slice(ASSET_TOP_N);
  const overflowBytes = overflow.reduce((n, r) => n + r.bytes, 0);
  const overflowRequests = overflow.reduce((n, r) => n + r.requests, 0);

  await dbRun(
    `INSERT INTO static_asset_daily (date, slug, path, requests, bytes)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (date, slug, path) DO UPDATE SET
       requests = requests + excluded.requests,
       bytes    = bytes    + excluded.bytes`,
    date, slug, ASSET_REST_PATH, overflowRequests, overflowBytes,
  );
  for (const r of overflow) {
    await dbRun(
      `DELETE FROM static_asset_daily WHERE date = ? AND slug = ? AND path = ?`,
      date, slug, r.path,
    );
  }
}

export interface AssetRow { slug: string; path: string; requests: number; bytes: number }

// Top files by bytes over the trailing `days` window, optionally scoped to
// one project slug. `_rest` rows (per slug) surface as a single row so the
// caller can see "and everything else" without it inflating the top list.
export async function topStaticAssets(days = 7, limit = 50, slug?: string): Promise<AssetRow[]> {
  const since = dayKey(Date.now() - days * 86_400_000);
  const rows = slug
    ? await dbAll<AssetRow>(
        `SELECT slug, path, SUM(requests) AS requests, SUM(bytes) AS bytes
           FROM static_asset_daily
          WHERE date >= ? AND slug = ?
          GROUP BY slug, path
          ORDER BY bytes DESC
          LIMIT ?`,
        since, slug, limit,
      )
    : await dbAll<AssetRow>(
        `SELECT slug, path, SUM(requests) AS requests, SUM(bytes) AS bytes
           FROM static_asset_daily
          WHERE date >= ?
          GROUP BY slug, path
          ORDER BY bytes DESC
          LIMIT ?`,
        since, limit,
      );
  return rows;
}

export function registerEgressMeter(app: FastifyInstance, opts: { flush?: boolean } = {}): void {
  // Wrap the raw response early (before routing/handler run) so a streamed
  // /api/* response — no Content-Length known up front — still gets counted
  // by what actually goes out over the wire. Scoped to /api/* only: static
  // responses already get a reliable Content-Length from @fastify/static.
  app.addHook('onRequest', async (req, reply) => {
    try {
      const path = req.url.split('?')[0];
      if (path.startsWith('/api/')) {
        (req as unknown as { __egressBytes?: () => number }).__egressBytes = countWrittenBytes(reply);
      }
    } catch { /* metering must never break a response */ }
  });

  app.addHook('onResponse', async (req, reply) => {
    try {
      const path = req.url.split('?')[0];
      const date = dayKey(Date.now());

      if (path.startsWith('/api/')) {
        const route = (req as { routeOptions?: { url?: string } }).routeOptions?.url;
        const counted = (req as unknown as { __egressBytes?: () => number }).__egressBytes?.();
        // Content-Length is exact when Fastify knows the body up front (JSON,
        // Buffer); for a stream it's typically absent, so fall back to the
        // bytes actually written to this response's socket rather than 0.
        const bytes = req.method === 'HEAD' ? 0 : (contentLengthOf(reply) || counted || 0);
        recordEgress(date, req.method, route ?? API_NOTFOUND_ROUTE, bytes);
        return;
      }

      const slug = slugForPath(path);
      const route = `${STATIC_ROUTE_PREFIX}${slug}`;
      // HEAD has no body — Content-Length still describes the full resource,
      // so counting it here would overstate actual transferred bytes.
      const bytes = req.method === 'HEAD' ? 0 : contentLengthOf(reply);
      recordEgress(date, req.method, route, bytes);

      // Per-file attribution, only for known projects (not _host/_other,
      // which would otherwise mint asset keys for arbitrary/adversarial URLs).
      if (slug !== '_other' && slug !== '_host' && req.method !== 'HEAD') {
        recordAsset(date, slug, path, bytes);
      }
    } catch { /* metering must never break a response */ }
  });

  if (opts.flush !== false && !timer) {
    timer = setInterval(() => { void flushEgress(); }, FLUSH_MS);
    timer.unref?.();
    app.addHook('onClose', async () => {
      if (timer) { clearInterval(timer); timer = null; }
      await flushEgress();
    });
  }
}

export interface EgressRow { method: string; route: string; requests: number; bytes: number; bytesPerRequest: number }

// Top routes by bytes over the trailing `days` window, biggest first.
// bytesPerRequest is the number that actually identifies a bandwidth hog: a
// route can dominate egress on volume (cheap, expected) or on payload size
// (usually a bug — an unpaginated list, or blobs inlined into JSON).
export async function topEgress(days = 7, limit = 25): Promise<EgressRow[]> {
  const since = dayKey(Date.now() - days * 86_400_000);
  const rows = await dbAll<{ method: string; route: string; requests: number; bytes: number }>(
    `SELECT method, route, SUM(requests) AS requests, SUM(bytes) AS bytes
       FROM api_egress_daily
      WHERE date >= ?
      GROUP BY method, route
      ORDER BY bytes DESC
      LIMIT ?`,
    since, limit,
  );
  return rows.map((r) => ({ ...r, bytesPerRequest: r.requests ? Math.round(r.bytes / r.requests) : 0 }));
}
