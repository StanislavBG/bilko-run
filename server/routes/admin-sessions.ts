import type { FastifyInstance } from 'fastify';
import { dbAll, dbGet } from '../db.js';
import { requireAdmin } from '../clerk.js';
import { isValidId } from '../session-identity.js';

const TIMELINE_CAP = 1000;
const SLUG_RE = /^[A-Za-z0-9_-]{1,100}$/;
const APP_PATH_RE = /^\/(?:projects|products)\/([A-Za-z0-9_-]+)(?:[/?#]|$)/;

interface SessionRow {
  session_id: string;
  visitor_id: string;
  email: string | null;
  started_at: number;
  ended_at: number;
  landing_path: string | null;
  exit_path: string | null;
  page_count: number | null;
  source_bucket: string | null;
  referrer_host: string | null;
  country: string | null;
  device: string | null;
  converted: number | null;
  purchased: number | null;
  click_count: number;
  event_count: number;
  error_count: number;
}

export type TimelineItem =
  | { ts: number; kind: 'view'; path: string; referrer: string | null }
  | { ts: number; kind: 'click'; path: string; label: string | null; href: string | null; track_name: string | null }
  | { ts: number; kind: 'event'; name: string; app: string | null; path: string | null; props: unknown }
  | { ts: number; kind: 'error'; app: string; name: string | null; msg: string; url: string | null };

function intParam(raw: string | undefined, def: number, min: number, max: number): number {
  const n = parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}

export function appSlugFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const m = APP_PATH_RE.exec(path);
  return m ? m[1] : null;
}

function parseProps(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

export function registerAdminSessionRoutes(app: FastifyInstance): void {
  app.get('/api/admin/sessions', async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;

    const q = (req.query ?? {}) as { days?: string; email?: string; visitor?: string; app?: string; limit?: string };
    const days = intParam(q.days, 1, 1, 30);
    const limit = intParam(q.limit, 50, 1, 200);
    const since = Date.now() - days * 86_400_000;

    const where: string[] = ['s.started_at >= ?'];
    const params: (string | number)[] = [since];
    if (q.email) { where.push('s.email = ?'); params.push(String(q.email).slice(0, 320)); }
    if (q.visitor) { where.push('s.visitor_id = ?'); params.push(String(q.visitor).slice(0, 200)); }
    if (q.app) {
      if (!SLUG_RE.test(q.app)) return { sessions: [] };
      where.push(
        `EXISTS (SELECT 1 FROM page_views pv WHERE pv.session_id = s.session_id AND
           (pv.path LIKE ? OR pv.path = ? OR pv.path LIKE ?))`,
      );
      // '_' is a LIKE wildcard; the slug regex allows it, so escape it.
      const esc = q.app.replace(/_/g, '\\_');
      params.push(`/projects/${esc}/%`, `/products/${q.app}`, `/products/${esc}/%`);
      // ESCAPE clause must apply to each LIKE
      where[where.length - 1] = where[where.length - 1].replace(/LIKE \?/g, "LIKE ? ESCAPE '\\'");
    }
    params.push(limit);

    const rows = await dbAll<SessionRow>(
      `SELECT s.session_id, s.visitor_id, s.email, s.started_at, s.ended_at,
              s.landing_path, s.exit_path, s.page_count, s.source_bucket, s.referrer_host,
              s.country, s.device, s.converted, s.purchased,
              (SELECT COUNT(*) FROM click_events c WHERE c.session_id = s.session_id) AS click_count,
              (SELECT COUNT(*) FROM funnel_events f WHERE f.session_id = s.session_id) AS event_count,
              (SELECT COUNT(*) FROM app_errors e WHERE e.session_id = s.session_id) AS error_count
         FROM sessions s
        WHERE ${where.join(' AND ')}
        ORDER BY s.started_at DESC
        LIMIT ?`,
      ...params,
    );

    const appsBySession = new Map<string, Set<string>>();
    if (rows.length) {
      const ids = rows.map(r => r.session_id);
      const paths = await dbAll<{ session_id: string; path: string }>(
        `SELECT DISTINCT session_id, path FROM page_views
          WHERE session_id IN (${ids.map(() => '?').join(',')})
            AND (path LIKE '/projects/%' OR path LIKE '/products/%')`,
        ...ids,
      );
      for (const p of paths) {
        const slug = appSlugFromPath(p.path);
        if (!slug) continue;
        let set = appsBySession.get(p.session_id);
        if (!set) appsBySession.set(p.session_id, (set = new Set()));
        set.add(slug);
      }
    }

    return {
      sessions: rows.map(r => ({
        session_id: r.session_id,
        visitor_id: r.visitor_id,
        email: r.email,
        started_at: r.started_at,
        ended_at: r.ended_at,
        duration_ms: Math.max(0, r.ended_at - r.started_at),
        landing_path: r.landing_path,
        exit_path: r.exit_path,
        page_count: r.page_count ?? 0,
        source_bucket: r.source_bucket,
        referrer_host: r.referrer_host,
        country: r.country,
        device: r.device,
        converted: r.converted ?? 0,
        purchased: r.purchased ?? 0,
        click_count: r.click_count,
        event_count: r.event_count,
        error_count: r.error_count,
        apps: [...(appsBySession.get(r.session_id) ?? [])].sort(),
      })),
    };
  });

  app.get('/api/admin/sessions/:id', async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;

    const id = (req.params as { id: string }).id;
    if (!isValidId(id)) return reply.status(400).send({ error: 'Invalid session id.' });

    const [session, views, clicks, events, errors] = await Promise.all([
      dbGet<SessionRow>(`SELECT * FROM sessions WHERE session_id = ?`, id),
      dbAll<{ ts: number; path: string; referrer: string | null }>(
        `SELECT created_at_ms AS ts, path, referrer FROM page_views
          WHERE session_id = ? AND created_at_ms IS NOT NULL ORDER BY created_at_ms ASC LIMIT ${TIMELINE_CAP}`, id),
      dbAll<{ ts: number; path: string; label: string | null; href: string | null; track_name: string | null }>(
        `SELECT ts_ms AS ts, path, label, href, track_name FROM click_events
          WHERE session_id = ? ORDER BY ts_ms ASC LIMIT ${TIMELINE_CAP}`, id),
      dbAll<{ ts: number; event: string; tool: string | null; path: string | null; metadata: string | null }>(
        `SELECT CAST(strftime('%s', created_at) AS INTEGER) * 1000 AS ts, event, tool, path, metadata
           FROM funnel_events WHERE session_id = ? ORDER BY created_at ASC LIMIT ${TIMELINE_CAP}`, id),
      dbAll<{ ts: number; app: string; name: string | null; msg: string; url: string | null }>(
        `SELECT created_at * 1000 AS ts, app, name, msg, url FROM app_errors
          WHERE session_id = ? ORDER BY created_at ASC LIMIT ${TIMELINE_CAP}`, id),
    ]);

    const timeline: TimelineItem[] = [
      ...views.map(r => ({ ts: r.ts, kind: 'view' as const, path: r.path, referrer: r.referrer })),
      ...clicks.map(r => ({ ts: r.ts, kind: 'click' as const, path: r.path, label: r.label, href: r.href, track_name: r.track_name })),
      ...events.map(r => ({ ts: r.ts, kind: 'event' as const, name: r.event, app: r.tool, path: r.path, props: parseProps(r.metadata) })),
      ...errors.map(r => ({ ts: r.ts, kind: 'error' as const, app: r.app, name: r.name, msg: r.msg, url: r.url })),
    ]
      .sort((a, b) => a.ts - b.ts)
      .slice(0, TIMELINE_CAP);

    if (!session && timeline.length === 0) return reply.status(404).send({ error: 'Session not found.' });

    return { session: session ?? null, timeline };
  });
}
