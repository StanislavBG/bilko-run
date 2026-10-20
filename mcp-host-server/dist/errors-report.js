// Thin client over bilko.run's admin observability API. Auth is the server's
// job (read-only `bka_...` admin key); this file only sends the header.
const TIMEOUT_MS = 15_000;
const MISSING_KEY = 'BILKO_ADMIN_KEY is not set — create a key at https://bilko.run/admin/secrets and add it to the bilko-host MCP env';
const OBS = '/api/admin/observability';
export function baseUrl() {
    return (process.env.BILKO_BASE_URL || 'https://bilko.run').replace(/\/+$/, '');
}
/** GET `path` (absolute, including any query string) on the bilko.run admin API with BILKO_ADMIN_KEY. Null on 404. */
export async function adminGet(path) {
    const key = process.env.BILKO_ADMIN_KEY;
    if (!key)
        throw new Error(MISSING_KEY);
    const res = await fetch(`${baseUrl()}${path}`, {
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) {
        throw new Error(`bilko.run admin API returned ${res.status}: BILKO_ADMIN_KEY is invalid, expired or revoked`);
    }
    if (res.status === 404)
        return null;
    if (!res.ok) {
        const body = (await res.text().catch(() => '')).replaceAll(key, '[redacted]').slice(0, 200);
        throw new Error(`bilko.run admin API returned ${res.status}: ${body}`);
    }
    return res.json();
}
export async function errorsReport(opts) {
    const p = new URLSearchParams();
    p.set('days', String(opts.days));
    if (opts.app)
        p.set('app', opts.app);
    if (opts.env)
        p.set('env', opts.env);
    if (opts.limit != null)
        p.set('limit', String(opts.limit));
    const body = await adminGet(`${OBS}/errors?${p.toString()}`);
    return (body ?? {});
}
export async function errorDetail(id) {
    const body = await adminGet(`${OBS}/errors/${encodeURIComponent(String(id))}`);
    return body;
}
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const withRate = (r) => {
    const requests = num(r.requests);
    const bytes = num(r.bytes);
    return { requests, bytes, bytesPerRequest: requests ? Math.round(bytes / requests) : 0 };
};
/** Shape GET /api/admin/egress into the usage_report output. */
export function mapEgressToUsage(body, days) {
    const b = (body && typeof body === 'object' ? body : {});
    const objs = (v) => Array.isArray(v) ? v.filter((x) => !!x && typeof x === 'object') : [];
    return {
        source: baseUrl(),
        window: { requestedDays: days },
        earliestDateInTable: typeof b.earliestDate === 'string' ? b.earliestDate : null,
        static: objs(b.bySlug).map((r) => ({ slug: String(r.slug ?? ''), ...withRate(r) })),
        api: objs(b.rows)
            .filter((r) => !String(r.route ?? '').startsWith('static:'))
            .map((r) => ({ method: String(r.method ?? ''), route: String(r.route ?? ''), ...withRate(r) })),
        notes: [
            'Capacity signal, not Render billing — measured at the origin, not the CDN edge.',
            'Under-reports by up to the flush interval (60s) on every process restart.',
            'static:_host absorbs some top-level static dirs that belong to real projects (e.g. outdoor-hours\' data tree, /apps/, /session-manager-operations/) — treat _host as inflated until that attribution gap is fixed in a follow-up.',
            '`api` rows are route PATTERNS (e.g. "/api/projects/:slug/feedback"), not resolved per-project — they are not folded into the per-slug `static` numbers. The host caps `api` to its top 25 routes by bytes.',
        ],
    };
}
