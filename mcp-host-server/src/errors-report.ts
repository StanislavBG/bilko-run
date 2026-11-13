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

/** The host's owner (`mine`) and bot (`bots`) query toggle: 'include' only when the caller opts in. */
type Toggle = 'include' | 'exclude';
const toggle = (include: boolean): Toggle => (include ? 'include' : 'exclude');
const isToggle = (v: unknown): v is Toggle => v === 'include' || v === 'exclude';

/** The host's `filters` echo ({ mine, bots, ... }) as sent, or null from a host older than the owner/bot filters. */
function filtersEcho(b: Record<string, unknown>): Record<string, unknown> | null {
  const f = b.filters;
  return f && typeof f === 'object' && !Array.isArray(f) ? (f as Record<string, unknown>) : null;
}

/** What traffic_report asked for: excludeSelf picks mine, includeBots picks bots. */
export interface TrafficRequest {
  excludeSelf: boolean;
  includeBots: boolean;
}

/** Shape GET /api/admin/traffic into the traffic_report output. Drops per-visitor IP/UA/email rows. */
export function mapTrafficToReport(
  body: unknown,
  days: number,
  requested: TrafficRequest = { excludeSelf: true, includeBots: true },
): Record<string, unknown> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const filters = filtersEcho(b);
  // The notes describe what the host applied; a host that echoes nothing gets what was asked for.
  const mine = isToggle(filters?.mine) ? filters.mine : toggle(!requested.excludeSelf);
  const bots = isToggle(filters?.bots) ? filters.bots : toggle(requested.includeBots);
  const t = (b.totals && typeof b.totals === 'object' ? b.totals : {}) as Record<string, unknown>;
  const q = (b.quality && typeof b.quality === 'object' ? b.quality : {}) as Record<string, unknown>;
  const humanHits = num(t.hits);
  const botHits = num(t.botHits);
  const humanVisitors = num(t.visitors);
  const botVisitors = num(q.botVisitors);
  const singleHit = num(q.singleHitVisitors);
  // Older hosts omit confirmedVisitors; report null rather than a misleading 0.
  const confirmed = typeof t.confirmedVisitors === 'number' && Number.isFinite(t.confirmedVisitors) ? t.confirmedVisitors : null;
  const firstDay = typeof b.earliestDate === 'string' ? b.earliestDate : null;
  return {
    source: baseUrl(),
    window: { requestedDays: days, days: num(b.days) || days, excludeSelf: requested.excludeSelf, includeBots: requested.includeBots },
    filters,
    visitors: {
      human: humanVisitors,
      bot: botVisitors,
      humanSingleHit: singleHit,
      humanMultiHit: Math.max(humanVisitors - singleHit, 0),
      bilkoVidCookie: num(q.cookieVisitors),
      confirmed,
      unverified: confirmed === null ? null : Math.max(humanVisitors - confirmed, 0),
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
      '`visitors.confirmed` counts human visitors whose browser ran the page script (page view or click beacon) or came back with the bilko_vid cookie; `visitors.unverified` is `human - confirmed` (no-JS clients, crawlers with a browser UA, blocked beacons). Both are null from a host older than confirmedVisitors.',
      '`visitors.bilkoVidCookie` counts bilko_vid cookie UUIDs. Clients that drop cookies (most crawlers) mint a new one on every request, so this over-counts non-browser traffic.',
      'Visitors are classified into six classes: human, search_crawler, ai_crawler, ai_user_agent, api_client, script. `byClass` covers all classes, so its hits sum to all non-error hits; `visitors.human` stays human-only. Undeclared bots with a browser UA and no navigator.webdriver flag still land in `human`; `humanSingleHit` is the main signal for them.',
      'Human aggregates exclude status >= 400. Hits are HTML documents only, not assets or API calls.',
      mine === 'exclude'
        ? "mine=exclude: the owner's own hits and clicks are left out of every count: is_admin rows, any visitor id (IP+UA hash or bilko_vid cookie) seen signed in as admin in the last 30 days, every device marked as the owner's on /admin/secrets, and every hit or click sent with the bilko_internal marker. `filters.mineHits` is the owner's human hits in the window."
        : "mine=include: the owner's own hits and clicks are counted (excludeSelf: false). `filters.mineHits` is the owner's human hits in the window.",
      bots === 'exclude'
        ? 'bots=exclude: byClass and topPagesByClass keep only non-bot hits. The human aggregates exclude bot hits either way (UA-flagged, HeadlessChrome/Playwright included, or re-flagged after a navigator.webdriver page view).'
        : 'bots=include: byClass and topPagesByClass keep every class, bots included. The human aggregates exclude bot hits either way (UA-flagged, HeadlessChrome/Playwright included, or re-flagged after a navigator.webdriver page view).',
      'A window that starts before `metricValidSince.visitors` only covers the days since then. page_hits keeps 90 days; the host caps the window at 90.',
      'Under-reports by up to the 60s flush interval on every process restart.',
    ],
  };
}

/**
 * GET /api/admin/traffic. excludeSelf (default true) sends mine=exclude. includeBots (default true) sends bots=include:
 * the human aggregates exclude bots either way, so bots=exclude would only trim byClass/topPagesByClass. Never sends
 * the legacy self= alias.
 */
