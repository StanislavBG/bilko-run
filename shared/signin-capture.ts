// "Sign in for updates" capture: the pages that may show the prompt, as the
// `source` stored on signin_captures. Shared by the client prompt, the
// /api/signin-capture route and the admin signups view.

export const SIGNIN_SOURCES = ['session-manager', 'manual', 'human-for-hire'] as const;
export type SigninSource = (typeof SIGNIN_SOURCES)[number];

export function isSigninSource(v: unknown): v is SigninSource {
  return typeof v === 'string' && (SIGNIN_SOURCES as readonly string[]).includes(v);
}

/** The capture source for a pathname, or null when the page isn't a capture page. */
export function signinSourceForPath(pathname: string): SigninSource | null {
  const p = pathname.replace(/\/+$/, '');
  if (p === '/products/session-manager') return 'session-manager';
  if (p === '/products/session-manager/manual') return 'manual';
  if (p === '/projects/human-for-hire') return 'human-for-hire';
  return null;
}
