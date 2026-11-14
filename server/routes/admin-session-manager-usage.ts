import type { FastifyInstance } from 'fastify';
import { dbAll, dbGet } from '../db.js';
import { requireAdmin } from '../clerk.js';
import { bearerMatches } from '../bearer.js';
import { parseEnvSelector, envPredicate, seedRollup, parseStoredSeeds } from './telemetry.js';

const APP = 'session-manager';
const ISSUE_LIMIT = 50;
const MIN_DAYS = 1;
const MAX_DAYS = 90;

// Event names Session Manager emits via /api/telemetry/event.
const EV_LAUNCH = 'app.launch';
const EV_SESSION = 'session.open';
const EV_EPIC = 'epic.create';
const EV_JOB_FINISH = 'scheduler.job.finish';
// session.open props.surface: a fresh PTY spawn or a Chat turn that starts a CLI session.
const SESSION_SURFACES = ['terminal', 'chat'];
const STATUS_LIMIT = 20;
// How far back an install's latest telemetry row is looked for (= the widest ?days).
const ACTIVITY_LOOKBACK_DAYS = MAX_DAYS;

// funnel_events.created_at is a DATETIME string ('YYYY-MM-DD HH:MM:SS', UTC);
// app_logs/app_errors.created_at are epoch seconds. Two window forms needed.
// Prefer the real column, fall back to the props blob so rows written before
// funnel_events.version existed still attribute.
const FUNNEL_VERSION = `COALESCE(version, json_extract(metadata, '$.appVersion'))`;

// Installs that are not real users. Unpackaged e2e runs report Electron's own
// version (e.g. '42.11.10') because app.getVersion() falls back to it; stubs and
// probes report '0.0.0-<tag>'; a few early rows report ''. Session Manager is
// 0.x, so any major >= 30 is an Electron version. NULL is "unknown", kept.
// `col` is a trusted SQL literal, never user input.
function testVersionSql(col: string): string {
  return `COALESCE((${col} = '' OR ${col} LIKE '0.0.0-%'`
    + ` OR CAST(SUBSTR(${col}, 1, INSTR(${col}, '.') - 1) AS INTEGER) >= 30), 0)`;
}

// The owner's own install(s), dropped when exclude_self is on (the default, as
// on every other admin tab). Kept server-side so the id never ships in the
// client bundle; SM_OWNER_INSTALL_IDS (comma-separated) overrides.
const DEFAULT_OWNER_INSTALL_IDS = ['9c6b8ecd-b3da-400d-b795-0c0c32504731'];
const MAX_EXCLUDED = 50;
const INSTALL_ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const PREFIX_LEN = 8;
const PER_INSTALL_LIMIT = 100;

function parseIdList(raw: unknown): string[] {
  const parts = (Array.isArray(raw) ? raw : [raw])
    .filter((v): v is string => typeof v === 'string')
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter((v) => INSTALL_ID_RE.test(v));
  return [...new Set(parts)].slice(0, MAX_EXCLUDED);
}

function ownerInstallIds(): string[] {
  const fromEnv = parseIdList(process.env.SM_OWNER_INSTALL_IDS ?? '');
  return fromEnv.length > 0 ? fromEnv : DEFAULT_OWNER_INSTALL_IDS;
}

type Filter = { sql: string; args: unknown[] };

function andAll(parts: Filter[]): Filter {
  return { sql: parts.map((p) => `(${p.sql})`).join(' AND '), args: parts.flatMap((p) => p.args) };
}

function notInList(col: string, ids: string[]): Filter {
  if (ids.length === 0) return { sql: '1 = 1', args: [] };
  return { sql: `COALESCE(${col}, '') NOT IN (${ids.map(() => '?').join(', ')})`, args: ids };
}

// app_installs rows: env + real version + not excluded.
function installFilter(env: Filter, includeTest: boolean, excluded: string[]): Filter {
  return andAll([
    env,
    includeTest ? { sql: '1 = 1', args: [] } : { sql: `NOT ${testVersionSql('app_version')}`, args: [] },
    notInList('install_id', excluded),
  ]);
}