export async function trafficReport(opts: {
  days: number;
  slug?: string;
  excludeSelf?: boolean;
  includeBots?: boolean;
}): Promise<Record<string, unknown>> {
  const requested: TrafficRequest = { excludeSelf: opts.excludeSelf ?? true, includeBots: opts.includeBots ?? true };
  const p = new URLSearchParams();
  p.set('days', String(opts.days));
  if (opts.slug) p.set('slug', opts.slug);
  p.set('mine', toggle(!requested.excludeSelf));
  p.set('bots', toggle(requested.includeBots));
  const body = await adminGet(`/api/admin/traffic?${p.toString()}`);
  if (!body) throw new Error('bilko.run returned 404 for /api/admin/traffic');
  return mapTrafficToReport(body, opts.days, requested);
}

/** GET /api/admin/funnel: per-UTM revenue funnel (visits → sign_ins → checkout_start → paid → booked), plus free_hours_booked. */
export async function funnelReport(opts: { utmSource: string; since?: string }): Promise<Record<string, unknown>> {
  const p = new URLSearchParams();
  p.set('utm_source', opts.utmSource);
  if (opts.since) p.set('since', opts.since);
  const body = await adminGet(`/api/admin/funnel?${p.toString()}`);
  if (!body) throw new Error('bilko.run returned 404 for /api/admin/funnel');
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  return {
    source: baseUrl(),
    since: typeof b.since === 'string' ? b.since : null,
    utm_source: typeof b.utm_source === 'string' ? b.utm_source : opts.utmSource,
    visits: num(b.visits),
    sign_ins: num(b.sign_ins),
    checkout_start: num(b.checkout_start),
    paid: num(b.paid),
    booked: num(b.booked),
    free_hours_booked: num(b.free_hours_booked),
  };
}

/**
 * The host's telemetry `env` selector (server/routes/telemetry.ts parseEnvSelector): one env, or 'all' for no filter.
 * prod keeps rows without env too, from clients that predate the tag.
 */
export type EnvFilter = 'prod' | 'dev' | 'test' | 'all';

/**
 * GET /api/admin/flows: per-app sessions, views, clicks, events and errors. Sends mine=exclude&bots=exclude unless the
 * caller opts in, so the counts are real visitors, and always sends env (prod unless given), so local dev and automated
 * test runs stay out. The body is passed through with the host's `filters` echo, or `filters: null` from a host that
 * echoes none.
 */
export async function flowsReport(opts: {
  days?: number;
  app?: string;
  includeMine?: boolean;
  includeBots?: boolean;
  env?: EnvFilter;
}): Promise<Record<string, unknown>> {
  const p = new URLSearchParams();
  if (opts.days !== undefined) p.set('days', String(opts.days));
  if (opts.app) p.set('app', opts.app);
  p.set('mine', toggle(!!opts.includeMine));
  p.set('bots', toggle(!!opts.includeBots));
  p.set('env', opts.env ?? 'prod');
  const body = await adminGet(`/api/admin/flows?${p.toString()}`);
  if (!body) throw new Error('bilko.run returned 404 for /api/admin/flows');
  const b = (typeof body === 'object' ? body : {}) as Record<string, unknown>;
  return { source: baseUrl(), ...b, filters: filtersEcho(b) };
}

/**
 * A session id as the host accepts it (server/session-identity.ts isValidId). Case is spelled out instead of an `i` flag
 * because the tool's JSON Schema `pattern` carries no flags.
 */
export const SESSION_ID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const EMAIL_KEY = /e[-_]?mail/i;
const EMAIL_ADDRESS = /[a-z0-9._%+-]+(?:@|%40)[a-z0-9.-]+\.[a-z]{2,}/gi;
// Non-global copy for .test(), which would otherwise carry lastIndex between calls.
const HAS_EMAIL_ADDRESS = new RegExp(EMAIL_ADDRESS.source, 'i');

/**
 * Deep copy that drops every object key naming an email or holding an email address, and turns each email address inside a string into [email],
 * so free-form values (event props, paths, error messages, mailto: hrefs) cannot carry one out.
 */
function scrubEmails(v: unknown): unknown {
  if (typeof v === 'string') return v.includes('@') || v.includes('%40') ? v.replace(EMAIL_ADDRESS, '[email]') : v;
  if (Array.isArray(v)) return v.map(scrubEmails);
  if (!v || typeof v !== 'object') return v;
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>)
      .filter(([k]) => !EMAIL_KEY.test(k) && !HAS_EMAIL_ADDRESS.test(k))
      .map(([k, x]) => [k, scrubEmails(x)]),
  );
}

// The session fields sessions_report returns, plus any utm_* column. The host's rows also carry `email`, never copied.
const SESSION_FIELDS = new Set([
  'session_id', 'visitor_id', 'started_at', 'ended_at', 'duration_ms', 'landing_path', 'exit_path', 'page_count',
  'source_bucket', 'referrer_host', 'country', 'device', 'converted', 'purchased',
  'click_count', 'event_count', 'error_count', 'apps', 'mine', 'bot',
]);

