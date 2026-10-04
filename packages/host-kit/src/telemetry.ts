/**
 * Unified client telemetry SDK for bilko.run sibling apps.
 *
 * One init call wires three signals:
 *   track()          → /api/telemetry/event   (analytics, batched)
 *   log.info|warn    → /api/telemetry/log     (structured logs, sampled)
 *   log.error/onerr  → /api/telemetry/error   (errors, 100%, de-duped)
 *
 * All sends are batched: at most one HTTP request per 5s per channel,
 * or on visibilitychange:hidden / pagehide / explicit flush().
 *
 * Falls back to fire-and-forget (pre-0.2.0 behavior) if initTelemetry
 * has not been called — so track() is always safe to use.
 */

const HOST = 'https://bilko.run';
const FLUSH_MS = 5_000;
const MAX_BATCH = 50;
const MAX_ERR_PER_KEY_PER_MIN = 3;

interface InitOpts {
  app: string;
  version: string;
  sampleInfo?: number;
  endpoint?: string;
}

interface BufferedEvent { kind: 'event'; payload: unknown }
interface BufferedLog   { kind: 'log';   payload: unknown }
interface BufferedError { kind: 'error'; payload: unknown }
type Buffered = BufferedEvent | BufferedLog | BufferedError;

let cfg: Required<InitOpts> | null = null;
let buf: Buffered[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
const errSeen = new Map<string, { count: number; windowStart: number }>();

let _visitorId: string | null = null;
function getVisitorId(): string {
  if (_visitorId) return _visitorId;
  try {
    let v = localStorage.getItem('bilko_vid');
    if (!v) { v = crypto.randomUUID(); localStorage.setItem('bilko_vid', v); }
    _visitorId = v;
    return v;
  } catch { return 'anon'; }
}

let _sessionId: string | null = null;
function getSessionId(): string {
  if (_sessionId) return _sessionId;
  try {
    _sessionId = sessionStorage.getItem('bilko_sid') ?? crypto.randomUUID();
    sessionStorage.setItem('bilko_sid', _sessionId);
    return _sessionId;
  } catch { return 'anon'; }
}

export function initTelemetry(opts: InitOpts): void {
  if (cfg) return; // idempotent
  cfg = { sampleInfo: 0.1, endpoint: `${HOST}/api/telemetry`, ...opts };
  if (typeof window === 'undefined') return; // SSR no-op
  window.addEventListener('error', (e) => {
    logError(e.error ?? new Error(e.message), { source: e.filename, line: e.lineno, col: e.colno });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
    logError(err, { kind: 'unhandledrejection' });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', () => flush());
  timer = setInterval(flush, FLUSH_MS);
}

export const log = {
  info(msg: string, fields?: Record<string, unknown>):  void { enqueueLog('info',  msg, fields); },
  warn(msg: string, fields?: Record<string, unknown>):  void { enqueueLog('warn',  msg, fields); },
  error(msg: string, fields?: Record<string, unknown>): void { enqueueLog('error', msg, fields); },
};

export function logError(err: Error, context?: Record<string, unknown>): void {
  if (!cfg) return;
  const key = errKey(err);
  const now = Date.now();
  const entry = errSeen.get(key);
  if (entry && now - entry.windowStart < 60_000) {
    if (entry.count >= MAX_ERR_PER_KEY_PER_MIN) return; // suppress burst
    entry.count += 1;
  } else {
    errSeen.set(key, { count: 1, windowStart: now });
  }
  buf.push({
    kind: 'error',
    payload: {
      app: cfg.app, version: cfg.version,
      visitor_id: getVisitorId(), session_id: getSessionId(),
      ts: now, msg: err.message, name: err.name,
      stack: err.stack ?? null,
      url: typeof location !== 'undefined' ? location.href : '',
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      context: stripPII(context ?? {}),
    },
  });
  if (buf.length >= MAX_BATCH) flush();
}

export function track(name: string, props?: Record<string, unknown>): void {
  if (cfg) {
    buf.push({
      kind: 'event',
      payload: {
        app: cfg.app, name,
        visitor_id: getVisitorId(), session_id: getSessionId(),
        ts: Date.now(), props: stripPII(props ?? {}),
      },
    });
    return;
  }
  // Backward compat: direct send (same behavior as host-kit 0.1.x track()).
  if (typeof window === 'undefined') return;
  try {
    const body = JSON.stringify({
      event: name,
      tool: (props as Record<string, unknown> | undefined)?.tool ?? 'unknown',
      path: window.location.pathname,
      metadata: (props as Record<string, unknown> | undefined)?.metadata ?? null,
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
    });
    const url = `${HOST}/api/analytics/event`;
    if (navigator?.sendBeacon) {
      if (navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) return;
    }
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch { /* never breaks the app */ }
}

export function flush(): void {
  if (!cfg || buf.length === 0) return;
  const groups: Record<string, unknown[]> = { event: [], log: [], error: [] };
  for (const b of buf) (groups[b.kind] as unknown[]).push(b.payload);
  buf = [];
  for (const [kind, payloads] of Object.entries(groups)) {
    if (payloads.length === 0) continue;
    const url = `${cfg.endpoint}/${kind}`;
    const body = JSON.stringify({ batch: payloads });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    } else {
      void fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  }
}

function enqueueLog(level: 'info' | 'warn' | 'error', msg: string, fields?: Record<string, unknown>) {
  if (!cfg) return;
  if (level === 'info' && Math.random() > cfg.sampleInfo) return;
  buf.push({
    kind: 'log',
    payload: {
      app: cfg.app, version: cfg.version, level, msg,
      visitor_id: getVisitorId(), session_id: getSessionId(),
      ts: Date.now(), fields: stripPII(fields ?? {}),
    },
  });
  if (level === 'error' || buf.length >= MAX_BATCH) flush();
}

function errKey(e: Error): string {
  const firstFrame = (e.stack ?? '').split('\n').find(l => l.includes('at ')) ?? '';
  return `${e.name}|${e.message.slice(0, 80)}|${firstFrame.slice(0, 120)}`;
}

const PII_RE = /(email|password|token|key|ssn|card|cvv|apikey)/i;
function stripPII<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = PII_RE.test(k) ? '[redacted]' : v;
  }
  return out;
}

// Exported so tests can verify behavior without timing constraints.
export function _getBufferLength(): number { return buf.length; }
export function _resetForTest(): void {
  cfg = null;
  buf = [];
  errSeen.clear();
  if (timer) { clearInterval(timer); timer = null; }
  _visitorId = null;
  _sessionId = null;
}