// Event/log/error rows: env + the row's own version is real + its install is
// not a test install + not excluded. Both checks are needed: a row carries its
// own version, but rows written before that stamp only link via visitor_id.
function rowFilter(
  env: Filter, includeTest: boolean, excluded: string[], visitorCol: string, versionExpr: string,
): Filter {
  const parts: Filter[] = [env];
  if (!includeTest) {
    parts.push({ sql: `NOT ${testVersionSql(versionExpr)}`, args: [] });
    parts.push({
      sql: `COALESCE(${visitorCol}, '') NOT IN (SELECT install_id FROM app_installs
              WHERE app = ? AND ${testVersionSql('app_version')})`,
      args: [APP],
    });
  }
  parts.push(notInList(visitorCol, excluded));
  return andAll(parts);
}

// Each install's latest telemetry row of any kind, as `latest(id, at)` (epoch
// seconds). app_installs.last_seen_at moves only when the client re-sends its
// install profile (a version change or a 30-day heartbeat), so a long-running
// install that is still sending events, logs and errors would otherwise fall
// out of "active". Callers take MAX(last_seen_at, latest.at). `env` filters the
// rows the same way it filters every other section.
function latestActivityCte(env: Filter, sinceSec: number, sinceIso: string): Filter {
  return {
    sql: `WITH seen(id, at) AS (
            SELECT visitor_id, CAST(strftime('%s', MAX(created_at)) AS INTEGER)
              FROM funnel_events
             WHERE tool = ? AND created_at > ? AND visitor_id IS NOT NULL AND ${env.sql}
             GROUP BY visitor_id
            UNION ALL
            SELECT visitor_id, MAX(created_at) FROM app_logs
             WHERE app = ? AND created_at > ? AND visitor_id IS NOT NULL AND ${env.sql}
             GROUP BY visitor_id
            UNION ALL
            SELECT visitor_id, MAX(created_at) FROM app_errors
             WHERE app = ? AND created_at > ? AND visitor_id IS NOT NULL AND ${env.sql}
             GROUP BY visitor_id
          ),
          latest(id, at) AS (SELECT id, MAX(at) FROM seen GROUP BY id)`,
    args: [APP, sinceIso, ...env.args, APP, sinceSec, ...env.args, APP, sinceSec, ...env.args],
  };
}

// One row per error-panel record: app_errors rows count as errors, app_logs
// rows as an error or a warn by level. Columns: version, visitor_id,
// created_at (epoch seconds), is_error, is_warn. Placeholders follow
// errorRowsArgs().
function errorRowsSql(errF: Filter, logF: Filter): string {
  return `SELECT version, visitor_id, created_at, 1 AS is_error, 0 AS is_warn
            FROM app_errors
           WHERE app = ? AND created_at > ? AND ${errF.sql}
          UNION ALL
          SELECT version, visitor_id, created_at,
                 CASE WHEN level = 'error' THEN 1 ELSE 0 END,
                 CASE WHEN level = 'warn'  THEN 1 ELSE 0 END
            FROM app_logs
           WHERE app = ? AND created_at > ? AND level IN ('error', 'warn') AND ${logF.sql}`;
}

function errorRowsArgs(since: number, errF: Filter, logF: Filter): unknown[] {
  return [APP, since, ...errF.args, APP, since, ...logF.args];
}

// Last activity of an app_installs row joined as `i` to `latest` as `l`.
const LAST_ACTIVE = 'MAX(i.last_seen_at, COALESCE(l.at, 0))';

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

// Headless read access for the owner's scripts/MCP. SM_USAGE_READ_TOKEN is the
// dedicated secret; PROJECT_SNAPSHOT_TOKEN (already held locally) is a fallback.
// A Bearer matching neither falls through to requireAdmin — Clerk JWTs are Bearer too.
function hasReadToken(authHeader: unknown): boolean {
  return bearerMatches(authHeader, [process.env.SM_USAGE_READ_TOKEN, process.env.PROJECT_SNAPSHOT_TOKEN]);
}

