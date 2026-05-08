import type { FastifyInstance } from 'fastify';
import { dbRun } from '../db.js';

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

function safeMeta(val: unknown, maxBytes: number): string {
  try { return JSON.stringify(val ?? {}).slice(0, maxBytes); } catch { return '{}'; }
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
    return { ok: true };
  });
}
