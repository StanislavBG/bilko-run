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
  return `tel:${raw.split(',')[0].trim()}`;
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
    const batch = Array.isArray(body?.batch) ? body!.batch!.slice(0, MAX_BATCH) : [];
    for (const e of batch as Record<string, unknown>[]) {
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
    const batch = Array.isArray(body?.batch) ? body!.batch!.slice(0, MAX_BATCH) : [];
    for (const l of batch as Record<string, unknown>[]) {
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
    const batch = Array.isArray(body?.batch) ? body!.batch!.slice(0, MAX_BATCH) : [];
    for (const e of batch as Record<string, unknown>[]) {
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
    if (!installId) return reply.code(400).send({ error: 'install_id_required' });
    const now = Math.floor(Date.now() / 1000);

    await dbRun(
      `INSERT INTO app_installs (
         install_id, app, app_version, platform, os_release, arch, cpu_count,
         total_mem_mb, node_version, electron_version, install_channel, locale,
         timezone, identify_email, first_seen_at, last_seen_at, seen_count)
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
         -- an absent identify_email must not wipe a previously opted-in one
         identify_email   = COALESCE(excluded.identify_email, app_installs.identify_email),
         last_seen_at     = excluded.last_seen_at,
         seen_count       = app_installs.seen_count + 1`,
      installId,
      clamp(b.app, 60),
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
      typeof b.identify_email === 'string' && b.identify_email ? clamp(b.identify_email, 160) : null,
      now,
      now,
    );

    return { ok: true };
  });
}
