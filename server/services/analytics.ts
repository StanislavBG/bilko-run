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

// ── UA parsing (no deps) ───────────────────────────────────────────────────

export function parseUa(ua: string): { device: string; browser: string; os: string } {
  if (!ua) return { device: 'other', browser: 'other', os: 'other' };
  const u = ua;

  // OS
  let os = 'other';
  if (/Windows/i.test(u)) os = 'Windows';
  else if (/iPhone|iPad|iPod|iOS/i.test(u)) os = 'iOS';
  else if (/Mac OS X|Macintosh/i.test(u)) os = 'Mac';
  else if (/Android/i.test(u)) os = 'Android';
  else if (/Linux/i.test(u)) os = 'Linux';

  // Device
  let device = 'desktop';
  if (/iPad|Tablet/i.test(u)) device = 'tablet';
  else if (/Mobile|iPhone|Android|iPod/i.test(u)) device = 'mobile';

  // Browser (order matters: Edge before Chrome, Chrome before Safari)
  let browser = 'other';
  if (/Edg\//i.test(u)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(u)) browser = 'Opera';
  else if (/Firefox/i.test(u)) browser = 'Firefox';
  else if (/Chrome/i.test(u)) browser = 'Chrome';
  else if (/Safari/i.test(u)) browser = 'Safari';

  return { device, browser, os };
}

// ── Bot detection ──────────────────────────────────────────────────────────

const BOT_RE = /bot|spider|crawler|bingbot|googlebot|facebookexternalhit|slackbot|curl|wget|python-requests|node-fetch|headless|whatsapp|linkedinbot|twitterbot|slurp/i;

export function isBot(ua: string): boolean {
  if (!ua) return false;
  return BOT_RE.test(ua);
}
