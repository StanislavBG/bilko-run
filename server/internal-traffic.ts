/**
 * Internal traffic marker (docs/host-contract.md#internal-traffic-marker).
 *
 * The owner's automation (link checkers, CDP-attached browsers, Playwright in a fresh profile) uses browser user
 * agents and never signs in, so neither the bot nor the admin signal catches it. It opts in by sending the
 * `bilko_internal=1` cookie, or by loading any page with `?bilko_internal=1`, which sets that cookie for a day.
 * Marked rows are written with is_internal = 1 and count as MINE in every admin report (server/traffic-filters.ts).
 * Rows are marked, never visitor ids: a leaked marker link hides only that visitor's own marked requests.
 */
import type { FastifyRequest } from 'fastify';

export const INTERNAL_COOKIE = 'bilko_internal';
export const INTERNAL_PARAM = 'bilko_internal';
export const INTERNAL_MAX_AGE_S = 86_400;

type RequestLike = Pick<FastifyRequest, 'headers' | 'url'>;

/** The cookie's value, or null when the Cookie header does not carry it. */
function cookieValue(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === INTERNAL_COOKIE) return part.slice(eq + 1).trim();
  }
  return null;
}

/** The query param's value ('1', '0', anything else), or null when the URL does not carry it. */
export function internalParam(url: string | undefined): string | null {
  if (!url) return null;
  const q = url.indexOf('?');
  if (q < 0) return null;
  try {
    return new URLSearchParams(url.slice(q + 1)).get(INTERNAL_PARAM);
  } catch {
    return null;
  }
}

/**
 * True when the request carries bilko_internal=1 in its Cookie header or its URL query. An explicit
 * ?bilko_internal=0 wins over the cookie, so the page load that clears the marker is not itself marked.
 */
export function isInternalRequest(req: RequestLike): boolean {
  const param = internalParam(req.url);
  if (param === '1') return true;
  if (param === '0') return false;
  const cookie = req.headers?.cookie;
  return cookieValue(Array.isArray(cookie) ? cookie.join('; ') : cookie) === '1';
}

/** 1 or 0 for an is_internal column. */
export function internalFlag(req: RequestLike): 0 | 1 {
  return isInternalRequest(req) ? 1 : 0;
}

/**
 * The Set-Cookie line for an HTML page load: set on ?bilko_internal=1, cleared on ?bilko_internal=0, otherwise null.
 * `attrs` carries Path, SameSite and Secure, shared with bilko_vid/bilko_sid.
 */
export function internalCookieHeader(url: string | undefined, attrs: string): string | null {
  const v = internalParam(url);
  if (v === '1') return `${INTERNAL_COOKIE}=1; Max-Age=${INTERNAL_MAX_AGE_S}; ${attrs}`;
  if (v === '0') return `${INTERNAL_COOKIE}=; Max-Age=0; ${attrs}`;
  return null;
}
