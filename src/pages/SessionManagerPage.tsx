import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { ManualToc } from '../../shared/manual-catalog.js';
import '../styles/session-manager-landing.css';
import { AccountChip, PageViewTracker } from './session-manager-landing/AccountChip.js';
import { COPY, fill } from './session-manager-landing/copy.js';
import { FilmDialog } from './session-manager-landing/FilmDialog.js';
import {
  useBodyOverflowLock,
  useCopyInstall,
  useLayoutMode,
  useManualToc,
  usePageFonts,
} from './session-manager-landing/hooks.js';
import type { LayoutModeName } from './session-manager-landing/layout.js';
import { PartsBin } from './session-manager-landing/PartsBin.js';

/**
 * bilko.run/products/session-manager — the Session Manager landing page (v2).
 *
 * Positioning (owner decisions, 2026-09-25): the APP is free and stays free,
 * and the Field Manual that teaches it is free too. Nothing on this page is for
 * sale, so there is no price other than the app's "$0", no checkout and no
 * "free while we're in alpha". ALPHA is a maturity label only.
 *
 * Layout: a faithful port of the Claude Design mock, a fixed 1440x860 canvas
 * scaled to fit the window, used only while that stays readable (see
 * `layoutMode`). Phones, tablets, short laptops and heavy browser zoom get the
 * same tokens in a scrollable single column instead.
 *
 * Every visible string comes from `session-manager-landing/copy.ts`; all CSS
 * lives in src/styles/session-manager-landing.css under the `.smlp-` prefix
 * (no runtime <style> elements — the CSP gates those on a nonce).
 *
 * Links to /products/session-manager/manual (and its #slug chapter deep
 * links) are plain <a href>: the manual and the server-rendered
 * /products/session-manager/my-manual must never go through a router <Link>.
 */

const DEFAULT_TITLE_FALLBACK = 'Bilko.run — Tools for Makers Who Ship';

function Header({ compact, allFree }: { compact: boolean; allFree: boolean }) {
  const h = COPY.header;
  return (
    <header className="smlp-header">
      <div className="smlp-header__brand">
        <span className="smlp-logo" aria-hidden="true">S</span>
        <span className="smlp-wordmark">{h.wordmark}</span>
        <span className="smlp-badge">{h.badge}</span>
        <span className="smlp-tagline">{h.tagline}</span>
      </div>
      <div className="smlp-header__right">
        <a className="smlp-header__manual" href={COPY.meta.manualHref}>
          {allFree ? h.manualLink : h.manualLinkNotFree}
        </a>
        <AccountChip compact={compact} />
      </div>
    </header>
  );
}

function Hero({
  mode,
  toc,
  onWatch,
  watchRef,
}: {
  mode: LayoutModeName;
  toc: ManualToc | null;
  onWatch: () => void;
  watchRef: RefObject<HTMLButtonElement>;
}) {
  const hero = COPY.hero;
  const film = COPY.ctas.film;
  const manual = COPY.ctas.manual;
  const canvas = mode === 'canvas';
  // Never a hard-coded count: the live manual decides, the fallback covers loading/failure.
  const manualSub = toc?.chapters.length
    ? fill(manual.subtitleTemplate, { n: toc.chapters.length })
    : manual.subtitleFallback;
  const sticker = <span className="smlp-sticker" aria-hidden="true">{hero.sticker}</span>;

  return (
    <div className="smlp-hero__copy">
      {/* The audience line is read once, before the headline and outside it.
          In canvas the visible pill sits inside the h1's first line (as in the
          mock), so it is aria-hidden there and a visually-hidden copy is read
          instead; the heading's accessible name stays the headline alone. */}
      <p className={canvas ? 'smlp-sr' : 'smlp-pill smlp-pill--above'}>{hero.audience}</p>
      <h1 className="smlp-h1">
        <span className="smlp-h1__line1">
          {hero.headlineLine1}
          {canvas && <span className="smlp-pill" aria-hidden="true">{hero.audience}</span>}
        </span>
        <em className="smlp-h1__line2">{hero.headlineLine2}</em>
      </h1>
      <p className="smlp-hero__body">{hero.body}</p>

      <div className="smlp-ctas">
        <p className="smlp-ctas__lead">{hero.ctaLead}</p>
        <button
          ref={watchRef}
          type="button"
          className="smlp-cta smlp-cta--film"
          aria-haspopup="dialog"
          onClick={onWatch}
        >
          <span className="smlp-cta__thumb" aria-hidden="true">
            <span className="smlp-cta__disc">
              <span className="smlp-cta__tri" />
            </span>
          </span>
          <span className="smlp-cta__text">
            <span className="smlp-cta__title">{film.title}</span>
            <span className="smlp-cta__sub">{film.subtitle}</span>
          </span>
        </button>
        <a className="smlp-cta smlp-cta--manual" href={manual.href}>
          <span className="smlp-cta__spine" aria-hidden="true">FM</span>
          <span className="smlp-cta__text">
            <span className="smlp-cta__title">{manual.title}</span>
            <span className="smlp-cta__sub">{manualSub}</span>
          </span>
          {!canvas && sticker}
        </a>
        {canvas && sticker}
      </div>
    </div>
  );
}

