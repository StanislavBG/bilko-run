import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { ADMIN_EMAILS } from '../constants.js';
import { HUB_CARDS, PUBLIC_CARDS, lastWorkedLabel, type HubCard } from '../data/projectsView.js';
import { track } from '../hooks/usePageView.js';

/**
 * Combined Projects + Packages hub.
 *
 * - Public visitors see only PUBLIC_CARDS (the 5 featured projects + flagship
 *   packages), ordered most-recently-committed first.
 * - The admin (Clerk email in ADMIN_EMAILS) gets a toggle that reveals every
 *   card in HUB_CARDS.
 * - Cards are full-width hero rows that expand inline on click with detail +
 *   links. On desktop the collapsed list fits the viewport without page scroll;
 *   the list area scrolls internally if an expansion overflows.
 */

function statusMeta(card: HubCard): { label: string; cls: string } {
  if (card.type === 'package') return { label: 'Package', cls: 'pkg' };
  switch (card.status) {
    case 'live':      return { label: 'Live', cls: 'live' };
    case 'cooking':   return { label: 'Cooking', cls: 'cooking' };
    case 'postponed': return { label: 'Postponed', cls: 'postponed' };
    default:          return { label: 'Shipped', cls: 'shipped' };
  }
}

function HubRow({ card, expanded, onToggle }: { card: HubCard; expanded: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const status = statusMeta(card);
  const worked = lastWorkedLabel(card);

  function open() {
    if (!card.href) return;
    track('hub_open', { tool: card.slug, metadata: { type: card.type } });
    if (card.isInternal) navigate(card.href);
    else window.location.href = card.href;
  }

  function copyInstall() {
    if (!card.install) return;
    void navigator.clipboard.writeText(card.install);
    setCopied(true);
    track('packages_install_copy', { tool: card.slug });
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className={`pf-hub-row${expanded ? ' expanded' : ''}`}>
      <button className="pf-hub-head" onClick={onToggle} aria-expanded={expanded}>
        <span className={`pf-hub-dot ${status.cls}`} aria-hidden="true" />
        <span className="pf-hub-title">
          <span className="pf-hub-name">{card.name}</span>
          <span className="pf-hub-blurb">{card.blurb}</span>
        </span>
        <span className="pf-hub-meta">
          <span className="pf-hub-cat">{card.category}</span>
          {worked && <span className="pf-hub-when" title="Last commit">{worked}</span>}
          <span className={`pf-chip pf-hub-status ${status.cls}`}>{status.label}</span>
          <span className={`pf-hub-caret${expanded ? ' open' : ''}`} aria-hidden="true">›</span>
        </span>
      </button>

      {expanded && (
        <div className="pf-hub-body">
          <div className="pf-hub-tags">
            {card.tags.map(t => <span key={t} className="pf-chip">{t}</span>)}
          </div>
          {card.install && (
            <button className="pf-hub-install" onClick={copyInstall} aria-label={`Copy install command for ${card.name}`}>
              <span className="pf-hub-dollar">$</span> {card.install}
              <span className="pf-hub-copy">{copied ? 'copied' : 'copy'}</span>
            </button>
          )}
          <div className="pf-hub-links">
            {card.href && card.status !== 'postponed' && (
              <button className="pf-hub-primary" onClick={open}>
                {card.type === 'package' ? 'View on GitHub' : 'Open'} →
              </button>
            )}
            {card.npm && (
              <a href={card.npm} target="_blank" rel="noopener noreferrer" className="pf-hub-link">npm →</a>
            )}
            {card.github && card.github !== card.href && (
              <a href={card.github} target="_blank" rel="noopener noreferrer" className="pf-hub-link">GitHub →</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjectsPage() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const isAdmin = ADMIN_EMAILS.includes(email);

  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Projects — Bilko Bibitkov';
    track('page_view', { tool: 'projects' });
    // Fit-to-viewport (no page scroll) is opt-in per route via this body class;
    // the matching rules live in portfolio.css.
    document.body.classList.add('hub-route');
    return () => {
      document.title = 'Bilko — AI Advisory for Small Business';
      document.body.classList.remove('hub-route');
    };
  }, []);

  const cards = useMemo(() => (isAdmin && showAll ? HUB_CARDS : PUBLIC_CARDS), [isAdmin, showAll]);
  const hiddenCount = HUB_CARDS.length - PUBLIC_CARDS.length;

  return (
    <div className="pf-page pf-hub-page">
      <header className="pf-hub-header">
        <div>
          <div className="pf-eyebrow">Section 02 · Portfolio</div>
          <h1 className="pf-hub-h1">Projects &amp; Packages.</h1>
          <p className="pf-hub-lede">
            Live tools and open-source packages, newest work on top. Click any card to expand.
          </p>
        </div>
        {isAdmin && (
          <button
            className={`pf-chip pf-hub-toggle${showAll ? ' on' : ''}`}
            onClick={() => setShowAll(s => !s)}
            title="Admin-only"
          >
            {showAll ? `Showing all · ${HUB_CARDS.length}` : `Show all (+${hiddenCount}) · admin`}
          </button>
        )}
      </header>

      <div className="pf-hub-list">
        {cards.map(card => (
          <HubRow
            key={`${card.type}:${card.slug}`}
            card={card}
            expanded={expanded === card.slug}
            onToggle={() => setExpanded(cur => (cur === card.slug ? null : card.slug))}
          />
        ))}
      </div>
    </div>
  );
}
