import type { FastifyInstance, FastifyReply } from 'fastify';
import { dbRun, dbGet } from '../db.js';
import { readSessionIds } from '../session-identity.js';

const MAX_BATCH = 50;
const MAX_FIELD_BYTES = 4_000;
const MAX_STACK_BYTES = 16_000;
const ALLOWED_LEVELS = new Set(['info', 'warn', 'error']);

// Per-IP rate limiter (same dual-window pattern as analytics.ts).
const _counts = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000;

function bumpAndCheck(key: string, limit: number): boolean {
  const now = Date.now();
  const e = _counts.get(key);
  if (!e || now - e.windowStart > WINDOW_MS) {
    _counts.set(key, { count: 1, windowStart: now });
    // Evict stale entries when map gets large.
    if (_counts.size > 5000) {
      for (const [k, v] of _counts) {
        if (now - v.windowStart > WINDOW_MS) _counts.delete(k);
      }
    }
    return true;
  }
  e.count += 1;
  return e.count <= limit;
}

function ipKey(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd[0] : (fwd ?? req.ip ?? '');
  const tag = beaconTag(req);
  return `tel:${tag}:${raw.split(',')[0].trim()}`;
}

// --- Abuse controls that do not know who the caller is ---------------------
// These beacons are deliberately unauthenticated: a fresh install on a stranger's
// machine must be able to POST successfully the first time it runs, with nothing
// configured. So every control below is identity-free.
//
// Quota throttling answers 429 + Retry-After, never a 200: a 200 tells the
// desktop client the batch was delivered, so it drops it from its queue and a
// boot backlog replay or crash burst is lost for good. Both callers treat 429
// as "back off and retry" (session-manager's telemetryClient requeues the batch
// with exponential backoff; host-kit's browser SDK is fire-and-forget), and
// neither treats it as the "contract is broken, stop reporting" 4xx. The quota
// check is all-or-nothing per request and consumes no budget when it refuses,
// so a retried batch never double-inserts the part that would have fit.
//
// Records that can never be valid (an `app` that is not slug-shaped, a /log
// record with an invalid level) are still dropped silently and never charged:
// retrying them would never succeed.

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

// Per-install limits. A stable anonymous install UUID (`visitor_id`) is the only
// identity we have, and it catches what per-IP misses in both directions: one
// looping install behind CGNAT shares an IP with thousands of innocents, and an
// office of five real installs shares one IP with each other.
const VISITOR_HOURLY_LIMIT = 200;
const VISITOR_DAILY_LIMIT = 2_000;

// Per-app ceiling, so a single pathological release cannot fill the DB overnight
// even if it rotates install UUIDs and IPs. Counted in records, not requests.
const APP_DAILY_LIMIT = 250_000;

// `app` is free-form (any sibling may ingest under its own slug), so there is no
// allowlist to maintain — but a value that is not slug-shaped is not one of ours,
// and is rejected before the record reaches the DB.
const APP_SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,59}$/i;

type Bucket = { count: number; windowStart: number };

type Quota = { map: Map<string, Bucket>; key: string; windowMs: number; limit: number; n: number };

const _visitorHour = new Map<string, Bucket>();
const _visitorDay = new Map<string, Bucket>();
const _appDay = new Map<string, Bucket>();

/** Seconds until `q` would fit, or 0 when it fits now. Never mutates. */
function quotaWait(q: Quota, now: number): number {
  const e = q.map.get(q.key);
  if (!e || now - e.windowStart > q.windowMs) return 0;
  if (e.count + q.n <= q.limit) return 0;
  return Math.max(1, Math.ceil((e.windowStart + q.windowMs - now) / 1000));
}

function quotaConsume(q: Quota, now: number): void {
  const e = q.map.get(q.key);
  if (!e || now - e.windowStart > q.windowMs) {
    q.map.set(q.key, { count: q.n, windowStart: now });
    if (q.map.size > 20_000) {
      for (const [k, v] of q.map) if (now - v.windowStart > q.windowMs) q.map.delete(k);
    }
    return;
  }
  e.count += q.n;
}

/**
 * All-or-nothing: either every quota fits and all are charged, or none is
 * charged and the caller gets the longest wait among the ones that do not fit.
 */
