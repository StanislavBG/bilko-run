import type { FastifyInstance } from 'fastify';
import { dbRun, dbGet } from '../db.js';

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
// configured. So every control below is identity-free, and every one of them
// DROPS SILENTLY WITH A 200 rather than a 4xx — a client that treats 4xx as
// "the contract is broken, stop reporting" must not be permanently disabled by
// routine throttling. Only the per-IP limiter (which predates this) answers 429,
// which well-behaved clients back off from rather than disable on.

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

function bumpWindow(map: Map<string, Bucket>, key: string, windowMs: number, limit: number, n: number): boolean {
  const now = Date.now();
  const e = map.get(key);
  if (!e || now - e.windowStart > windowMs) {
    map.set(key, { count: n, windowStart: now });
    if (map.size > 20_000) {
      for (const [k, v] of map) if (now - v.windowStart > windowMs) map.delete(k);
    }
    return n <= limit;
  }
  e.count += n;
  return e.count <= limit;
}

const _visitorHour = new Map<string, Bucket>();
const _visitorDay = new Map<string, Bucket>();
const _appDay = new Map<string, Bucket>();

// Records with no visitor_id are exempt here (browser SDK traffic often has none
// on a first hit); they are still covered by the per-IP limiter and the per-app
// ceiling.
function allowVisitor(visitorId: string): boolean {
  if (!visitorId) return true;
  const hourOk = bumpWindow(_visitorHour, visitorId, HOUR_MS, VISITOR_HOURLY_LIMIT, 1);
  const dayOk = bumpWindow(_visitorDay, visitorId, DAY_MS, VISITOR_DAILY_LIMIT, 1);
  return hourOk && dayOk;
}

function allowApp(appName: string): boolean {
  return bumpWindow(_appDay, appName, DAY_MS, APP_DAILY_LIMIT, 1);
}

// Shape + quota gate applied to every record of every batch, before any INSERT.
// Returns the records that survive; everything else is dropped without a trace
// of it reaching the caller.
function admit(batch: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const r of batch) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    const rec = r as Record<string, unknown>;
    const appName = typeof rec.app === 'string' ? rec.app : '';
    if (!APP_SLUG_RE.test(appName)) continue;
    if (!allowApp(appName)) continue;
    if (!allowVisitor(typeof rec.visitor_id === 'string' ? rec.visitor_id.slice(0, 80) : '')) continue;
    out.push(rec);
  }
  return out;
}

// A build-constant tag compiled into a client package (e.g.
// `X-SM-Beacon: session-manager/1.2.3`). It ships inside a public npm package,
// so it is NOT a secret and nothing here treats it as authentication. Its only
// job is to give recognised client traffic its own per-IP bucket, so a scanner
// hammering a public POST route cannot exhaust the budget of a real install that
// happens to share an egress IP with it. Untagged traffic is never dropped for
// being untagged — the browser SDK does not send it.
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
const LOG_RETENTION_DAYS = 30;
const ERROR_RETENTION_DAYS = 90;
const MAX_LOG_ROWS = 200_000;
const MAX_ERROR_ROWS = 100_000;
const PRUNE_EVERY_MS = 10 * 60_000;

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

export function registerTelemetryRoutes(app: FastifyInstance): void {
  // Alias endpoint — writes to the same funnel_events table as /api/analytics/event.
  // No ALLOWED_EVENTS check; apps may track any event name via the SDK.
  app.post('/api/telemetry/event', async (req, reply) => {
    if (!bumpAndCheck(ipKey(req as any), 1200)) return reply.code(429).send({ error: 'rate_limited' });
    const body = req.body as { batch?: unknown[] } | null;
    const batch = admit(Array.isArray(body?.batch) ? body!.batch!.slice(0, MAX_BATCH) : []);
    for (const e of batch) {
      await dbRun(
        `INSERT INTO funnel_events (event, tool, metadata, session_id, visitor_id, path)
         VALUES (?, ?, ?, ?, ?, ?)`,
        clamp(e.name, 80),
        clamp(e.app, 60),
        safeMeta(e.props, MAX_FIELD_BYTES),
        clamp(e.session_id, 80),
        clamp(e.visitor_id, 80),
        clamp((e.props as Record<string, unknown> | undefined)?.path, 200),
      );
    }
    return { ok: true, ingested: batch.length };
  });

  app.post('/api/telemetry/log', async (req, reply) => {
    if (!bumpAndCheck(ipKey(req as any), 600)) return reply.code(429).send({ error: 'rate_limited' });
    const body = req.body as { batch?: unknown[] } | null;
    const batch = admit(Array.isArray(body?.batch) ? body!.batch!.slice(0, MAX_BATCH) : []);
    for (const l of batch) {
      if (!ALLOWED_LEVELS.has(String(l.level))) continue; // drop invalid levels silently
      await dbRun(
        `INSERT INTO app_logs (app, version, level, msg, visitor_id, session_id, fields_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        clamp(l.app, 60),
        clamp(l.version, 20),
        String(l.level),
        clamp(l.msg, 500),
        clamp(l.visitor_id, 80),
        clamp(l.session_id, 80),
        safeMeta(l.fields, MAX_FIELD_BYTES),
        Math.floor((typeof l.ts === 'number' ? l.ts : Date.now()) / 1000),
      );
    }
    await maybePrune();
    return { ok: true };
  });

  app.post('/api/telemetry/error', async (req, reply) => {
    if (!bumpAndCheck(ipKey(req as any), 300)) return reply.code(429).send({ error: 'rate_limited' });
    const body = req.body as { batch?: unknown[] } | null;
    const batch = admit(Array.isArray(body?.batch) ? body!.batch!.slice(0, MAX_BATCH) : []);
    for (const e of batch) {
      await dbRun(
        `INSERT INTO app_errors (app, version, name, msg, stack, url, ua, visitor_id, session_id, context_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      );
    }
    await maybePrune();
    return { ok: true };
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
    // Silent drops from here down: an upsert that is throttled must look
    // identical to one that landed, or the client disables itself.
    if (!allowApp(appName)) return { ok: true };
    if (!bumpWindow(_visitorDay, `install:${installId}`, DAY_MS, VISITOR_DAILY_LIMIT, 1)) return { ok: true };
    const now = Math.floor(Date.now() / 1000);

    await dbRun(
      `INSERT INTO app_installs (
         install_id, app, app_version, platform, os_release, arch, cpu_count,
         total_mem_mb, node_version, electron_version, install_channel, locale,
         timezone, first_seen_at, last_seen_at, seen_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
      now,
      now,
    );

    return { ok: true };
  });
}
