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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { usePageView } from '../hooks/usePageView.js';
import {
  fetchManualToc, fetchManualChapter, manualDownloadUrl,
  type ManualChapterBody, type ManualChapterUnavailable, type TokenGetter,
} from '../lib/manualClient.js';
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

export default function ManualPage() {
  usePageView();

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
  const articleRef = useRef<HTMLElement | null>(null);
  // The chapter currently on screen, so a re-fetch of the same one (sign-in
  // state settling after the first load) doesn't flash "Loading chapter…".
  const shownSlug = useRef<string | null>(null);
  // First chapter render is the page load — scrolling then would jump a visitor
  // past the header they haven't read yet.
  const firstChapterRender = useRef(true);

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
      if (slug) setActiveSlug(slug);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [toc]);

  /** Single entry point for "show me this chapter" — keeps the URL in step. */
  const openChapter = useCallback((slug: string) => {
    setActiveSlug(slug);
    if (window.location.hash !== `#${slug}`) {
      window.history.pushState(null, '', `#${slug}`);
    }
  }, []);

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
      setChapterLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeSlug, sendToken, currentToken]);

  // Land at the top of the chapter you just chose, not halfway down the
  // previous one's scroll position.
  useEffect(() => {
    if (!activeSlug) return;
    if (firstChapterRender.current) { firstChapterRender.current = false; return; }
    articleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [activeSlug]);

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
    openChapter(slug);
  }, [toc, openChapter]);

  if (loading) {
    return <main className="mx-auto max-w-5xl px-6 py-20 text-warm-700">Loading the manual…</main>;
  }

  if (!toc) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-3xl font-semibold text-warm-900">{MANUAL_TITLE}</h1>
        <p className="mt-4 text-warm-700">
          The first release is still being cut. Check back shortly — or grab the app free with{' '}
          <code className="rounded bg-warm-100 px-1.5 py-0.5">npx claude-code-session-manager@latest</code>.
        </p>
      </main>
    );
  }

  const allFree = toc.chapters.every(c => c.free);
  const activeIndex = toc.chapters.findIndex(c => c.slug === activeSlug);
  const prev = activeIndex > 0 ? toc.chapters[activeIndex - 1] : null;
  const next = activeIndex >= 0 && activeIndex < toc.chapters.length - 1 ? toc.chapters[activeIndex + 1] : null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="border-b border-warm-200 pb-8">
        <p className="text-xs uppercase tracking-widest text-emerald-700">Digital guide</p>
        <h1 className="mt-2 text-4xl font-semibold text-warm-900">{toc.title}</h1>
        <p className="mt-3 max-w-2xl text-warm-700">{toc.summary}</p>
        <p className="mt-2 text-sm text-warm-700">
          v{toc.version} · released {formatManualReleaseDate(toc.releasedAt)} · documents
          Session Manager v{toc.documentsAppVersion}
        </p>

        {/* What's in the box. Derived from the manifest, so it can't drift. */}
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-warm-700">
          <li>{toc.chapters.length} chapters</li>
          {allFree && <li className="text-emerald-700">Free to read, no sign-in needed</li>}
          {toc.assets.length > 0 && <li>{toc.assets.map(a => a.label).join(' + ')}, free to download</li>}
        </ul>

        {/* Plain links: downloads need no account, and the server sends
            Content-Disposition: attachment, so the browser saves the file. */}
        {toc.assets.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {toc.assets.map(a => (
              <a
                key={a.id}
                href={manualDownloadUrl(a.id)}
                download
                className="rounded-md border border-warm-200 px-4 py-2 text-sm text-warm-900 hover:border-emerald-600"
              >
                ↓ {a.label} <span className="text-warm-700">({formatBytes(a.bytes)})</span>
              </a>
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-warm-700">
          The app itself is free too —{' '}
          <code className="rounded bg-warm-100 px-1.5 py-0.5">npx claude-code-session-manager@latest</code>.
          This is the guide that teaches it.
        </p>
      </header>

      <div className="mt-8 grid gap-8 md:grid-cols-[260px_1fr]">
        {/* Below md the full chapter list is a wall of nav rows standing between
            a phone visitor and the words they came for — collapse it to one control. */}
        <label className="md:hidden">
          <span className="text-xs uppercase tracking-widest text-warm-700">Chapter</span>
          <select
            value={activeSlug ?? ''}
            onChange={e => openChapter(e.target.value)}
            className="mt-1 w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-warm-900"
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

        <nav className="hidden space-y-1 md:block md:sticky md:top-6 md:max-h-[calc(100vh-3rem)] md:self-start md:overflow-y-auto">
          {(() => {
            let lastPart: string | undefined;
            return toc.chapters.map((c, i) => {
              const showHeading = c.part && c.part !== lastPart;
              lastPart = c.part;
              return (
                <div key={c.slug}>
                  {showHeading && (
                    <div className="mt-4 mb-1 px-3 text-xs font-semibold uppercase tracking-widest text-warm-500 first:mt-0">
                      {c.part}
                    </div>
                  )}
                  <button
                    onClick={() => openChapter(c.slug)}
                    title={c.blurb}
                    aria-current={activeSlug === c.slug ? 'true' : undefined}
                    className={`block w-full rounded px-3 py-2 text-left text-sm ${
                      activeSlug === c.slug ? 'bg-warm-100 text-warm-900' : 'text-warm-700 hover:bg-warm-50'
                    }`}
                  >
                    <span className="mr-2 text-warm-500">{String(i + 1).padStart(2, '0')}</span>
                    {c.title}
                  </button>
                </div>
              );
            });
          })()}
        </nav>

        <article ref={articleRef} onClick={handleArticleClick} className="min-h-[320px] scroll-mt-6">
          {chapterLoading && <p className="text-warm-700">Loading chapter…</p>}

          {/* Only reachable if a release marks a chapter non-free again: the
              server answers 402. Say so plainly — there is nothing to buy. */}
          {!chapterLoading && isUnavailable(chapter) && (
            <div className="rounded-lg border border-warm-200 bg-white p-8">
              <h2 className="text-2xl font-semibold text-warm-900">{chapter.title}</h2>
              <p className="mt-2 text-warm-700">{chapter.blurb}</p>
              <p className="mt-6 text-warm-700">This chapter isn't available right now.</p>
            </div>
          )}

          {!chapterLoading && chapter && !isUnavailable(chapter) && (
            // Chapter HTML is first-party content authored in this repo's own
            // release bundle — not user input — so rendering it directly is safe.
            <div className="manual-prose" dangerouslySetInnerHTML={{ __html: chapter.html }} />
          )}

          {!chapterLoading && !chapter && (
            <p className="text-warm-700">This chapter couldn't be loaded. Try another one.</p>
          )}

          {/* Reading straight through shouldn't mean going back to the sidebar
              after every chapter. */}
          {!chapterLoading && (prev || next) && (
            <nav className="mt-12 flex flex-wrap gap-3 border-t border-warm-200 pt-6 text-sm">
              {prev && (
                <button
                  onClick={() => openChapter(prev.slug)}
                  className="flex-1 min-w-[220px] rounded-md border border-warm-200 px-4 py-3 text-left text-warm-700 hover:border-fire-300"
                >
                  <span className="block text-xs text-warm-500">← Previous</span>
                  {prev.title}
                </button>
              )}
              {next && (
                <button
                  onClick={() => openChapter(next.slug)}
                  className="flex-1 min-w-[220px] rounded-md border border-warm-200 px-4 py-3 text-right text-warm-700 hover:border-fire-300"
                >
                  <span className="block text-xs text-warm-500">Next →</span>
                  {next.title}
                </button>
              )}
            </nav>
          )}
        </article>
      </div>
    </main>
  );
}