function chargeQuotas(quotas: Quota[]): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  let wait = 0;
  for (const q of quotas) wait = Math.max(wait, quotaWait(q, now));
  if (wait > 0) return { ok: false, retryAfterSec: wait };
  for (const q of quotas) quotaConsume(q, now);
  return { ok: true };
}

type Admitted =
  | { ok: true; records: Record<string, unknown>[] }
  | { ok: false; retryAfterSec: number };

// Shape + quota gate applied to every batch, before any INSERT. Malformed
// records are dropped; if what survives does not fit the per-app or
// per-install budget, the whole batch is refused so the client keeps it.
// Records with no visitor_id are exempt from the per-install quota (browser SDK
// traffic often has none on a first hit); they are still covered by the per-IP
// limiter and the per-app ceiling.
function admit(batch: unknown[], valid: (rec: Record<string, unknown>) => boolean = () => true): Admitted {
  const records: Record<string, unknown>[] = [];
  const perApp = new Map<string, number>();
  const perVisitor = new Map<string, number>();
  for (const r of batch) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    const rec = r as Record<string, unknown>;
    const appName = typeof rec.app === 'string' ? rec.app : '';
    if (!APP_SLUG_RE.test(appName)) continue;
    if (!valid(rec)) continue;
    records.push(rec);
    perApp.set(appName, (perApp.get(appName) ?? 0) + 1);
    const visitorId = typeof rec.visitor_id === 'string' ? rec.visitor_id.slice(0, 80) : '';
    if (visitorId) perVisitor.set(visitorId, (perVisitor.get(visitorId) ?? 0) + 1);
  }
  const quotas: Quota[] = [];
  for (const [key, n] of perApp) quotas.push({ map: _appDay, key, windowMs: DAY_MS, limit: APP_DAILY_LIMIT, n });
  for (const [key, n] of perVisitor) {
    quotas.push({ map: _visitorHour, key, windowMs: HOUR_MS, limit: VISITOR_HOURLY_LIMIT, n });
    quotas.push({ map: _visitorDay, key, windowMs: DAY_MS, limit: VISITOR_DAILY_LIMIT, n });
  }
  const charged = chargeQuotas(quotas);
  return charged.ok ? { ok: true, records } : charged;
}

// Browser records carry the same-origin bilko_vid/bilko_sid cookie ids when present, so
// sibling apps still sending per-tab body ids join the site-wide session. Stamped before
// admit() so the per-install quota is charged against the id that is actually stored.
// Desktop clients send no cookie and keep their body ids.
function batchOf(req: { body?: unknown; headers: { cookie?: string } }): unknown[] {
  const body = req.body as { batch?: unknown[] } | null;
  const batch = Array.isArray(body?.batch) ? body!.batch!.slice(0, MAX_BATCH) : [];
  const ids = readSessionIds(req.headers.cookie);
  if (!ids.sessionId && !ids.visitorId) return batch;
  return batch.map((r) => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return r;
    const rec = { ...(r as Record<string, unknown>) };
    if (ids.sessionId) rec.session_id = ids.sessionId;
    if (ids.visitorId) rec.visitor_id = ids.visitorId;
    return rec;
  });
}

function sendThrottled(reply: FastifyReply, retryAfterSec: number) {
  return reply.code(429).header('Retry-After', String(retryAfterSec)).send({ error: 'quota_exceeded', retryAfterSec });
}

// Per-record deployment environment, as the client resolved it. Anything else
// (including absent) is stored as NULL; read paths treat NULL as prod so rows
// written before clients sent it, and browser-SDK rows, still count.
const ALLOWED_ENVS = new Set(['prod', 'dev', 'test']);

function envOf(rec: Record<string, unknown>): string | null {
  return typeof rec.env === 'string' && ALLOWED_ENVS.has(rec.env) ? rec.env : null;
}

export type EnvSelector = 'prod' | 'dev' | 'test' | 'all';

/** Parse a `?env=` query value; anything unrecognised means the prod default. */
export function parseEnvSelector(raw: unknown): EnvSelector {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === 'all' || (typeof v === 'string' && ALLOWED_ENVS.has(v)) ? (v as EnvSelector) : 'prod';
}

