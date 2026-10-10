// Blog Video macro primitive: pick the next post that needs a video, and validate a generated
// video document is self-contained, network-free, <= 4 MB and declares a 5-30 s duration.
// Rules mirror session-manager's projectHomeAdminRoutes.cjs demo-video validator.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSeededPosts } from './blog-cadence-gate.js';

const MAX_VIDEO_BYTES = 4 * 1024 * 1024;
const MIN_DURATION_S = 5;
const MAX_DURATION_S = 30;

interface Check {
  re: RegExp;
  message: string;
}

const REMOTE_REFERENCE_CHECKS: Check[] = [
  { re: /<script\b[^>]*\bsrc\s*=/i, message: '<script src> is not allowed — inline all scripts' },
  { re: /<link\b[^>]*\bhref\s*=\s*["']?\s*(?:https?:)?\/\//i, message: '<link href="http(s)://…"> is not allowed — inline all styles' },
  { re: /@import\b/i, message: '@import is not allowed — inline all styles' },
  { re: /url\(\s*["']?\s*(?:https?:)?\/\//i, message: 'url(http(s)://…) is not allowed — embed assets as data: URIs' },
];

const NETWORK_CHECKS: Check[] = [
  { re: /\bfetch\s*\(/i, message: 'fetch(...) is not allowed' },
  { re: /\bXMLHttpRequest\b/i, message: 'XMLHttpRequest is not allowed' },
  { re: /\bWebSocket\b/i, message: 'WebSocket is not allowed' },
  { re: /\bEventSource\b/i, message: 'EventSource is not allowed' },
  { re: /\bsendBeacon\b/i, message: 'sendBeacon is not allowed' },
  { re: /\bimport\s*\(/i, message: 'import(...) is not allowed' },
  { re: /\bimportScripts\b/i, message: 'importScripts is not allowed' },
  { re: /<iframe\b/i, message: '<iframe> is not allowed' },
  { re: /<object\b/i, message: '<object> is not allowed' },
  { re: /<embed\b/i, message: '<embed> is not allowed' },
  { re: /\bwindow\.open\b/i, message: 'window.open is not allowed' },
  { re: /\b(?:src|href)\s*=\s*["']?\s*(?:https?:)?\/\//i, message: 'src=/href= pointing at http(s): or // is not allowed' },
  { re: /["'`](?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|open|importScripts)["'`]/i, message: 'computed/bracket access to a network API (e.g. window["fetch"]) is not allowed' },
  { re: /\bWorker\s*\(/i, message: 'Worker(...) is not allowed' },
  { re: /\bSharedWorker\b/i, message: 'SharedWorker is not allowed' },
  { re: /\bserviceWorker\b/i, message: 'serviceWorker is not allowed' },
  { re: /rel\s*=\s*["']?\s*(?:prefetch|preconnect|dns-prefetch|preload)/i, message: 'rel="prefetch|preconnect|dns-prefetch|preload" is not allowed' },
  { re: /\beval\s*\(/i, message: 'eval(...) is not allowed' },
  // Also matches the keyword `function (` (case-insensitive) — video authors must use arrow functions.
  { re: /\bFunction\s*\(/i, message: 'Function(...) is not allowed (this also matches the keyword `function (` — use arrow functions)' },
  { re: /<base\b/i, message: '<base> is not allowed' },
  { re: /<form\b/i, message: '<form> is not allowed' },
  { re: /http-equiv\s*=\s*["']?refresh/i, message: 'meta refresh is not allowed' },
  { re: /\blocation\s*(?:\.\s*(?:href|assign|replace)\b|=[^=])/i, message: 'location.href/assign/replace/= navigation is not allowed' },
  { re: /\bdocument\.location\b/i, message: 'document.location is not allowed' },
  { re: /\b(?:top|parent)\./i, message: 'top./parent. property access is not allowed' },
  { re: /<a\b[^>]*\bhref\s*=\s*["']?\s*(?:https?:|\/\/|javascript:)/i, message: '<a href="http(s):|//|javascript:…"> is not allowed' },
];

const DURATION_META_RE = /<meta\b[^>]*\bname\s*=\s*["']sm-demo-duration["'][^>]*\bcontent\s*=\s*["'](\d+)["'][^>]*>/i;

const VOICE_META_RE = /<meta\b[^>]*\bname\s*=\s*["']blog-video-voice["'][^>]*\bcontent\s*=\s*["']([^"']*)["'][^>]*>/i;
const CLAIMS_RE = /<script\b[^>]*\btype\s*=\s*["']application\/json["'][^>]*\bid\s*=\s*["']blog-video-claims["'][^>]*>([\s\S]*?)<\/script>/i;

export function validateBlogVideoHtml(html: string): { ok: boolean; errors: string[] } {
  if (typeof html !== 'string' || html.trim().length === 0) {
    return { ok: false, errors: ['html must be a non-empty string'] };
  }
  if (Buffer.byteLength(html, 'utf8') > MAX_VIDEO_BYTES) {
    return { ok: false, errors: [`html exceeds the ${MAX_VIDEO_BYTES}-byte limit`] };
  }
  const errors: string[] = [];
  for (const { re, message } of REMOTE_REFERENCE_CHECKS) {
    if (re.test(html)) errors.push(`html must be self-contained: ${message}`);
  }
  for (const { re, message } of NETWORK_CHECKS) {
    if (re.test(html)) errors.push(`html must not be network-capable: ${message}`);
  }
  const match = html.match(DURATION_META_RE);
  if (!match) {
    errors.push(
      `html must declare <meta name="sm-demo-duration" content="N"> with ${MIN_DURATION_S} <= N <= ${MAX_DURATION_S}`,
    );
  } else {
    const duration = Number(match[1]);
    if (!Number.isFinite(duration) || duration < MIN_DURATION_S || duration > MAX_DURATION_S) {
      errors.push(`sm-demo-duration must be between ${MIN_DURATION_S} and ${MAX_DURATION_S}, got ${match[1]}`);
    }
  }
  const voice = html.match(VOICE_META_RE);
  if (!voice || voice[1].trim().length === 0) {
    errors.push('html must declare <meta name="blog-video-voice" content="..."> with a non-empty voice name');
  }
  return { ok: errors.length === 0, errors };
}

const normalizeText = (text: string): string =>
  text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();

export function checkClaimsGrounded(html: string, postMarkdown: string): string[] {
  const block = html.match(CLAIMS_RE);
  if (!block) return ['html must include <script type="application/json" id="blog-video-claims">[{sceneId, source}]</script>'];
  let claims: unknown;
  try {
    claims = JSON.parse(block[1]);
  } catch (err) {
    return [`blog-video-claims is not valid JSON: ${(err as Error).message}`];
  }
  if (!Array.isArray(claims)) return ['blog-video-claims must be a JSON array of {sceneId, source}'];
  const fence = postMarkdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const title = fence?.[1].match(/^title:\s*(.*)$/m)?.[1].trim().replace(/^(["'])([\s\S]*)\1$/, '$2') ?? '';
  const haystack = [normalizeText(fence ? fence[2] : postMarkdown), normalizeText(title)];
  const errors: string[] = [];
  claims.forEach((claim, i) => {
    const c = (claim ?? {}) as { sceneId?: unknown; source?: unknown };
    const id = typeof c.sceneId === 'string' ? c.sceneId : `#${i}`;
    const source = typeof c.source === 'string' ? normalizeText(c.source) : '';
    if (!source) errors.push(`claim ${id}: missing source sentence`);
    else if (!haystack.some((h) => h.includes(source))) errors.push(`claim ${id}: source not found in post: "${source}"`);
  });
  return errors;
}

export function pickNextPost(
  posts: { slug: string; publishedAt: string }[],
  hasVideo: (slug: string) => boolean,
  now: Date,
): { slug: string; publishedAt: string } | null {
  let best: { slug: string; publishedAt: string } | null = null;
  let bestTime = -Infinity;
  for (const post of posts) {
    const t = Date.parse(post.publishedAt);
    if (Number.isNaN(t) || t > now.getTime() || hasVideo(post.slug)) continue;
    if (t > bestTime) {
      best = post;
      bestTime = t;
    }
  }
  return best;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [cmd, arg] = args;
  const postIdx = args.indexOf('--post');
  const postPath = postIdx >= 0 ? args[postIdx + 1] : undefined;
  if (cmd === 'next') {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const posts = await loadSeededPosts();
    const hasVideo = (slug: string): boolean =>
      existsSync(path.join(root, 'public', 'blog-videos', slug, 'index.html'));
    const next = pickNextPost(posts, hasVideo, new Date());
    console.log(JSON.stringify(next ? { slug: next.slug, publishedAt: next.publishedAt } : { slug: null }));
    return;
  }
  if (cmd === 'validate' && arg) {
    const html = readFileSync(arg, 'utf8');
    const result = validateBlogVideoHtml(html);
    if (postPath) {
      result.errors.push(...checkClaimsGrounded(html, readFileSync(postPath, 'utf8')));
      result.ok = result.errors.length === 0;
    }
    if (result.ok) {
      console.log('OK');
      return;
    }
    for (const e of result.errors) console.log(e);
    process.exit(1);
  }
  console.error('usage: blog-video.ts next | validate <file> [--post content/blog/<slug>.md]');
  process.exit(2);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
