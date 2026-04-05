import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

const API = import.meta.env.VITE_API_URL || '/api';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
type UtmKey = typeof UTM_KEYS[number];

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min

function getOrCaptureUtms(): Record<UtmKey, string | null> {
  let stored: Record<string, string> = {};
  try {
    const raw = sessionStorage.getItem('bilko_utms');
    if (raw) stored = JSON.parse(raw);
  } catch { /* ignore */ }

  const params = new URLSearchParams(window.location.search);
  let changed = false;
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v && !stored[k]) {
      stored[k] = v;
      changed = true;
    }
  }
  if (changed) {
    try { sessionStorage.setItem('bilko_utms', JSON.stringify(stored)); } catch { /* ignore */ }
  }

  const out = {} as Record<UtmKey, string | null>;
  for (const k of UTM_KEYS) out[k] = stored[k] ?? null;
  return out;
}

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

export function getOrCreateVisitorId(): string {
  try {
    let id = localStorage.getItem('bilko_vid');
    if (!id) {
      id = uuid();
      localStorage.setItem('bilko_vid', id);
    }
    return id;
  } catch {
    return uuid();
  }
}

export function getOrCreateSessionId(): string {
  try {
    const now = Date.now();
    const last = parseInt(sessionStorage.getItem('bilko_sid_last') ?? '0', 10);
    let id = sessionStorage.getItem('bilko_sid');
    if (!id || !last || now - last > SESSION_TIMEOUT_MS) {
      id = uuid();
      sessionStorage.setItem('bilko_sid', id);
    }
    sessionStorage.setItem('bilko_sid_last', String(now));
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

/** Fire a page view on every route change. Sends email when authenticated. */
export function usePageView() {
  const location = useLocation();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    // Dedup: skip StrictMode double-fires and re-fires triggered purely by email change.
    if (lastPathRef.current === location.pathname) return;
    lastPathRef.current = location.pathname;

    const utms = getOrCaptureUtms();
    const visitorId = getOrCreateVisitorId();
    const sessionId = getOrCreateSessionId();
    fetch(`${API}/analytics/pageview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: location.pathname,
        referrer: document.referrer || '',
        screen: `${window.innerWidth}x${window.innerHeight}`,
        visitor_id: visitorId,
        session_id: sessionId,
        ...utms,
        ...(email ? { email } : {}),
      }),
    }).catch(() => {});
  }, [location.pathname, email]);
}