function AppleGlyph() {
  return (
    <svg className="smlp-dl__glyph" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-2.99-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.78.74 2.99.72 1.24-.02 2.02-1.12 2.77-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.42-3.66ZM14.1 5.85c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.67 1.37-.58.67-1.09 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.28Z"
      />
    </svg>
  );
}

function WindowsGlyph() {
  return (
    <svg className="smlp-dl__glyph" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M3 5.1 10.4 4v7.1H3V5.1Zm8.3-1.2L21 2.5v8.6h-9.7V3.9ZM3 12.9h7.4V20L3 18.9v-6Zm8.3 0H21v8.6l-9.7-1.4v-7.2Z" />
    </svg>
  );
}

function PriceTag() {
  const tag = COPY.priceTag;
  const dl = tag.downloads;
  return (
    <div className="smlp-tagcol">
      <span className="smlp-tag__pin" aria-hidden="true" />
      <span className="smlp-tag__string" aria-hidden="true" />
      <section className="smlp-tag" aria-label={tag.aria.region}>
        <span className="smlp-tag__hole" aria-hidden="true" />
        <p className="smlp-tag__kicker">{tag.kicker}</p>
        <p className="smlp-tag__price">{tag.price}</p>
        <p className="smlp-tag__line">{tag.line}</p>
        <p className="smlp-tag__platforms">
          <span aria-hidden="true">{tag.platforms}</span>
          <span className="smlp-sr">{tag.aria.platforms}</span>
        </p>
        <div className="smlp-tag__install" role="group" aria-label={tag.aria.downloads}>
          <a className="smlp-dl" href={dl.mac.href} download>
            <AppleGlyph />
            <span>{dl.mac.label}</span>
          </a>
          <a className="smlp-dl__alt" href={dl.macIntel.href} download>
            {dl.macIntel.label}
          </a>
          <a className="smlp-dl" href={dl.windows.href} download>
            <WindowsGlyph />
            <span>{dl.windows.label}</span>
          </a>
          <p className="smlp-tag__note">{tag.note}</p>
          <p className="smlp-tag__fineprint">
            {tag.unsignedNote}{' '}
            <a className="smlp-tag__releases" href={dl.allReleases.href}>
              {dl.allReleases.label}
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}

export default function SessionManagerPage() {
  const layout = useLayoutMode();
  const canvas = layout.mode === 'canvas';
  useBodyOverflowLock(canvas);
  usePageFonts();
  const toc = useManualToc();
  const copier = useCopyInstall();
  const [filmOpen, setFilmOpen] = useState(false);
  const watchRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = COPY.meta.documentTitle;
    return () => {
      document.title = previous && previous !== COPY.meta.documentTitle ? previous : DEFAULT_TITLE_FALLBACK;
    };
  }, []);

  const openFilm = useCallback(() => setFilmOpen(true), []);
  const closeFilm = useCallback(() => {
    setFilmOpen(false);
    // Older Safari doesn't hand focus back when a modal dialog closes.
    requestAnimationFrame(() => watchRef.current?.focus());
  }, []);

  // Only an explicit non-free chapter in the live TOC turns the "free" wording off.
  const allFree = toc ? toc.chapters.every(c => c.free) : true;
  const statusMessage =
    copier.status === 'copied'
      ? COPY.priceTag.aria.copiedStatus
      : copier.status === 'failed'
        ? COPY.priceTag.aria.copyFailedStatus
        : '';

  const canvasStyle = canvas
    ? { left: `${layout.offX}px`, top: `${layout.offY}px`, transform: `scale(${layout.scale})` }
    : undefined;

  return (
    <div className={`smlp-root smlp-root--${layout.mode}`} data-layout={layout.mode}>
      <PageViewTracker />
      <div className="smlp-canvas" style={canvasStyle}>
        {canvas && (
          <>
            <span className="smlp-stripe smlp-stripe--a" aria-hidden="true" />
            <span className="smlp-stripe smlp-stripe--b" aria-hidden="true" />
          </>
        )}
        <Header compact={!canvas} allFree={allFree} />
        <main className="smlp-main">
          <div className="smlp-hero">
            <Hero mode={layout.mode} toc={toc} onWatch={openFilm} watchRef={watchRef} />
            <PriceTag />
          </div>
          <PartsBin mode={layout.mode} toc={toc} />
        </main>
      </div>
      <FilmDialog
        open={filmOpen}
        onClose={closeFilm}
        layout={layout}
        copier={copier}
        statusMessage={statusMessage}
      />
    </div>
  );
}
