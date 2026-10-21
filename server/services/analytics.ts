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
  return 'human';
}

export function isBot(ua: string): boolean {
  if (!ua) return false;
  return classifyVisitor(ua) !== 'human';
}