/**
 * SQL predicate for read paths over telemetry tables. `column` is a trusted
 * literal (e.g. `env` or `e.env`), never user input; the selector value is
 * always bound. NULL counts as prod (see ALLOWED_ENVS above).
 */
export function envPredicate(sel: EnvSelector, column = 'env'): { sql: string; args: string[] } {
  if (sel === 'all') return { sql: '1 = 1', args: [] };
  if (sel === 'prod') return { sql: `COALESCE(${column}, 'prod') = 'prod'`, args: [] };
  return { sql: `${column} = ?`, args: [sel] };
}

// A build-constant tag compiled into a client package (e.g.
// `X-SM-Beacon: session-manager/1.2.3`). It ships inside a public npm package,
// so it is NOT a secret and nothing here treats it as authentication. Its only
// job is to give recognised client traffic its own per-IP bucket, so a scanner
// hammering a public POST route cannot exhaust the budget of a real install that
// happens to share an egress IP with it. Untagged traffic is never dropped for
// being untagged — the browser SDK does not send it.
//
// The desktop client also sends `X-SM-Beacon-Key`. It is deliberately ignored:
// its value is a public fallback constant compiled into the npm package, so
// checking it would authenticate nothing.
const BEACON_RE = /^[a-z0-9][a-z0-9._-]{0,39}\/[0-9][0-9a-z.\-+]{0,19}$/i;

function beaconTag(req: { headers: Record<string, string | string[] | undefined> }): string {
  const h = req.headers['x-sm-beacon'];
  const raw = Array.isArray(h) ? h[0] : (h ?? '');
  return BEACON_RE.test(raw) ? raw.split('/')[0].toLowerCase() : '';
}

function clamp(s: unknown, n: number): string {
  return typeof s === 'string' ? s.slice(0, n) : String(s ?? '').slice(0, n);
}

function clampInt(v: unknown, max: number): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(Math.floor(n), max));
}

// Clients send the app version either top-level (`version`) or nested in the
// props blob (`appVersion`, which is where the desktop SDK puts it). Accept
// both; NULL rather than '' when neither is present, so `WHERE version IS NULL`
// means "caller does not report a version" (every browser-app caller).
function eventVersion(e: Record<string, unknown>): string | null {
  const props = e.props as Record<string, unknown> | undefined;
  const raw = e.version ?? props?.appVersion ?? props?.version;
  const v = clamp(raw, 20).trim();
  return v || null;
}

function safeMeta(val: unknown, maxBytes: number): string {
  try { return JSON.stringify(val ?? {}).slice(0, maxBytes); } catch { return '{}'; }
}

// --- Retention -------------------------------------------------------------
// app_logs / app_errors are unbounded ingest tables with no external scheduler
// to sweep them, and desktop crash reports arrive in correlated bursts (one
// OOM-killed machine can emit thousands of rows in a minute). So the prune is
// opportunistic, on the same request path that writes: at most once every
// PRUNE_EVERY_MS per process, delete anything past the age cap, then trim the
// oldest rows back to the row cap. Cheap (two bounded DELETEs), and it cannot
// let a burst grow the table without bound the way a nightly job would.
//
// That path alone is not enough: an app that stops reporting never triggers it,
// and funnel_events / app_installs have no cap at all. So a daily in-process
// timer (plus one run 5 minutes after boot, since Render restarts reset
// in-process clocks and a daily interval alone might never fire) also calls
// pruneTelemetryScheduled(). funnel_events is shared with web analytics and
// web-product checkout metrics, which must never be pruned; telemetry ingest
// always writes env and/or version, so only rows with one of them set qualify.
const LOG_RETENTION_DAYS = 30;
const ERROR_RETENTION_DAYS = 90;
const MAX_LOG_ROWS = 200_000;
const MAX_ERROR_ROWS = 100_000;
const PRUNE_EVERY_MS = 10 * 60_000;
const EVENT_RETENTION_DAYS = 180;
const INSTALL_RETENTION_DAYS = 365;
const SCHEDULED_PRUNE_EVERY_MS = DAY_MS;
const SCHEDULED_PRUNE_FIRST_MS = 5 * 60_000;

let _lastPruneAt = 0;

