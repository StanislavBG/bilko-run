import type { FastifyInstance } from 'fastify';
import { dbAll, dbRun } from '../db.js';

// Per-project user-feedback endpoint — the receiving half of a sibling app's
// in-page feedback widget.
//
// Why this exists: social-signals-trader's dashboard grew a "Leave feedback"
// button on every card, position row and trade-detail page. The browser has
// nowhere to send that, and the app has no server of its own — it consumes
// bilko.run. This is the sibling of the snapshot route next door: same
// slug-scoping, same shared-secret bearer for the authed side.
//
//   POST /api/projects/:slug/feedback   PUBLIC → store one submission
//   GET  /api/projects/:slug/feedback   authed → drain it for local analysis
//
// The POST is deliberately unauthenticated — anyone visiting the public page
// may file feedback (a login is a later decision, not this one). That makes
// server-side hygiene load-bearing: a body cap, a per-IP rate limit, and
// strict field validation. Submitted text is stored RAW and never rendered by
// this server; any future UI that displays it must escape it.
//
// The contract this implements is authored in the sibling repo:
//   ~/Projects/social-signals-trader/docs/feedback-api-contract.md

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const KINDS = new Set(['component', 'position', 'trade', 'page']);
const TYPES = new Set(['bug', 'feature', 'feedback']);

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 4_000;
const MAX_LABEL = 200;
const MAX_ID = 200;
const MAX_ROUTE = 200;
const MAX_IMAGE_BYTES = 2_000_000; // matches the client's post-downscale cap
const BODY_LIMIT = 4 * 1024 * 1024;

// Per-IP token bucket, in-process. Deliberately not in the DB: this is abuse
// damping, not accounting, and a Render restart resetting it is harmless.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) hits.clear(); // crude bound; never grows unbounded
  return recent.length > RATE_MAX;
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > max) return null;
  return s;
}

interface FeedbackRow {
  id: string;
  slug: string;
  target_kind: string;
  target_id: string;
  target_label: string | null;
  route: string | null;
  type: string;
  title: string;
  description: string;
  image_mime: string | null;
  image_data: string | null;
  client_json: string | null;
  snapshot_generated_at: string | null;
  created_at: number;
}

export function registerProjectFeedbackRoutes(app: FastifyInstance): void {
  // ── public write ─────────────────────────────────────────────────────────
  app.post('/api/projects/:slug/feedback', { bodyLimit: BODY_LIMIT }, async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;
    if (!SLUG_RE.test(slug)) return reply.code(400).send({ error: 'bad slug' });

    const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    if (rateLimited(ip)) return reply.code(429).send({ error: 'too many submissions, try again shortly' });

    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object') return reply.code(400).send({ error: 'body must be a JSON object' });

    const target = body.target as Record<string, unknown> | undefined;
    if (!target || typeof target !== 'object') return reply.code(400).send({ error: 'target is required' });

    const kind = typeof target.kind === 'string' ? target.kind : '';
    if (!KINDS.has(kind)) return reply.code(400).send({ error: `target.kind must be one of ${[...KINDS].join(', ')}` });

    const targetId = str(target.id, MAX_ID);
    if (!targetId) return reply.code(400).send({ error: 'target.id is required' });

    const type = typeof body.type === 'string' ? body.type : '';
    if (!TYPES.has(type)) return reply.code(400).send({ error: `type must be one of ${[...TYPES].join(', ')}` });

    const title = str(body.title, MAX_TITLE);
    if (!title) return reply.code(400).send({ error: `title is required (max ${MAX_TITLE} chars)` });

    const description = str(body.description, MAX_DESCRIPTION);
    if (!description) return reply.code(400).send({ error: `description is required (max ${MAX_DESCRIPTION} chars)` });

    let imageMime: string | null = null;
    let imageData: string | null = null;
    const image = body.image as Record<string, unknown> | null | undefined;
    if (image && typeof image === 'object') {
      const dataUrl = typeof image.dataUrl === 'string' ? image.dataUrl : '';
      if (dataUrl) {
        if (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(dataUrl)) {
          return reply.code(400).send({ error: 'image.dataUrl must be a base64 image data URL' });
        }
        if (dataUrl.length > MAX_IMAGE_BYTES) {
          return reply.code(413).send({ error: `image too large (${dataUrl.length} > ${MAX_IMAGE_BYTES})` });
        }
        imageMime = typeof image.mime === 'string' ? image.mime : dataUrl.slice(5, dataUrl.indexOf(';'));
        imageData = dataUrl;
      }
    }

    const id = `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const now = Math.floor(Date.now() / 1000);

    await dbRun(
      `INSERT INTO project_feedback
        (id, slug, target_kind, target_id, target_label, route, type, title, description,
         image_mime, image_data, client_json, snapshot_generated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, slug, kind, targetId,
      str(target.label, MAX_LABEL), str(body.route, MAX_ROUTE),
      type, title, description,
      imageMime, imageData,
      body.client ? JSON.stringify(body.client).slice(0, 4_000) : null,
      typeof body.snapshotGeneratedAt === 'string' ? body.snapshotGeneratedAt : null,
      now,
    );

    return reply.code(201).send({ id, receivedAt: new Date(now * 1000).toISOString() });
  });

  // ── authed read ──────────────────────────────────────────────────────────
  app.get('/api/projects/:slug/feedback', async (req, reply) => {
    const expected = process.env.PROJECT_SNAPSHOT_TOKEN;
    if (!expected) return reply.code(503).send({ error: 'feedback read disabled (no token configured)' });

    const auth = String(req.headers['authorization'] || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token || token !== expected) return reply.code(401).send({ error: 'unauthorized' });

    const slug = (req.params as { slug: string }).slug;
    if (!SLUG_RE.test(slug)) return reply.code(400).send({ error: 'bad slug' });

    const q = req.query as { since?: string; limit?: string };
    const limit = Math.min(Math.max(parseInt(q.limit || '500', 10) || 500, 1), 1000);
    // `since` is the exclusive cursor from the previous page's nextSince.
    const sinceSec = q.since ? Math.floor(new Date(q.since).getTime() / 1000) : 0;
    if (q.since && !Number.isFinite(sinceSec)) return reply.code(400).send({ error: 'since must be an ISO timestamp' });

    const rows = await dbAll<FeedbackRow>(
      `SELECT * FROM project_feedback
        WHERE slug = ? AND created_at > ?
        ORDER BY created_at ASC, id ASC
        LIMIT ?`,
      slug, sinceSec, limit,
    );

    const items = rows.map((r) => ({
      id: r.id,
      receivedAt: new Date(r.created_at * 1000).toISOString(),
      target: { kind: r.target_kind, id: r.target_id, label: r.target_label },
      route: r.route,
      type: r.type,
      title: r.title,
      description: r.description,
      image: r.image_data ? { dataUrl: r.image_data, mime: r.image_mime, bytes: r.image_data.length } : null,
      client: r.client_json ? JSON.parse(r.client_json) : null,
      snapshotGeneratedAt: r.snapshot_generated_at,
    }));

    const nextSince = rows.length ? new Date(rows[rows.length - 1].created_at * 1000).toISOString() : (q.since || null);
    return reply.send({ items, nextSince });
  });
}
