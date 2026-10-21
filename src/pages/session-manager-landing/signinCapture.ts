import { isSigninSource, type SigninSource } from '../../../shared/signin-capture.js';

// localStorage state for the "sign in for updates" capture (see SignInPrompt.tsx).

export const PENDING_KEY = 'bilko.signinCapture.pending';
export const DISMISSED_KEY = (source: SigninSource) => `bilko.signinPrompt.dismissed.${source}`;
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export interface Pending {
  source: SigninSource;
  consent: boolean;
  at: number;
}

export function readStore(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export function writeStore(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* private mode: the prompt just shows again */ }
}

/** Remember that a sign-in started on a capture page. Kept consent wins over a later unticked start. */
export function markPendingSignin(source: SigninSource, consent: boolean): void {
  const prev = readPending();
  const keep = !!prev && prev.source === source && prev.consent;
  writeStore(PENDING_KEY, JSON.stringify({ source, consent: consent || keep, at: Date.now() } satisfies Pending));
}

export function readPending(): Pending | null {
  const raw = readStore(PENDING_KEY);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<Pending>;
    if (!isSigninSource(p.source) || typeof p.at !== 'number' || Date.now() - p.at > PENDING_TTL_MS) {
      writeStore(PENDING_KEY, null);
      return null;
    }
    return { source: p.source, consent: p.consent === true, at: p.at };
  } catch {
    writeStore(PENDING_KEY, null);
    return null;
  }
}