export async function pruneTelemetry(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await dbRun('DELETE FROM app_logs WHERE created_at < ?', now - LOG_RETENTION_DAYS * 86_400);
  await dbRun('DELETE FROM app_errors WHERE created_at < ?', now - ERROR_RETENTION_DAYS * 86_400);

  for (const [table, cap] of [['app_logs', MAX_LOG_ROWS], ['app_errors', MAX_ERROR_ROWS]] as const) {
    const row = await dbGet<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
    const excess = (row?.n ?? 0) - cap;
    if (excess > 0) {
      await dbRun(
        `DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} ORDER BY created_at ASC LIMIT ?)`,
        excess,
      );
    }
  }
}

async function maybePrune(): Promise<void> {
  const now = Date.now();
  if (now - _lastPruneAt < PRUNE_EVERY_MS) return;
  _lastPruneAt = now;
  // Never let a retention failure fail an ingest — the write already landed.
  try { await pruneTelemetry(); } catch { /* best-effort */ }
}

export async function pruneTelemetryScheduled(): Promise<void> {
  await pruneTelemetry();
  const eventCutoff = new Date(Date.now() - EVENT_RETENTION_DAYS * DAY_MS)
    .toISOString().slice(0, 19).replace('T', ' ');
  await dbRun(
    'DELETE FROM funnel_events WHERE created_at < ? AND (env IS NOT NULL OR version IS NOT NULL)',
    eventCutoff,
  );
  const installCutoff = Math.floor(Date.now() / 1000) - INSTALL_RETENTION_DAYS * 86_400;
  await dbRun('DELETE FROM app_installs WHERE last_seen_at < ?', installCutoff);
}

function startScheduledPrune(app: FastifyInstance): void {
  const run = () => {
    pruneTelemetryScheduled().catch(err => app.log.warn({ err }, 'scheduled telemetry prune failed'));
  };
  const first = setTimeout(run, SCHEDULED_PRUNE_FIRST_MS);
  const timer = setInterval(run, SCHEDULED_PRUNE_EVERY_MS);
  first.unref();
  timer.unref();
  app.addHook('onClose', async () => {
    clearTimeout(first);
    clearInterval(timer);
  });
}

