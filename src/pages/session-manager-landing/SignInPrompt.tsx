import { useEffect, useId, useRef, useState } from 'react';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { API_BASE } from '../../constants.js';
import { track } from '../../lib/telemetry.js';
import type { SigninSource } from '../../../shared/signin-capture.js';
import { QuietBoundary } from './AccountChip.js';
import { COPY } from './copy.js';
import { DISMISSED_KEY, PENDING_KEY, markPendingSignin, readPending, readStore, writeStore } from './signinCapture.js';

/**
 * "Sign in for updates" prompt (owner decision 2026-10-20, superseding the
 * 2026-09-25 "no email form" rule). Inline and dismissable — never a modal,
 * never in front of content, and nothing on the page needs an account.
 *
 * Signing in through it (or the header chip) on a capture page leaves a
 * pending marker in localStorage; once Clerk reports the visitor signed in —
 * after the modal closes or after the redirect back — the marker is posted to
 * /api/signin-capture, which keeps the first source and the opt-in consent.
 */

function Prompt({ source, variant }: { source: SigninSource; variant: 'inline' | 'corner' }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const clerk = useClerk();
  const [dismissed, setDismissed] = useState(() => readStore(DISMISSED_KEY(source)) === '1');
  const [consent, setConsent] = useState(false);
  const shownTracked = useRef(false);
  const posting = useRef(false);
  const consentId = useId();

  // Sync a pending capture once signed in, whatever surface started the sign-in.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || posting.current) return;
    const pending = readPending();
    if (!pending) return;
    posting.current = true;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${API_BASE}/signin-capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ source: pending.source, consent: pending.consent }),
        });
        if (res.ok || res.status === 400) writeStore(PENDING_KEY, null);
      } catch { /* keep the marker; the next signed-in load retries */ } finally {
        posting.current = false;
      }
    })();
  }, [isLoaded, isSignedIn, getToken]);

  const visible = isLoaded && !isSignedIn && !dismissed;

  useEffect(() => {
    if (!visible || shownTracked.current) return;
    shownTracked.current = true;
    track('prompt_shown', { tool: source });
  }, [visible, source]);

  if (!visible) return null;

  const p = COPY.signinPrompt;
  const dismiss = () => {
    writeStore(DISMISSED_KEY(source), '1');
    setDismissed(true);
    track('prompt_dismissed', { tool: source });
  };
  const signIn = () => {
    markPendingSignin(source, consent);
    track('signin_click', { tool: source, metadata: { surface: 'prompt', consent } });
    clerk.openSignIn({ forceRedirectUrl: window.location.pathname + window.location.hash });
  };

  return (
    <aside className={`smlp-signin smlp-signin--${variant}`} aria-label={p.aria.region}>
      <button type="button" className="smlp-signin__close" aria-label={p.aria.dismiss} data-track="signin-prompt-dismiss" onClick={dismiss}>
        ×
      </button>
      <p className="smlp-signin__title">{p.title}</p>
      <p className="smlp-signin__body">{p.body}</p>
      <label className="smlp-signin__consent" htmlFor={consentId}>
        <input id={consentId} type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
        {p.consent}
      </label>
      <div className="smlp-signin__actions">
        <button type="button" className="smlp-signin__cta" data-track="signin-prompt-signin" onClick={signIn}>
          {p.signIn}
        </button>
        <button type="button" className="smlp-signin__later" onClick={dismiss}>
          {p.dismiss}
        </button>
      </div>
    </aside>
  );
}

/** The prompt, isolated so a Clerk outage hides it instead of breaking the page. */
export function SignInPrompt({ source, variant }: { source: SigninSource; variant: 'inline' | 'corner' }) {
  return (
    <QuietBoundary name="sign-in prompt">
      <Prompt source={source} variant={variant} />
    </QuietBoundary>
  );
}
