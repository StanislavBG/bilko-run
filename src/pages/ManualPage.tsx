/**
 * /products/session-manager/manual — the reader for the Session Manager Field Manual.
 *
 * The manual is free as of release 2.0.1: every chapter reads without an
 * account, and the PDF and offline editions download for anyone. There is no
 * buy flow on this page any more — the Stripe wiring that sold it stays on the
 * server only so a late or in-flight payment still resolves (routes/stripe.ts).
 *
 * The reader is written for a first-time visitor who has never used the app:
 * the chapter is deep-linkable (`/products/session-manager/manual#plans-and-scheduler`),
 * cross-references inside a chapter body switch chapters instead of dead-ending
 * on a `#slug` that isn't in the DOM, and every chapter ends with where to go next.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { usePageView } from '../hooks/usePageView.js';
import {
  fetchManualToc, fetchManualChapter, manualDownloadUrl,
  type ManualChapterBody, type ManualChapterUnavailable, type TokenGetter,
} from '../lib/manualClient.js';
import '../styles/session-manager-landing.css';
import '../styles/session-manager-manual.css';
import { Header } from './session-manager-landing/Header.js';
import { COPY, fill } from './session-manager-landing/copy.js';
import {
  bookNavigate, markBookPageReady, shouldInterceptClick, turnBook, waitForBookPageReady,
  type BookDirection,
} from './session-manager-landing/bookTurn.js';
import { useLayoutMode, usePageFonts } from './session-manager-landing/hooks.js';
import { MANUAL_TITLE, formatManualReleaseDate, type ManualToc } from '../../shared/manual-catalog.js';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Chapter requests from a visitor who isn't (or isn't yet known to be) signed in. */
const NO_TOKEN: TokenGetter = async () => null;

function isUnavailable(c: ManualChapterBody | ManualChapterUnavailable | null): c is ManualChapterUnavailable {
  return !!c && (c as ManualChapterUnavailable).locked === true;
}

/** The chapter named by `#slug`, if it is one this release actually has. */
function slugFromHash(toc: ManualToc | null): string | null {
  if (!toc) return null;
  const raw = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  return toc.chapters.some(c => c.slug === raw) ? raw : null;
}

const LANDING_HREF = '/products/session-manager';
const PARTS_HREF = '/products/session-manager#parts';
const BOOK_PAGE_COUNT = 3;

