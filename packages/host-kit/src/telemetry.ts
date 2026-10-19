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
 * If initTelemetry has not been called, track() auto-initializes (app derived
 * from /projects/<slug>/) — so track() is always safe to use.
 */

const HOST = 'https://bilko.run';
const FLOW_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

const FLUSH_MS = 5_000;
const MAX_BATCH = 50;
const MAX_ERR_PER_KEY_PER_MIN = 3;

function defaultEndpoint(): string {
  const h = typeof location !== 'undefined' ? location.hostname : '';
  return h === 'bilko.run' || h === 'www.bilko.run' ? '/api/telemetry' : `${HOST}/api/telemetry`;
}

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

// Identity contract mirrors server/session-identity.ts (host repo). host-kit
// cannot import server code, so the constants are duplicated here.
const VID_COOKIE = 'bilko_vid';
const SID_COOKIE = 'bilko_sid';
const VID_MAX_AGE = 31_536_000;
const SID_MAX_AGE = 1_800;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validId(v: string | null | undefined): string | null {
  return v && ID_RE.test(v) ? v : null;
}

function readCookie(name: string): string | null {
  for (const part of document.cookie.split(';')) {
    const t = part.trim();
    if (t.startsWith(`${name}=`)) return t.slice(name.length + 1);
  }
  return null;
}

function writeCookie(name: string, value: string, maxAge: number): void {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function touchSession(): { vid: string; sid: string } {
  try {
    const cookieVid = validId(readCookie(VID_COOKIE));
    let lsVid: string | null = null;
    try { lsVid = validId(localStorage.getItem(VID_COOKIE)); } catch { /* storage blocked */ }
    const vid = lsVid ?? cookieVid ?? newId();
    try { localStorage.setItem(VID_COOKIE, vid); } catch { /* storage blocked */ }
    writeCookie(VID_COOKIE, vid, VID_MAX_AGE);
    const sid = validId(readCookie(SID_COOKIE)) ?? newId();
    writeCookie(SID_COOKIE, sid, SID_MAX_AGE);
    return { vid, sid };
  } catch { return { vid: 'anon', sid: 'anon' }; }
}

export function initTelemetry(opts: InitOpts): void {
  if (cfg) return; // idempotent
  cfg = { sampleInfo: 0.1, endpoint: defaultEndpoint(), ...opts };
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
  const { vid, sid } = touchSession();
  buf.push({
    kind: 'error',
    payload: {
      app: cfg.app, version: cfg.version,
      visitor_id: vid, session_id: sid,
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
  if (typeof window === 'undefined') return;
  try {
    if (!cfg) {
      const m = /^\/projects\/([^/]+)\//.exec(location.pathname);
      initTelemetry({ app: m ? m[1] : 'bilko', version: 'unknown' });
    }
    if (!cfg) return;
    const p = { ...(props ?? {}) };
    if (p.path === undefined) p.path = location.pathname;
    const { vid, sid } = touchSession();
    buf.push({
      kind: 'event',
      payload: {
        app: cfg.app, name,
        visitor_id: vid, session_id: sid,
        ts: Date.now(), props: stripPII(p),
      },
    });
    if (buf.length >= MAX_BATCH) flush();
  } catch { /* never breaks the app */ }
}

export function trackFlow(flow: string, step: string, props?: Record<string, unknown>): void {
  if (!FLOW_RE.test(flow) || !FLOW_RE.test(step)) return;
  track(`${flow}.${step}`, { ...(props ?? {}), flow, step });
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
  const { vid, sid } = touchSession();
  buf.push({
    kind: 'log',
    payload: {
      app: cfg.app, version: cfg.version, level, msg,
      visitor_id: vid, session_id: sid,
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
}
