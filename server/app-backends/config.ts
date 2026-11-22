/**
 * Pure helpers shared by the app-backend HTTP and WebSocket forwarders.
 *
 * Env APP_BACKENDS is a comma list of `<slug>=<https origin>`. The host forwards
 * /projects/<slug>/api/* to that origin's /api/*. Apps run their own backends; bilko.run only
 * forwards, so nothing here knows about any particular app. No env reads, no logging except
 * through the warn callback.
 */
import type { IncomingHttpHeaders } from 'node:http';

export interface AppBackend {
  slug: string;
  origin: string;
  prefix: string;
}

// Mirrors SlugSchema in mcp-host-server/src/contract/registry.ts (the server cannot import
// mcp-host-server/src). tests/app-backends-config.test.ts keeps the two in step.
export const APP_BACKEND_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function originProblem(rawOrigin: string): { origin: string } | { reason: string } {
  let url: URL;
  try {
    url = new URL(rawOrigin);
  } catch {
    return { reason: 'origin is not a valid URL' };
  }
  if (url.protocol !== 'https:') {
    if (url.protocol !== 'http:') return { reason: 'origin must use https' };
    if (!LOOPBACK_HOSTS.has(url.hostname)) return { reason: 'origin must use https (http only for loopback)' };
  }
  if (url.username || url.password) return { reason: 'origin must not contain credentials' };
  if (url.pathname !== '/') return { reason: 'origin must not have a path' };
  if (url.search) return { reason: 'origin must not have a query' };
  if (url.hash) return { reason: 'origin must not have a hash' };
  return { origin: url.origin };
}

export function parseAppBackends(
  raw: string | undefined,
  warn: (msg: string) => void = (m) => console.warn(m),
): AppBackend[] {
  if (!raw) return [];
  const out: AppBackend[] = [];
  const seen = new Set<string>();
  let n = 0;
  for (const piece of raw.split(',')) {
    const entry = piece.trim();
    if (!entry) continue;
    n += 1;
    const skip = (reason: string, slug?: string): void => {
      warn(`[app-backends] APP_BACKENDS entry ${n} ignored: ${reason}${slug ? ` (slug ${slug})` : ''}`);
    };
    const eq = entry.indexOf('=');
    if (eq < 0) {
      skip("missing '='");
      continue;
    }
    const slug = entry.slice(0, eq).trim();
    const rawOrigin = entry.slice(eq + 1).trim();
    if (!APP_BACKEND_SLUG_RE.test(slug)) {
      skip('slug must be 2-40 chars of [a-z0-9-], no leading or trailing hyphen');
      continue;
    }
    const checked = originProblem(rawOrigin);
    if ('reason' in checked) {
      skip(checked.reason, slug);
      continue;
    }
    if (seen.has(slug)) {
      skip('duplicate slug (first entry wins)', slug);
      continue;
    }
    seen.add(slug);
    out.push({ slug, origin: checked.origin, prefix: `/projects/${slug}/api/` });
  }
  return out;
}

export function matchAppBackend(
  backends: readonly AppBackend[],
  rawUrl: string,
): { backend: AppBackend; rest: string } | null {
  for (const backend of backends) {
    if (rawUrl.startsWith(backend.prefix)) {
      return { backend, rest: rawUrl.slice(backend.prefix.length) };
    }
  }
  return null;
}

export function buildUpstreamUrl(backend: AppBackend, rest: string, scheme: 'http' | 'ws'): URL | null {
  let u: URL;
  try {
    u = new URL('/api/' + rest, backend.origin);
  } catch {
    return null;
  }
  // The WHATWG parser folds `..`, `%2e%2e` and backslashes, so the parsed pathname is the
  // traversal guard.
  if (u.origin !== backend.origin || !u.pathname.startsWith('/api/')) return null;
  if (scheme === 'ws') u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u;
}

const COPIED_HEADERS = new Set(['authorization', 'content-type', 'accept', 'origin', 'user-agent']);

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  if (v === undefined) return undefined;
  const head = v.split(',')[0]?.trim();
  return head || undefined;
}

export function forwardRequestHeaders(
  incoming: IncomingHttpHeaders,
  peerAddress: string | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawName, value] of Object.entries(incoming)) {
    const name = rawName.toLowerCase();
    if (!COPIED_HEADERS.has(name) && !name.startsWith('if-')) continue;
    const v = Array.isArray(value) ? value[0] : value;
    if (v !== undefined) out[name] = v;
  }

  const xffIn = incoming['x-forwarded-for'];
  const xffParts = (Array.isArray(xffIn) ? xffIn : xffIn !== undefined ? [xffIn] : [])
    .map((s) => s.trim())
    .filter(Boolean);
  if (peerAddress) xffParts.push(peerAddress);
  if (xffParts.length) out['x-forwarded-for'] = xffParts.join(', ');

  out['x-forwarded-proto'] = first(incoming['x-forwarded-proto']) ?? 'http';

  const fwdHost = first(incoming['x-forwarded-host']) ?? first(incoming.host);
  if (fwdHost) out['x-forwarded-host'] = fwdHost;

  return out;
}
