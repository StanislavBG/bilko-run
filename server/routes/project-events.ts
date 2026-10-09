import type { FastifyInstance, FastifyReply } from 'fastify';
import { dbAll, dbRun } from '../db.js';

// Per-project live EVENT STREAM — the append-only sibling of the JSON-globals
// snapshot in project-data.ts.
//
// Why this exists: dashboard/live-events.js (in social-signals-trader) polls
// data-events.ndjson with a byte `Range: bytes=<consumed>-` cursor so an idle
// tab costs a 416 instead of refetching the whole file (see that file's
// BANDWIDTH CONTRACT comment). That file used to be git-mirrored into this
// repo's public/ dir alongside the dashboard shell, but publish-to-bilko.sh
// deliberately excludes generated data from that mirror (mirroring a file
// that changes every trader tick was the 30-min bot-commit loop retired for
// data.js) — so the committed copy is a frozen cold-start artifact and
// appended rows never reached the live page.
//
// Instead the trader POSTs each new row here as it's written locally, and GET
// serves the SAME byte-Range/416 contract the client already polls for, from
// a durable store (Render's filesystem is ephemeral across redeploys, unlike
// project_snapshots' DB-backed sibling). On a cold slug (nothing synced yet)
// GET falls back to @fastify/static's reply.sendFile against the committed
// on-disk copy, so a fresh deploy still renders the cold-start fallback with
// native Range support.
//
//   POST /api/projects/:slug/events            authed  → append one row
//   GET  /projects/:slug/data-events.ndjson    public  → Range-capable read
//
// Auth mirrors project-data.ts: a shared-secret bearer (PROJECT_SNAPSHOT_TOKEN)
// since the publisher is an unattended cron/trade-event write, not a browser.

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_LINE_BYTES = 32_000; // one ndjson row; today's rows run ~200 bytes
const KEEP_PER_SLUG = 5000; // trims on every write so a stuck publisher can't grow this forever

const CACHE_TTL_MS = 5 * 60 * 1000;

interface EventRow {
  event_id: number;
  line: string;
}

// Built ndjson body per slug. Repeat GETs (and Range polls) are served from
// here without a DB query; the POST for a slug drops its entry, and entries
// expire after CACHE_TTL_MS as a backstop for writes that bypass this route.
const bodyCache = new Map<string, { buf: Buffer; builtAt: number }>();
// Bumped on every write so a GET whose DB read raced a POST can't cache the
// pre-write body after the POST already invalidated.
const writeVersion = new Map<string, number>();

export function clearProjectEventsCache(): void {
  bodyCache.clear();
}

export function registerProjectEventsRoutes(app: FastifyInstance): void {
  // ── authed write ─────────────────────────────────────────────────────────
  app.post('/api/projects/:slug/events', async (req, reply) => {
    const expected = process.env.PROJECT_SNAPSHOT_TOKEN;
    if (!expected) return reply.code(503).send({ error: 'event ingest disabled (no token configured)' });

    const auth = String(req.headers['authorization'] || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token || token !== expected) return reply.code(401).send({ error: 'unauthorized' });

    const slug = (req.params as { slug: string }).slug;
    if (!SLUG_RE.test(slug)) return reply.code(400).send({ error: 'bad slug' });

    const body = req.body as { id?: unknown; line?: unknown } | undefined;
    const id =
      body && typeof body.id === 'number' && Number.isInteger(body.id) && body.id > 0 ? body.id : null;
    const line = body && typeof body.line === 'string' ? body.line.trim() : '';
    if (!id || !line) {
      return reply.code(400).send({ error: 'body must be {id: positive int, line: non-empty string}' });
    }
    if (line.length > MAX_LINE_BYTES) {
      return reply.code(413).send({ error: `line too large (${line.length} > ${MAX_LINE_BYTES})` });
    }
    try {
      JSON.parse(line);
    } catch {
      return reply.code(400).send({ error: 'line must be a single JSON object' });
    }

    const now = Math.floor(Date.now() / 1000);
    const invalidate = () => {
      writeVersion.set(slug, (writeVersion.get(slug) ?? 0) + 1);
      bodyCache.delete(slug);
    };
    // Invalidate before and after the writes: before so concurrent GETs don't
    // keep serving the old body, after so a GET that read mid-write can't
    // leave a partial body cached.
    invalidate();
    try {
      // INSERT OR IGNORE — a retried POST (network hiccup) for an id already
      // stored must not error or duplicate the row.
      await dbRun(
        'INSERT OR IGNORE INTO project_events (slug, event_id, line, created_at) VALUES (?, ?, ?, ?)',
        slug, id, line, now,
      );
      await dbRun(
        `DELETE FROM project_events WHERE slug = ? AND event_id NOT IN (
           SELECT event_id FROM project_events WHERE slug = ? ORDER BY event_id DESC LIMIT ?
         )`,
        slug, slug, KEEP_PER_SLUG,
      );
    } finally {
      invalidate();
    }
    return reply.send({ ok: true, slug, id });
  });

  // ── public, Range-capable read ──────────────────────────────────────────
  app.get('/projects/:slug/data-events.ndjson', async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;
    if (!SLUG_RE.test(slug)) return reply.code(400).send({ error: 'bad slug' });

    let body: Buffer | undefined;
    const cached = bodyCache.get(slug);
    if (cached && Date.now() - cached.builtAt < CACHE_TTL_MS) {
      body = cached.buf;
    } else {
      bodyCache.delete(slug);
      const version = writeVersion.get(slug) ?? 0;
      const rows = await dbAll<EventRow>(
        'SELECT event_id, line FROM project_events WHERE slug = ? ORDER BY event_id ASC',
        slug,
      );
      if (rows.length > 0) {
        body = Buffer.from(rows.map((r) => r.line).join('\n') + '\n', 'utf-8');
        if ((writeVersion.get(slug) ?? 0) === version) {
          bodyCache.set(slug, { buf: body, builtAt: Date.now() });
        }
      }
    }

    if (!body) {
      // Nothing synced server-side yet (fresh deploy, or a slug this route
      // has never received a POST for) — fall back to the committed
      // cold-start copy on disk, still Range-capable via @fastify/static.
      const sendFile = (reply as FastifyReply & { sendFile?: (p: string) => FastifyReply }).sendFile;
      if (typeof sendFile === 'function') {
        return sendFile.call(reply, `projects/${slug}/data-events.ndjson`);
      }
      return reply.code(404).send({ error: 'no events yet' });
    }

    const total = body.length;

    reply.header('accept-ranges', 'bytes');
    reply.header('content-type', 'application/x-ndjson; charset=utf-8');
    // Never CDN/browser-cache — a stale cached copy would silently serve the
    // wrong slice for a byte offset the cache never saw.
    reply.header('cache-control', 'no-store');

    const rangeHeader = req.headers['range'];
    if (typeof rangeHeader === 'string') {
      const m = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader.trim());
      const start = m ? parseInt(m[1], 10) : NaN;
      if (!m || Number.isNaN(start) || start >= total) {
        reply.header('content-range', `bytes */${total}`);
        return reply.code(416).send();
      }
      const end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
      const slice = body.subarray(start, end + 1);
      reply.header('content-range', `bytes ${start}-${end}/${total}`);
      return reply.code(206).send(slice);
    }

    return reply.code(200).send(body);
  });
}
