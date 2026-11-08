import { dbAll } from '../db.js';

// ── Referrer classification ────────────────────────────────────────────────

interface ReferrerRule { host_pattern: string; bucket: string; source_name: string; }

let _rulesCache: ReferrerRule[] | null = null;
let _rulesCacheAt = 0;
const RULES_CACHE_TTL_MS = 60 * 60 * 1000; // 1h

async function getRules(): Promise<ReferrerRule[]> {
  const now = Date.now();
  if (_rulesCache && now - _rulesCacheAt < RULES_CACHE_TTL_MS) return _rulesCache;
  try {
    _rulesCache = await dbAll<ReferrerRule>('SELECT host_pattern, bucket, source_name FROM referrer_rules');
    _rulesCacheAt = now;
  } catch {
    _rulesCache ??= [];
  }
  return _rulesCache;
}

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

export type VisitorClass =
  | 'human'
  | 'search_crawler'
  | 'ai_crawler'
  | 'ai_user_agent'
  | 'api_client'
  | 'script';

export const VISITOR_CLASSES: readonly VisitorClass[] = [
  'human',
  'search_crawler',
  'ai_crawler',
  'ai_user_agent',
  'api_client',
  'script',
];

// Checked in this order so specific agent tokens win over the generic bot|spider|crawler fallback.
const RE_AI_USER_AGENT = /chatgpt-user|claude-user|perplexity-user|oai-searchbot|claude-searchbot|claude-web|mistralai-user|duckassistbot/i;
const RE_AI_CRAWLER = /gptbot|claudebot|anthropic-ai|ccbot|google-extended|perplexitybot|bytespider|applebot-extended|meta-externalagent|amazonbot|cohere-ai/i;
const RE_SEARCH_CRAWLER = /googlebot|bingbot|duckduckbot|yandexbot|baiduspider|applebot|slurp|facebookexternalhit|slackbot|twitterbot|linkedinbot|whatsapp|discordbot/i;
const RE_SCRIPT = /curl|wget|python-requests|python-httpx|aiohttp|node-fetch|axios|undici|go-http-client|okhttp|headlesschrome|playwright|puppeteer|phantomjs|bot|spider|crawler/i;

export function classifyVisitor(
  ua: string,
  opts?: { botId?: string | null; mcp?: boolean },
): VisitorClass {
  if (opts?.mcp || opts?.botId) return 'api_client';
  if (!ua) return 'script';
  if (RE_AI_USER_AGENT.test(ua)) return 'ai_user_agent';
  if (RE_AI_CRAWLER.test(ua)) return 'ai_crawler';
  if (RE_SEARCH_CRAWLER.test(ua)) return 'search_crawler';
  if (RE_SCRIPT.test(ua)) return 'script';
  // Every real browser UA starts with Mozilla/. Anything else is a script with a
  // name we don't list (PostmanRuntime, Java, a tool's own UA), not a person.
  if (!ua.startsWith('Mozilla/')) return 'script';
  return 'human';
}

// ── Request-level bot rule (every ingest path) ───────────────────────────────
// One rule for is_bot on page_views, click_events, funnel_events and app_errors
// and for git-viewer's built_by = 'automation'. A bot is browser automation or a
// crawler. A first-party non-browser client is not: Session Manager's desktop
// telemetry (Node fetch, UA `node`, plus X-SM-Beacon), a CLI, undici, Electron,
// curl. docs/observability.md §10 says CLIs and desktop apps report here, so the
// bots=exclude defaults must keep them. classifyVisitor stays the finer-grained
// visitor_class for page_hits; this rule is deliberately narrower.

export type RequestHeaders = Record<string, string | string[] | undefined>;

function headerValue(h: string | string[] | undefined): string {
  return String((Array.isArray(h) ? h[0] : h) ?? '');
}

// A build-constant tag compiled into a client package (e.g.
// `X-SM-Beacon: session-manager/1.2.3`). It ships inside a public npm package,
// so it is NOT a secret and nothing treats it as authentication: it gives
// recognised client traffic its own per-IP telemetry bucket and marks it as a
// first-party client. Spoofing it only un-flags the spoofer's own rows.
const BEACON_RE = /^[a-z0-9][a-z0-9._-]{0,39}\/[0-9][0-9a-z.\-+]{0,19}$/i;

/** The client name from a valid X-SM-Beacon header (lowercased), or ''. */
export function beaconTag(headers: RequestHeaders): string {
  const raw = headerValue(headers['x-sm-beacon']);
  return BEACON_RE.test(raw) ? raw.split('/')[0].toLowerCase() : '';
}

const RE_BROWSER_AUTOMATION = /headlesschrome|playwright|puppeteer|phantomjs|selenium/i;
const RE_GENERIC_CRAWLER = /bot|spider|crawler/i;

/**
 * True when the request is browser automation or a crawler. A valid X-SM-Beacon
 * tag, an empty UA and any other non-browser client UA are not bots.
 */
export function isBotRequest(headers: RequestHeaders): boolean {
  if (beaconTag(headers)) return false;
  const ua = headerValue(headers['user-agent']);
  if (!ua) return false;
  return RE_BROWSER_AUTOMATION.test(ua)
    || RE_AI_USER_AGENT.test(ua)
    || RE_AI_CRAWLER.test(ua)
    || RE_SEARCH_CRAWLER.test(ua)
    || RE_GENERIC_CRAWLER.test(ua);
}