export function registerTelemetryRoutes(app: FastifyInstance, opts: { scheduledPrune?: boolean } = {}): void {
  if (opts.scheduledPrune !== false) startScheduledPrune(app);
  // Alias endpoint — writes to the same funnel_events table as /api/analytics/event.
  // No ALLOWED_EVENTS check; apps may track any event name via the SDK.
  app.post('/api/telemetry/event', async (req, reply) => {
    if (!bumpAndCheck(ipKey(req as any), 1200)) return reply.code(429).send({ error: 'rate_limited' });
    const admitted = admit(batchOf(req));
    if (!admitted.ok) return sendThrottled(reply, admitted.retryAfterSec);
    for (const e of admitted.records) {
      await dbRun(
        `INSERT INTO funnel_events (event, tool, metadata, session_id, visitor_id, path, version, env)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        clamp(e.name, 80),
        clamp(e.app, 60),
        safeMeta(e.props, MAX_FIELD_BYTES),
        clamp(e.session_id, 80),
        clamp(e.visitor_id, 80),
        clamp((e.props as Record<string, unknown> | undefined)?.path, 200),
        eventVersion(e),
        envOf(e),
      );
    }
    return { ok: true, ingested: admitted.records.length };
  });

  app.post('/api/telemetry/log', async (req, reply) => {
    if (!bumpAndCheck(ipKey(req as any), 600)) return reply.code(429).send({ error: 'rate_limited' });
    // Invalid levels are dropped silently, before they are charged to any quota.
    const admitted = admit(
      batchOf(req),
      (l) => ALLOWED_LEVELS.has(String(l.level)),
    );
    if (!admitted.ok) return sendThrottled(reply, admitted.retryAfterSec);
    for (const l of admitted.records) {
      await dbRun(
        `INSERT INTO app_logs (app, version, level, msg, visitor_id, session_id, fields_json, created_at, env)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        clamp(l.app, 60),
        clamp(l.version, 20),
        String(l.level),
        clamp(l.msg, 500),
        clamp(l.visitor_id, 80),
        clamp(l.session_id, 80),
        safeMeta(l.fields, MAX_FIELD_BYTES),
        Math.floor((typeof l.ts === 'number' ? l.ts : Date.now()) / 1000),
        envOf(l),
      );
    }
    await maybePrune();
    return { ok: true, ingested: admitted.records.length };
  });

  app.post('/api/telemetry/error', async (req, reply) => {
    if (!bumpAndCheck(ipKey(req as any), 300)) return reply.code(429).send({ error: 'rate_limited' });
    const admitted = admit(batchOf(req));
    if (!admitted.ok) return sendThrottled(reply, admitted.retryAfterSec);
    for (const e of admitted.records) {
      await dbRun(
        `INSERT INTO app_errors (app, version, name, msg, stack, url, ua, visitor_id, session_id, context_json, created_at, env)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        clamp(e.app, 60),
        clamp(e.version, 20),
        clamp(e.name, 60),
        clamp(e.msg, 500),
        clamp(e.stack, MAX_STACK_BYTES),
        clamp(e.url, 500),
        clamp(e.ua, 200),
        clamp(e.visitor_id, 80),
        clamp(e.session_id, 80),
        safeMeta(e.context, MAX_FIELD_BYTES),
        Math.floor((typeof e.ts === 'number' ? e.ts : Date.now()) / 1000),
        envOf(e),
      );
    }
    await maybePrune();
    return { ok: true, ingested: admitted.records.length };
  });

  // Durable install record. Unlike its three siblings this is an upsert keyed on
  // install_id, not an append: a desktop install is a slowly-changing dimension.
  // first_seen_at is preserved, last_seen_at/seen_count advance, and every other
  // profile field is overwritten so a version or OS upgrade is reflected.
  app.post('/api/telemetry/install', async (req, reply) => {
    if (!bumpAndCheck(ipKey(req as any), 60)) return reply.code(429).send({ error: 'rate_limited' });
    const b = (req.body ?? {}) as Record<string, unknown>;
    const installId = clamp(b.install_id, 80);
    // A missing install_id is a genuinely malformed body, not throttling — the
    // one case on this route that still earns a 4xx.
    if (!installId) return reply.code(400).send({ error: 'install_id_required' });
    const appName = clamp(b.app, 60);
    if (!APP_SLUG_RE.test(appName)) return { ok: true };
    const charged = chargeQuotas([
      { map: _appDay, key: appName, windowMs: DAY_MS, limit: APP_DAILY_LIMIT, n: 1 },
      { map: _visitorDay, key: `install:${installId}`, windowMs: DAY_MS, limit: VISITOR_DAILY_LIMIT, n: 1 },
    ]);
    if (!charged.ok) return sendThrottled(reply, charged.retryAfterSec);
    const now = Math.floor(Date.now() / 1000);

    await dbRun(
      `INSERT INTO app_installs (
         install_id, app, app_version, platform, os_release, arch, cpu_count,
         total_mem_mb, node_version, electron_version, install_channel, locale,
         timezone, env, first_seen_at, last_seen_at, seen_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(install_id) DO UPDATE SET
         app              = excluded.app,
         app_version      = excluded.app_version,
         platform         = excluded.platform,
         os_release       = excluded.os_release,
         arch             = excluded.arch,
         cpu_count        = excluded.cpu_count,
         total_mem_mb     = excluded.total_mem_mb,
         node_version     = excluded.node_version,
         electron_version = excluded.electron_version,
         install_channel  = excluded.install_channel,
         locale           = excluded.locale,
         timezone         = excluded.timezone,
         env              = excluded.env,
         last_seen_at     = excluded.last_seen_at,
         seen_count       = app_installs.seen_count + 1`,
      installId,
      appName,
      clamp(b.app_version, 20),
      clamp(b.platform, 20),
      clamp(b.os_release, 80),
      clamp(b.arch, 20),
      clampInt(b.cpu_count, 4096),
      clampInt(b.total_mem_mb, 8_388_608),
      clamp(b.node_version, 20),
      clamp(b.electron_version, 20),
      clamp(b.install_channel, 20),
      clamp(b.locale, 20),
      clamp(b.timezone, 60),
      envOf(b),
      now,
      now,
    );

    return { ok: true };
  });
}
