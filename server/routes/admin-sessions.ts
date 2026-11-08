import type { FastifyInstance } from 'fastify';
import { dbAll, dbGet } from '../db.js';
import { requireAdmin } from '../clerk.js';
import { isValidId } from '../session-identity.js';
import { parseTrafficFilters, loadOwnerIds, isOwnerRow, mineExclusionSql, type SqlFragment } from '../traffic-filters.js';
import type { TimelineItem } from '../../shared/session-timeline.js';
import { parseEnvSelector, envPredicate } from './telemetry.js';

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
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
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

/**
 * Distinct app slugs per session: page views under /projects|products/<slug>, plus the app's own telemetry
 * (funnel_events.tool, app_errors.app), the same signals the ?app= filter matches on.
 */
async function appsForSessions(ids: string[]): Promise<Map<string, string[]>> {
  const bySession = new Map<string, Set<string>>();
  const add = (sid: string, slug: string | null | undefined): void => {
    if (!slug) return;
    let set = bySession.get(sid);
    if (!set) bySession.set(sid, (set = new Set()));
    set.add(slug);
  };
  if (ids.length) {
    const list = ids.map(() => '?').join(',');
    const [paths, telemetry] = await Promise.all([
      dbAll<{ session_id: string; path: string }>(
        `SELECT DISTINCT session_id, path FROM page_views
          WHERE session_id IN (${list})
            AND (path LIKE '/projects/%' OR path LIKE '/products/%')`,
        ...ids,
      ),
      dbAll<{ session_id: string; app: string }>(
        `SELECT DISTINCT session_id, tool AS app FROM funnel_events
          WHERE session_id IN (${list}) AND tool IS NOT NULL AND tool != ''
         UNION
         SELECT DISTINCT session_id, app FROM app_errors
          WHERE session_id IN (${list}) AND app IS NOT NULL AND app != ''`,
        ...ids, ...ids,
      ),
    ]);
    for (const p of paths) add(p.session_id, appSlugFromPath(p.path));
    for (const t of telemetry) add(t.session_id, t.app);
  }
  return new Map([...bySession].map(([id, set]) => [id, [...set].sort()]));
}

interface SessionFlags {
  admin: boolean;
  bot: boolean;
  /** Any page view in the session carried the bilko_internal marker (server/internal-traffic.ts). */
  internal: boolean;
}

/**
 * Per session, in one grouped query: admin when any page view has is_admin = 1; internal when any page view has
 * is_internal = 1; bot when any page view, funnel event
 * or app error has is_bot = 1 (funnel_events and app_errors are flagged at ingest from the request UA).
 */
async function sessionFlags(ids: string[]): Promise<Map<string, SessionFlags>> {
  const flags = new Map<string, SessionFlags>();
  if (!ids.length) return flags;
  const list = ids.map(() => '?').join(',');
  const rows = await dbAll<{ session_id: string; a: number; b: number; i: number }>(
    `SELECT session_id, MAX(a) AS a, MAX(b) AS b, MAX(i) AS i FROM (
       SELECT session_id, COALESCE(is_admin, 0) AS a, COALESCE(is_bot, 0) AS b, COALESCE(is_internal, 0) AS i
         FROM page_views WHERE session_id IN (${list})
       UNION ALL
       SELECT session_id, 0 AS a, 1 AS b, 0 AS i FROM funnel_events WHERE session_id IN (${list}) AND is_bot = 1
       UNION ALL
       SELECT session_id, 0 AS a, 1 AS b, 0 AS i FROM app_errors WHERE session_id IN (${list}) AND is_bot = 1
     ) GROUP BY session_id`,
    ...ids, ...ids, ...ids,
  );
  for (const r of rows) {
    flags.set(r.session_id, { admin: Number(r.a) === 1, bot: Number(r.b) === 1, internal: Number(r.i) === 1 });
  }
  return flags;
}

function sqlUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

/** Concatenates WHERE fragments in order, so the args stay in placeholder order. */
function joinSql(parts: SqlFragment[]): SqlFragment {
  return { sql: parts.map((p) => p.sql).join(''), args: parts.flatMap((p) => p.args) };
}

/**
 * Drops rows whose session has a page view flagged `flag` on or after `sinceDay`; 'owner' means is_admin = 1 or
 * is_internal = 1 (the bilko_internal marker). page_views.date is the view's UTC
 * day, so the bound keeps the subquery on idx_page_views_date. The subquery skips NULL session ids, because one NULL
 * in a NOT IN list would drop every row, and rows with no session id of their own are kept.
 */