function pickSession(r: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) if (SESSION_FIELDS.has(k) || k.startsWith('utm_')) out[k] = v;
  // GET /api/admin/sessions/:id returns the raw sessions row, which has no duration_ms.
  if (out.duration_ms === undefined && typeof r.started_at === 'number' && typeof r.ended_at === 'number') {
    out.duration_ms = Math.max(0, r.ended_at - r.started_at);
  }
  return out;
}

/** One timeline item reduced to its kind's fields; a view keeps only the host's stored referrer_host. */
function pickTimelineItem(r: Record<string, unknown>): Record<string, unknown> {
  const base = { ts: num(r.ts), kind: str(r.kind) };
  switch (r.kind) {
    case 'view':
      return { ...base, path: str(r.path), referrer_host: str(r.referrer_host) };
    case 'click':
      return { ...base, path: str(r.path), label: str(r.label), href: str(r.href), track_name: str(r.track_name) };
    case 'event':
      return { ...base, name: str(r.name), app: str(r.app), path: str(r.path), props: r.props ?? null };
    case 'error':
      return { ...base, app: str(r.app), name: str(r.name), msg: str(r.msg) };
    default:
      return base;
  }
}

interface SessionDetail {
  session: Record<string, unknown> | null;
  apps: string[];
  timeline: Record<string, unknown>[];
}

/** GET /api/admin/sessions/:id with the session and timeline allowlisted (not yet scrubbed). Null on 404. */
async function readSession(id: string): Promise<SessionDetail | null> {
  if (!SESSION_ID_RE.test(id)) throw new Error('invalid session id: expected a UUID');
  const body = await adminGet(`/api/admin/sessions/${encodeURIComponent(id)}`);
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  return {
    session: b.session && typeof b.session === 'object' ? pickSession(b.session as Record<string, unknown>) : null,
    apps: Array.isArray(b.apps) ? b.apps.filter((a): a is string => typeof a === 'string') : [],
    timeline: rows(b.timeline).map(pickTimelineItem),
  };
}

/** GET /api/admin/sessions/:id as { session, apps, timeline } with no email. Null when the host has no such session. */
export async function sessionDetail(id: string): Promise<Record<string, unknown> | null> {
  const detail = await readSession(id);
  return detail && (scrubEmails(detail) as Record<string, unknown>);
}

const TIMELINE_SESSION_CAP = 50;
const TIMELINE_CONCURRENCY = 5;

/** Maps fn over items with at most `size` calls in flight, keeping input order. No new call starts after one fails. */
async function mapLimit<T, R>(items: readonly T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async (): Promise<void> => {
    while (!failed && next < items.length) {
      const i = next++;
      try {
        out[i] = await fn(items[i]);
      } catch (e) {
        failed = true;
        throw e;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

/**
 * GET /api/admin/sessions as allowlisted rows with no email. Sends mine=exclude&bots=exclude unless the caller opts in.
 * With `timeline`, at most 50 sessions are listed and each gets its GET /api/admin/sessions/:id timeline, 5 requests
 * at a time.
 */
export async function sessionsReport(opts: {
  days?: number;
  app?: string;
  limit?: number;
  includeMine?: boolean;
  includeBots?: boolean;
  timeline?: boolean;
}): Promise<Record<string, unknown>> {
  const limit = opts.timeline ? Math.min(opts.limit ?? TIMELINE_SESSION_CAP, TIMELINE_SESSION_CAP) : opts.limit;
  const p = new URLSearchParams();
  if (opts.days !== undefined) p.set('days', String(opts.days));
  if (opts.app) p.set('app', opts.app);
  if (limit !== undefined) p.set('limit', String(limit));
  p.set('mine', toggle(!!opts.includeMine));
  p.set('bots', toggle(!!opts.includeBots));
  const body = await adminGet(`/api/admin/sessions?${p.toString()}`);
  if (!body) throw new Error('bilko.run returned 404 for /api/admin/sessions');
  const b = (typeof body === 'object' ? body : {}) as Record<string, unknown>;
  let sessions = rows(b.sessions).map(pickSession);
  if (opts.timeline) {
    sessions = sessions.slice(0, TIMELINE_SESSION_CAP);
    // The host still stores legacy non-UUID session ids, which GET /api/admin/sessions/:id refuses: those keep their
    // row with an empty timeline and a note instead of failing the whole report.
    const details = await mapLimit(sessions, TIMELINE_CONCURRENCY, async (s) => {
      const id = String(s.session_id ?? '');
      if (!SESSION_ID_RE.test(id)) {
        return { timeline: [], timeline_note: 'timeline unavailable: legacy session id is not a UUID' };
      }
      const d = await readSession(id);
      return d ? { timeline: d.timeline } : { timeline: [], timeline_note: 'timeline unavailable: host returned 404' };
    });
    sessions = sessions.map((s, i) => ({ ...s, ...details[i] }));
  }
  const report = { source: baseUrl(), filters: filtersEcho(b), count: sessions.length, sessions };
  return scrubEmails(report) as Record<string, unknown>;
}
