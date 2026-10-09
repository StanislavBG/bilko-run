import type { FastifyInstance } from 'fastify';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
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
//   POST /api/projects/:slug/feedback               PUBLIC → store one submission
//   GET  /api/projects/:slug/feedback               authed → drain it for local analysis
//   POST /api/projects/:slug/feedback/:id/moderate  authed → archive/delete a thread
//   POST /api/projects/:slug/feedback/:id/status    authed → set work status
//   POST /api/projects/:slug/feedback/status-lookup PUBLIC → status by receipt
//
// Moderation is visibility; status is work state (open | in_progress |
// resolved | wontfix, NULL = open). The POST returns a one-time `receipt`
// (32 random bytes, base64url) and stores only its sha256, so a submitter
// with no account can later ask "what happened to my report?":
//
//   POST .../feedback          → 201 { id, parentId, receivedAt, receipt }
//   POST .../:id/status        { status, note? } → { id, status, note, statusAt }
//   POST .../status-lookup     { items: [{ id, receipt }] } (1..100)
//                              → { items: [{ id, status, note, statusAt }] }
//
// The lookup returns ONLY rows whose receipt hash matches for that slug, and
// silently omits everything else — it never reveals whether an id exists and
// never returns title/description/client fields. Rows filed before receipts
// existed have no hash and are simply never returned. GET items carry
// `status: { value, note, at }`, and a status change re-surfaces a row through
// the same `moderatedSince` cursor as moderation does.
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

// Moderation verbs. `delete` is a HIDE, never a purge: the sibling's puller
// dedupes on ids it has already seen on disk, so dropping the row would make
// the item re-arrive as brand-new feedback on the next pull and resurrect
// itself on the published page. Same reasoning for `archive`.
const MODERATION_ACTIONS: Record<string, string | null> = {
  archive: 'archived',
  unarchive: null,
  delete: 'deleted',
  restore: null,
};
const MAX_REASON = 500;

const STATUSES = new Set(['open', 'in_progress', 'resolved', 'wontfix']);
const MAX_STATUS_NOTE = 500;
const MAX_LOOKUP_ITEMS = 100;

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
// Status lookups get their own bucket so a client polling for status can't
// eat the same visitor's submit quota.
const lookupHits = new Map<string, number[]>();

