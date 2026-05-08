import type { FastifyInstance } from 'fastify';
import { dbAll } from '../db.js';
import { requireAdmin } from '../clerk.js';
import { computeDrift } from '../../shared/manifest-schema.js';

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

    const [manifests, traffic, errors, warns, synthSummary, latestErrors, alerts] = await Promise.all([
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
}
