import type { FastifyInstance } from 'fastify';
import { dbAll, dbGet } from '../db.js';
import { requireAdmin } from '../clerk.js';

const APP = 'session-manager';
const ISSUE_LIMIT = 50;
const MIN_DAYS = 1;
const MAX_DAYS = 90;

// Event names Session Manager emits via /api/telemetry/event.
const EV_LAUNCH = 'app.launch';
const EV_SESSION = 'session.open';
const EV_EPIC = 'epic.create';

// funnel_events.created_at is a DATETIME string ('YYYY-MM-DD HH:MM:SS', UTC);
// app_logs/app_errors.created_at are epoch seconds. Two window forms needed.
// Prefer the real column, fall back to the props blob so rows written before
// funnel_events.version existed still attribute.
const FUNNEL_VERSION = `COALESCE(version, json_extract(metadata, '$.appVersion'))`;

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

function clampDays(raw: unknown): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(n)) return 30;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.floor(n)));
}

function median(values: number[]): number {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return 0;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : Math.round((xs[mid - 1] + xs[mid]) / 2);
}

export function registerSessionManagerUsageRoutes(app: FastifyInstance): void {
  app.get('/api/admin/session-manager/usage', async (req, reply) => {
    const email = await requireAdmin(req, reply);
    if (!email) return;

    const days = clampDays((req.query as Record<string, unknown> | undefined)?.days);
    const now = Math.floor(Date.now() / 1000);
    const since = now - days * 86_400;
    const since7 = now - 7 * 86_400;
    const since30 = now - 30 * 86_400;
    const sinceIso = new Date(since * 1000).toISOString().slice(0, 19).replace('T', ' ');

    const [
      installTotals,
      installsByVersion,
      installsByPlatform,
      installSpecs,
      usageDaily,
      usageByVersion,
      issues,
      issueVersions,
      issuePlatforms,
      errorsByVersion,
      errorsDaily,
    ] = await Promise.all([
      // ---- installs -------------------------------------------------------
      // app_installs is populated by POST /api/telemetry/install. Until that
      // ships, every installs.* query falls back to zeros rather than 500ing —
      // the dashboard's empty state is a first-class view.
      safeQuery(() => dbGet<{ total: number; active7: number; active30: number; new7: number }>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN last_seen_at  > ? THEN 1 ELSE 0 END) AS active7,
                SUM(CASE WHEN last_seen_at  > ? THEN 1 ELSE 0 END) AS active30,
                SUM(CASE WHEN first_seen_at > ? THEN 1 ELSE 0 END) AS new7
         FROM app_installs WHERE app = ?`,
        since7, since30, since7, APP,
      ), null),

      safeQuery(() => dbAll<{ version: string | null; installs: number; active7: number }>(
        `SELECT app_version AS version,
                COUNT(*) AS installs,
                SUM(CASE WHEN last_seen_at > ? THEN 1 ELSE 0 END) AS active7
         FROM app_installs WHERE app = ?
         GROUP BY app_version
         ORDER BY installs DESC
         LIMIT 50`,
        since7, APP,
      ), []),

      safeQuery(() => dbAll<{ platform: string | null; arch: string | null; installs: number }>(
        `SELECT platform, arch, COUNT(*) AS installs
         FROM app_installs WHERE app = ?
         GROUP BY platform, arch
         ORDER BY installs DESC
         LIMIT 50`,
        APP,
      ), []),

      safeQuery(() => dbAll<{ total_mem_mb: number | null; cpu_count: number | null }>(
        `SELECT total_mem_mb, cpu_count FROM app_installs WHERE app = ?`,
        APP,
      ), []),

      // ---- usage ----------------------------------------------------------
      safeQuery(() => dbAll<{
        date: string; launches: number; sessions: number; epics: number; installsSeen: number;
      }>(
        `SELECT SUBSTR(created_at, 1, 10) AS date,
                SUM(CASE WHEN event = ? THEN 1 ELSE 0 END) AS launches,
                SUM(CASE WHEN event = ? THEN 1 ELSE 0 END) AS sessions,
                SUM(CASE WHEN event = ? THEN 1 ELSE 0 END) AS epics,
                COUNT(DISTINCT visitor_id) AS installsSeen
         FROM funnel_events
         WHERE tool = ? AND created_at > ?
         GROUP BY date
         ORDER BY date DESC
         LIMIT ?`,
        EV_LAUNCH, EV_SESSION, EV_EPIC, APP, sinceIso, days,
      ), []),

      safeQuery(() => dbAll<{ version: string | null; launches: number; sessions: number }>(
        `SELECT ${FUNNEL_VERSION} AS version,
                SUM(CASE WHEN event = ? THEN 1 ELSE 0 END) AS launches,
                SUM(CASE WHEN event = ? THEN 1 ELSE 0 END) AS sessions
         FROM funnel_events
         WHERE tool = ? AND created_at > ?
         GROUP BY version
         ORDER BY launches DESC
         LIMIT 50`,
        EV_LAUNCH, EV_SESSION, APP, sinceIso,
      ), []),

      // ---- issues ---------------------------------------------------------
      // Ranked by DISTINCT installs affected, not raw occurrences: one machine
      // in an OOM crash loop emits hundreds of correlated rows and would
      // otherwise permanently own the top of the list.
      safeQuery(() => dbAll<{
        signature: string; name: string | null; msg: string;
        occurrences: number; installsAffected: number;
        firstSeen: number; lastSeen: number;
      }>(
        `SELECT COALESCE(name, 'Error') || '|' || SUBSTR(COALESCE(stack, ''), 1, 80) AS signature,
                COALESCE(name, 'Error') AS name,
                MIN(msg) AS msg,
                COUNT(*) AS occurrences,
                COUNT(DISTINCT visitor_id) AS installsAffected,
                MIN(created_at) AS firstSeen,
                MAX(created_at) AS lastSeen
         FROM app_errors
         WHERE app = ? AND created_at > ?
         GROUP BY signature
         ORDER BY installsAffected DESC, occurrences DESC
         LIMIT ?`,
        APP, since, ISSUE_LIMIT,
      ), []),

      safeQuery(() => dbAll<{ signature: string; version: string | null }>(
        `SELECT DISTINCT
                COALESCE(name, 'Error') || '|' || SUBSTR(COALESCE(stack, ''), 1, 80) AS signature,
                version
         FROM app_errors
         WHERE app = ? AND created_at > ? AND version IS NOT NULL`,
        APP, since,
      ), []),

      // Platform is not a column on app_errors; approximate it from the UA
      // string the beacon already sends, picking the most common per signature.
      safeQuery(() => dbAll<{ signature: string; ua: string | null; n: number }>(
        `SELECT COALESCE(name, 'Error') || '|' || SUBSTR(COALESCE(stack, ''), 1, 80) AS signature,
                ua, COUNT(*) AS n
         FROM app_errors
         WHERE app = ? AND created_at > ?
         GROUP BY signature, ua`,
        APP, since,
      ), []),

      // ---- errors ---------------------------------------------------------
      safeQuery(() => dbAll<{
        version: string | null; errors: number; warns: number; installsAffected: number;
      }>(
        `SELECT version,
                SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) AS errors,
                SUM(CASE WHEN level = 'warn'  THEN 1 ELSE 0 END) AS warns,
                COUNT(DISTINCT visitor_id) AS installsAffected
         FROM app_logs
         WHERE app = ? AND created_at > ? AND level IN ('error', 'warn')
         GROUP BY version
         ORDER BY errors DESC
         LIMIT 50`,
        APP, since,
      ), []),

      safeQuery(() => dbAll<{ date: string; errors: number; warns: number }>(
        `SELECT DATE(created_at, 'unixepoch') AS date,
                SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) AS errors,
                SUM(CASE WHEN level = 'warn'  THEN 1 ELSE 0 END) AS warns
         FROM app_logs
         WHERE app = ? AND created_at > ? AND level IN ('error', 'warn')
         GROUP BY date
         ORDER BY date DESC
         LIMIT ?`,
        APP, since, days,
      ), []),
    ]);

    const versionsBySig = new Map<string, string[]>();
    for (const row of issueVersions) {
      if (!row.version) continue;
      const list = versionsBySig.get(row.signature) ?? [];
      list.push(row.version);
      versionsBySig.set(row.signature, list);
    }

    const topPlatformBySig = new Map<string, { platform: string; n: number }>();
    for (const row of issuePlatforms) {
      const platform = uaPlatform(row.ua);
      const best = topPlatformBySig.get(row.signature);
      if (!best || row.n > best.n) topPlatformBySig.set(row.signature, { platform, n: row.n });
    }

    return {
      generatedAt: now,
      windowDays: days,
      installs: {
        total: installTotals?.total ?? 0,
        active7: installTotals?.active7 ?? 0,
        active30: installTotals?.active30 ?? 0,
        new7: installTotals?.new7 ?? 0,
        byVersion: installsByVersion.map((r) => ({
          version: r.version ?? 'unknown',
          installs: r.installs ?? 0,
          active7: r.active7 ?? 0,
        })),
        byPlatform: installsByPlatform.map((r) => ({
          platform: r.platform ?? 'unknown',
          arch: r.arch ?? 'unknown',
          installs: r.installs ?? 0,
        })),
        specs: {
          medianTotalMemMb: median(installSpecs.map((r) => Number(r.total_mem_mb))),
          medianCpuCount: median(installSpecs.map((r) => Number(r.cpu_count))),
        },
      },
      usage: {
        daily: usageDaily
          .slice()
          .reverse()
          .map((r) => ({
            date: r.date,
            launches: r.launches ?? 0,
            sessions: r.sessions ?? 0,
            epics: r.epics ?? 0,
            installsSeen: r.installsSeen ?? 0,
          })),
        byVersion: usageByVersion.map((r) => ({
          version: r.version ?? 'unknown',
          launches: r.launches ?? 0,
          sessions: r.sessions ?? 0,
        })),
      },
      issues: issues.map((r) => ({
        signature: r.signature,
        name: r.name ?? 'Error',
        msg: r.msg ?? '',
        occurrences: r.occurrences ?? 0,
        installsAffected: r.installsAffected ?? 0,
        firstSeen: r.firstSeen ?? 0,
        lastSeen: r.lastSeen ?? 0,
        versions: [...new Set(versionsBySig.get(r.signature) ?? [])].sort(),
        topPlatform: topPlatformBySig.get(r.signature)?.platform ?? 'unknown',
      })),
      errors: {
        byVersion: errorsByVersion.map((r) => ({
          version: r.version ?? 'unknown',
          errors: r.errors ?? 0,
          warns: r.warns ?? 0,
          installsAffected: r.installsAffected ?? 0,
        })),
        daily: errorsDaily
          .slice()
          .reverse()
          .map((r) => ({ date: r.date, errors: r.errors ?? 0, warns: r.warns ?? 0 })),
      },
    };
  });
}

function uaPlatform(ua: string | null): string {
  if (!ua) return 'unknown';
  if (/Windows/i.test(ua)) return 'win32';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'darwin';
  if (/Linux|X11/i.test(ua)) return 'linux';
  return 'unknown';
}
