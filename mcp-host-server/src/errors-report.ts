// Thin client over bilko.run's admin observability API. Auth is the server's
// job (read-only `bka_...` admin key); this file only sends the header.

const TIMEOUT_MS = 15_000;
const MISSING_KEY =
  'BILKO_ADMIN_KEY is not set — create a key at https://bilko.run/admin/secrets and add it to the bilko-host MCP env';

export type ErrorsReport = Record<string, unknown>;
export type ErrorDetail = Record<string, unknown>;

export function baseUrl(): string {
  return (process.env.BILKO_BASE_URL || 'https://bilko.run').replace(/\/+$/, '');
}

async function adminGet(path: string, params?: URLSearchParams): Promise<unknown | null> {
  const key = process.env.BILKO_ADMIN_KEY;
  if (!key) throw new Error(MISSING_KEY);
  const qs = params && params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${baseUrl()}/api/admin/observability${path}${qs}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`bilko.run admin API returned ${res.status}: BILKO_ADMIN_KEY is invalid, expired or revoked`);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = (await res.text().catch(() => '')).replaceAll(key, '[redacted]').slice(0, 200);
    throw new Error(`bilko.run admin API returned ${res.status}: ${body}`);
  }
  return res.json();
}

export async function errorsReport(opts: {
  days: number;
  app?: string;
  env?: string;
  limit?: number;
}): Promise<ErrorsReport> {
  const p = new URLSearchParams();
  p.set('days', String(opts.days));
  if (opts.app) p.set('app', opts.app);
  if (opts.env) p.set('env', opts.env);
  if (opts.limit != null) p.set('limit', String(opts.limit));
  const body = await adminGet('/errors', p);
  return (body ?? {}) as ErrorsReport;
}

export async function errorDetail(id: number): Promise<ErrorDetail | null> {
  const body = await adminGet(`/errors/${encodeURIComponent(String(id))}`);
  return body as ErrorDetail | null;
}
