import { dbAll } from '../db.js';

// ── Referrer classification ────────────────────────────────────────────────

interface ReferrerRule { host_pattern: string; bucket: string; source_name: string; }

let _rulesCache: ReferrerRule[] | null = null;

async function getRules(): Promise<ReferrerRule[]> {
  if (_rulesCache) return _rulesCache;
  try {
    _rulesCache = await dbAll<ReferrerRule>('SELECT host_pattern, bucket, source_name FROM referrer_rules');
  } catch {
    _rulesCache = [];
  }
  return _rulesCache;
}

/** Clear the referrer rules cache (call after inserts if admin mutates table). */
export function refreshReferrerRules(): void { _rulesCache = null; }

function hostMatches(host: string, pattern: string): boolean {
  if (host === pattern) return true;
  if (host.endsWith('.' + pattern)) return true;
  return false;
}

export async function classifyReferrer(refHost: string | null): Promise<{ bucket: string; source: string; host: string | null }> {
  if (!refHost) return { bucket: 'direct', source: 'direct', host: null };
  const host = refHost; // already normalized upstream by parseRefHost
  const rules = await getRules();
  for (const r of rules) {
    if (hostMatches(host, r.host_pattern)) {
      return { bucket: r.bucket, source: r.source_name, host };
    }
  }
  return { bucket: 'referral', source: host, host };
}

// ── UA parsing (no deps, precompiled regexes) ─────────────────────────────

const RE_OS_WINDOWS = /Windows/i;
const RE_OS_IOS = /iPhone|iPad|iPod|iOS/i;
const RE_OS_MAC = /Mac OS X|Macintosh/i;
const RE_OS_ANDROID = /Android/i;
const RE_OS_LINUX = /Linux/i;
const RE_DEV_TABLET = /iPad|Tablet/i;
const RE_DEV_MOBILE = /Mobile|iPhone|Android|iPod/i;
const RE_BR_EDGE = /Edg\//i;
const RE_BR_OPERA = /OPR\/|Opera/i;
const RE_BR_FIREFOX = /Firefox/i;
const RE_BR_CHROME = /Chrome/i;
const RE_BR_SAFARI = /Safari/i;

export function parseUa(ua: string): { device: string; browser: string; os: string } {
  if (!ua) return { device: 'other', browser: 'other', os: 'other' };

  let os = 'other';
  if (RE_OS_WINDOWS.test(ua)) os = 'Windows';
  else if (RE_OS_IOS.test(ua)) os = 'iOS';
  else if (RE_OS_MAC.test(ua)) os = 'Mac';
  else if (RE_OS_ANDROID.test(ua)) os = 'Android';
  else if (RE_OS_LINUX.test(ua)) os = 'Linux';

  let device = 'desktop';
  if (RE_DEV_TABLET.test(ua)) device = 'tablet';
  else if (RE_DEV_MOBILE.test(ua)) device = 'mobile';

  // Order matters: Edge before Chrome, Chrome before Safari (Chrome UA contains "Safari").
  let browser = 'other';
  if (RE_BR_EDGE.test(ua)) browser = 'Edge';
  else if (RE_BR_OPERA.test(ua)) browser = 'Opera';
  else if (RE_BR_FIREFOX.test(ua)) browser = 'Firefox';
  else if (RE_BR_CHROME.test(ua)) browser = 'Chrome';
  else if (RE_BR_SAFARI.test(ua)) browser = 'Safari';

  return { device, browser, os };
}

// ── Bot detection ──────────────────────────────────────────────────────────

const BOT_RE = /bot|spider|crawler|bingbot|googlebot|facebookexternalhit|slackbot|curl|wget|python-requests|node-fetch|headless|whatsapp|linkedinbot|twitterbot|slurp/i;

export function isBot(ua: string): boolean {
  if (!ua) return false;
  return BOT_RE.test(ua);
}