function flaggedSessionExclusion(flag: 'owner' | 'is_bot', sinceDay: string): SqlFragment {
  const pred = flag === 'owner' ? '(is_admin = 1 OR is_internal = 1)' : 'is_bot = 1';
  return {
    sql: ` AND (session_id IS NULL OR session_id NOT IN (SELECT session_id FROM page_views
             WHERE date >= ? AND ${pred} AND session_id IS NOT NULL))`,
    args: [sinceDay],
  };
}

export function registerAdminSessionRoutes(app: FastifyInstance): void {
  app.get('/api/admin/flows', async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;

    const q = (req.query ?? {}) as { days?: string; app?: string; env?: string };
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

    // mine=exclude (legacy self=exclude) and bots=exclude; both default to include.
    const filters = parseTrafficFilters(req.query);
    // Extra WHERE fragments per table, appended last to each query so their args follow the query's own.
    const pvParts: SqlFragment[] = [];
    const ceParts: SqlFragment[] = [];
    const feParts: SqlFragment[] = [];
    const aeParts: SqlFragment[] = [];
    // env=prod (the default, and any unrecognised value) keeps rows with no env, from clients that predate the tag,
    // and drops dev and test; env=all is a no-op. page_views and click_events have no env column: only the bilko.run
    // beacon writes them.
    const env = parseEnvSelector(q.env);
    const envPred = envPredicate(env);
    const envPart: SqlFragment = { sql: ` AND ${envPred.sql}`, args: envPred.args };
    feParts.push(envPart);
    aeParts.push(envPart);
    const sinceDay = new Date(sinceMs).toISOString().slice(0, 10);
    if (filters.excludeMine) {
      const ownerIds = await loadOwnerIds();
      const ownerSessions = flaggedSessionExclusion('owner', sinceDay);
      // Cookie ids are page_views/funnel_events/app_errors.visitor_id and click_events.client_vid;
      // click_events.visitor_id is the ip+ua hash.
      // is_internal marks rows sent with the bilko_internal marker (the owner's automation).
      pvParts.push(mineExclusionSql(ownerIds, { isAdmin: 'is_admin', isInternal: 'is_internal', cookieId: 'visitor_id' }));
      ceParts.push(mineExclusionSql(ownerIds, {
        isAdmin: 'is_admin', isInternal: 'is_internal', hashId: 'visitor_id', cookieId: 'client_vid',
      }));
      // funnel_events.is_admin flags the owner's checkouts; app_errors has no owner flag of its own.
      feParts.push(
        mineExclusionSql(ownerIds, { isAdmin: 'is_admin', isInternal: 'is_internal', cookieId: 'visitor_id' }),
        ownerSessions,
      );
      aeParts.push(mineExclusionSql(ownerIds, { cookieId: 'visitor_id' }), ownerSessions);
    }
    if (filters.excludeBots) {
      const human: SqlFragment = { sql: ' AND COALESCE(is_bot, 0) = 0', args: [] };
      // funnel_events and app_errors carry their own is_bot, set at ingest from the request UA, which catches agent
      // sessions with no flagged page view (or none at all); they also follow their session's flagged page views.
      const botSessions = flaggedSessionExclusion('is_bot', sinceDay);
      pvParts.push(human);
      ceParts.push(human);
      feParts.push(human, botSessions);
      aeParts.push(human, botSessions);
    }
    const pvWhere = joinSql(pvParts);
    const ceWhere = joinSql(ceParts);
    const feWhere = joinSql(feParts);
    const aeWhere = joinSql(aeParts);

    const [views, clicks, events, errors, steps, totals] = await Promise.all([
      dbAll<{ path: string; session_id: string | null; n: number; last_ms: number }>(
        `SELECT path, session_id, COUNT(*) AS n, MAX(created_at_ms) AS last_ms FROM page_views
          WHERE created_at_ms >= ? AND (path LIKE '/projects/%' OR path LIKE '/products/%')${pvWhere.sql}
          GROUP BY path, session_id`, sinceMs, ...pvWhere.args),
      dbAll<{ path: string; session_id: string | null; n: number; last_ms: number }>(
        `SELECT path, session_id, COUNT(*) AS n, MAX(ts_ms) AS last_ms FROM click_events
          WHERE ts_ms >= ? AND (path LIKE '/projects/%' OR path LIKE '/products/%')${ceWhere.sql}
          GROUP BY path, session_id`, sinceMs, ...ceWhere.args),
      dbAll<{ tool: string; session_id: string | null; n: number; last_ms: number }>(
        `SELECT tool, session_id, COUNT(*) AS n,
                MAX(CAST(strftime('%s', created_at) AS INTEGER)) * 1000 AS last_ms
           FROM funnel_events WHERE created_at >= ? AND tool IS NOT NULL AND tool != ''${appTool}${feWhere.sql}
          GROUP BY tool, session_id`, sinceUtc, ...toolParams, ...feWhere.args),
      dbAll<{ app: string; session_id: string | null; n: number; last_s: number }>(
        `SELECT app, session_id, COUNT(*) AS n, MAX(created_at) AS last_s FROM app_errors
          WHERE created_at >= ?${appFilter ? ' AND app = ?' : ''}${aeWhere.sql}
          GROUP BY app, session_id`, sinceSec, ...toolParams, ...aeWhere.args),
      dbAll<{ tool: string; flow: string; step: string | null; sessions: number; first_ms: number }>(
        `SELECT tool, json_extract(metadata, '$.flow') AS flow, json_extract(metadata, '$.step') AS step,
                COUNT(DISTINCT session_id) AS sessions,
                MIN(CAST(strftime('%s', created_at) AS INTEGER)) * 1000 AS first_ms
           FROM funnel_events
          WHERE created_at >= ? AND tool IS NOT NULL AND tool != '' AND json_valid(metadata)
            AND json_extract(metadata, '$.flow') IS NOT NULL${appTool}${feWhere.sql}
          GROUP BY tool, flow, step`, sinceUtc, ...toolParams, ...feWhere.args),
      dbAll<{ tool: string; flow: string; sessions: number }>(
        `SELECT tool, json_extract(metadata, '$.flow') AS flow, COUNT(DISTINCT session_id) AS sessions
           FROM funnel_events
          WHERE created_at >= ? AND tool IS NOT NULL AND tool != '' AND json_valid(metadata)
            AND json_extract(metadata, '$.flow') IS NOT NULL${appTool}${feWhere.sql}
          GROUP BY tool, flow`, sinceUtc, ...toolParams, ...feWhere.args),
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

    return {
      apps,
      flows,
      filters: {
        mine: filters.excludeMine ? 'exclude' : 'include',
        bots: filters.excludeBots ? 'exclude' : 'include',
        env,
      },
    };
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
      // A page view under the app, or the app's own telemetry as /api/admin/flows counts it (funnel_events.tool,
      // app_errors.app), so sessions that only sent events or errors match too. Each EXISTS is a session id lookup
      // (idx_page_views_session, idx_funnel_events_session, idx_app_errors_session).
      where.push(
        `(EXISTS (SELECT 1 FROM page_views pv WHERE pv.session_id = s.session_id AND
            (pv.path LIKE ? ESCAPE '\\' OR pv.path = ? OR pv.path LIKE ? ESCAPE '\\'))
          OR EXISTS (SELECT 1 FROM funnel_events f WHERE f.session_id = s.session_id AND f.tool = ?)
          OR EXISTS (SELECT 1 FROM app_errors e WHERE e.session_id = s.session_id AND e.app = ?))`,
      );
      params.push(`/projects/${esc}/%`, `/products/${slug}`, `/products/${esc}/%`, slug, slug);
    }

    // mine=exclude (legacy self=exclude) and bots=exclude; both default to include.
    const filters = parseTrafficFilters(req.query);
    // Never rejects. Started here so it overlaps the main query unless the mine exclusion needs it first.
    const ownerIdsP = loadOwnerIds();
    // page_views.date is the view's UTC day, so bounding on it keeps the subqueries on idx_page_views_date.
    // The subqueries skip NULL session ids: one NULL in a NOT IN list would drop every session.
    const sinceDay = new Date(since).toISOString().slice(0, 10);
    if (filters.excludeMine) {
      const { cookieIds } = await ownerIdsP;
      if (cookieIds.length) {
        where.push(`s.visitor_id NOT IN (${cookieIds.map(() => '?').join(',')})`);
        params.push(...cookieIds);
      }
      // is_internal: a page view sent with the bilko_internal marker (the owner's automation).
      where.push(
        `s.session_id NOT IN (SELECT session_id FROM page_views
           WHERE date >= ? AND (is_admin = 1 OR is_internal = 1) AND session_id IS NOT NULL)`,
      );
      params.push(sinceDay);
    }
    if (filters.excludeBots) {
      where.push(
        `s.session_id NOT IN (SELECT session_id FROM page_views
           WHERE date >= ? AND is_bot = 1 AND session_id IS NOT NULL)`,
      );
      params.push(sinceDay);
      // Also any funnel event or app error flagged at ingest, the same rows that set the bot flag below.
      // Session id lookups (idx_funnel_events_session, idx_app_errors_session), so NULL session ids cannot match.
      where.push(
        `NOT EXISTS (SELECT 1 FROM funnel_events f WHERE f.session_id = s.session_id AND f.is_bot = 1)`,
        `NOT EXISTS (SELECT 1 FROM app_errors e WHERE e.session_id = s.session_id AND e.is_bot = 1)`,
      );
    }
    params.push(limit);

    const rows = await dbAll<SessionRow>(
      `SELECT s.session_id, s.visitor_id, s.email, s.started_at, s.ended_at,
              s.landing_path, s.exit_path, s.page_count, s.source_bucket, s.referrer_host,
              s.utm_source, s.utm_medium, s.utm_campaign, s.country, s.device, s.converted, s.purchased,
              (SELECT COUNT(*) FROM click_events c WHERE c.session_id = s.session_id) AS click_count,
              (SELECT COUNT(*) FROM funnel_events f WHERE f.session_id = s.session_id) AS event_count,
              (SELECT COUNT(*) FROM app_errors e WHERE e.session_id = s.session_id) AS error_count
         FROM sessions s
        WHERE ${where.join(' AND ')}
        ORDER BY s.started_at DESC
        LIMIT ?`,
      ...params,
    );

    const ids = rows.map(r => r.session_id);
    const [ownerIds, appsBySession, flagsBySession] = await Promise.all([
      ownerIdsP, appsForSessions(ids), sessionFlags(ids),
    ]);

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
        utm_source: r.utm_source ?? null,
        utm_medium: r.utm_medium ?? null,
        utm_campaign: r.utm_campaign ?? null,
        country: r.country,
        device: r.device,
        converted: r.converted ?? 0,
        purchased: r.purchased ?? 0,
        click_count: r.click_count,
        event_count: r.event_count,
        error_count: r.error_count,
        apps: appsBySession.get(r.session_id) ?? [],
        // The owner's: a known owner cookie id, or any is_admin or is_internal page view in the session.
        mine: isOwnerRow(ownerIds, {
          isAdmin: flagsBySession.get(r.session_id)?.admin,
          isInternal: flagsBySession.get(r.session_id)?.internal,
          cookieId: r.visitor_id,
        }),
        internal: flagsBySession.get(r.session_id)?.internal ?? false,
        bot: flagsBySession.get(r.session_id)?.bot ?? false,
      })),
      filters: {
        mine: filters.excludeMine ? 'exclude' : 'include',
        bots: filters.excludeBots ? 'exclude' : 'include',
      },
    };
  });

  app.get('/api/admin/sessions/:id', async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;

    const id = (req.params as { id: string }).id;
    if (!isValidId(id)) return reply.status(400).send({ error: 'Invalid session id.' });

    const [session, views, clicks, events, errors] = await Promise.all([
      dbGet<SessionRow>(`SELECT * FROM sessions WHERE session_id = ?`, id),
      dbAll<{ ts: number; path: string; referrer: string | null; referrer_host: string | null }>(
        `SELECT created_at_ms AS ts, path, referrer, referrer_host FROM page_views
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
      ...views.map(r => ({ ts: r.ts, kind: 'view' as const, path: r.path, referrer: r.referrer, referrer_host: r.referrer_host })),
      ...clicks.map(r => ({ ts: r.ts, kind: 'click' as const, path: r.path, label: r.label, href: r.href, track_name: r.track_name })),
      ...events.map(r => ({ ts: r.ts, kind: 'event' as const, name: r.event, app: r.tool, path: r.path, props: parseProps(r.metadata) })),
      ...errors.map(r => ({ ts: r.ts, kind: 'error' as const, app: r.app, name: r.name, msg: r.msg, url: r.url })),
    ]
      .sort((a, b) => a.ts - b.ts)
      .slice(0, TIMELINE_CAP);

    if (!session && timeline.length === 0) return reply.status(404).send({ error: 'Session not found.' });

    const [appsBySession, flagsBySession, ownerIds, counts] = await Promise.all([
      appsForSessions([id]),
      sessionFlags([id]),
      loadOwnerIds(),
      dbGet<{ click_count: number; event_count: number; error_count: number }>(
        `SELECT (SELECT COUNT(*) FROM click_events WHERE session_id = ?) AS click_count,
                (SELECT COUNT(*) FROM funnel_events WHERE session_id = ?) AS event_count,
                (SELECT COUNT(*) FROM app_errors WHERE session_id = ?) AS error_count`,
        id, id, id,
      ),
    ]);
    const flags = flagsBySession.get(id);
    // The same counts and mine/bot flags the list rows carry, so sessions_report's sessionId mode has them too.
    const sessionOut = session
      ? {
          ...session,
          click_count: Number(counts?.click_count ?? 0),
          event_count: Number(counts?.event_count ?? 0),
          error_count: Number(counts?.error_count ?? 0),
          mine: isOwnerRow(ownerIds, { isAdmin: flags?.admin, cookieId: session.visitor_id }),
          bot: flags?.bot ?? false,
        }
      : null;

    return { session: sessionOut, timeline, apps: appsBySession.get(id) ?? [] };
  });
}