export function registerSessionManagerUsageRoutes(app: FastifyInstance): void {
  app.get('/api/admin/session-manager/usage', async (req, reply) => {
    if (!hasReadToken(req.headers.authorization)) {
      const email = await requireAdmin(req, reply);
      if (!email) return;
    }

    const query = req.query as Record<string, unknown> | undefined;
    const days = clampDays(query?.days);
    const env = parseEnvSelector(query?.env);
    const includeTest = String(query?.includeTest ?? '0') === '1';
    const excludeSelf = String(query?.exclude_self ?? '1') !== '0';
    const excluded = [
      ...new Set([...(excludeSelf ? ownerInstallIds() : []), ...parseIdList(query?.excludeInstall)]),
    ];
    const ev = envPredicate(env);
    const evE = envPredicate(env, 'e.env');
    const instF = installFilter(ev, includeTest, excluded);
    const evtF = rowFilter(ev, includeTest, excluded, 'visitor_id', FUNNEL_VERSION);
    const errF = rowFilter(ev, includeTest, excluded, 'visitor_id', 'version');
    const errEF = rowFilter(evE, includeTest, excluded, 'e.visitor_id', 'e.version');
    const logF = errF;
    const now = Math.floor(Date.now() / 1000);
    const since = now - days * 86_400;
    const since7 = now - 7 * 86_400;
    const since14 = now - 14 * 86_400;
    const since30 = now - 30 * 86_400;
    const toIso = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const sinceIso = toIso(since);
    const since7Iso = toIso(since7);
    const since14Iso = toIso(since14);
    const sinceActivity = now - ACTIVITY_LOOKBACK_DAYS * 86_400;
    const activity = latestActivityCte(ev, sinceActivity, toIso(sinceActivity));

    const [
      installTotals,
      installsByVersion,
      installsByPlatform,
      installSpecs,
      installSeeds,
      usageDaily,
      usageByVersion,
      sessionsBySurface,
      jobsByStatus,
      issues,
      issueVersions,
      issuePlatforms,
      errorsByVersion,
      errorsDaily,
      perInstallRows,
      perInstallUsage,
      perInstallErrors,
    ] = await Promise.all([
      // ---- installs -------------------------------------------------------
      // app_installs is the upsert written by POST /api/telemetry/install,
      // keyed on install_id — which is the same value every event/log/error
      // beacon sends as visitor_id. safeQuery still wraps these so a migration
      // that has not run yet yields zeros rather than a 500; the dashboard's
      // empty state is a first-class view.
      // Active = the install's last activity (latest telemetry row or install
      // report, whichever is newer) falls inside the window.
      safeQuery(() => dbGet<{ total: number; active7: number; active30: number; new7: number }>(
        `${activity.sql}
         SELECT COUNT(*) AS total,
                SUM(CASE WHEN ${LAST_ACTIVE} > ? THEN 1 ELSE 0 END) AS active7,
                SUM(CASE WHEN ${LAST_ACTIVE} > ? THEN 1 ELSE 0 END) AS active30,
                SUM(CASE WHEN i.first_seen_at > ? THEN 1 ELSE 0 END) AS new7
         FROM app_installs i LEFT JOIN latest l ON l.id = i.install_id
         WHERE i.app = ? AND ${instF.sql}`,
        ...activity.args, since7, since30, since7, APP, ...instF.args,
      ), null),

      safeQuery(() => dbAll<{ version: string | null; installs: number; active7: number }>(
        `${activity.sql}
         SELECT i.app_version AS version,
                COUNT(*) AS installs,
                SUM(CASE WHEN ${LAST_ACTIVE} > ? THEN 1 ELSE 0 END) AS active7
         FROM app_installs i LEFT JOIN latest l ON l.id = i.install_id
         WHERE i.app = ? AND ${instF.sql}
         GROUP BY i.app_version
         ORDER BY installs DESC
         LIMIT 50`,
        ...activity.args, since7, APP, ...instF.args,
      ), []),

      safeQuery(() => dbAll<{ platform: string | null; arch: string | null; installs: number }>(
        `SELECT platform, arch, COUNT(*) AS installs
         FROM app_installs WHERE app = ? AND ${instF.sql}
         GROUP BY platform, arch
         ORDER BY installs DESC
         LIMIT 50`,
        APP, ...instF.args,
      ), []),

      safeQuery(() => dbAll<{ total_mem_mb: number | null; cpu_count: number | null }>(
        `SELECT total_mem_mb, cpu_count FROM app_installs WHERE app = ? AND ${instF.sql}`,
        APP, ...instF.args,
      ), []),

      // First-run setup outcomes per step (devPlugin, schedulerMcp, ...).
      safeQuery(() => seedRollup(APP, instF), []),

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
         WHERE tool = ? AND created_at > ? AND ${evtF.sql}
         GROUP BY date
         ORDER BY date DESC
         LIMIT ?`,
        EV_LAUNCH, EV_SESSION, EV_EPIC, APP, sinceIso, ...evtF.args, days,
      ), []),

      safeQuery(() => dbAll<{ version: string | null; launches: number; sessions: number }>(
        `SELECT ${FUNNEL_VERSION} AS version,
                SUM(CASE WHEN event = ? THEN 1 ELSE 0 END) AS launches,
                SUM(CASE WHEN event = ? THEN 1 ELSE 0 END) AS sessions
         FROM funnel_events
         WHERE tool = ? AND created_at > ? AND ${evtF.sql}
         GROUP BY version
         ORDER BY launches DESC
         LIMIT 50`,
        EV_LAUNCH, EV_SESSION, APP, sinceIso, ...evtF.args,
      ), []),

      // session.open by the view that opened it. Rows from clients that predate
      // the surface prop (or send anything else) are 'unknown'. json_valid
      // guards the extract: a metadata blob clipped by safeMeta is not JSON.
      safeQuery(() => dbAll<{ surface: string; sessions: number }>(
        `SELECT CASE WHEN json_valid(metadata)
                      AND json_extract(metadata, '$.surface') IN (${SESSION_SURFACES.map(() => '?').join(', ')})
                     THEN json_extract(metadata, '$.surface') ELSE 'unknown' END AS surface,
                COUNT(*) AS sessions
         FROM funnel_events
         WHERE tool = ? AND event = ? AND created_at > ? AND ${evtF.sql}
         GROUP BY surface
         ORDER BY sessions DESC`,
        ...SESSION_SURFACES, APP, EV_SESSION, sinceIso, ...evtF.args,
      ), []),

      // scheduler.job.finish by the job's final status (props.status).
      safeQuery(() => dbAll<{ status: string; jobs: number; installsSeen: number }>(
        `SELECT COALESCE(CASE WHEN json_valid(metadata)
                              THEN SUBSTR(CAST(json_extract(metadata, '$.status') AS TEXT), 1, 40) END,
                         'unknown') AS status,
                COUNT(*) AS jobs,
                COUNT(DISTINCT visitor_id) AS installsSeen
         FROM funnel_events
         WHERE tool = ? AND event = ? AND created_at > ? AND ${evtF.sql}
         GROUP BY status
         ORDER BY jobs DESC
         LIMIT ?`,
        APP, EV_JOB_FINISH, sinceIso, ...evtF.args, STATUS_LIMIT,
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
         WHERE app = ? AND created_at > ? AND ${errF.sql}
         GROUP BY signature
         ORDER BY installsAffected DESC, occurrences DESC
         LIMIT ?`,
        APP, since, ...errF.args, ISSUE_LIMIT,
      ), []),

      safeQuery(() => dbAll<{ signature: string; version: string | null }>(
        `SELECT DISTINCT
                COALESCE(name, 'Error') || '|' || SUBSTR(COALESCE(stack, ''), 1, 80) AS signature,
                version
         FROM app_errors
         WHERE app = ? AND created_at > ? AND version IS NOT NULL AND ${errF.sql}`,
        APP, since, ...errF.args,
      ), []),

      // Real platform, not a UA guess: every beacon stamps platform into
      // context_json (PRD 1140), and app_errors.visitor_id IS
      // app_installs.install_id, so the join backfills rows written before the
      // stamp existed. UA sniffing is the last resort.
      safeQuery(() => dbAll<{ signature: string; platform: string | null; n: number }>(
        `SELECT COALESCE(e.name, 'Error') || '|' || SUBSTR(COALESCE(e.stack, ''), 1, 80) AS signature,
                COALESCE(
                  json_extract(e.context_json, '$.platform'),
                  i.platform,
                  e.ua
                ) AS platform,
                COUNT(*) AS n
         FROM app_errors e
         LEFT JOIN app_installs i
                ON i.install_id = e.visitor_id AND i.app = e.app
         WHERE e.app = ? AND e.created_at > ? AND ${errEF.sql}
         GROUP BY signature, platform`,
        APP, since, ...errEF.args,
      ), []),

      // ---- errors ---------------------------------------------------------
      // errors = app_errors rows (crash and exception reports, POST
      // /api/telemetry/error) + app_logs error lines; warns = app_logs warns.
      // Session Manager sends every error to /error and only warns to /log,
      // so reading app_logs alone left errors at 0.
      safeQuery(() => dbAll<{
        version: string | null; errors: number; warns: number; installsAffected: number;
      }>(
        `SELECT version,
                SUM(is_error) AS errors,
                SUM(is_warn) AS warns,
                COUNT(DISTINCT visitor_id) AS installsAffected
         FROM (${errorRowsSql(errF, logF)})
         GROUP BY version
         ORDER BY errors DESC, warns DESC
         LIMIT 50`,
        ...errorRowsArgs(since, errF, logF),
      ), []),

      safeQuery(() => dbAll<{ date: string; errors: number; warns: number }>(
        `SELECT DATE(created_at, 'unixepoch') AS date,
                SUM(is_error) AS errors,
                SUM(is_warn) AS warns
         FROM (${errorRowsSql(errF, logF)})
         GROUP BY date
         ORDER BY date DESC
         LIMIT ?`,
        ...errorRowsArgs(since, errF, logF), days,
      ), []),

      // ---- per install ----------------------------------------------------
      // funnel_events.visitor_id and app_errors.visitor_id ARE the install id.
      // Last 7d vs the 7d before it, independent of ?days.
      safeQuery(() => dbAll<{
        install_id: string; app_version: string | null; platform: string | null; arch: string | null;
        first_seen_at: number; last_seen_at: number; last_active: number; seeds: string | null;
      }>(
        `${activity.sql}
         SELECT i.install_id, i.app_version, i.platform, i.arch, i.first_seen_at, i.last_seen_at,
                ${LAST_ACTIVE} AS last_active, i.seeds
         FROM app_installs i LEFT JOIN latest l ON l.id = i.install_id
         WHERE i.app = ? AND ${instF.sql}
         ORDER BY last_active DESC
         LIMIT ?`,
        ...activity.args, APP, ...instF.args, PER_INSTALL_LIMIT,
      ), []),

      safeQuery(() => dbAll<{
        visitor_id: string;
        launches7: number; sessions7: number; epics7: number;
        launchesPrev: number; sessionsPrev: number; epicsPrev: number;
      }>(
        `SELECT visitor_id,
                SUM(CASE WHEN event = ? AND created_at >  ? THEN 1 ELSE 0 END) AS launches7,
                SUM(CASE WHEN event = ? AND created_at >  ? THEN 1 ELSE 0 END) AS sessions7,
                SUM(CASE WHEN event = ? AND created_at >  ? THEN 1 ELSE 0 END) AS epics7,
                SUM(CASE WHEN event = ? AND created_at <= ? THEN 1 ELSE 0 END) AS launchesPrev,
                SUM(CASE WHEN event = ? AND created_at <= ? THEN 1 ELSE 0 END) AS sessionsPrev,
                SUM(CASE WHEN event = ? AND created_at <= ? THEN 1 ELSE 0 END) AS epicsPrev
         FROM funnel_events
         WHERE tool = ? AND created_at > ? AND visitor_id IS NOT NULL AND ${evtF.sql}
         GROUP BY visitor_id`,
        EV_LAUNCH, since7Iso, EV_SESSION, since7Iso, EV_EPIC, since7Iso,
        EV_LAUNCH, since7Iso, EV_SESSION, since7Iso, EV_EPIC, since7Iso,
        APP, since14Iso, ...evtF.args,
      ), []),

      safeQuery(() => dbAll<{ visitor_id: string; errors7: number; errorsPrev: number }>(
        `SELECT visitor_id,
                SUM(CASE WHEN created_at >  ? THEN 1 ELSE 0 END) AS errors7,
                SUM(CASE WHEN created_at <= ? THEN 1 ELSE 0 END) AS errorsPrev
         FROM app_errors
         WHERE app = ? AND created_at > ? AND visitor_id IS NOT NULL AND ${errF.sql}
         GROUP BY visitor_id`,
        since7, since7, APP, since14, ...errF.args,
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
      const platform = normalizePlatform(row.platform);
      const best = topPlatformBySig.get(row.signature);
      if (!best || row.n > best.n) topPlatformBySig.set(row.signature, { platform, n: row.n });
    }

    const usageById = new Map(perInstallUsage.map((r) => [r.visitor_id, r]));
    const errorsById = new Map(perInstallErrors.map((r) => [r.visitor_id, r]));
    // Privacy contract: only a short prefix of the anonymous install id leaves
    // the server — enough to tell rows apart, not to address an install.
    const perInstall = perInstallRows.map((r) => {
      const u = usageById.get(r.install_id);
      const e = errorsById.get(r.install_id);
      return {
        id: r.install_id.slice(0, PREFIX_LEN),
        version: r.app_version ?? 'unknown',
        platform: r.platform ?? 'unknown',
        arch: r.arch ?? 'unknown',
        firstSeen: r.first_seen_at ?? 0,
        lastSeen: r.last_seen_at ?? 0,
        lastActive: r.last_active ?? r.last_seen_at ?? 0,
        seeds: parseStoredSeeds(r.seeds),
        last7: {
          launches: u?.launches7 ?? 0, sessions: u?.sessions7 ?? 0,
          epics: u?.epics7 ?? 0, errors: e?.errors7 ?? 0,
        },
        prev7: {
          launches: u?.launchesPrev ?? 0, sessions: u?.sessionsPrev ?? 0,
          epics: u?.epicsPrev ?? 0, errors: e?.errorsPrev ?? 0,
        },
      };
    });

    return {
      generatedAt: now,
      windowDays: days,
      env,
      includeTest,
      excludeSelf,
      excludedInstalls: excluded.length,
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
        seeds: installSeeds,
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
        sessionsBySurface: sessionsBySurface.map((r) => ({
          surface: r.surface ?? 'unknown',
          sessions: r.sessions ?? 0,
        })),
        jobsByStatus: jobsByStatus.map((r) => ({
          status: r.status ?? 'unknown',
          jobs: r.jobs ?? 0,
          installsSeen: r.installsSeen ?? 0,
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
      perInstall,
    };
  });
}

// Accepts either a real process.platform value (the common case) or a UA
// string from a row that predates the platform stamp.
function normalizePlatform(raw: string | null): string {
  if (!raw) return 'unknown';
  if (raw === 'linux' || raw === 'darwin' || raw === 'win32') return raw;
  if (/Windows/i.test(raw)) return 'win32';
  if (/Mac OS X|Macintosh/i.test(raw)) return 'darwin';
  if (/Linux|X11/i.test(raw)) return 'linux';
  return 'unknown';
}
