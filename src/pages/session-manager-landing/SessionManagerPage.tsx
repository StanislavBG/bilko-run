import { useCallback, useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ManualToc } from '../../../shared/manual-catalog.js';
import '../../styles/session-manager-landing.css';
import { bookNavigate, markBookPageReady, shouldInterceptClick } from './bookTurn.js';
import { PageViewTracker } from './AccountChip.js';
import { COPY, fill } from './copy.js';
import { MacDownload, WindowsDownload, windowsAvailable } from './Downloads.js';
import { Header } from './Header.js';
import { FilmDialog } from './FilmDialog.js';
import { Chevron } from './Chevron.js';
import {
  useBodyOverflowLock,
  useBookPages,
  useCanvasTurnInputs,
  useLayoutMode,
  useManualToc,
  usePageFonts,
} from './hooks.js';
import { PAGE_COUNT, type LayoutModeName } from './layout.js';
import { chapterHref, PartsBin, TABS } from './PartsBin.js';

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
          <span aria-hidden="true">{windowsAvailable ? tag.platforms : tag.platformsWindowsSoon}</span>
          <span className="smlp-sr">{windowsAvailable ? tag.aria.platforms : tag.aria.platformsWindowsSoon}</span>
        </p>
        <div className="smlp-tag__install" role="group" aria-label={tag.aria.downloads}>
          <MacDownload />
          <a className="smlp-dl__alt" href={dl.macIntel.href} download>
            {dl.macIntel.label}
          </a>
          <WindowsDownload />
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

/** The cover carries `--flipped` once page 2 is active; the parts page never rotates. */
function pageClass(canvas: boolean, active: boolean, cover: boolean): string {
  if (!canvas) return 'smlp-page';
  const base = active ? 'smlp-page smlp-page--active' : 'smlp-page smlp-page--inactive';
  return cover && !active ? `${base} smlp-page--flipped` : base;
}

export default function SessionManagerPage() {
  const layout = useLayoutMode();
  const canvas = layout.mode === 'canvas';
  useBodyOverflowLock(canvas);
  usePageFonts();
  const toc = useManualToc();
  const [filmOpen, setFilmOpen] = useState(false);
  const watchRef = useRef<HTMLButtonElement>(null);
  const coverRef = useRef<HTMLElement>(null);
  const partsRef = useRef<HTMLElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { page, pageRef, turning, focusAfterTurn, endTurn, turnTo } = useBookPages(pagesRef);
  const activeTab = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    markBookPageReady();
  }, []);

  const turnToManual = useCallback(() => {
    if (turning.current) return;
    turning.current = true;
    const href = chapterHref(TABS[activeTab.current].chapter.slug, toc);
    void bookNavigate(navigate, href, 'forward', { animate: canvas }).finally(() => {
      turning.current = false;
    });
  }, [navigate, toc, canvas]);

  const onBookLinkClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, href: string) => {
      if (!shouldInterceptClick(e, e.currentTarget.target)) return;
      e.preventDefault();
      void bookNavigate(navigate, href, 'forward', { animate: canvas });
    },
    [navigate, canvas],
  );

  useCanvasTurnInputs({ canvas, filmOpen, rootRef, pageRef, turnTo, turnToManual });

  // React 18's types have no `inert` prop, so it is set on the element directly.
  useEffect(() => {
    coverRef.current?.toggleAttribute('inert', canvas && page !== 0);
    partsRef.current?.toggleAttribute('inert', canvas && page !== 1);
  }, [canvas, page]);

  // After a click-turn, focus the new page's first heading (the inert one is no longer inert by now).
  useEffect(() => {
    if (!focusAfterTurn.current) return;
    focusAfterTurn.current = false;
    const heading = (page === 0 ? coverRef : partsRef).current?.querySelector<HTMLElement>('h1, h2');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }, [page]);

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

  const canvasStyle = canvas
    ? { left: `${layout.offX}px`, top: `${layout.offY}px`, transform: `scale(${layout.scale})` }
    : undefined;

  return (
    <div ref={rootRef} className={`smlp-root smlp-root--${layout.mode}`} data-layout={layout.mode}>
      <PageViewTracker />
      <div className="smlp-canvas" style={canvasStyle}>
        <Header compact={!canvas} allFree={allFree} current="landing" onLinkClick={e => onBookLinkClick(e, COPY.meta.manualHref)} />
        <main className="smlp-main">
          <div ref={pagesRef} className="smlp-pages">
            <section
              ref={coverRef}
              className={pageClass(canvas, page === 0, true)}
              onTransitionEnd={e => {
                if (e.target === e.currentTarget && (e.propertyName === 'transform' || e.propertyName === 'opacity')) {
                  endTurn();
                }
              }}
              aria-label={COPY.pages.aria.cover}
              aria-hidden={canvas && page !== 0 ? true : undefined}
            >
              {canvas && (
                <>
                  <span className="smlp-stripe smlp-stripe--a" aria-hidden="true" />
                  <span className="smlp-stripe smlp-stripe--b" aria-hidden="true" />
                </>
              )}
              <div className="smlp-hero">
                <Hero mode={layout.mode} toc={toc} onWatch={openFilm} watchRef={watchRef} />
                <PriceTag />
              </div>
              {canvas && (
                <button type="button" className="smlp-turn smlp-turn--next" onClick={() => turnTo(1, { focus: true })}>
                  {COPY.pages.next}
                  <Chevron />
                </button>
              )}
            </section>
            <section
              ref={partsRef}
              id="parts"
              className={pageClass(canvas, page === 1, false)}
              aria-label={COPY.pages.aria.parts}
              aria-hidden={canvas && page !== 1 ? true : undefined}
            >
              {canvas && (
                <div className="smlp-backrow">
                  <button type="button" className="smlp-turn smlp-turn--back" onClick={() => turnTo(0, { focus: true })}>
                    <Chevron up />
                    {COPY.pages.prev}
                  </button>
                </div>
              )}
              <PartsBin mode={layout.mode} toc={toc} onTabChange={i => { activeTab.current = i; }} />
              {canvas && (
                <button type="button" className="smlp-turn smlp-turn--manual" onClick={turnToManual}>
                  {COPY.book.toManual}
                  <Chevron />
                </button>
              )}
            </section>
          </div>
        </main>
        {canvas && (
          <nav className="smlp-dots" aria-label={COPY.pages.aria.nav}>
            {Array.from({ length: PAGE_COUNT }, (_, i) => (
              <button
                key={i}
                type="button"
                className={page === i ? 'smlp-dot smlp-dot--on' : 'smlp-dot'}
                aria-label={fill(COPY.pages.aria.goToTemplate, { n: i + 1, count: PAGE_COUNT })}
                aria-current={page === i ? 'page' : undefined}
                onClick={() => turnTo(i, { focus: true })}
              />
            ))}
            <a
              className="smlp-dot smlp-dot--manual"
              href={chapterHref(TABS[activeTab.current].chapter.slug, toc)}
              aria-label={COPY.book.aria.manualDot}
              onClick={e => onBookLinkClick(e, chapterHref(TABS[activeTab.current].chapter.slug, toc))}
            />
          </nav>
        )}
      </div>
      <FilmDialog
        open={filmOpen}
        onClose={closeFilm}
        layout={layout}
      />
    </div>
  );
}
