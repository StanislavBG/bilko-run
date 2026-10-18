import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { ADMIN_EMAILS } from '../constants.js';
import { PROJECTS } from '../data/projectsRegistry.js';
import { projectMetadataRows } from '../data/projectMetadata.js';
import { HUB_CARDS, PUBLIC_CARDS, type HubCard } from '../data/projectsView.js';
import { RING_DOTS, heroBox, pad3, ringOffset, ringStats, spineGeom, tickStyle } from '../data/projectsRing.js';
import { track, trackFlow } from '../lib/telemetry.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

/**
 * Combined Projects + Packages hub, rendered as the "Projects Ring": a fixed
 * hero window with an endless ring of vertical spines and a tick scrubber
 * (spec: docs/design/projects-ring/README.md).
 *
 * - Public visitors see only PUBLIC_CARDS; the admin (Clerk email in
 *   ADMIN_EMAILS) gets a toggle that reveals every card in HUB_CARDS.
 * - "Full story" swaps the hero screenshot for the old drawer content.
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

/** Split "Data · Portfolio" into ["Data", "Portfolio"] for the chip column. */
function categoryChips(category: string): string[] {
  return category.split(/[·,/]/).map(s => s.trim()).filter(Boolean);
}

function MetadataPanel({ slug }: { slug: string }) {
  const entry = PROJECTS.find(p => p.slug === slug);
  if (!entry) return null;
  return (
    <div className="pf-hub-meta-wrap">
      <h3 className="pf-hub-meta-h">Metadata · admin</h3>
      <dl className="pf-hub-meta">
        {projectMetadataRows(entry).map(r => (
          <div key={r.key} className="pf-hub-meta-row">
            <dt>{r.key}</dt>
            <dd className={r.missing ? 'missing' : undefined}>{r.missing ? '— not set' : r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const FONT_LINK_ID = 'pr-fonts';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap';

/**
 * Page-scoped web fonts: one `<link rel="stylesheet">` on mount, removed on
 * unmount. A link to fonts.googleapis.com passes the CSP's style-src; a runtime
 * `<style>` element would not (no nonce), so none is created.
 */
function useRingFonts(): void {
  useEffect(() => {
    const added: HTMLLinkElement[] = [];
    const add = (id: string, attrs: Record<string, string>) => {
      if (document.getElementById(id)) return;
      const link = document.createElement('link');
      link.id = id;
      for (const [k, v] of Object.entries(attrs)) link.setAttribute(k, v);
      document.head.appendChild(link);
      added.push(link);
    };
    add('pr-preconnect-css', { rel: 'preconnect', href: 'https://fonts.googleapis.com' });
    add('pr-preconnect-files', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' });
    add(FONT_LINK_ID, { rel: 'stylesheet', href: FONT_HREF });
    return () => {
      for (const link of added) link.remove();
    };
  }, []);
}

function StoryPanel({ card, isAdmin }: { card: HubCard; isAdmin: boolean }) {
  const [copied, setCopied] = useState(false);

  function copyInstall() {
    if (!card.install) return;
    void navigator.clipboard.writeText(card.install);
    setCopied(true);
    track('packages_install_copy', { tool: card.slug });
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="pr-story">
      <p className="pf-hub-detail">{card.detail ?? card.blurb}</p>
      {card.tags.length > 0 && (
        <div className="pf-hub-tags">
          {card.tags.map(t => <span key={t} className="pf-pill-sm">{t}</span>)}
        </div>
      )}
      {card.install && (
        <button className="pf-hub-install" onClick={copyInstall} aria-label={`Copy install command for ${card.name}`}>
          <span className="pf-hub-dollar">$</span> {card.install}
          <span className="pf-hub-copy">{copied ? 'copied' : 'copy'}</span>
        </button>
      )}
      <div className="pf-hub-actions">
        {card.npm && (
          <a href={card.npm} target="_blank" rel="noopener noreferrer" className="pf-hub-link">npm →</a>
        )}
        {card.github && (
          <a href={card.github} target="_blank" rel="noopener noreferrer" className="pf-hub-src">
            {card.github.replace(/^https?:\/\//, '')}
          </a>
        )}
        {card.slug === 'session-manager' && (
          <a href="/projects/session-manager/" className="pf-hub-link">Web Remote →</a>
        )}
      </div>
      {isAdmin && card.type === 'project' && <MetadataPanel slug={card.slug} />}
    </div>
  );
}

export function ProjectsPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const isAdmin = ADMIN_EMAILS.includes(email);

  const [showAll, setShowAll] = useState(false);
  const [active, setActive] = useState(() => {
    const slug = searchParams.get('p');
    const i = slug ? PUBLIC_CARDS.findIndex(c => c.slug === slug) : -1;
    return i < 0 ? 0 : i;
  });
  const [storyOpen, setStoryOpen] = useState(false);
  const [stage, setStage] = useState({ w: 1280, h: 560 });
  const stageRef = useRef<HTMLDivElement>(null);
  const lastWheel = useRef(0);
  const storyOpenRef = useRef(false);
  storyOpenRef.current = storyOpen;

  useDocumentTitle('Projects — Bilko Bibitkov');
  useRingFonts();

  useEffect(() => {
    track('page_view', { tool: 'projects' });
    // Fit-to-viewport (no page scroll) is opt-in per route via this body class;
    // the matching rules live in portfolio.css.
    document.body.classList.add('hub-route');
    return () => {
      document.body.classList.remove('hub-route');
    };
  }, []);

  const cards = useMemo(() => (isAdmin && showAll ? HUB_CARDS : PUBLIC_CARDS), [isAdmin, showAll]);
  const hiddenCount = HUB_CARDS.length - PUBLIC_CARDS.length;
  const n = cards.length;

  const go = useCallback((i: number) => {
    if (n === 0) return;
    setActive(((i % n) + n) % n);
    setStoryOpen(false);
  }, [n]);
  const step = useCallback((d: number) => {
    if (n === 0) return;
    setActive(a => (((a + d) % n) + n) % n);
    setStoryOpen(false);
  }, [n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      e.preventDefault();
      step(d);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const onWheel = (e: WheelEvent) => {
      if (storyOpenRef.current && (e.target as HTMLElement | null)?.closest?.('.pr-story')) return;
      e.preventDefault();
      const t = Date.now();
      if (t - lastWheel.current < 140) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 4) return;
      lastWheel.current = t;
      step(d > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', onWheel);
    };
  }, [step, n]);

  function toggleShowAll() {
    const nextCards = !showAll ? HUB_CARDS : PUBLIC_CARDS;
    const i = nextCards.findIndex(c => c.slug === cards[active]?.slug);
    setShowAll(!showAll);
    setActive(i < 0 ? 0 : i);
    setStoryOpen(false);
  }

  const card = cards[active];
  const activeSlug = card?.slug;

  useEffect(() => {
    if (!activeSlug) return;
    setSearchParams(prev => {
      if (prev.get('p') === activeSlug) return prev;
      const next = new URLSearchParams(prev);
      next.set('p', activeSlug);
      return next;
    }, { replace: true });
  }, [activeSlug, setSearchParams]);

  function open() {
    if (!card?.href) return;
    trackFlow('explore', 'open-project', { slug: card.slug });
    track('hub_open', { tool: card.slug, metadata: { type: card.type } });
    if (card.isInternal) navigate(card.href);
    else window.location.href = card.href;
  }

  const hero = heroBox(stage.w);
  const status = card ? statusMeta(card) : null;
  const chips = card ? categoryChips(card.category) : [];

  return (
    <div className="pr-page">
      <div className="pr-bar">
        <div className="pr-bar-title">
          <div className="pr-eyebrow">SECTION 02 · PORTFOLIO</div>
          <h1 className="pr-h1">Projects &amp; Packages.</h1>
        </div>
        <div className="pr-bar-ctl">
          {isAdmin && (
            <button
              className={`pf-chip pf-hub-toggle${showAll ? ' on' : ''}`}
              onClick={toggleShowAll}
              title="Admin-only"
            >
              {showAll ? `Showing all · ${HUB_CARDS.length}` : `Show all (+${hiddenCount}) · admin`}
            </button>
          )}
          <button className="pr-nav" onClick={() => step(-1)} aria-label="Previous project">←</button>
          <span className="pr-counter">{n ? pad3(active) : '000'} / {n}</span>
          <button className="pr-nav" onClick={() => step(1)} aria-label="Next project">→</button>
        </div>
      </div>

      {n === 0 || !card ? (
        <p className="pr-empty">No projects yet.</p>
      ) : (
        <>
          <div className="pr-stage" ref={stageRef}>
            {cards.map((c, i) => {
              const g = spineGeom(ringOffset(i, active, n), stage.w, stage.h, undefined, n);
              return (
                <button
                  key={`${c.type}:${c.slug}`}
                  type="button"
                  className="pr-spine"
                  aria-label={`Open ${c.name}`}
                  data-track="project-select"
                  data-track-slug={c.slug}
                  title={c.name}
                  tabIndex={g.hidden ? -1 : 0}
                  aria-hidden={g.hidden || undefined}
                  onClick={() => go(i)}
                  style={{
                    width: g.w,
                    height: g.h,
                    transform: `translate(${g.x}px,-50%)`,
                    opacity: g.opacity,
                    pointerEvents: g.hidden ? 'none' : 'auto',
                  }}
                >
                  <span className="pr-spine-in">
                    <span className="pr-spine-n">{pad3(i)}</span>
                    <span className="pr-spine-dot" style={{ background: RING_DOTS[i % 3] }} />
                    <span className="pr-spine-title" style={{ fontSize: g.fontPx }}>{c.name}</span>
                  </span>
                </button>
              );
            })}

            <div className="pr-hero" aria-live="polite" style={{ left: hero.left, width: hero.width }}>
              <div className="pr-hero-in" key={card.slug}>
                <div className="pr-meta">
                  <span className="pr-meta-dot" style={{ background: RING_DOTS[active % 3] }} />
                  {pad3(active)} · {chips.map(c => c.toUpperCase()).join(' · ')}
                  {status && <span className={`pr-badge ${status.cls}`}>{status.label.toUpperCase()}</span>}
                </div>
                {storyOpen ? (
                  <StoryPanel card={card} isAdmin={isAdmin} />
                ) : (
                  <div className="pr-shot">
                    {card.thumbnail
                      ? <img src={card.thumbnail} alt={card.name} />
                      : <span>SCREENSHOT</span>}
                  </div>
                )}
                <div className="pr-title">{card.name}</div>
                <div className="pr-desc">{card.blurb}</div>
                <div className="pr-foot">
                  {ringStats(card).map(m => (
                    <div key={m.l} className="pr-stat">
                      <span className="pr-stat-v">{m.v}</span>
                      <span className="pr-stat-l">{m.l}</span>
                    </div>
                  ))}
                  <div className="pr-actions">
                    <button className="pr-btn" aria-expanded={storyOpen} onClick={() => setStoryOpen(o => !o)}>
                      Full story
                    </button>
                    {card.href && card.status !== 'postponed' && (
                      <button className="pr-btn pr-btn-primary" data-track="project-open" data-track-slug={card.slug} onClick={open}>
                        {card.type === 'package' ? 'GitHub' : 'Open'} →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pr-scrubber">
            <div className="pr-ticks">
              {cards.map((c, i) => {
                const t = tickStyle(Math.abs(ringOffset(i, active, n)));
                return (
                  <div
                    key={`${c.type}:${c.slug}`}
                    className="pr-tick"
                    title={`${pad3(i)} ${c.name}`}
                    onClick={() => go(i)}
                    style={{ height: t.h, background: t.color }}
                  />
                );
              })}
            </div>
            <div className="pr-caps">
              <span>NEWEST</span>
              <span>SCROLL · ←/→ · CLICK A SPINE OR TICK</span>
              <span>OLDEST</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
