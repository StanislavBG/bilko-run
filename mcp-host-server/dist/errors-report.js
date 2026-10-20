import { mcpAll, mcpGet } from './db.js';
// Local copy of the host's envPredicate semantics (server/routes/telemetry.ts);
// not imported because mcp-host-server compiles with its own rootDir.
const ALLOWED_ENVS = new Set(['prod', 'dev', 'test']);
const SIGNATURE_SQL = `COALESCE(name, 'Error') || '|' || SUBSTR(COALESCE(stack, ''), 1, 80)`;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const STACK_MAX = 2000;
function envClause(env) {
    const sel = env === 'all' || (typeof env === 'string' && ALLOWED_ENVS.has(env)) ? env : 'prod';
    if (sel === 'all')
        return { sql: '1 = 1', args: [] };
    if (sel === 'prod')
        return { sql: `COALESCE(env, 'prod') = 'prod'`, args: [] };
    return { sql: 'env = ?', args: [sel] };
}
export async function errorsReport(opts) {
    const days = Math.min(90, Math.max(1, Math.floor(Number(opts.days)) || 1));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(Number(opts.limit)) || DEFAULT_LIMIT));
    const since = Math.floor(Date.now() / 1000) - days * 86400;
    const ev = envClause(opts.env);
    const app = typeof opts.app === 'string' && opts.app ? opts.app.slice(0, 60) : undefined;
    const where = `created_at > ?${app ? ' AND app = ?' : ''} AND ${ev.sql}`;
    const whereArgs = [since, ...(app ? [app] : []), ...ev.args];
    const groupRows = await mcpAll(`SELECT app, ${SIGNATURE_SQL} AS signature, COALESCE(name, 'Error') AS name,
            COUNT(*) AS count, MIN(created_at) AS firstSeen, MAX(created_at) AS lastSeen,
            MAX(id) AS sampleId
     FROM app_errors WHERE ${where}
     GROUP BY app, signature
     ORDER BY count DESC, lastSeen DESC
     LIMIT ?`, [...whereArgs, limit]);
    const totalGroups = await mcpGet(`SELECT COUNT(*) AS n FROM (SELECT 1 FROM app_errors WHERE ${where} GROUP BY app, ${SIGNATURE_SQL})`, whereArgs);
    const byAppRows = await mcpAll(`SELECT app, COUNT(*) AS count FROM app_errors WHERE ${where}
     GROUP BY app ORDER BY count DESC, app ASC`, whereArgs);
    const versionRows = groupRows.length === 0 ? [] : await mcpAll(`SELECT DISTINCT app, ${SIGNATURE_SQL} AS signature, version
     FROM app_errors WHERE ${where} AND version IS NOT NULL`, whereArgs);
    const sampleIds = groupRows.map((g) => Number(g.sampleId));
    const sampleRows = sampleIds.length === 0 ? [] : await mcpAll(`SELECT id, msg, url, stack FROM app_errors WHERE id IN (${sampleIds.map(() => '?').join(',')})`, sampleIds);
    const samples = new Map(sampleRows.map((r) => [Number(r.id), r]));
    const versions = new Map();
    for (const v of versionRows) {
        const key = `${v.app}\u0000${v.signature}`;
        const list = versions.get(key) ?? [];
        list.push(v.version);
        versions.set(key, list);
    }
    const groups = groupRows.map((g) => {
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
export async function errorDetail(id) {
    const row = await mcpGet(`SELECT id, app, version, name, msg, stack, url, ua, visitor_id, session_id,
            context_json, created_at, env
     FROM app_errors WHERE id = ?`, [id]);
    if (!row)
        return null;
    let context = row.context_json ?? null;
    if (typeof context === 'string') {
        try {
            context = JSON.parse(context);
        }
        catch { /* keep raw string */ }
    }
    return {
        id: Number(row.id),
        app: row.app,
        version: row.version ?? null,
        name: row.name ?? null,
        msg: row.msg,
        stack: row.stack ?? null,
        url: row.url ?? null,
        ua: row.ua ?? null,
        visitor_id: row.visitor_id ?? null,
        session_id: row.session_id ?? null,
        context_json: context,
        created_at: Number(row.created_at),
        env: row.env ?? null,
    };
}
