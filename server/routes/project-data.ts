import type { FastifyInstance } from 'fastify';
import { dbGet, dbRun } from '../db.js';

// Per-project live data snapshot endpoint.
//
// Why this exists: sibling apps (e.g. social-signals-trader's dashboard) used to
// publish fresh data by committing a regenerated data.js into this repo every
// ~30 min, which rebuilt the whole site and buried the git history under bot
// commits. Instead, the app now POSTs its latest snapshot here and the live page
// fetches it at load — no commit, no rebuild. The shell still ships via git; only
// the DATA flows through this endpoint.
//
//   GET  /api/projects/:slug/snapshot   public  → latest snapshot JSON (or 404)
//   POST /api/projects/:slug/snapshot   authed  → replace the snapshot
//
// Auth is a shared-secret bearer (PROJECT_SNAPSHOT_TOKEN) rather than a Clerk
// session, because the publisher is an unattended cron, not a browser. Storage is
// the libsql control DB (Turso-backed on Render → survives redeploys); on a cold
// DB the GET 404s and the page falls back to its bundled baseline data.js.

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_BYTES = 6_000_000; // snapshot is ~0.5MB today; cap generously

interface SnapshotRow {
  payload: string;
  updated_at: number;
}

export function registerProjectDataRoutes(app: FastifyInstance): void {
  // ── public read ──────────────────────────────────────────────────────────
  app.get('/api/projects/:slug/snapshot', async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;
    if (!SLUG_RE.test(slug)) return reply.code(400).send({ error: 'bad slug' });

    const row = await dbGet<SnapshotRow>(
      'SELECT payload, updated_at FROM project_snapshots WHERE slug = ?',
      slug,
    );
    if (!row) return reply.code(404).send({ error: 'no snapshot yet' });

    // Short cache — the publisher refreshes every few minutes; let CDN/browser
    // hold it briefly but not pin a stale copy.
    reply.header('cache-control', 'public, max-age=60');
    reply.header('content-type', 'application/json; charset=utf-8');
    reply.header('x-snapshot-updated-at', String(row.updated_at));
    // payload is stored as a JSON string — send verbatim (no re-stringify).
    return reply.send(row.payload);
  });

  // ── authed write ─────────────────────────────────────────────────────────
  app.post(
    '/api/projects/:slug/snapshot',
    { bodyLimit: 8 * 1024 * 1024 },
    async (req, reply) => {
      const expected = process.env.PROJECT_SNAPSHOT_TOKEN;
      if (!expected) return reply.code(503).send({ error: 'snapshot ingest disabled (no token configured)' });

      const auth = String(req.headers['authorization'] || '');
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!token || token !== expected) return reply.code(401).send({ error: 'unauthorized' });

      const slug = (req.params as { slug: string }).slug;
      if (!SLUG_RE.test(slug)) return reply.code(400).send({ error: 'bad slug' });

      const body = req.body as { globals?: Record<string, unknown> } | undefined;
      if (!body || typeof body !== 'object' || typeof body.globals !== 'object' || body.globals === null) {
        return reply.code(400).send({ error: 'body must be a JSON object with a "globals" object' });
      }

      const payload = JSON.stringify(body);
      if (payload.length > MAX_BYTES) {
        return reply.code(413).send({ error: `snapshot too large (${payload.length} > ${MAX_BYTES})` });
      }

      const now = Math.floor(Date.now() / 1000);
      await dbRun(
        `INSERT INTO project_snapshots (slug, payload, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
        slug, payload, now,
      );
      return reply.send({ ok: true, slug, bytes: payload.length, updated_at: now });
    },
  );
}
