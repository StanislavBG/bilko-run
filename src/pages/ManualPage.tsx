/**
 * /products/session-manager/manual — the reader for the Session Manager Field Manual.
 *
 * The manual is free as of release 2.0.1: every chapter reads without an
 * account, and the PDF and offline editions download for anyone. There is no
 * buy flow on this page any more — the Stripe wiring that sold it stays on the
 * server only so a late or in-flight payment still resolves (routes/stripe.ts).
 *
 * The manual is page 3 of a 3-page book and is ONE long scrolling page: every
 * chapter renders in TOC order inside one card, a contents list jumps natively
 * to `#slug`, and `/products/session-manager/manual#plans-and-scheduler` scrolls
 * straight to its chapter once they have all rendered.
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
  bookNavigate, markBookPageReady, shouldInterceptClick,
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
function slugFromHash(toc: ManualToc): string | null {
  let raw = window.location.hash.replace(/^#/, '');
  try { raw = decodeURIComponent(raw); } catch { /* malformed escape: match as-is */ }
  return toc.chapters.some(c => c.slug === raw) ? raw : null;
}

type Chapters = ManualToc['chapters'];

/** Consecutive chapters sharing a `part`, in TOC order, with each chapter's 1-based number. */
function groupByPart(chapters: Chapters) {
  const groups: Array<{ part: string | undefined; items: Array<{ c: Chapters[number]; n: number }> }> = [];
  chapters.forEach((c, i) => {
    if (groups.length === 0 || groups[groups.length - 1].part !== c.part) groups.push({ part: c.part, items: [] });
    groups[groups.length - 1].items.push({ c, n: i + 1 });
  });
  return groups;
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
  // undefined = still loading, null = failed to load.
  const [chapters, setChapters] = useState<Record<string, ManualChapterBody | ManualChapterUnavailable | null>>({});
  // Every chapter fetch has settled — the deep-link scroll and the book-turn
  // ready signal wait for this so nothing above the target shifts afterwards.
  const [allSettled, setAllSettled] = useState(false);
  const scrolled = useRef(false);
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

  /** Leave for the landing: a book turn back on desktop, instant otherwise. */
  const leaveTo = useCallback((e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, href: string) => {
    if (!shouldInterceptClick(e, (e.currentTarget as HTMLAnchorElement).target)) return;
    e.preventDefault();
    void bookNavigate(navigate, href, 'back', { animate: canvas });
  }, [navigate, canvas]);

  // A token can only change what a non-free chapter returns; free chapters are
  // always fetched without one, so signing in re-fetches only when one exists.
  const anyNonFree = toc?.chapters.some(c => !c.free) ?? false;
  const sendTokenAny = signedIn && anyNonFree;

  useEffect(() => {
    if (!toc) return;
    let cancelled = false;
    (async () => {
      await Promise.all(toc.chapters.map(async c => {
        const getter = signedIn && !c.free ? currentToken : NO_TOKEN;
        let body: ManualChapterBody | ManualChapterUnavailable | null = null;
        try { body = await fetchManualChapter(c.slug, getter); } catch { body = null; }
        if (cancelled) return;
        // A failed refresh keeps the chapter that is already showing.
        setChapters(prev => (body === null && prev[c.slug] ? prev : { ...prev, [c.slug]: body }));
      }));
      if (!cancelled) setAllSettled(true);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sendTokenAny stands in for signedIn: free chapters never need a re-fetch
  }, [toc, sendTokenAny, currentToken]);

  // Once every chapter is on screen: scroll the deep-linked section (else stay
  // at the top) and tell an in-flight book turn the page is ready.
  useEffect(() => {
    if (loading) return;
    if (!toc) { markBookPageReady(); return; }
    if (!allSettled || scrolled.current) return;
    scrolled.current = true;
    const slug = slugFromHash(toc);
    if (slug) {
      document.getElementById(slug)?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
    }
    markBookPageReady();
  }, [loading, toc, allSettled]);

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
  const groups = groupByPart(toc.chapters);
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

        <nav aria-label="Contents" className="smlm-toc">
          {groups.map((g, gi) => (
            <div key={`${g.part ?? ''}-${gi}`} className="smlm-toc__group">
              {g.part && <div className="smlm-toc__part">{g.part}</div>}
              {g.items.map(({ c, n }) => (
                <a key={c.slug} href={`#${c.slug}`} className="smlm-toc__row" title={c.blurb}>
                  <span className="smlm-toc__num">{String(n).padStart(2, '0')}</span>
                  <span className="smlm-toc__label">{c.title}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>
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
        <article className="smlm-card">
          <span className="smlm-card__tape" aria-hidden="true" />
          {groups.map((g, gi) => (
            <div key={`${g.part ?? ''}-${gi}`}>
              {g.part && <h2 className="smlm-part">{g.part}</h2>}
              {g.items.map(({ c, n }) => {
                const body = chapters[c.slug];
                return (
                  <section key={c.slug} id={c.slug} className="smlm-chapter">
                    <span className="smlm-card__ghost" aria-hidden="true">{String(n).padStart(2, '0')}</span>
                    <p className="smlm-card__count smlm-card__body">
                      {fill(COPY.book.chapterOfTemplate, { n, count })}
                    </p>
                    <div className="smlm-card__body">
                      {body === undefined && <p className="smlm-status">Loading chapter…</p>}

                      {/* Only reachable if a release marks a chapter non-free again: the
                          server answers 402. Say so plainly — there is nothing to buy. */}
                      {isUnavailable(body) && (
                        <div className="smlm-unavailable">
                          <h2 className="smlm-unavailable__title">{body.title}</h2>
                          <p className="smlm-unavailable__blurb">{body.blurb}</p>
                          <p className="smlm-status">This chapter isn't available right now.</p>
                        </div>
                      )}

                      {body && !isUnavailable(body) && (
                        // Chapter HTML is first-party content authored in this repo's own
                        // release bundle — not user input — so rendering it directly is safe.
                        <div className="smlm-prose" dangerouslySetInnerHTML={{ __html: body.html }} />
                      )}

                      {body === null && (
                        <div className="smlm-unavailable">
                          <h2 className="smlm-unavailable__title">{c.title}</h2>
                          <p className="smlm-status">This chapter couldn't be loaded right now.</p>
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          ))}
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
