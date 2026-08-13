import type { FastifyInstance } from 'fastify';
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

export async function flushEgress(): Promise<void> {
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

// Best-effort byte count of whatever Fastify is about to write. Strings are
// measured in UTF-8 bytes, not characters — base64 image payloads are ASCII so
// the two agree there, but non-ASCII feedback text would otherwise undercount.
function sizeOf(payload: unknown): number {
  if (payload == null) return 0;
  if (typeof payload === 'string') return Buffer.byteLength(payload);
  if (Buffer.isBuffer(payload)) return payload.length;
  if (payload instanceof Uint8Array) return payload.byteLength;
  return 0; // streams — unknowable here without consuming them
}

// Static asset egress, bucketed by /projects/<slug>/ — a second metering path
// alongside the /api/* one above, because static traffic is where the bill
// actually goes. PNGs are already compressed and transfer byte-for-byte, while
// JSON/JS gets brotli'd ~3-24x by Render's edge, so on-disk size is a bad
// proxy: a 2.58 MB sprite transfers 2.58 MB, while outdoor-hours' 2.01 MB
// hourly JSON transfers ~87 KB on the wire. Only actual transferred bytes
// tell you who is burning bandwidth (see the game-academy sprite incident
// this meter was built to stop repeating).
//
// @fastify/static serves a stream, so sizeOf(payload) above is useless for
// these responses (it returns 0 for anything that isn't a string/Buffer). Use
// an onResponse hook instead, which fires after the reply is fully written and
// can read the Content-Length header Fastify/Node set for the actual
// response — correct for normal 200s, empty (0) for 304s, and the range
// length for 206 partial-content responses.
const STATIC_ROUTE_PREFIX = 'static:';
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

function contentLengthOf(reply: { getHeader(name: string): unknown }): number {
  const h = reply.getHeader('content-length');
  if (typeof h === 'number') return h;
  if (typeof h === 'string') return parseInt(h, 10) || 0;
  return 0;
}

export function registerEgressMeter(app: FastifyInstance, opts: { flush?: boolean } = {}): void {
  app.addHook('onSend', async (req, reply, payload) => {
    try {
      const route = (req as { routeOptions?: { url?: string } }).routeOptions?.url;
      // No matched route (404s, static files) → don't invent a key for it.
      if (route && route.startsWith('/api/')) {
        recordEgress(dayKey(Date.now()), req.method, route, sizeOf(payload));
      }
    } catch { /* metering must never break a response */ }
    return payload;
  });

  app.addHook('onResponse', async (req, reply) => {
    try {
      // /api/* is fully accounted for by the onSend hook above (route pattern,
      // payload-measured). Don't double-count it here under a static bucket.
      const path = req.url.split('?')[0];
      if (path.startsWith('/api/')) return;
      const slug = slugForPath(path);
      const route = `${STATIC_ROUTE_PREFIX}${slug}`;
      // HEAD has no body — Content-Length still describes the full resource,
      // so counting it here would overstate actual transferred bytes.
      const bytes = req.method === 'HEAD' ? 0 : contentLengthOf(reply);
      recordEgress(dayKey(Date.now()), req.method, route, bytes);
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
