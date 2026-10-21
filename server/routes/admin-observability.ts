import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { load as loadYaml } from 'js-yaml';
import { dbAll, dbGet } from '../db.js';
import { requireAdmin } from '../clerk.js';
import { parseEnvSelector, envPredicate } from './telemetry.js';
import { computeDrift } from '../../shared/manifest-schema.js';
import { flushEgress, topEgress, topEgressBySlug, topStaticAssets, earliestEgressDate, dayKey } from '../egress.js';
import { VISITOR_CLASSES } from '../services/analytics.js';

type DriftStatus = 'current' | 'minor_behind' | 'major_behind' | 'unknown';

interface Row {
  slug: string;
  manifest: {
    version: string | null;
    gitSha: string | null;
    hostKit: string | null;
    builtAt: string | null;
    bundleGz: number | null;
  };
  traffic24h: number;
  bytesOut24h: number;
  errors24h: number;
  warnLogs24h: number;
  errorLogs24h: number;
  synthetic: {
    passes: number;
    fails: number;
    loadP50: number | null;
    loadP95: number | null;
    latestOk: boolean | null;
  };
  hostKitDrift: DriftStatus;
  openAlerts: { kind: string; details: string }[];
  latestError: { msg: string; ts: number } | null;
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

export function registerObservabilityRoutes(app: FastifyInstance): void {
  app.get('/api/admin/observability', async (req, reply) => {
    const email = await requireAdmin(req, reply);
    if (!email) return;

    const env = parseEnvSelector((req.query as { env?: string } | undefined)?.env);
    const ev = envPredicate(env);
    const evA = envPredicate(env, 'a.env');
    const since = Math.floor(Date.now() / 1000) - 86_400;
    // page_hits.ts_ms is in milliseconds; other tables use seconds
    const sinceMsEpoch = since * 1000;
    // api_egress_daily is bucketed by calendar day, not a rolling window, so
    // "today + yesterday" is the closest available approximation of a
    // trailing 24h — flush first or the current minute's traffic is invisible.
    await safeQuery(() => flushEgress(), undefined);
    const egressSinceDate = dayKey(Date.now() - 86_400_000);

    const [manifests, traffic, bytesOut, errors, warns, synthSummary, latestErrors, alerts, desktopApps] = await Promise.all([
      safeQuery(() => dbAll<{
        slug: string; app_version: string; git_sha: string;
        host_kit_version: string; built_at: string; bundle_size_gz: number;
      }>(`SELECT slug, app_version, git_sha, host_kit_version, built_at, bundle_size_gz
          FROM app_manifests`), []),

      // Traffic: human server-side page hits per slug (page_hits is written by
      // the HTML-response recorder, so static-path apps are counted too).
      safeQuery(() => dbAll<{ slug: string; n: number }>(
        `SELECT slug, COUNT(*) AS n
         FROM page_hits
         WHERE ts_ms >= ? AND is_bot = 0 AND status < 400 AND slug IS NOT NULL
         GROUP BY slug`,
        sinceMsEpoch,
      ), []),

      // Static-asset egress by slug — route is stored as `static:<slug>`.
      safeQuery(() => dbAll<{ slug: string; bytes: number }>(
        `SELECT SUBSTR(route, 8) AS slug, SUM(bytes) AS bytes
           FROM api_egress_daily
          WHERE date >= ? AND route LIKE 'static:%'
          GROUP BY 1`,
        egressSinceDate,
      ), []),

      safeQuery(() => dbAll<{ app: string; n: number }>(
        `SELECT app, COUNT(*) AS n FROM app_errors WHERE created_at > ? AND ${ev.sql} GROUP BY app`,
        since, ...ev.args,
      ), []),

      safeQuery(() => dbAll<{ app: string; level: string; n: number }>(
        `SELECT app, level, COUNT(*) AS n FROM app_logs
         WHERE created_at > ? AND level IN ('warn','error') AND ${ev.sql} GROUP BY app, level`,
        since, ...ev.args,
      ), []),

      // SQLite has no native PERCENTILE; AVG as p50 approximation, MAX as p95
      safeQuery(() => dbAll<{
        slug: string; passes: number; fails: number;
        p50: number | null; p95: number | null; latest_ok: number | null;
      }>(
        `SELECT slug,
                SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS passes,
                SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS fails,
                AVG(load_ms) AS p50,
                MAX(load_ms) AS p95,
                (SELECT ok FROM synthetic_runs s2
                 WHERE s2.slug = s1.slug ORDER BY ran_at DESC LIMIT 1) AS latest_ok
         FROM synthetic_runs s1 WHERE ran_at > ? GROUP BY slug`,
        since,
      ), []),

      safeQuery(() => dbAll<{ app: string; msg: string; created_at: number }>(
        `SELECT a.app, a.msg, a.created_at FROM app_errors a
         JOIN (SELECT app, MAX(created_at) AS max_at
               FROM app_errors WHERE created_at > ? AND ${ev.sql} GROUP BY app) m
           ON a.app = m.app AND a.created_at = m.max_at
        WHERE ${evA.sql}`,
        since, ...ev.args, ...evA.args,
      ), []),

      safeQuery(() => dbAll<{ alert_kind: string; app_slug: string | null; details_json: string }>(
        `SELECT alert_kind, app_slug, details_json FROM cost_alerts WHERE resolved_at IS NULL`,
      ), []),

      // Desktop/phone-home apps that report into app_installs. They have no
      // manifest so they can never appear in `rows`; this teaser exists so the
      // dashboard can link out to /api/admin/observability/installs?app=<app>
      // without the panel being invisible until someone knows to ask for it.
      safeQuery(() => dbAll<{ app: string; installs: number; active7: number }>(
        `SELECT app, COUNT(*) AS installs,
                SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS active7
           FROM app_installs WHERE ${ev.sql} GROUP BY app ORDER BY installs DESC`,
        since - 6 * 86_400, ...ev.args,
      ), []),
    ]);

    const latestKit = process.env.BILKO_LATEST_HOST_KIT ?? null;

    const trafficMap = new Map(traffic.map(t => [t.slug, t.n]));
    const bytesOutMap = new Map(bytesOut.map(b => [b.slug, b.bytes]));
    const errorsMap  = new Map(errors.map(e => [e.app, e.n]));
    const warnsByApp = new Map<string, { warn: number; error: number }>();
    for (const w of warns) {
      const cur = warnsByApp.get(w.app) ?? { warn: 0, error: 0 };
      if (w.level === 'warn') cur.warn = w.n;
      if (w.level === 'error') cur.error = w.n;
      warnsByApp.set(w.app, cur);
    }
    const synthMap    = new Map(synthSummary.map(s => [s.slug, s]));
    const latestErrMap = new Map(latestErrors.map(e => [e.app, { msg: e.msg, ts: e.created_at }]));

    const rows: Row[] = manifests.map(m => {
      const slug = m.slug;
      const synth = synthMap.get(slug);
      return {
        slug,
        manifest: {
          version:  m.app_version,
          gitSha:   m.git_sha,
          hostKit:  m.host_kit_version,
          builtAt:  m.built_at,
          bundleGz: m.bundle_size_gz,
        },
        traffic24h:   trafficMap.get(slug) ?? 0,
        bytesOut24h:  bytesOutMap.get(slug) ?? 0,
        errors24h:    errorsMap.get(slug)  ?? 0,
        warnLogs24h:  warnsByApp.get(slug)?.warn  ?? 0,
        errorLogs24h: warnsByApp.get(slug)?.error ?? 0,
        synthetic: {
          passes:   synth?.passes ?? 0,
          fails:    synth?.fails  ?? 0,
          loadP50:  synth?.p50    ?? null,
          loadP95:  synth?.p95    ?? null,
          latestOk: synth?.latest_ok != null ? synth.latest_ok === 1 : null,
        },
        hostKitDrift: latestKit ? computeDrift(m.host_kit_version, latestKit) : 'unknown',
        openAlerts: alerts
          .filter(a => a.app_slug === slug)
          .map(a => ({ kind: a.alert_kind, details: a.details_json })),
        latestError: latestErrMap.get(slug) ?? null,
      };
    });

    const globalAlerts = alerts
      .filter(a => a.app_slug === null)
      .map(a => ({ kind: a.alert_kind, details: a.details_json }));

    return { env, rows, globalAlerts, desktopApps, latestKit, generatedAt: Math.floor(Date.now() / 1000) };
  });

  // Server-side traffic report from page_hits. Human aggregates exclude bots and
  // error responses; botHits and `recent` deliberately include bots (flagged).
  app.get('/api/admin/traffic', async (req, reply) => {
    const email = await requireAdmin(req, reply);
    if (!email) return;

    const q = req.query as { days?: string; slug?: string; self?: string };
    const days = Math.min(Math.max(parseInt(q.days || '7', 10) || 7, 1), 90);
    const slug = q.slug ? q.slug.slice(0, 100) : null;
    const since = Date.now() - days * 86_400_000;

    // Default includes the owner's own traffic; self=exclude drops is_admin rows.
    const selfSql = q.self === 'exclude' ? ' AND COALESCE(is_admin, 0) = 0' : '';
    const slugSql = (slug ? ' AND slug = ?' : '') + selfSql;
    const slugArgs: string[] = slug ? [slug] : [];
    const human = `ts_ms >= ? AND is_bot = 0 AND status < 400${slugSql}`;
    const VKEY = 'COALESCE(visitor_id, visitor_hash)';
    const humanArgs = [since, ...slugArgs];
    // All visitor classes (agents included); legacy NULL-class rows derive from is_bot.
    const CLASS_SQL = "COALESCE(visitor_class, CASE WHEN is_bot = 1 THEN 'script' ELSE 'human' END)";
    const allClasses = `ts_ms >= ? AND status < 400${slugSql}`;

    const [totals, botRow, notFoundRow, byDay, topPages, topReferrers, bySlug, byCountry, byDevice, byBrowser, recent, earliest, clickTotal, topClicks, visitorRows, visitorClicks] = await Promise.all([
      safeQuery(() => dbGet<{ hits: number; visitors: number }>(
        `SELECT COUNT(*) AS hits, COUNT(DISTINCT ${VKEY}) AS visitors FROM page_hits WHERE ${human}`,
        ...humanArgs,
      ), undefined),
      safeQuery(() => dbGet<{ n: number }>(
        `SELECT COUNT(*) AS n FROM page_hits WHERE ts_ms >= ? AND is_bot = 1${slugSql}`,
        since, ...slugArgs,
      ), undefined),
      safeQuery(() => dbGet<{ n: number }>(
        `SELECT COUNT(*) AS n FROM page_hits WHERE ts_ms >= ? AND is_bot = 0 AND status = 404${slugSql}`,
        since, ...slugArgs,
      ), undefined),
      safeQuery(() => dbAll<{ date: string; hits: number; visitors: number }>(
        `SELECT date, COUNT(*) AS hits, COUNT(DISTINCT ${VKEY}) AS visitors
           FROM page_hits WHERE ${human} GROUP BY date ORDER BY date`,
        ...humanArgs,
      ), []),
      safeQuery(() => dbAll<{ path: string; hits: number; visitors: number }>(
        `SELECT path, COUNT(*) AS hits, COUNT(DISTINCT ${VKEY}) AS visitors
           FROM page_hits WHERE ${human} GROUP BY path ORDER BY hits DESC LIMIT 25`,
        ...humanArgs,
      ), []),
      safeQuery(() => dbAll<{ host: string; hits: number }>(
        `SELECT referrer_host AS host, COUNT(*) AS hits
           FROM page_hits WHERE ${human} AND referrer_host IS NOT NULL
          GROUP BY referrer_host ORDER BY hits DESC LIMIT 25`,
        ...humanArgs,
      ), []),
      safeQuery(() => dbAll<{ slug: string; hits: number; visitors: number }>(
        `SELECT slug, COUNT(*) AS hits, COUNT(DISTINCT ${VKEY}) AS visitors
           FROM page_hits WHERE ${human} AND slug IS NOT NULL
          GROUP BY slug ORDER BY hits DESC LIMIT 25`,
        ...humanArgs,
      ), []),
      safeQuery(() => dbAll<{ country: string; hits: number }>(
        `SELECT country, COUNT(*) AS hits FROM page_hits
          WHERE ${human} AND country IS NOT NULL GROUP BY country ORDER BY hits DESC LIMIT 25`,
        ...humanArgs,
      ), []),
      safeQuery(() => dbAll<{ device: string; hits: number }>(
        `SELECT device, COUNT(*) AS hits FROM page_hits
          WHERE ${human} GROUP BY device ORDER BY hits DESC LIMIT 25`,
        ...humanArgs,
      ), []),
      safeQuery(() => dbAll<{ browser: string; hits: number }>(
        `SELECT browser, COUNT(*) AS hits FROM page_hits
          WHERE ${human} GROUP BY browser ORDER BY hits DESC LIMIT 25`,
        ...humanArgs,
      ), []),
      safeQuery(() => dbAll<{
        ts_ms: number; path: string; status: number; referrer_host: string | null;
        country: string | null; device: string; browser: string; os: string; is_bot: number;
        ip: string | null; ua: string | null; referrer: string | null; visitor_id: string | null;
        visitor_hash: string | null; user_email: string | null; is_admin: number | null;
        session_id: string | null; visitor_class: string;
      }>(
        `SELECT ts_ms, path, status, referrer_host, country, device, browser, os, is_bot,
                ip, ua, referrer, visitor_id, visitor_hash, user_email, is_admin, session_id,
                ${CLASS_SQL} AS visitor_class
           FROM page_hits WHERE ts_ms >= ?${slugSql} ORDER BY ts_ms DESC LIMIT 200`,
        since, ...slugArgs,
      ), []),
      safeQuery(() => dbGet<{ d: string | null }>(`SELECT MIN(date) AS d FROM page_hits`), undefined),
      safeQuery(() => dbGet<{ n: number }>(
        `SELECT COUNT(*) AS n FROM click_events WHERE ts_ms >= ? AND is_bot = 0${slugSql}`,
        since, ...slugArgs,
      ), undefined),
      safeQuery(() => dbAll<{
        path: string; tag: string | null; label: string | null; href: string | null; clicks: number; visitors: number;
      }>(
        `SELECT path, tag, label, href, COUNT(*) AS clicks, COUNT(DISTINCT ${VKEY}) AS visitors
           FROM click_events WHERE ts_ms >= ? AND is_bot = 0${slugSql}
          GROUP BY path, tag, label, href ORDER BY clicks DESC LIMIT 25`,
        since, ...slugArgs,
      ), []),
      safeQuery(() => dbAll<{
        vid: string; ip: string | null; country: string | null; device: string | null;
        browser: string | null; os: string | null; user_email: string | null; is_admin: number | null;
        hits: number; pages: number; first_seen: number; last_seen: number;
      }>(
        `SELECT ${VKEY} AS vid, MAX(ip) AS ip, MAX(country) AS country, MAX(device) AS device,
                MAX(browser) AS browser, MAX(os) AS os, MAX(user_email) AS user_email,
                MAX(COALESCE(is_admin, 0)) AS is_admin, COUNT(*) AS hits,
                COUNT(DISTINCT path) AS pages, MIN(ts_ms) AS first_seen, MAX(ts_ms) AS last_seen
           FROM page_hits WHERE ${human} AND ${VKEY} IS NOT NULL
          GROUP BY vid ORDER BY hits DESC, last_seen DESC LIMIT 100`,
        ...humanArgs,
      ), []),
      safeQuery(() => dbAll<{ vid: string; n: number }>(
        `SELECT ${VKEY} AS vid, COUNT(*) AS n FROM click_events
          WHERE ts_ms >= ? AND is_bot = 0${slugSql} AND ${VKEY} IS NOT NULL GROUP BY vid`,
        since, ...slugArgs,
      ), []),
    ]);
    const [classRows, classPageRows] = await Promise.all([
      safeQuery(() => dbAll<{ cls: string; hits: number; visitors: number }>(
        `SELECT ${CLASS_SQL} AS cls, COUNT(*) AS hits, COUNT(DISTINCT ${VKEY}) AS visitors
           FROM page_hits WHERE ${allClasses} GROUP BY cls`,
        since, ...slugArgs,
      ), []),
      safeQuery(() => dbAll<{ path: string; cls: string; hits: number; visitors: number }>(
        `SELECT path, ${CLASS_SQL} AS cls, COUNT(*) AS hits, COUNT(DISTINCT ${VKEY}) AS visitors
           FROM page_hits WHERE ${allClasses} GROUP BY path, cls ORDER BY hits DESC LIMIT 100`,
        since, ...slugArgs,
      ), []),
    ]);
    const classMap = new Map(classRows.map(r => [r.cls, r]));
    const byClass = VISITOR_CLASSES.map(c => ({
      class: c as string,
      hits: classMap.get(c)?.hits ?? 0,
      visitors: classMap.get(c)?.visitors ?? 0,
    }));
    const topPagesByClass = classPageRows.map(r => ({ path: r.path, class: r.cls, hits: r.hits, visitors: r.visitors }));
    const clicksByVisitor = new Map(visitorClicks.map(c => [c.vid, c.n]));

    // Real-vs-bot signals: bot visitors (UA-flagged), human visitors seen exactly
    // once (likely undeclared crawlers or bounces), and bilko_vid cookie uniques
    // (client_vid; only populated since the cookie shipped).
    const [botVisitorsRow, singleHitRow, cookieRow, cookieSince] = await Promise.all([
      safeQuery(() => dbGet<{ n: number }>(
        `SELECT COUNT(DISTINCT ${VKEY}) AS n FROM page_hits WHERE ts_ms >= ? AND is_bot = 1${slugSql}`,
        since, ...slugArgs,
      ), undefined),
      safeQuery(() => dbGet<{ n: number }>(
        `SELECT COUNT(*) AS n FROM (SELECT ${VKEY} AS vid FROM page_hits WHERE ${human}
          GROUP BY vid HAVING COUNT(*) = 1)`,
        ...humanArgs,
      ), undefined),
      safeQuery(() => dbGet<{ n: number }>(
        `SELECT COUNT(DISTINCT client_vid) AS n FROM page_hits WHERE ${human} AND client_vid IS NOT NULL`,
        ...humanArgs,
      ), undefined),
      safeQuery(() => dbGet<{ d: string | null }>(
        `SELECT MIN(date) AS d FROM page_hits WHERE client_vid IS NOT NULL`,
      ), undefined),
    ]);

    return {
      days,
      totals: {
        hits: totals?.hits ?? 0,
        visitors: totals?.visitors ?? 0,
        botHits: botRow?.n ?? 0,
        notFound: notFoundRow?.n ?? 0,
        clicks: clickTotal?.n ?? 0,
      },
      byDay,
      topPages,
      byClass,
      topPagesByClass,
      topReferrers,
      bySlug,
      byCountry,
      byDevice,
      byBrowser,
      topClicks,
      recent: recent.map(r => ({
        ts: r.ts_ms,
        path: r.path,
        status: r.status,
        referrerHost: r.referrer_host,
        country: r.country,
        device: r.device,
        browser: r.browser,
        os: r.os,
        isBot: r.is_bot === 1,
        ip: r.ip,
        ua: r.ua,
        referrer: r.referrer,
        visitorId: r.visitor_id ?? r.visitor_hash,
        userEmail: r.user_email,
        isAdmin: r.is_admin === 1,
        sessionId: r.session_id ?? null,
        visitorClass: r.visitor_class,
      })),
      visitors: visitorRows.map(v => ({
        visitorId: v.vid,
        ip: v.ip,
        country: v.country,
        device: v.device,
        browser: v.browser,
        os: v.os,
        userEmail: v.user_email,
        isAdmin: v.is_admin === 1,
        hits: v.hits,
        clicks: clicksByVisitor.get(v.vid) ?? 0,
        pages: v.pages,
        firstSeen: v.first_seen,
        lastSeen: v.last_seen,
      })),
      quality: {
        botVisitors: botVisitorsRow?.n ?? 0,
        singleHitVisitors: singleHitRow?.n ?? 0,
        cookieVisitors: cookieRow?.n ?? 0,
        cookieSince: cookieSince?.d ?? null,
      },
      earliestDate: earliest?.d ?? null,
      generatedAt: Math.floor(Date.now() / 1000),
    };
  });

  // Per-visitor timeline: page hits and clicks merged, oldest first, latest 500.
  app.get('/api/admin/traffic/visitor/:id', async (req, reply) => {
    const email = await requireAdmin(req, reply);
    if (!email) return;

    const id = String((req.params as { id: string }).id).slice(0, 200);
    const q = req.query as { days?: string };
    const days = Math.min(Math.max(parseInt(q.days || '7', 10) || 7, 1), 90);
    const since = Date.now() - days * 86_400_000;

    const rows = await safeQuery(() => dbAll<{
      ts_ms: number; kind: string; path: string; status: number | null; label: string | null;
      href: string | null; referrer: string | null; ip: string | null; ua: string | null;
    }>(
      `SELECT * FROM (
         SELECT ts_ms, 'hit' AS kind, path, status, NULL AS label, NULL AS href,
                COALESCE(referrer, referrer_host) AS referrer, ip, ua
           FROM page_hits WHERE ts_ms >= ? AND COALESCE(visitor_id, visitor_hash) = ?
         UNION ALL
         SELECT ts_ms, 'click' AS kind, path, NULL AS status, label, href,
                NULL AS referrer, ip, NULL AS ua
           FROM click_events WHERE ts_ms >= ? AND COALESCE(visitor_id, visitor_hash) = ?
          ORDER BY ts_ms DESC LIMIT 500
       ) ORDER BY ts_ms ASC`,
      since, id, since, id,
    ), []);

    return {
      visitorId: id,
      days,
      events: rows.map(r => ({
        ts: r.ts_ms,
        kind: r.kind as 'hit' | 'click',
        path: r.path,
        ...(r.status != null ? { status: r.status } : {}),
        ...(r.label != null ? { label: r.label } : {}),
        ...(r.href != null ? { href: r.href } : {}),
        ...(r.referrer != null ? { referrer: r.referrer } : {}),
        ip: r.ip,
        ua: r.ua,
      })),
      generatedAt: Math.floor(Date.now() / 1000),
    };
  });

  // Grouped error list: what an app's errors actually are, not just a count.
  // Admin-only; error stacks/URLs are never public.
  app.get('/api/admin/observability/errors', async (req, reply) => {
    const email = await requireAdmin(req, reply);
    if (!email) return;

    const q = req.query as { app?: string; days?: string; limit?: string; env?: string };
    const env = parseEnvSelector(q.env);
    const ev = envPredicate(env);
    const appName = q.app ? String(q.app).slice(0, 60) : '';
    const days = Math.min(Math.max(parseInt(q.days || '1', 10) || 1, 1), 90);
    const limit = Math.min(Math.max(parseInt(q.limit || '50', 10) || 50, 1), 200);
    const since = Math.floor(Date.now() / 1000) - days * 86_400;

    const SIG = `COALESCE(name, 'Error') || '|' || SUBSTR(COALESCE(stack, ''), 1, 80)`;
    const where = `created_at > ? AND ${ev.sql}${appName ? ' AND app = ?' : ''}`;
    const whereArgs: (string | number)[] = [since, ...ev.args, ...(appName ? [appName] : [])];

    const groupRows = await dbAll<{
      app: string; signature: string; name: string; msg: string; count: number;
      firstSeen: number; lastSeen: number; sampleId: number;
    }>(
      `SELECT app, ${SIG} AS signature, COALESCE(name, 'Error') AS name,
              MIN(msg) AS msg, COUNT(*) AS count,
              MIN(created_at) AS firstSeen, MAX(created_at) AS lastSeen,
              MAX(id) AS sampleId
         FROM app_errors
        WHERE ${where}
        GROUP BY app, signature
        ORDER BY count DESC, lastSeen DESC
        LIMIT ?`,
      ...whereArgs, limit,
    );

    const totalRow = await dbGet<{ errors: number; groups: number }>(
      `SELECT COUNT(*) AS errors, COUNT(DISTINCT app || char(0) || ${SIG}) AS groups
         FROM app_errors WHERE ${where}`,
      ...whereArgs,
    );

    const versionRows = await dbAll<{ app: string; signature: string; version: string }>(
      `SELECT DISTINCT app, ${SIG} AS signature, version
         FROM app_errors WHERE version IS NOT NULL AND ${where}`,
      ...whereArgs,
    );
    const versionsByGroup = new Map<string, string[]>();
    for (const v of versionRows) {
      const key = `${v.app}\u0000${v.signature}`;
      const list = versionsByGroup.get(key);
      if (list) list.push(v.version); else versionsByGroup.set(key, [v.version]);
    }

    const sampleUrls = new Map<number, string | null>();
    if (groupRows.length > 0) {
      const ids = groupRows.map((g) => Number(g.sampleId));
      const rows = await dbAll<{ id: number; url: string | null }>(
        `SELECT id, url FROM app_errors WHERE id IN (${ids.map(() => '?').join(',')})`,
        ...ids,
      );
      for (const r of rows) sampleUrls.set(Number(r.id), r.url);
    }

    return {
      env,
      days,
      app: appName || null,
      totals: { errors: Number(totalRow?.errors ?? 0), groups: Number(totalRow?.groups ?? 0) },
      groups: groupRows.map((g) => ({
        app: g.app,
        signature: g.signature,
        name: g.name,
        msg: g.msg,
        count: Number(g.count),
        firstSeen: Number(g.firstSeen),
        lastSeen: Number(g.lastSeen),
        versions: (versionsByGroup.get(`${g.app}\u0000${g.signature}`) ?? []).sort(),
        sampleUrl: sampleUrls.get(Number(g.sampleId)) ?? null,
        sampleId: Number(g.sampleId),
      })),
    };
  });

  app.get('/api/admin/observability/errors/:id', async (req, reply) => {
    const email = await requireAdmin(req, reply);
    if (!email) return;

    const raw = (req.params as { id: string }).id;
    if (!/^\d+$/.test(raw)) return reply.status(400).send({ error: 'id must be an integer' });
    const id = parseInt(raw, 10);

    const row = await dbGet<Record<string, unknown> & { context_json: string | null }>(
      `SELECT id, app, version, name, msg, stack, url, ua, visitor_id, session_id,
              context_json, created_at, env
         FROM app_errors WHERE id = ?`,
      id,
    );
    if (!row) return reply.status(404).send({ error: 'Not found' });

    let context: unknown = row.context_json;
    if (typeof row.context_json === 'string') {
      try { context = JSON.parse(row.context_json); } catch { /* keep raw string */ }
    }
    return { ...row, id: Number(row.id), created_at: Number(row.created_at), context_json: context };
  });

  // Desktop-app panel: installs are a slowly-changing dimension (app_installs),
  // not an event stream, so the rollups here are GROUP BYs over one row per
  // machine. Separate route from the per-app observability rollup above because
  // that one is keyed by published static-app slug — a desktop app has no
  // manifest, no synthetic run and no egress, and would be an all-null row there.
  //
  // `app` defaults to session-manager but is a parameter: any phone-home client
  // posting to /api/telemetry/install with its own `app` gets the same panel.
  app.get('/api/admin/observability/installs', async (req, reply) => {
    const email = await requireAdmin(req, reply);
    if (!email) return;

    const q = req.query as { app?: string; days?: string; limit?: string; env?: string };
    const env = parseEnvSelector(q.env);
    const ev = envPredicate(env);
    const appName = (q.app || 'session-manager').slice(0, 60);
    const days = Math.min(Math.max(parseInt(q.days || '30', 10) || 30, 1), 365);
    const limit = Math.min(Math.max(parseInt(q.limit || '20', 10) || 20, 1), 100);

    const now = Math.floor(Date.now() / 1000);
    const since7 = now - 7 * 86_400;
    const since30 = now - 30 * 86_400;
    const sinceWindow = now - days * 86_400;

    const [totals, byPlatform, byArch, byVersion, errorsByVersion, topSignatures, logLevels] = await Promise.all([
      safeQuery(() => dbGet<{
        total: number; active7: number; active30: number; new7: number;
      }>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN last_seen_at  >= ? THEN 1 ELSE 0 END) AS active7,
                SUM(CASE WHEN last_seen_at  >= ? THEN 1 ELSE 0 END) AS active30,
                SUM(CASE WHEN first_seen_at >= ? THEN 1 ELSE 0 END) AS new7
           FROM app_installs WHERE app = ? AND ${ev.sql}`,
        since7, since30, since7, appName, ...ev.args,
      ), undefined),

      safeQuery(() => dbAll<{ platform: string | null; n: number }>(
        `SELECT platform, COUNT(*) AS n FROM app_installs
          WHERE app = ? AND ${ev.sql} GROUP BY platform ORDER BY n DESC`,
        appName, ...ev.args,
      ), []),

      safeQuery(() => dbAll<{ arch: string | null; n: number }>(
        `SELECT arch, COUNT(*) AS n FROM app_installs
          WHERE app = ? AND ${ev.sql} GROUP BY arch ORDER BY n DESC`,
        appName, ...ev.args,
      ), []),

      safeQuery(() => dbAll<{ app_version: string | null; installs: number; active7: number }>(
        `SELECT app_version, COUNT(*) AS installs,
                SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS active7
           FROM app_installs WHERE app = ? AND ${ev.sql}
          GROUP BY app_version ORDER BY installs DESC`,
        since7, appName, ...ev.args,
      ), []),

      // The release-regression query: errors per version, and how many distinct
      // machines they came from (10 000 errors from one looping install is a
      // very different signal from 10 errors across 10 installs).
      safeQuery(() => dbAll<{ version: string | null; errors: number; visitors: number }>(
        `SELECT version, COUNT(*) AS errors, COUNT(DISTINCT visitor_id) AS visitors
           FROM app_errors WHERE app = ? AND created_at >= ? AND ${ev.sql}
          GROUP BY version ORDER BY errors DESC`,
        appName, sinceWindow, ...ev.args,
      ), []),

      // Top-N signatures with counts, rather than the single latest `msg`
      // sample the per-app rollup above exposes.
      safeQuery(() => dbAll<{
        name: string | null; msg: string; n: number; visitors: number; last_seen: number;
      }>(
        `SELECT name, msg, COUNT(*) AS n, COUNT(DISTINCT visitor_id) AS visitors,
                MAX(created_at) AS last_seen
           FROM app_errors WHERE app = ? AND created_at >= ? AND ${ev.sql}
          GROUP BY name, msg ORDER BY n DESC LIMIT ?`,
        appName, sinceWindow, ...ev.args, limit,
      ), []),

      safeQuery(() => dbAll<{ level: string; n: number }>(
        `SELECT level, COUNT(*) AS n FROM app_logs
          WHERE app = ? AND created_at >= ? AND ${ev.sql} GROUP BY level`,
        appName, sinceWindow, ...ev.args,
      ), []),
    ]);

    return {
      app: appName,
      env,
      days,
      installs: {
        total:    totals?.total    ?? 0,
        active7:  totals?.active7  ?? 0,
        active30: totals?.active30 ?? 0,
        new7:     totals?.new7     ?? 0,
        byPlatform,
        byArch,
        byVersion,
      },
      errorsByVersion,
      topSignatures,
      logLevels,
      generatedAt: now,
    };
  });

  // Where the bandwidth actually goes. Separate from the per-app rollup above
  // because egress is keyed by route pattern, not by app slug — a single route
  // can serve many slugs, and the expensive ones (inline image payloads,
  // unpaginated lists) are route-shaped problems, not app-shaped ones.
  app.get('/api/admin/egress', async (req, reply) => {
    const email = await requireAdmin(req, reply);
    if (!email) return;

    const q = req.query as { days?: string; limit?: string; slug?: string };
    const days = Math.min(Math.max(parseInt(q.days || '7', 10) || 7, 1), 90);
    const limit = Math.min(Math.max(parseInt(q.limit || '25', 10) || 25, 1), 200);

    // Flush the in-process buffer first, or the last minute of traffic — often
    // the exact minute someone is investigating — is invisible.
    await safeQuery(() => flushEgress(), undefined);

    // Distinguishes "no traffic in this window" from "metering has never
    // run" — same signal usage_report (mcp-host-server) already exposes.
    const earliestDate = await safeQuery(() => earliestEgressDate(), null);

    const rows = await safeQuery(() => topEgress(days, limit), []);
    const totalBytes = rows.reduce((n, r) => n + r.bytes, 0);
    // Per-project bandwidth, driven by api_egress_daily's static:<slug> rows
    // directly — no join onto app_manifests, so a slug with traffic and no
    // published manifest still shows up, and _host/_other stay their own rows.
    const bySlug = await safeQuery(() => topEgressBySlug(days), []);
    // Per-file attribution for static traffic — "which FILE under a project
    // burned the bytes", not just "which project". Bounded by construction
    // (see static_asset_daily's comment in db.ts); `slug` narrows to one
    // project, otherwise it's the global top-N across all projects.
    const assets = await safeQuery(() => topStaticAssets(days, limit, q.slug || undefined), []);

    return { rows, bySlug, totalBytes, assets, earliestDate, days, generatedAt: Math.floor(Date.now() / 1000) };
  });

  // Days since the last LIVE blog post, colour-coded against blog.config.yaml's
  // cadence policy — this is the tile the 36-day gap incident would have
  // caught (nothing on-site showed a number before this route existed).
  // Reads the same DB table the public /api/blog route serves, not a cache,
  // so this can never show "healthy" while the public site is actually stale.
  app.get('/api/admin/blog-cadence', async (req, reply) => {
    const email = await requireAdmin(req, reply);
    if (!email) return;

    const configPath = resolve(process.cwd(), '.claude/skills/blog-from-git/blog.config.yaml');
    let config: { target_gap_days?: [number, number]; catchup_trigger_days?: number } | null;
    try {
      const raw = readFileSync(configPath, 'utf-8');
      const parsed = loadYaml(raw) as { cadence?: typeof config };
      config = parsed.cadence ?? null;
    } catch (err) {
      // Logged, not silently swallowed — a broken read must not look
      // identical to "cadence just isn't configured" (status: 'unknown').
      req.log.error({ err, configPath }, '[blog-cadence] failed to read/parse blog.config.yaml');
      config = null;
    }

    const latest = await safeQuery(
      () => dbGet<{ published_at: string }>(
        `SELECT published_at FROM blog_posts WHERE published = 1 AND datetime(published_at) <= datetime('now') ORDER BY published_at DESC LIMIT 1`,
      ),
      undefined,
    );

    const targetUpperDays = config?.target_gap_days?.[1] ?? null;
    const catchupTriggerDays = config?.catchup_trigger_days ?? null;
    const lastPublishedAt = latest?.published_at ?? null;
    const gapDays = lastPublishedAt
      ? Math.floor((Date.now() - new Date(lastPublishedAt).getTime()) / 86_400_000)
      : null;

    let status: 'ok' | 'warn' | 'critical' | 'unknown' = 'unknown';
    if (gapDays !== null && targetUpperDays !== null && catchupTriggerDays !== null) {
      if (gapDays < targetUpperDays) status = 'ok';
      else if (gapDays < catchupTriggerDays) status = 'warn';
      else status = 'critical';
    }

    return { lastPublishedAt, gapDays, targetUpperDays, catchupTriggerDays, status };
  });
}
