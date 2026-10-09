import type { MouseEvent } from 'react';
import { AccountChip } from './AccountChip.js';
import { COPY } from './copy.js';

/**
 * The Session Manager header, shared by the landing and the Field Manual reader
 * so the manual reads as the landing's next page. `current` picks the right-hand
 * link: the landing points at the manual, the manual points back at the app.
 */
export function Header({
  compact,
  allFree,
  current,
  onLinkClick,
}: {
  compact: boolean;
  allFree: boolean;
  current: 'landing' | 'manual';
  onLinkClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const h = COPY.header;
  const manual = current === 'manual';
  return (
    <header className="smlp-header">
      <div className="smlp-header__brand">
        <span className="smlp-logo" aria-hidden="true">S</span>
        <span className="smlp-wordmark">{h.wordmark}</span>
        <span className="smlp-badge">{h.badge}</span>
        <span className="smlp-tagline">{h.tagline}</span>
      </div>
      <div className="smlp-header__right">
        <a
          className="smlp-header__manual"
          href={manual ? '/products/session-manager' : COPY.meta.manualHref}
          onClick={onLinkClick}
        >
          {manual ? COPY.book.backToApp : allFree ? h.manualLink : h.manualLinkNotFree}
        </a>
        <AccountChip compact={compact} />
      </div>
    </header>
  );
}