function rateLimited(ip: string, bucket = hits): boolean {
  const now = Date.now();
  const recent = (bucket.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  bucket.set(ip, recent);
  if (bucket.size > 5_000) bucket.clear(); // crude bound; never grows unbounded
  return recent.length > RATE_MAX;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function isoOrNull(sec: number | null): string | null {
  return sec ? new Date(sec * 1000).toISOString() : null;
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > max) return null;
  return s;
}

// Shared bearer check for the two authed routes. Returns an error tuple the
// caller sends verbatim, or null when the request is authorised.
function checkBearer(req: { headers: Record<string, unknown> }): { code: number; error: string } | null {
  const expected = process.env.PROJECT_SNAPSHOT_TOKEN;
  if (!expected) return { code: 503, error: 'feedback read disabled (no token configured)' };
  const auth = String(req.headers['authorization'] || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || token !== expected) return { code: 401, error: 'unauthorized' };
  return null;
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
  parent_id: string | null;
  moderation_action: string | null;
  moderation_at: number | null;
  moderation_reason: string | null;
  status: string | null;
  status_note: string | null;
  status_at: number | null;
  receipt_hash: string | null;
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

    // Threading pointer. Deliberately opaque: this server assigns it no
    // meaning, does not check that it resolves, and echoes it back unchanged
    // on GET. A dangling value is the reading client's problem to render.
    // The only thing enforced is a length bound, same as every other string.
    const parentId = str(body.parentId, MAX_ID);

    // Bearer-style receipt for the public status lookup. Only the hash is
    // stored; the plaintext exists once, in this response.
    const receipt = randomBytes(32).toString('base64url');

    await dbRun(
      `INSERT INTO project_feedback
        (id, slug, target_kind, target_id, target_label, route, type, title, description,
         image_mime, image_data, client_json, snapshot_generated_at, created_at, parent_id,
         receipt_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, slug, kind, targetId,
      str(target.label, MAX_LABEL), str(body.route, MAX_ROUTE),
      type, title, description,
      imageMime, imageData,
      body.client ? JSON.stringify(body.client).slice(0, 4_000) : null,
      typeof body.snapshotGeneratedAt === 'string' ? body.snapshotGeneratedAt : null,
      now, parentId, sha256Hex(receipt),
    );

    return reply.code(201).send({ id, parentId, receivedAt: new Date(now * 1000).toISOString(), receipt });
  });

  // ── authed read ──────────────────────────────────────────────────────────
  app.get('/api/projects/:slug/feedback', async (req, reply) => {
    const bad = checkBearer(req as never);
    if (bad) return reply.code(bad.code).send({ error: bad.error });

    const slug = (req.params as { slug: string }).slug;
    if (!SLUG_RE.test(slug)) return reply.code(400).send({ error: 'bad slug' });

    const q = req.query as { since?: string; limit?: string; moderatedSince?: string; images?: string };
    const limit = Math.min(Math.max(parseInt(q.limit || '500', 10) || 500, 1), 1000);
    // `since` is the exclusive cursor from the previous page's nextSince.
    const sinceSec = q.since ? Math.floor(new Date(q.since).getTime() / 1000) : 0;
    if (q.since && !Number.isFinite(sinceSec)) return reply.code(400).send({ error: 'since must be an ISO timestamp' });

    // Moderation happens long after a row was created, so a purely
    // created_at-based cursor would never re-surface a newly archived item and
    // the caller's local mirror would silently disagree with the server.
    // `moderatedSince` re-admits already-pulled rows whose moderation state
    // changed after that instant; the caller replays it from nextModeratedSince.
    // A status change rides the same cursor, so one replay covers both.
    const modSince = q.moderatedSince ? Math.floor(new Date(q.moderatedSince).getTime() / 1000) : null;
    if (q.moderatedSince && !Number.isFinite(modSince)) {
      return reply.code(400).send({ error: 'moderatedSince must be an ISO timestamp' });
    }

    const rows = modSince === null
      ? await dbAll<FeedbackRow>(
          `SELECT * FROM project_feedback
            WHERE slug = ? AND created_at > ?
            ORDER BY created_at ASC, id ASC
            LIMIT ?`,
          slug, sinceSec, limit,
        )
      : await dbAll<FeedbackRow>(
          `SELECT * FROM project_feedback
            WHERE slug = ? AND (created_at > ? OR moderation_at > ? OR status_at > ?)
            ORDER BY created_at ASC, id ASC
            LIMIT ?`,
          slug, sinceSec, modSince, modSince, limit,
        );

    // Screenshots are stored as inline base64 and can run to 2 MB each, so a
    // full page can be three orders of magnitude larger than the same page
    // without them. That is pure waste on a moderation-replay pull, where the
    // caller already has every blob on disk and only wants the changed flags.
    // `images=none` returns the metadata (mime, bytes) and drops the payload.
    const withImages = q.images !== 'none';

    const items = rows.map((r) => ({
      id: r.id,
      receivedAt: new Date(r.created_at * 1000).toISOString(),
      target: { kind: r.target_kind, id: r.target_id, label: r.target_label },
      route: r.route,
      type: r.type,
      title: r.title,
      description: r.description,
      image: r.image_data
        ? {
            dataUrl: withImages ? r.image_data : null,
            mime: r.image_mime,
            bytes: r.image_data.length,
          }
        : null,
      client: r.client_json ? JSON.parse(r.client_json) : null,
      snapshotGeneratedAt: r.snapshot_generated_at,
      parentId: r.parent_id,
      moderation: r.moderation_action
        ? {
            action: r.moderation_action,
            at: r.moderation_at ? new Date(r.moderation_at * 1000).toISOString() : null,
            reason: r.moderation_reason,
          }
        : null,
      status: { value: r.status || 'open', note: r.status_note, at: isoOrNull(r.status_at) },
    }));

    // Never let the cursor regress: a page made entirely of re-admitted
    // moderated rows has a max created_at below the cursor we were handed.
    const maxCreated = rows.reduce((m, r) => Math.max(m, r.created_at), sinceSec);
    const nextSince = rows.length || q.since ? new Date(maxCreated * 1000).toISOString() : null;
    const maxModerated = rows.reduce(
      (m, r) => Math.max(m, r.moderation_at || 0, r.status_at || 0),
      modSince ?? 0,
    );
    const nextModeratedSince = maxModerated > 0 ? new Date(maxModerated * 1000).toISOString() : null;
    return reply.send({ items, nextSince, nextModeratedSince });
  });

  // ── authed moderation ────────────────────────────────────────────────────
  // Owner-only, same bearer as the read side. Public page + destructive verb
  // means this can never be open: an unauthenticated route would let any
  // visitor erase anyone's feedback.
  app.post('/api/projects/:slug/feedback/:id/moderate', async (req, reply) => {
    const bad = checkBearer(req as never);
    if (bad) return reply.code(bad.code).send({ error: bad.error });

    const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    if (rateLimited(ip)) return reply.code(429).send({ error: 'too many moderation calls, try again shortly' });

    const { slug, id } = req.params as { slug: string; id: string };
    if (!SLUG_RE.test(slug)) return reply.code(400).send({ error: 'bad slug' });

    const body = req.body as Record<string, unknown> | undefined;
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!(action in MODERATION_ACTIONS)) {
      return reply.code(400).send({ error: `action must be one of ${Object.keys(MODERATION_ACTIONS).join(', ')}` });
    }
    const reason = body?.reason == null ? null : str(body.reason, MAX_REASON);
    if (body?.reason != null && reason === null) {
      return reply.code(400).send({ error: `reason must be a non-empty string (max ${MAX_REASON} chars)` });
    }

    const state = MODERATION_ACTIONS[action];
    const at = Math.floor(Date.now() / 1000);

    // Slug-scoped so one project's token can't moderate another's rows.
    // The row is always kept — even for `delete`, which only flips the flag.
    const res = await dbRun(
      `UPDATE project_feedback
          SET moderation_action = ?, moderation_at = ?, moderation_reason = ?
        WHERE id = ? AND slug = ?`,
      state, at, reason, id, slug,
    );
    if (!res.changes) return reply.code(404).send({ error: 'unknown feedback id' });

    return reply.send({ id, action, moderatedAt: new Date(at * 1000).toISOString() });
  });

  // ── authed status ────────────────────────────────────────────────────────
  // Owner-only work state. Same bearer, rate limit and slug scoping as
  // moderation; independent of it (an archived row can still be resolved).
  app.post('/api/projects/:slug/feedback/:id/status', async (req, reply) => {
    const bad = checkBearer(req as never);
    if (bad) return reply.code(bad.code).send({ error: bad.error });

    const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    if (rateLimited(ip)) return reply.code(429).send({ error: 'too many status calls, try again shortly' });

    const { slug, id } = req.params as { slug: string; id: string };
    if (!SLUG_RE.test(slug)) return reply.code(400).send({ error: 'bad slug' });

    const body = req.body as Record<string, unknown> | undefined;
    const status = typeof body?.status === 'string' ? body.status : '';
    if (!STATUSES.has(status)) {
      return reply.code(400).send({ error: `status must be one of ${[...STATUSES].join(', ')}` });
    }
    const note = body?.note == null ? null : str(body.note, MAX_STATUS_NOTE);
    if (body?.note != null && note === null) {
      return reply.code(400).send({ error: `note must be a non-empty string (max ${MAX_STATUS_NOTE} chars)` });
    }

    const at = Math.floor(Date.now() / 1000);
    const res = await dbRun(
      `UPDATE project_feedback
          SET status = ?, status_note = ?, status_at = ?
        WHERE id = ? AND slug = ?`,
      status, note, at, id, slug,
    );
    if (!res.changes) return reply.code(404).send({ error: 'unknown feedback id' });

    return reply.send({ id, status, note, statusAt: new Date(at * 1000).toISOString() });
  });

  // ── public status lookup ─────────────────────────────────────────────────
  // Unauthenticated: possession of the receipt IS the credential. Anything
  // that doesn't match — unknown id, wrong slug, wrong receipt, pre-receipt
  // row — is dropped without a trace so the route can't be used to probe ids.
  app.post('/api/projects/:slug/feedback/status-lookup', async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;
    if (!SLUG_RE.test(slug)) return reply.code(400).send({ error: 'bad slug' });

    const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    if (rateLimited(ip, lookupHits)) return reply.code(429).send({ error: 'too many lookups, try again shortly' });

    const body = req.body as Record<string, unknown> | undefined;
    const raw = body?.items;
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_LOOKUP_ITEMS) {
      return reply.code(400).send({ error: `items must be an array of 1..${MAX_LOOKUP_ITEMS} { id, receipt }` });
    }
    const wanted = new Map<string, string>();
    for (const it of raw) {
      const id = str((it as Record<string, unknown> | null)?.id, MAX_ID);
      const receipt = str((it as Record<string, unknown> | null)?.receipt, MAX_ID);
      if (!id || !receipt) {
        return reply.code(400).send({ error: `each item needs string id and receipt (max ${MAX_ID} chars)` });
      }
      wanted.set(id, sha256Hex(receipt));
    }

    const ids = [...wanted.keys()];
    const rows = await dbAll<Pick<FeedbackRow, 'id' | 'receipt_hash' | 'status' | 'status_note' | 'status_at'>>(
      `SELECT id, receipt_hash, status, status_note, status_at FROM project_feedback
        WHERE slug = ? AND receipt_hash IS NOT NULL AND id IN (${ids.map(() => '?').join(', ')})`,
      slug, ...ids,
    );

    const items = rows
      .filter((r) => {
        const want = Buffer.from(wanted.get(r.id)!, 'hex');
        const have = Buffer.from(r.receipt_hash!, 'hex');
        return want.length === have.length && timingSafeEqual(want, have);
      })
      .map((r) => ({ id: r.id, status: r.status || 'open', note: r.status_note, statusAt: isoOrNull(r.status_at) }));

    return reply.send({ items });
  });
}
