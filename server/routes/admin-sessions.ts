import type { FastifyInstance } from 'fastify';
import { dbAll, dbGet } from '../db.js';
import { requireAdmin } from '../clerk.js';
import { isValidId } from '../session-identity.js';
import type { TimelineItem } from '../../shared/session-timeline.js';

const TIMELINE_CAP = 1000;
const APP_FILTER_RE = /^[a-z0-9][a-z0-9._-]{0,59}$/i;
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

function intParam(raw: string | undefined, def: number, min: number, max: number): number {
  const n = parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}

function appSlugFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const m = APP_PATH_RE.exec(path);
  return m ? m[1] : null;
}

function parseProps(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return raw; }
}

interface AppAgg {
  sessions: Set<string>;
  views: number;
  clicks: number;
  events: number;
  errors: number;
  errorSessions: Set<string>;
  lastSeen: number;
}

/** Distinct app slugs per session, derived from page views under /projects|products/<slug>. */
async function appsForSessions(ids: string[]): Promise<Map<string, string[]>> {
  const bySession = new Map<string, Set<string>>();
  if (ids.length) {
    const paths = await dbAll<{ session_id: string; path: string }>(
      `SELECT DISTINCT session_id, path FROM page_views
        WHERE session_id IN (${ids.map(() => '?').join(',')})
          AND (path LIKE '/projects/%' OR path LIKE '/products/%')`,
      ...ids,
    );
    for (const p of paths) {
      const slug = appSlugFromPath(p.path);
      if (!slug) continue;
      let set = bySession.get(p.session_id);
      if (!set) bySession.set(p.session_id, (set = new Set()));
      set.add(slug);
    }
  }
  return new Map([...bySession].map(([id, set]) => [id, [...set].sort()]));
}

function sqlUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

