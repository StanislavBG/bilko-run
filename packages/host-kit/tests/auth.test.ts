import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authFetch, getAuthToken, hasSignedInCookie, __resetAuthForTests } from '../src/auth';

function clearCookies() {
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

beforeEach(() => {
  __resetAuthForTests();
  clearCookies();
  delete window.Clerk;
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth', () => {
  it('treats a missing or zero __client_uat as signed out', () => {
    expect(hasSignedInCookie()).toBe(false);
    document.cookie = '__client_uat=0';
    expect(hasSignedInCookie()).toBe(false);
    document.cookie = '__client_uat=1700000000';
    expect(hasSignedInCookie()).toBe(true);
  });

  it('signed out: authFetch sends nothing and resolves null', async () => {
    expect(await getAuthToken()).toBeNull();
    expect(await authFetch('https://bilko.run/api/games/x/save')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('signed in: attaches a Bearer token, never relies on cookies', async () => {
    document.cookie = '__client_uat=1700000000';
    window.Clerk = {
      user: { firstName: 'A', imageUrl: null },
      session: { getToken: async () => 'jwt-123' },
      load: async () => {},
      openSignIn: () => {},
      signOut: async () => {},
      addListener: () => () => {},
    };
    // Pre-existing script tag → injectScript resolves without network.
    const s = document.createElement('script');
    s.src = 'https://clerk.bilko.run/npm/@clerk/clerk-js@5/dist/clerk.browser.js';
    document.head.appendChild(s);

    await authFetch('https://bilko.run/api/games/x/save', { method: 'PUT', headers: { 'content-type': 'application/json' } });
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const h = new Headers(init.headers);
    expect(h.get('authorization')).toBe('Bearer jwt-123');
    expect(h.get('content-type')).toBe('application/json');
    expect(init.credentials).toBeUndefined();
  });
});
