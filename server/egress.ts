import type { FastifyInstance } from 'fastify';
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

function dayKey(ms: number): string {
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
