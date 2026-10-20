import { mcpAll, mcpGet } from './db.js';

// Local copy of the host's envPredicate semantics (server/routes/telemetry.ts);
// not imported because mcp-host-server compiles with its own rootDir.
const ALLOWED_ENVS = new Set(['prod', 'dev', 'test']);

const SIGNATURE_SQL = `COALESCE(name, 'Error') || '|' || SUBSTR(COALESCE(stack, ''), 1, 80)`;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const STACK_MAX = 2000;

export interface ErrorGroup {
  app: string;
  signature: string;
  name: string;
  msg: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  versions: string[];
  sampleUrl: string | null;
  sampleId: number;
  sampleStack: string | null;
}

export interface ErrorsReport {
  totals: { errors: number; groups: number };
  byApp: { app: string; count: number }[];
  groups: ErrorGroup[];
}

export interface ErrorDetail {
  id: number;
  app: string;
  version: string | null;
  name: string | null;
  msg: string;
  stack: string | null;
  url: string | null;
  ua: string | null;
  visitor_id: string | null;
  session_id: string | null;
  context_json: unknown;
  created_at: number;
  env: string | null;
}

function envClause(env: string | undefined): { sql: string; args: string[] } {
  const sel = env === 'all' || (typeof env === 'string' && ALLOWED_ENVS.has(env)) ? env : 'prod';
  if (sel === 'all') return { sql: '1 = 1', args: [] };
  if (sel === 'prod') return { sql: `COALESCE(env, 'prod') = 'prod'`, args: [] };
  return { sql: 'env = ?', args: [sel as string] };
}

export async function errorsReport(opts: {
  days: number;
  app?: string;
  env?: string;
  limit?: number;
}): Promise<ErrorsReport> {
  const days = Math.min(90, Math.max(1, Math.floor(Number(opts.days)) || 1));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(opts.limit)) || DEFAULT_LIMIT));
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const ev = envClause(opts.env);
  const app = typeof opts.app === 'string' && opts.app ? opts.app.slice(0, 60) : undefined;

  const where = `created_at > ?${app ? ' AND app = ?' : ''} AND ${ev.sql}`;
  const whereArgs: unknown[] = [since, ...(app ? [app] : []), ...ev.args];

  const groupRows = await mcpAll<{
    app: string; signature: string; name: string; count: number | bigint;
    firstSeen: number | bigint; lastSeen: number | bigint; sampleId: number | bigint;
  }>(
    `SELECT app, ${SIGNATURE_SQL} AS signature, COALESCE(name, 'Error') AS name,
            COUNT(*) AS count, MIN(created_at) AS firstSeen, MAX(created_at) AS lastSeen,
            MAX(id) AS sampleId
     FROM app_errors WHERE ${where}
     GROUP BY app, signature
     ORDER BY count DESC, lastSeen DESC
     LIMIT ?`,
    [...whereArgs, limit],
  );

  const totalGroups = await mcpGet<{ n: number | bigint }>(
    `SELECT COUNT(*) AS n FROM (SELECT 1 FROM app_errors WHERE ${where} GROUP BY app, ${SIGNATURE_SQL})`,
    whereArgs,
  );

  const byAppRows = await mcpAll<{ app: string; count: number | bigint }>(
    `SELECT app, COUNT(*) AS count FROM app_errors WHERE ${where}
     GROUP BY app ORDER BY count DESC, app ASC`,
    whereArgs,
  );

  const versionRows = groupRows.length === 0 ? [] : await mcpAll<{
    app: string; signature: string; version: string;
  }>(
    `SELECT DISTINCT app, ${SIGNATURE_SQL} AS signature, version
     FROM app_errors WHERE ${where} AND version IS NOT NULL`,
    whereArgs,
  );

  const sampleIds = groupRows.map((g) => Number(g.sampleId));
  const sampleRows = sampleIds.length === 0 ? [] : await mcpAll<{
    id: number | bigint; msg: string; url: string | null; stack: string | null;
  }>(
    `SELECT id, msg, url, stack FROM app_errors WHERE id IN (${sampleIds.map(() => '?').join(',')})`,
    sampleIds,
  );
  const samples = new Map(sampleRows.map((r) => [Number(r.id), r]));

  const versions = new Map<string, string[]>();
  for (const v of versionRows) {
    const key = `${v.app}\u0000${v.signature}`;
    const list = versions.get(key) ?? [];
    list.push(v.version);
    versions.set(key, list);
  }

  const groups: ErrorGroup[] = groupRows.map((g) => {
    const sample = samples.get(Number(g.sampleId));
    return {
      app: g.app,
      signature: g.signature,
      name: g.name,
      msg: sample?.msg ?? '',
      count: Number(g.count),
      firstSeen: Number(g.firstSeen),
      lastSeen: Number(g.lastSeen),
      versions: versions.get(`${g.app}\u0000${g.signature}`) ?? [],
      sampleUrl: sample?.url ?? null,
      sampleId: Number(g.sampleId),
      sampleStack: sample?.stack != null ? sample.stack.slice(0, STACK_MAX) : null,
    };
  });

  const byApp = byAppRows.map((r) => ({ app: r.app, count: Number(r.count) }));
  return {
    totals: {
      errors: byApp.reduce((n, r) => n + r.count, 0),
      groups: Number(totalGroups?.n ?? 0),
    },
    byApp,
    groups,
  };
}

export async function errorDetail(id: number): Promise<ErrorDetail | null> {
  const row = await mcpGet<Record<string, unknown>>(
    `SELECT id, app, version, name, msg, stack, url, ua, visitor_id, session_id,
            context_json, created_at, env
     FROM app_errors WHERE id = ?`,
    [id],
  );
  if (!row) return null;
  let context: unknown = row.context_json ?? null;
  if (typeof context === 'string') {
    try { context = JSON.parse(context); } catch { /* keep raw string */ }
  }
  return {
    id: Number(row.id),
    app: row.app as string,
    version: (row.version as string | null) ?? null,
    name: (row.name as string | null) ?? null,
    msg: row.msg as string,
    stack: (row.stack as string | null) ?? null,
    url: (row.url as string | null) ?? null,
    ua: (row.ua as string | null) ?? null,
    visitor_id: (row.visitor_id as string | null) ?? null,
    session_id: (row.session_id as string | null) ?? null,
    context_json: context,
    created_at: Number(row.created_at),
    env: (row.env as string | null) ?? null,
  };
}
