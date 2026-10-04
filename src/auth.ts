import { useSyncExternalStore } from 'react';

/**
 * Clerk auth for static-path siblings.
 *
 * The host's `requireAuth` reads only `Authorization: Bearer <Clerk JWT>` — it
 * deliberately ignores the `__session` cookie (a 60s token that only clerk-js
 * refreshes). So a static page must run clerk-js itself and attach the token.
 * clerk-js is loaded lazily from the host's Clerk Frontend API, and only when
 * the `__client_uat` cookie says the user has signed in on bilko.run.
 * See bilko-run docs/host-contract.md → "Calling authenticated host APIs".
 */

const CLERK_SCRIPT_SRC = 'https://clerk.bilko.run/npm/@clerk/clerk-js@5/dist/clerk.browser.js';
const CLERK_PUBLISHABLE_KEY = 'pk_live_Y2xlcmsuYmlsa28ucnVuJA';
const LOAD_TIMEOUT_MS = 10_000;

export type AuthState = {
  status: 'idle' | 'loading' | 'signed-out' | 'signed-in' | 'unavailable';
  firstName: string | null;
  imageUrl: string | null;
};

interface ClerkUserLike {
  firstName: string | null;
  imageUrl: string | null;
}

interface ClerkLike {
  user: ClerkUserLike | null;
  session: { getToken(): Promise<string | null> } | null;
  load(): Promise<void>;
  openSignIn(): void;
  signOut(): Promise<void>;
  addListener(cb: (payload: { user: ClerkUserLike | null }) => void): () => void;
}

declare global {
  interface Window {
    Clerk?: ClerkLike;
  }
}

const IDLE_STATE: AuthState = { status: 'idle', firstName: null, imageUrl: null };

let state: AuthState = IDLE_STATE;
const listeners = new Set<(s: AuthState) => void>();
let loadPromise: Promise<ClerkLike | null> | null = null;

function setState(next: AuthState): void {
  state = next;
  for (const listener of listeners) listener(state);
}

function toAuthState(status: AuthState['status'], user: ClerkUserLike | null): AuthState {
  return { status, firstName: user?.firstName ?? null, imageUrl: user?.imageUrl ?? null };
}

/** True when Clerk's `__client_uat` cookie says this browser has signed in on bilko.run. */
export function hasSignedInCookie(): boolean {
  if (typeof document === 'undefined') return false;
  const match = /(?:^|;\s*)__client_uat=([^;]*)/.exec(document.cookie);
  if (!match) return false;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0;
}

function injectScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CLERK_SCRIPT_SRC}"]`);
    if (existing) {
      if (window.Clerk) resolve();
      else {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Failed to load Clerk script')));
      }
      return;
    }
    const script = document.createElement('script');
    script.src = CLERK_SCRIPT_SRC;
    script.setAttribute('data-clerk-publishable-key', CLERK_PUBLISHABLE_KEY);
    script.crossOrigin = 'anonymous';
    const nonce = document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content');
    if (nonce) script.nonce = nonce;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Failed to load Clerk script')));
    document.head.appendChild(script);
  });
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Clerk load timed out')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

function loadClerk(): Promise<ClerkLike | null> {
  if (loadPromise) return loadPromise;

  setState(toAuthState('loading', null));

  loadPromise = (async () => {
    try {
      await injectScript();
      const clerk = window.Clerk;
      if (!clerk) throw new Error('window.Clerk missing after script load');
      await withTimeout(clerk.load(), LOAD_TIMEOUT_MS);
      clerk.addListener(({ user }) => {
        setState(toAuthState(user ? 'signed-in' : 'signed-out', user));
      });
      setState(toAuthState(clerk.user ? 'signed-in' : 'signed-out', clerk.user));
      return clerk;
    } catch {
      setState(toAuthState('unavailable', null));
      return null;
    }
  })();

  return loadPromise;
}

/** Start loading clerk-js if the user has signed in before. Safe to call repeatedly. */
export function initAuth(): void {
  if (state.status !== 'idle') return;
  if (!hasSignedInCookie()) {
    setState(toAuthState('signed-out', null));
    return;
  }
  void loadClerk();
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => IDLE_STATE,
  );
}

export async function openSignIn(): Promise<void> {
  const clerk = await loadClerk();
  clerk?.openSignIn();
}

export async function signOut(): Promise<void> {
  const clerk = window.Clerk;
  if (clerk) await clerk.signOut();
}

/**
 * A fresh Clerk session JWT, or null when signed out / Clerk unavailable.
 * Call before every request — clerk-js caches and refreshes it internally.
 */
export async function getAuthToken(): Promise<string | null> {
  if (!window.Clerk?.session && !hasSignedInCookie()) return null;
  const clerk = await loadClerk();
  return (await clerk?.session?.getToken()) ?? null;
}

/**
 * `fetch` with `Authorization: Bearer <Clerk JWT>` attached. Resolves to null
 * (no request sent) when there's no signed-in user, since the host would 401.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response | null> {
  const token = await getAuthToken();
  if (!token) return null;
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

/** Test-only: reset module state between tests. */
export function __resetAuthForTests(): void {
  state = IDLE_STATE;
  loadPromise = null;
  listeners.clear();
}
