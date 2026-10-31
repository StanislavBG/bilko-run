import { timingSafeEqual } from 'node:crypto';

// True when the Authorization header carries one of `accepted` as a Bearer.
// Empty entries (an unset env var) never match.
export function bearerMatches(authHeader: unknown, accepted: Array<string | undefined>): boolean {
  const auth = typeof authHeader === 'string' ? authHeader : '';
  if (!auth.startsWith('Bearer ')) return false;
  const presented = Buffer.from(auth.slice(7));
  if (presented.length === 0) return false;
  for (const token of accepted) {
    if (!token) continue;
    const want = Buffer.from(token);
    if (want.length === presented.length && timingSafeEqual(want, presented)) return true;
  }
  return false;
}
