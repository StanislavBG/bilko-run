// Thin client over bilko.run's admin observability API. Auth is the server's
// job (read-only `bka_...` admin key); this file only sends the header.

import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const TIMEOUT_MS = 15_000;

/** Key file read when BILKO_ADMIN_KEY is unset. BILKO_ADMIN_KEY_FILE overrides the path. */
export function adminKeyPath(): string {
  return process.env.BILKO_ADMIN_KEY_FILE || join(homedir(), '.config', 'bilko-host', 'admin-key');
}

function missingKey(): string {
  return `BILKO_ADMIN_KEY is not set and no key file at ${adminKeyPath()} — create a key at https://bilko.run/admin/secrets, then either set BILKO_ADMIN_KEY in the bilko-host MCP env or write it to that file with mode 0600`;
}

/** BILKO_ADMIN_KEY env var, else the 0600 key file. Throws a message naming both options when neither is present. */
export function resolveAdminKey(): string {
  const env = process.env.BILKO_ADMIN_KEY?.trim();
  if (env) return env;
  const path = adminKeyPath();
  let mode: number;
  try {
    mode = statSync(path).mode;
  } catch {
    throw new Error(missingKey());
  }
  if (mode & 0o077) {
    throw new Error(`${path} is readable by other users (mode ${(mode & 0o777).toString(8)}) — run: chmod 600 ${path}`);
  }
  const key = readFileSync(path, 'utf8').trim();
  if (!key) throw new Error(missingKey());
  return key;
}

const OBS = '/api/admin/observability';

export type ErrorsReport = Record<string, unknown>;
export type ErrorDetail = Record<string, unknown>;

export function baseUrl(): string {
  return (process.env.BILKO_BASE_URL || 'https://bilko.run').replace(/\/+$/, '');
}

/** GET `path` (absolute, including any query string) on the bilko.run admin API with BILKO_ADMIN_KEY. Null on 404. */
export async function adminGet(path: string): Promise<unknown | null> {
  const key = resolveAdminKey();
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`bilko.run admin API returned ${res.status}: the admin key is invalid, expired or revoked`);
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
  const body = await adminGet(`${OBS}/errors?${p.toString()}`);
  return (body ?? {}) as ErrorsReport;
}

export async function errorDetail(id: number): Promise<ErrorDetail | null> {
  const body = await adminGet(`${OBS}/errors/${encodeURIComponent(String(id))}`);
  return body as ErrorDetail | null;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const withRate = (r: Record<string, unknown>) => {
  const requests = num(r.requests);
  const bytes = num(r.bytes);
  return { requests, bytes, bytesPerRequest: requests ? Math.round(bytes / requests) : 0 };
};

/** Shape GET /api/admin/egress into the usage_report output. */
export function mapEgressToUsage(body: unknown, days: number): Record<string, unknown> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const objs = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];
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

const rows = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];
const pct = (n: number, d: number): number => (d ? Math.round((n / d) * 1000) / 10 : 0);

/** Shape GET /api/admin/traffic into the traffic_report output. Drops per-visitor IP/UA/email rows. */
export function mapTrafficToReport(body: unknown, days: number, excludeSelf = false): Record<string, unknown> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const t = (b.totals && typeof b.totals === 'object' ? b.totals : {}) as Record<string, unknown>;
  const q = (b.quality && typeof b.quality === 'object' ? b.quality : {}) as Record<string, unknown>;
  const humanHits = num(t.hits);
  const botHits = num(t.botHits);
  const humanVisitors = num(t.visitors);
  const botVisitors = num(q.botVisitors);
  const singleHit = num(q.singleHitVisitors);
  const firstDay = typeof b.earliestDate === 'string' ? b.earliestDate : null;
  return {
    source: baseUrl(),
    window: { requestedDays: days, days: num(b.days) || days, excludeSelf },
    visitors: {
      human: humanVisitors,
      bot: botVisitors,
      humanSingleHit: singleHit,
      humanMultiHit: Math.max(humanVisitors - singleHit, 0),
      bilkoVidCookie: num(q.cookieVisitors),
    },
    hits: { human: humanHits, bot: botHits, notFound: num(t.notFound), clicks: num(t.clicks) },
    split: {
      botHitPct: pct(botHits, humanHits + botHits),
      botVisitorPct: pct(botVisitors, humanVisitors + botVisitors),
      humanSingleHitPct: pct(singleHit, humanVisitors),
    },
    byDay: rows(b.byDay),
    topPages: rows(b.topPages),
    byProject: rows(b.bySlug),
    byClass: rows(b.byClass),
    topPagesByClass: rows(b.topPagesByClass),
    topReferrers: rows(b.topReferrers),
    byCountry: rows(b.byCountry),
    byDevice: rows(b.byDevice),
    topClicks: rows(b.topClicks),
    metricValidSince: {
      // page_hits and its IP+UA visitor_id shipped together (2026-10-12), so both start on the table's first day.
      visitors: firstDay,
      bilkoVidCookie: typeof q.cookieSince === 'string' ? q.cookieSince : null,
    },
    notes: [
      '`visitors.human` counts a salted IP+user-agent hash (page_hits.visitor_id), NOT the bilko_vid cookie. One person on two devices counts twice; many people behind one NAT with the same browser count once.',
      '`visitors.bilkoVidCookie` counts bilko_vid cookie UUIDs. Clients that drop cookies (most crawlers) mint a new one on every request, so this over-counts non-browser traffic.',
      'Visitors are classified into six classes: human, search_crawler, ai_crawler, ai_user_agent, api_client, script. `byClass` covers all classes, so its hits sum to all non-error hits; `visitors.human` stays human-only. Undeclared bots with browser UAs still land in `human`; `humanSingleHit` is the main signal for them.',
      'Human aggregates exclude status >= 400. Hits are HTML documents only, not assets or API calls.',
      excludeSelf ? 'Excludes the owner\'s own signed-in visits (is_admin rows).' : 'Includes the owner\'s own visits (is_admin rows); pass excludeSelf to drop them.',
      'A window that starts before `metricValidSince.visitors` only covers the days since then. page_hits keeps 90 days; the host caps the window at 90.',
      'Under-reports by up to the 60s flush interval on every process restart.',
    ],
  };
}

export async function trafficReport(opts: { days: number; slug?: string; excludeSelf?: boolean }): Promise<Record<string, unknown>> {
  const p = new URLSearchParams();
  p.set('days', String(opts.days));
  if (opts.slug) p.set('slug', opts.slug);
  if (opts.excludeSelf) p.set('self', 'exclude');
  const body = await adminGet(`/api/admin/traffic?${p.toString()}`);
  if (!body) throw new Error('bilko.run returned 404 for /api/admin/traffic');
  return mapTrafficToReport(body, opts.days, !!opts.excludeSelf);
}
