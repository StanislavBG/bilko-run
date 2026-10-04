import { type ReactNode } from 'react';

/**
 * SiteHeader — the shared Bilko top bar for sibling apps.
 *
 * The host SPA's real top bar (src/components/Layout.tsx `pf-topbar`) is built
 * on Clerk + React Router and can't be imported by a static-path sibling. This
 * is a self-contained, dependency-free reproduction: brand, section links
 * (absolute bilko.run URLs so they work from any /projects/<slug>/ page),
 * an optional Search (⌘K) trigger, an Online status pill, and a right slot for
 * app-specific controls (e.g. a theme toggle).
 *
 * Styling is theme-aware: it reads host-kit/app CSS tokens (--paper, --ink,
 * --accent, …) with Bilko-light fallbacks, so it recolors with the host app's
 * theme while keeping the brand shape consistent everywhere.
 */

export interface SiteSection {
  label: string;
  href: string;
}

export interface SiteHeaderProps {
  /** Brand click target. Default: https://bilko.run */
  brandHref?: string;
  /** Name shown next to the brand mark. Default: "Bilko Bibitkov". */
  brandName?: string;
  /** Section links. Default: the standard bilko.run sections (absolute URLs). */
  sections?: readonly SiteSection[];
  /** href of the section to render as active. */
  activeHref?: string;
  /** When set, renders a "Search ⌘K" button that calls this on click. */
  onSearch?: () => void;
  /** Show the "Online" status pill. Default: true. */
  showStatus?: boolean;
  /** Extra controls rendered at the far right (e.g. a theme toggle). */
  rightSlot?: ReactNode;
}

export const DEFAULT_SECTIONS: readonly SiteSection[] = [
  { label: 'Home', href: 'https://bilko.run/' },
  { label: 'Projects', href: 'https://bilko.run/projects' },
  { label: 'Blog', href: 'https://bilko.run/blog' },
  { label: 'Academy', href: 'https://bilko.run/projects/academy/' },
  { label: 'Workflows', href: 'https://bilko.run/workflows' },
  { label: 'Contact', href: 'https://bilko.run/contact' },
];

const CSS = `
.bk-siteheader {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; gap: 18px;
  height: 52px; padding: 0 18px;
  font-family: var(--sans, 'Inter', system-ui, sans-serif);
  background: color-mix(in srgb, var(--paper, #fdfcf9) 88%, transparent);
  border-bottom: 1px solid var(--rule-soft, rgba(28,28,30,0.1));
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
}
.bk-sh-brand {
  display: inline-flex; align-items: center; gap: 9px;
  text-decoration: none; color: var(--ink, #1c1c1e);
  font-weight: 700; font-size: 14px; letter-spacing: -0.01em;
  flex-shrink: 0;
}
.bk-sh-mark {
  display: grid; place-items: center;
  width: 24px; height: 24px; border-radius: 6px;
  background: var(--ink, #1c1c1e); color: var(--paper, #fdfcf9);
  font-weight: 800; font-size: 14px; line-height: 1;
}
.bk-sh-nav {
  display: flex; align-items: center; gap: 4px;
  flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none;
}
.bk-sh-nav::-webkit-scrollbar { display: none; }
.bk-sh-link {
  text-decoration: none; white-space: nowrap;
  color: var(--ink-3, #6b6457); font-size: 13px; font-weight: 500;
  padding: 6px 10px; border-radius: 6px;
  transition: color 120ms ease, background 120ms ease;
}
.bk-sh-link:hover { color: var(--ink, #1c1c1e); background: var(--paper-3, rgba(28,28,30,0.05)); }
.bk-sh-link.active { color: var(--ink, #1c1c1e); font-weight: 600; }
.bk-sh-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.bk-sh-status {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--mono, ui-monospace, monospace); font-size: 11px;
  color: var(--ink-3, #6b6457); letter-spacing: 0.08em; text-transform: uppercase;
}
.bk-sh-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #27c93f; box-shadow: 0 0 0 3px color-mix(in srgb, #27c93f 22%, transparent);
}
.bk-sh-search {
  display: inline-flex; align-items: center; gap: 8px;
  background: transparent; cursor: pointer;
  border: 1px solid var(--rule-soft, rgba(28,28,30,0.14));
  color: var(--ink-2, #3a342b); border-radius: 7px;
  padding: 5px 10px; font-size: 12px; font-family: inherit;
  transition: border-color 120ms ease;
}
.bk-sh-search:hover { border-color: var(--ink, #1c1c1e); }
.bk-sh-search kbd {
  font-family: var(--mono, ui-monospace, monospace); font-size: 11px;
  opacity: 0.6; border: 0; background: none; padding: 0;
}
@media (max-width: 760px) {
  .bk-siteheader { gap: 10px; }
  .bk-sh-nav { display: none; }
  .bk-sh-status { display: none; }
}
`;

export function SiteHeader({
  brandHref = 'https://bilko.run',
  brandName = 'Bilko Bibitkov',
  sections = DEFAULT_SECTIONS,
  activeHref,
  onSearch,
  showStatus = true,
  rightSlot,
}: SiteHeaderProps) {
  return (
    <header className="bk-siteheader">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <a className="bk-sh-brand" href={brandHref}>
        <span className="bk-sh-mark" aria-hidden="true">B</span>
        <span>{brandName}</span>
      </a>
      <nav className="bk-sh-nav" aria-label="Bilko sections">
        {sections.map(s => (
          <a
            key={s.href}
            href={s.href}
            className={'bk-sh-link' + (activeHref === s.href ? ' active' : '')}
            aria-current={activeHref === s.href ? 'page' : undefined}
          >
            {s.label}
          </a>
        ))}
      </nav>
      <div className="bk-sh-right">
        {showStatus && (
          <span className="bk-sh-status">
            <span className="bk-sh-dot" aria-hidden="true" />
            Online
          </span>
        )}
        {onSearch && (
          <button className="bk-sh-search" onClick={onSearch} title="Search (⌘K)">
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
        )}
        {rightSlot}
      </div>
    </header>
  );
}
