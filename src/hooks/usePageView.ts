const API = import.meta.env.VITE_API_URL || '/api';

const VID_COOKIE = 'bilko_vid';
const SID_COOKIE = 'bilko_sid';
const VID_MAX_AGE_S = 31536000;
const SID_IDLE_S = 1800;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* ignore */ }
  // Fallback uuid v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readCookie(name: string): string {
  for (const part of document.cookie.split(';')) {
    const k = part.indexOf('=');
    if (k > 0 && part.slice(0, k).trim() === name) {
      const v = part.slice(k + 1).trim();
      return UUID_RE.test(v) ? v : '';
    }
  }
  return '';
}

function writeCookie(name: string, value: string, maxAge: number): void {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

export function getOrCreateVisitorId(): string {
  try {
    let id = readCookie(VID_COOKIE);
    let legacy = '';
    try { legacy = localStorage.getItem('bilko_vid') ?? ''; } catch { /* ignore */ }
    if (UUID_RE.test(legacy)) id = legacy;
    else if (!id) id = uuid();
    writeCookie(VID_COOKIE, id, VID_MAX_AGE_S);
    try { localStorage.setItem('bilko_vid', id); } catch { /* ignore */ }
    return id;
  } catch {
    return uuid();
  }
}

export function getOrCreateSessionId(): string {
  try {
    const id = readCookie(SID_COOKIE) || uuid();
    writeCookie(SID_COOKIE, id, SID_IDLE_S);
    return id;
  } catch {
    return uuid();
  }
}

/** Fire a funnel event. Uses sendBeacon when available, fetch keepalive otherwise. */
export function track(event: string, props?: { tool?: string; path?: string; metadata?: unknown }): void {
  try {
    const body = JSON.stringify({
      event,
      tool: props?.tool ?? null,
      path: props?.path ?? (typeof window !== 'undefined' ? window.location.pathname : null),
      metadata: props?.metadata ?? null,
      visitor_id: getOrCreateVisitorId(),
      session_id: getOrCreateSessionId(),
    });
    const url = `${API}/analytics/event`;
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return;
    }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch { /* never fail */ }
}

const FLOW_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const PII_RE = /(email|password|token|key|ssn|card|cvv|apikey)/i;
const TELEMETRY_URL = '/api/telemetry/event';

function stripPII(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = PII_RE.test(k) ? '[redacted]' : v;
  return out;
}

/** Send one host-kit-shaped telemetry event. Never throws. */
function sendTelemetry(name: string, props: Record<string, unknown>): void {
  try {
    const body = JSON.stringify({
      batch: [{
        app: 'bilko',
        name,
        visitor_id: getOrCreateVisitorId(),
        session_id: getOrCreateSessionId(),
        ts: Date.now(),
        props: { ...stripPII(props), path: location.pathname },
      }],
    });
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(TELEMETRY_URL, blob)) return;
    }
    fetch(TELEMETRY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch { /* never fail */ }
}

/** Primary-flow event, same shape as host-kit's trackFlow (name `${flow}.${step}`). */
export function trackFlow(flow: string, step: string, props?: Record<string, unknown>): void {
  if (!FLOW_RE.test(flow) || !FLOW_RE.test(step)) return;
  sendTelemetry(`${flow}.${step}`, { ...(props ?? {}), flow, step });
}

/** Screen view event: name 'screen_view', props { screen, path }. */
export function trackScreen(screen: string): void {
  sendTelemetry('screen_view', { screen });
}
