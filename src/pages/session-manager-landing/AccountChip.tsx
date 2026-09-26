import React from 'react';
import { ClerkLoaded, SignedIn, SignedOut, SignInButton, useUser } from '@clerk/clerk-react';
import { usePageView } from '../../hooks/usePageView.js';
import { COPY } from './copy.js';

/**
 * The only file on this page that touches Clerk.
 *
 * If ClerkProvider fails to initialise, App's ClerkErrorBoundary renders the
 * routes with no provider and every Clerk hook throws. Each Clerk consumer
 * here therefore sits inside its own tiny boundary that renders nothing on
 * error, so a Clerk outage hides the chip (and skips one page-view beacon)
 * instead of replacing the whole landing page with "This tool hit a snag".
 */
class QuietBoundary extends React.Component<{ name: string; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: Error) {
    console.warn(`[session-manager] ${this.props.name} unavailable:`, err.message);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function PageViewBeacon() {
  usePageView();
  return null;
}

/** Records the page view (it reads the Clerk user for its email field). */
export function PageViewTracker() {
  return (
    <QuietBoundary name="page-view tracking">
      <PageViewBeacon />
    </QuietBoundary>
  );
}

function SignedInChip({ compact }: { compact: boolean }) {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const initial = (user?.firstName?.[0] ?? email[0] ?? COPY.header.account.avatarFallbackInitial).toUpperCase();
  return (
    <div role="group" aria-label={COPY.header.aria.account} className="smlp-chip">
      <span className="smlp-chip__avatar" aria-hidden="true">{initial}</span>
      <span className={compact ? 'smlp-sr' : 'smlp-chip__email'} title={email || undefined}>
        <span className="smlp-sr">{COPY.header.account.signedInPrefixSr} </span>
        {email}
      </span>
    </div>
  );
}

function Chip({ compact }: { compact: boolean }) {
  return (
    <ClerkLoaded>
      <SignedIn>
        <SignedInChip compact={compact} />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
          <button type="button" className="smlp-chip smlp-chip--signin">
            {COPY.header.account.signIn}
          </button>
        </SignInButton>
      </SignedOut>
    </ClerkLoaded>
  );
}

/**
 * Header account chip. Signed in: avatar initial + the account's email
 * (display-only; sign-out lives in the site Layout's UserButton). Signed out:
 * a "Sign in" pill that opens Clerk's modal, which portals to <body> and is
 * never scaled by the canvas. `compact` collapses it to the avatar in reflow.
 */
export function AccountChip({ compact }: { compact: boolean }) {
  return (
    <QuietBoundary name="account chip">
      <Chip compact={compact} />
    </QuietBoundary>
  );
}