export function registerAdminSessionRoutes(app: FastifyInstance): void {
  app.get('/api/admin/flows', async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;

    const q = (req.query ?? {}) as { days?: string; app?: string };
    const days = intParam(q.days, 7, 1, 30);
    if (q.app !== undefined && !APP_FILTER_RE.test(String(q.app))) {
      return reply.status(400).send({ error: 'Invalid app.' });
    }
    const appFilter = q.app !== undefined ? String(q.app) : null;
    const sinceMs = Date.now() - days * 86_400_000;
    const sinceUtc = sqlUtc(sinceMs);
    const sinceSec = Math.floor(sinceMs / 1000);

    const aggs = new Map<string, AppAgg>();
    const get = (slug: string): AppAgg => {
      let a = aggs.get(slug);
      if (!a) {
        a = { sessions: new Set(), views: 0, clicks: 0, events: 0, errors: 0, errorSessions: new Set(), lastSeen: 0 };
        aggs.set(slug, a);
      }
      return a;
    };
    const appTool = appFilter ? ' AND tool = ?' : '';
    const toolParams = appFilter ? [appFilter] : [];

    const [views, clicks, events, errors, steps, totals] = await Promise.all([
      dbAll<{ path: string; session_id: string | null; n: number; last_ms: number }>(
        `SELECT path, session_id, COUNT(*) AS n, MAX(created_at_ms) AS last_ms FROM page_views
          WHERE created_at_ms >= ? AND (path LIKE '/projects/%' OR path LIKE '/products/%')
          GROUP BY path, session_id`, sinceMs),
      dbAll<{ path: string; session_id: string | null; n: number; last_ms: number }>(
        `SELECT path, session_id, COUNT(*) AS n, MAX(ts_ms) AS last_ms FROM click_events
          WHERE ts_ms >= ? AND (path LIKE '/projects/%' OR path LIKE '/products/%')
          GROUP BY path, session_id`, sinceMs),
      dbAll<{ tool: string; session_id: string | null; n: number; last_ms: number }>(
        `SELECT tool, session_id, COUNT(*) AS n,
                MAX(CAST(strftime('%s', created_at) AS INTEGER)) * 1000 AS last_ms
           FROM funnel_events WHERE created_at >= ? AND tool IS NOT NULL AND tool != ''${appTool}
          GROUP BY tool, session_id`, sinceUtc, ...toolParams),
      dbAll<{ app: string; session_id: string | null; n: number; last_s: number }>(
        `SELECT app, session_id, COUNT(*) AS n, MAX(created_at) AS last_s FROM app_errors
          WHERE created_at >= ?${appFilter ? ' AND app = ?' : ''}
          GROUP BY app, session_id`, sinceSec, ...toolParams),
      dbAll<{ tool: string; flow: string; step: string | null; sessions: number; first_ms: number }>(
        `SELECT tool, json_extract(metadata, '$.flow') AS flow, json_extract(metadata, '$.step') AS step,
                COUNT(DISTINCT session_id) AS sessions,
                MIN(CAST(strftime('%s', created_at) AS INTEGER)) * 1000 AS first_ms
           FROM funnel_events
          WHERE created_at >= ? AND tool IS NOT NULL AND tool != '' AND json_valid(metadata)
            AND json_extract(metadata, '$.flow') IS NOT NULL${appTool}
          GROUP BY tool, flow, step`, sinceUtc, ...toolParams),
      dbAll<{ tool: string; flow: string; sessions: number }>(
        `SELECT tool, json_extract(metadata, '$.flow') AS flow, COUNT(DISTINCT session_id) AS sessions
           FROM funnel_events
          WHERE created_at >= ? AND tool IS NOT NULL AND tool != '' AND json_valid(metadata)
            AND json_extract(metadata, '$.flow') IS NOT NULL${appTool}
          GROUP BY tool, flow`, sinceUtc, ...toolParams),
    ]);

    for (const r of views) {
      const slug = appSlugFromPath(r.path);
      if (!slug || (appFilter && slug !== appFilter)) continue;
      const a = get(slug);
      a.views += r.n;
      if (r.session_id) a.sessions.add(r.session_id);
      a.lastSeen = Math.max(a.lastSeen, r.last_ms ?? 0);
    }
    for (const r of clicks) {
      const slug = appSlugFromPath(r.path);
      if (!slug || (appFilter && slug !== appFilter)) continue;
      const a = get(slug);
      a.clicks += r.n;
      if (r.session_id) a.sessions.add(r.session_id);
      a.lastSeen = Math.max(a.lastSeen, r.last_ms ?? 0);
    }
    for (const r of events) {
      const a = get(r.tool);
      a.events += r.n;
      if (r.session_id) a.sessions.add(r.session_id);
      a.lastSeen = Math.max(a.lastSeen, r.last_ms ?? 0);
    }
    for (const r of errors) {
      const a = get(r.app);
      a.errors += r.n;
      if (r.session_id) { a.sessions.add(r.session_id); a.errorSessions.add(r.session_id); }
      a.lastSeen = Math.max(a.lastSeen, (r.last_s ?? 0) * 1000);
    }

    const apps = [...aggs.entries()]
      .map(([slug, a]) => ({
        app: slug,
        sessions: a.sessions.size,
        views: a.views,
        clicks: a.clicks,
        events: a.events,
        errors: a.errors,
        error_sessions: a.errorSessions.size,
        last_seen_ms: a.lastSeen,
      }))
      .sort((x, y) => y.sessions - x.sessions || x.app.localeCompare(y.app));

    const flowMap = new Map<string, { app: string; flow: string; steps: { step: string; sessions: number; first_seen_ms: number }[]; total_sessions: number }>();
    const key = (tool: string, flow: string) => `${tool}\u0000${flow}`;
    for (const t of totals) {
      flowMap.set(key(t.tool, String(t.flow)), { app: t.tool, flow: String(t.flow), steps: [], total_sessions: t.sessions });
    }
    for (const s of steps) {
      const f = flowMap.get(key(s.tool, String(s.flow)));
      if (f) f.steps.push({ step: String(s.step ?? ''), sessions: s.sessions, first_seen_ms: s.first_ms });
    }
    const flows = [...flowMap.values()]
      .map(f => ({
        ...f,
        steps: f.steps.sort((x, y) => y.sessions - x.sessions || x.first_seen_ms - y.first_seen_ms),
      }))
      .sort((x, y) => x.app.localeCompare(y.app) || x.flow.localeCompare(y.flow));

    return { apps, flows };
  });

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
    if (q.app !== undefined) {
      if (!APP_FILTER_RE.test(String(q.app))) return reply.status(400).send({ error: 'Invalid app.' });
      const slug = String(q.app);
      // '_' is a LIKE wildcard and the slug regex allows it, so escape it.
      const esc = slug.replace(/_/g, '\\_');
      where.push(
        `EXISTS (SELECT 1 FROM page_views pv WHERE pv.session_id = s.session_id AND
           (pv.path LIKE ? ESCAPE '\\' OR pv.path = ? OR pv.path LIKE ? ESCAPE '\\'))`,
      );
      params.push(`/projects/${esc}/%`, `/products/${slug}`, `/products/${esc}/%`);
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

    const appsBySession = await appsForSessions(rows.map(r => r.session_id));

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
        apps: appsBySession.get(r.session_id) ?? [],
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

    const apps = (await appsForSessions([id])).get(id) ?? [];

    return { session: session ?? null, timeline, apps };
  });
}