function Chevron({ up }: { up?: boolean }) {
  return (
    <svg className="smlp-turn__chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d={up ? 'M3 10.5 8 5.5l5 5' : 'M3 5.5 8 10.5l5-5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ManualPage() {
  usePageView();
  usePageFonts();
  const { mode } = useLayoutMode();

  // Only used to forward a token with a chapter the TOC marks non-free: a
  // release that still has one serves it to a pre-2.0.1 buyer
  // (routes/manual.ts). A free chapter is always fetched without a token, so
  // a signed-in visitor neither waits on Clerk for it nor fetches it twice
  // when sign-in settles. Reading never waits on Clerk: until it reports a
  // signed-in visitor (and forever, if it is blocked or down) chapters are
  // fetched without a token.
  const { isSignedIn, getToken } = useAuth();
  const signedIn = isSignedIn === true;
  // Read at request time, so a new getToken identity alone never re-fetches.
  // Declared before the chapter effect, so it is current when that one runs.
  const getTokenRef = useRef<TokenGetter>(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
  const currentToken = useCallback<TokenGetter>(() => getTokenRef.current(), []);

  const [toc, setToc] = useState<ManualToc | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [chapter, setChapter] = useState<ManualChapterBody | ManualChapterUnavailable | null>(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  // The slug whose fetch has settled (chapter, unavailable or error) — the
  // book-turn ready signal fires once this matches the active chapter.
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  // The chapter currently on screen, so a re-fetch of the same one (sign-in
  // state settling after the first load) doesn't flash "Loading chapter…".
  const shownSlug = useRef<string | null>(null);
  // Set by a chapter switch (not the page load — focusing then would jump a
  // visitor past the header they haven't read yet); consumed once it is shown.
  const pendingFocus = useRef(false);
  const canvas = mode === 'canvas';
  const navigate = useNavigate();

  // The table of contents is public; nobody has to sign in to read.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pub = await fetchManualToc();
      if (cancelled) return;
      setToc(pub?.toc ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Open the chapter the URL asks for, else the first one — the page is never
  // an empty shell, and a shared `/products/session-manager/manual#plans-and-scheduler`
  // link lands where it says.
  useEffect(() => {
    if (activeSlug || !toc?.chapters.length) return;
    setActiveSlug(slugFromHash(toc) ?? toc.chapters[0].slug);
  }, [toc, activeSlug]);

  // Back/forward and hand-edited hashes move the reader too.
  useEffect(() => {
    const onHashChange = () => {
      const slug = slugFromHash(toc);
      if (slug && slug !== activeSlug) {
        pendingFocus.current = true;
        setActiveSlug(slug);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [toc, activeSlug]);

  /**
   * Single entry point for "show me this chapter" — keeps the URL in step and
   * turns the page forward or back by chapter order (animated on desktop only).
   */
  const openChapter = useCallback((slug: string, opts?: { animate?: boolean }) => {
    if (slug === activeSlug) return Promise.resolve();
    const chapters = toc?.chapters ?? [];
    const dir: BookDirection =
      chapters.findIndex(c => c.slug === slug) < chapters.findIndex(c => c.slug === activeSlug) ? 'back' : 'forward';
    return turnBook(dir, async () => {
      const ready = waitForBookPageReady();
      pendingFocus.current = true;
      setActiveSlug(slug);
      if (window.location.hash !== `#${slug}`) {
        window.history.pushState(null, '', `#${slug}`);
      }
      await ready;
    }, { animate: opts?.animate ?? canvas });
  }, [toc, activeSlug, canvas]);

  /** Leave for the landing: a book turn back on desktop, instant otherwise. */
  const leaveTo = useCallback((e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, href: string) => {
    if (!shouldInterceptClick(e, (e.currentTarget as HTMLAnchorElement).target)) return;
    e.preventDefault();
    void bookNavigate(navigate, href, 'back', { animate: canvas });
  }, [navigate, canvas]);

  // Whether a token could change what this chapter request returns. Only then
  // does signing in re-fetch the chapter already on screen.
  const activeFree = toc?.chapters.find(c => c.slug === activeSlug)?.free ?? true;
  const sendToken = signedIn && !activeFree;

  useEffect(() => {
    if (!activeSlug) return;
    let cancelled = false;
    const refresh = shownSlug.current === activeSlug;
    if (!refresh) setChapterLoading(true);
    (async () => {
      const c = await fetchManualChapter(activeSlug, sendToken ? currentToken : NO_TOKEN);
      if (cancelled) return;
      // A failed refresh keeps the chapter that is already showing.
      if (!(refresh && c === null)) setChapter(c);
      shownSlug.current = activeSlug;
      setLoadedSlug(activeSlug);
      setChapterLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeSlug, sendToken, currentToken]);

  // Once the chapter you chose (or its unavailable / error state) is on screen:
  // move focus to its heading, land at the card top, and tell an in-flight book
  // turn the page is ready. Focus and scroll come first so the new page is
  // snapshotted already in place.
  useEffect(() => {
    if (loading) return;
    if (!toc) { markBookPageReady(); return; }
    if (!activeSlug || chapterLoading || loadedSlug !== activeSlug) return;
    if (pendingFocus.current) {
      pendingFocus.current = false;
      const card = cardRef.current;
      const heading = card?.querySelector<HTMLElement>('h1, h2, h3');
      if (heading) {
        heading.tabIndex = -1;
        heading.classList.add('smlm-focus');
        heading.focus({ preventScroll: true });
      }
      card?.scrollIntoView({ block: 'start' });
    }
    markBookPageReady();
  }, [loading, toc, activeSlug, chapterLoading, loadedSlug, chapter]);

  // Chapters cross-reference each other as `<a href="#other-chapter">`, which
  // is correct in the offline single-file edition but points at nothing here,
  // where one chapter renders at a time. Resolve those to a chapter switch.
  const handleArticleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const anchor = (e.target as HTMLElement).closest('a');
    const href = anchor?.getAttribute('href');
    if (!href?.startsWith('#')) return;
    const slug = href.slice(1);
    if (!toc?.chapters.some(c => c.slug === slug)) return;
    e.preventDefault();
    void openChapter(slug);
  }, [toc, openChapter]);

  const root = (allFree: boolean, children: ReactNode) => (
    <div className={`smlp-root smlm-root ${canvas ? 'smlm-root--canvas' : 'smlm-root--reflow'}`}>
      <Header
        compact={!canvas}
        allFree={allFree}
        current="manual"
        onLinkClick={e => leaveTo(e, PARTS_HREF)}
      />
      {children}
    </div>
  );

  if (loading) {
    return root(true, <main className="smlm-title-block" aria-label={COPY.book.aria.manualPage}><p className="smlm-status">Loading the manual…</p></main>);
  }

  if (!toc) {
    return root(true, (
      <main className="smlm-title-block" aria-label={COPY.book.aria.manualPage}>
        <h1 className="smlm-title">{MANUAL_TITLE}</h1>
        <p className="smlm-summary">
          The first release is still being cut. Check back shortly — or get the app free from the{' '}
          <a href="/products/session-manager">Session Manager page</a> — Mac and Windows installers, no terminal needed.
        </p>
      </main>
    ));
  }

  const allFree = toc.chapters.every(c => c.free);
  const count = toc.chapters.length;
  const activeIndex = toc.chapters.findIndex(c => c.slug === activeSlug);
  const prev = activeIndex > 0 ? toc.chapters[activeIndex - 1] : null;
  const next = activeIndex >= 0 && activeIndex < count - 1 ? toc.chapters[activeIndex + 1] : null;
  const dotHrefs = [LANDING_HREF, PARTS_HREF];

  return root(allFree, (
    <main aria-label={COPY.book.aria.manualPage}>
      <header className="smlm-title-block">
        <p className="smlm-eyebrow">Digital guide</p>
        <h1 className="smlm-title">{toc.title}</h1>
        <p className="smlm-summary">{toc.summary}</p>
        <p className="smlm-meta">
          v{toc.version} · released {formatManualReleaseDate(toc.releasedAt)} · documents
          Session Manager v{toc.documentsAppVersion}
        </p>

        {/* What's in the box. Derived from the manifest, so it can't drift. */}
        <ul className="smlm-facts">
          <li>{count} chapters</li>
          {allFree && <li className="smlm-facts__free">Free to read, no sign-in needed</li>}
          {toc.assets.length > 0 && <li>{toc.assets.map(a => a.label).join(' + ')}, free to download</li>}
        </ul>

        {/* Plain links: downloads need no account, and the server sends
            Content-Disposition: attachment, so the browser saves the file. */}
        {toc.assets.length > 0 && (
          <div className="smlm-downloads">
            {toc.assets.map(a => (
              <a key={a.id} href={manualDownloadUrl(a.id)} download className="smlm-download">
                ↓ {a.label} <span className="smlm-download__size">({formatBytes(a.bytes)})</span>
              </a>
            ))}
          </div>
        )}

        <p className="smlm-appnote">
          The app itself is free too — get it from the{' '}
          <a href="/products/session-manager">Session Manager page</a> — Mac and Windows installers, no terminal needed.
          This is the guide that teaches it.
        </p>
      </header>

      {canvas && (
        <div className="smlm-backrow">
          <button type="button" className="smlp-turn" onClick={e => leaveTo(e, PARTS_HREF)}>
            <Chevron up />
            {COPY.book.toParts}
          </button>
        </div>
      )}

      <div className="smlm-spread">
        {!canvas ? (
          // On a phone the full chapter list is a wall of rows standing between
          // the visitor and the words they came for — collapse it to one control.
          <label className="smlm-picker">
            <span className="smlm-picker__label">Chapter</span>
            <select
              value={activeSlug ?? ''}
              onChange={e => { void openChapter(e.target.value, { animate: false }); }}
              className="smlm-picker__select"
            >
              {(() => {
                let lastPart: string | undefined;
                const groups: Array<{ part: string | undefined; items: Array<{ c: (typeof toc.chapters)[number]; i: number }> }> = [];
                toc.chapters.forEach((c, i) => {
                  if (c.part !== lastPart || groups.length === 0) {
                    groups.push({ part: c.part, items: [] });
                    lastPart = c.part;
                  }
                  groups[groups.length - 1].items.push({ c, i });
                });
                return groups.map((g, gi) => {
                  const options = g.items.map(({ c, i }) => (
                    <option key={c.slug} value={c.slug}>
                      {String(i + 1).padStart(2, '0')} · {c.title}
                    </option>
                  ));
                  return g.part
                    ? <optgroup key={`${g.part}-${gi}`} label={g.part}>{options}</optgroup>
                    : options;
                });
              })()}
            </select>
          </label>
        ) : (
          <nav className="smlm-rail" aria-label="Chapters">
            {(() => {
              let lastPart: string | undefined;
              return toc.chapters.map((c, i) => {
                const showHeading = c.part && c.part !== lastPart;
                lastPart = c.part;
                return (
                  <div key={c.slug} className="smlm-rail__item">
                    {showHeading && <div className="smlm-rail__part">{c.part}</div>}
                    <button
                      type="button"
                      className="smlm-rail__row"
                      onClick={() => { void openChapter(c.slug); }}
                      title={c.blurb}
                      aria-current={activeSlug === c.slug ? 'page' : undefined}
                    >
                      <span className="smlm-rail__num">{String(i + 1).padStart(2, '0')}</span>
                      <span className="smlm-rail__label">{c.title}</span>
                    </button>
                  </div>
                );
              });
            })()}
          </nav>
        )}

        <article ref={cardRef} onClick={handleArticleClick} className="smlm-card">
          <span className="smlm-card__tape" aria-hidden="true" />
          {activeIndex >= 0 && (
            <>
              <span className="smlm-card__ghost" aria-hidden="true">{String(activeIndex + 1).padStart(2, '0')}</span>
              <p className="smlm-card__count smlm-card__body">
                {fill(COPY.book.chapterOfTemplate, { n: activeIndex + 1, count })}
              </p>
            </>
          )}

          <div className="smlm-card__body">
            {chapterLoading && <p className="smlm-status">Loading chapter…</p>}

            {/* Only reachable if a release marks a chapter non-free again: the
                server answers 402. Say so plainly — there is nothing to buy. */}
            {!chapterLoading && isUnavailable(chapter) && (
              <div className="smlm-unavailable">
                <h2 className="smlm-unavailable__title">{chapter.title}</h2>
                <p className="smlm-unavailable__blurb">{chapter.blurb}</p>
                <p className="smlm-status">This chapter isn't available right now.</p>
              </div>
            )}

            {!chapterLoading && chapter && !isUnavailable(chapter) && (
              // Chapter HTML is first-party content authored in this repo's own
              // release bundle — not user input — so rendering it directly is safe.
              <div className="smlm-prose" dangerouslySetInnerHTML={{ __html: chapter.html }} />
            )}

            {!chapterLoading && !chapter && (
              <p className="smlm-status">This chapter couldn't be loaded. Try another one.</p>
            )}

            {/* Reading straight through shouldn't mean going back to the rail
                after every chapter. */}
            {!chapterLoading && (prev || next) && (
              <div className="smlm-pager">
                {prev && (
                  <button type="button" className="smlp-turn smlm-pager__prev" onClick={() => { void openChapter(prev.slug); }}>
                    <Chevron up />
                    {prev.title}
                  </button>
                )}
                {next && (
                  <button type="button" className="smlp-turn smlm-pager__next" onClick={() => { void openChapter(next.slug); }}>
                    {next.title}
                    <Chevron />
                  </button>
                )}
              </div>
            )}
          </div>
        </article>
      </div>

      {canvas && (
        <nav className="smlm-dots" aria-label={COPY.pages.aria.nav}>
          {dotHrefs.map((href, i) => (
            <a
              key={href}
              className="smlp-dot smlp-dot--manual"
              href={href}
              aria-label={fill(COPY.pages.aria.goToTemplate, { n: i + 1, count: BOOK_PAGE_COUNT })}
              onClick={e => leaveTo(e, href)}
            />
          ))}
          <a
            className="smlp-dot smlp-dot--manual smlp-dot--on"
            href={`${LANDING_HREF}/manual`}
            aria-label={fill(COPY.pages.aria.goToTemplate, { n: 3, count: BOOK_PAGE_COUNT })}
            aria-current="page"
            onClick={e => e.preventDefault()}
          />
        </nav>
      )}
    </main>
  ));
}
