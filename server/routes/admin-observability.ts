import type { FastifyInstance } from 'fastify';
import { dbAll } from '../db.js';
import { requireAdmin } from '../clerk.js';
import { computeDrift } from '../../shared/manifest-schema.js';
import { flushEgress, topEgress, topEgressBySlug, topStaticAssets, earliestEgressDate, dayKey } from '../egress.js';

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

    const since = Math.floor(Date.now() / 1000) - 86_400;
    // page_views.created_at_ms is in milliseconds; other tables use seconds
    const sinceMsEpoch = since * 1000;
    // api_egress_daily is bucketed by calendar day, not a rolling window, so
    // "today + yesterday" is the closest available approximation of a
    // trailing 24h — flush first or the current minute's traffic is invisible.
    await safeQuery(() => flushEgress(), undefined);
    const egressSinceDate = dayKey(Date.now() - 86_400_000);

    const [manifests, traffic, bytesOut, errors, warns, synthSummary, latestErrors, alerts] = await Promise.all([
      safeQuery(() => dbAll<{
        slug: string; app_version: string; git_sha: string;
        host_kit_version: string; built_at: string; bundle_size_gz: number;
      }>(`SELECT slug, app_version, git_sha, host_kit_version, built_at, bundle_size_gz
          FROM app_manifests`), []),

      // Traffic: extract slug from /projects/<slug>/... path prefix
      safeQuery(() => dbAll<{ slug: string; n: number }>(
        `SELECT SUBSTR(path, 11, INSTR(SUBSTR(path, 11) || '/', '/') - 1) AS slug,
                COUNT(*) AS n
         FROM page_views
         WHERE created_at_ms > ? AND path LIKE '/projects/%'
         GROUP BY 1`,
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
        `SELECT app, COUNT(*) AS n FROM app_errors WHERE created_at > ? GROUP BY app`,
        since,
      ), []),

      safeQuery(() => dbAll<{ app: string; level: string; n: number }>(
        `SELECT app, level, COUNT(*) AS n FROM app_logs
         WHERE created_at > ? AND level IN ('warn','error') GROUP BY app, level`,
        since,
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
               FROM app_errors WHERE created_at > ? GROUP BY app) m
           ON a.app = m.app AND a.created_at = m.max_at`,
        since,
      ), []),

      safeQuery(() => dbAll<{ alert_kind: string; app_slug: string | null; details_json: string }>(
        `SELECT alert_kind, app_slug, details_json FROM cost_alerts WHERE resolved_at IS NULL`,
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
          .filter(a => a.app_slug === slug || a.app_slug === null)
          .map(a => ({ kind: a.alert_kind, details: a.details_json })),
        latestError: latestErrMap.get(slug) ?? null,
      };
    });

    return { rows, latestKit, generatedAt: Math.floor(Date.now() / 1000) };
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
}
