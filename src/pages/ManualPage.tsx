/**
 * /manual — the buy + read surface for the Session Manager Field Manual ($19.99).
 *
 * Three states, one page (deliberately not three routes — a buyer landing here
 * from a Stripe receipt, a signed-out visitor, and an owner all use one URL):
 *   1. anonymous       → TOC + free sample chapter + sign-in-to-buy
 *   2. signed in, not entitled → same, plus a real Buy button
 *   3. entitled        → full reader + download buttons
 *
 * The reader half is written for a first-time visitor who has never used the
 * app: the chapter is deep-linkable (`/manual#scheduler`), cross-references
 * inside a chapter body switch chapters instead of dead-ending on a `#slug`
 * that isn't in the DOM, and every chapter ends with where to go next.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth, useUser, SignInButton } from '@clerk/clerk-react';
import { usePageView } from '../hooks/usePageView.js';
import {
  fetchManualToc, fetchManualStatus, fetchManualChapter, downloadManualAsset,
  type ManualStatus, type ManualChapterBody, type ManualChapterLocked,
} from '../lib/manualClient.js';
import { startSessionManagerCheckout } from '../lib/sessionManagerCheckout.js';
import { MANUAL_PRICE_LABEL, MANUAL_TITLE, type ManualToc } from '../../shared/manual-catalog.js';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isLocked(c: ManualChapterBody | ManualChapterLocked | null): c is ManualChapterLocked {
  return !!c && (c as ManualChapterLocked).locked === true;
}

/** The chapter named by `#slug`, if it is one this release actually has. */
function slugFromHash(toc: ManualToc | null): string | null {
  if (!toc) return null;
  const raw = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  return toc.chapters.some(c => c.slug === raw) ? raw : null;
}

export default function ManualPage() {
  usePageView();

  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  const [toc, setToc] = useState<ManualToc | null>(null);
  const [status, setStatus] = useState<ManualStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [chapter, setChapter] = useState<ManualChapterBody | ManualChapterLocked | null>(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const articleRef = useRef<HTMLElement | null>(null);
  // First chapter render is the page load — scrolling then would jump a visitor
  // past the header they haven't read yet.
  const firstChapterRender = useRef(true);

  const entitled = status?.entitled === true;

  // Load the TOC (public) and, when signed in, the entitlement status.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (isSignedIn) {
        const s = await fetchManualStatus(getToken);
        if (cancelled) return;
        if (s) {
          setStatus(s);
          setToc(s.toc);
          setLoading(false);
          return;
        }
      }
      const pub = await fetchManualToc();
      if (cancelled) return;
      setStatus(null);
      setToc(pub?.toc ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isSignedIn, getToken]);

  // Open the chapter the URL asks for, else the first one — the page is never
  // an empty shell, and a shared `/manual#scheduler` link lands where it says.
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

  useEffect(() => {
    if (!activeSlug) return;
    let cancelled = false;
    (async () => {
      setChapterLoading(true);
      const c = await fetchManualChapter(activeSlug, getToken);
      if (!cancelled) { setChapter(c); setChapterLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [activeSlug, entitled, getToken]);

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

  const handleBuy = useCallback(async () => {
    if (!email) { setError('Sign in first so we can attach the purchase to your account.'); return; }
    setBuying(true);
    setError('');
    const result = await startSessionManagerCheckout(email);
    if (!result.ok) { setError(result.error ?? 'Checkout failed.'); setBuying(false); }
  }, [email]);

  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = useCallback(async (assetId: string) => {
    setError('');
    setDownloading(assetId);
    // Fetches with the auth header and saves the blob — no signed URL, so the
    // server needs no download secret. See lib/manualClient.ts.
    const result = await downloadManualAsset(assetId, getToken);
    setDownloading(null);
    if (!result.ok) setError(result.error);
  }, [getToken]);

  if (loading) {
    return <main className="mx-auto max-w-5xl px-6 py-20 text-neutral-400">Loading the manual…</main>;
  }

  if (!toc) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-3xl font-semibold text-neutral-100">{MANUAL_TITLE}</h1>
        <p className="mt-4 text-neutral-400">
          The first release is still being cut. Check back shortly — or grab the app free with{' '}
          <code className="rounded bg-neutral-900 px-1.5 py-0.5">npx claude-code-session-manager@latest</code>.
        </p>
      </main>
    );
  }

  const freeChapters = toc.chapters.filter(c => c.free);
  const activeIndex = toc.chapters.findIndex(c => c.slug === activeSlug);
  const prev = activeIndex > 0 ? toc.chapters[activeIndex - 1] : null;
  const next = activeIndex >= 0 && activeIndex < toc.chapters.length - 1 ? toc.chapters[activeIndex + 1] : null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="border-b border-neutral-800 pb-8">
        <p className="text-xs uppercase tracking-widest text-emerald-400">Digital guide</p>
        <h1 className="mt-2 text-4xl font-semibold text-neutral-100">{toc.title}</h1>
        <p className="mt-3 max-w-2xl text-neutral-400">{toc.summary}</p>
        <p className="mt-2 text-sm text-neutral-500">
          v{toc.version} · released {new Date(toc.releasedAt).toLocaleDateString()} · documents
          Session Manager v{toc.documentsAppVersion}
        </p>

        {/* What's in the box, before anyone has to click a locked chapter to
            find out. Derived from the manifest, so it can't drift. */}
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-neutral-400">
          <li>{toc.chapters.length} chapters, one per surface of the app</li>
          {freeChapters.length > 0 && <li className="text-emerald-400">{freeChapters.length} readable free, right now</li>}
          {toc.assets.length > 0 && <li>{toc.assets.map(a => a.label).join(' + ')} to keep</li>}
          <li>Free updates for every future edition</li>
        </ul>

        {!entitled && (
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-5">
            <div className="flex-1 min-w-[240px]">
              <p className="text-lg font-semibold text-neutral-100">{MANUAL_PRICE_LABEL} · one time</p>
              <p className="text-sm text-neutral-400">
                Every chapter, every screenshot, and every future revision. Buy once — updates are free forever.
              </p>
              {/* The open-core split, restated on the surface where money changes
                  hands: nobody should reach checkout thinking they're buying the app. */}
              <p className="mt-2 text-xs text-neutral-500">
                The app itself is free —{' '}
                <code className="rounded bg-neutral-900 px-1.5 py-0.5">npx claude-code-session-manager@latest</code>.
                This is the guide that teaches it.
              </p>
              {!isSignedIn && (
                <p className="mt-2 text-xs text-neutral-500">
                  Signing in first attaches the purchase to your account, so you can re-download
                  every future edition without hunting for a receipt.
                </p>
              )}
            </div>
            {isSignedIn ? (
              <button
                onClick={handleBuy}
                disabled={buying}
                className="rounded-md bg-emerald-500 px-6 py-3 font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
              >
                {buying ? 'Opening checkout…' : `Get the manual — ${MANUAL_PRICE_LABEL}`}
              </button>
            ) : (
              <SignInButton mode="modal">
                <button className="rounded-md bg-emerald-500 px-6 py-3 font-semibold text-black hover:bg-emerald-400">
                  Sign in to buy
                </button>
              </SignInButton>
            )}
            <p className="w-full text-xs text-neutral-500">
              {freeChapters.length > 0 && (
                <>
                  Not sure yet?{' '}
                  <button
                    onClick={() => openChapter(freeChapters[0].slug)}
                    className="text-sky-400 underline-offset-2 hover:underline"
                  >
                    Read “{freeChapters[0].title}” free →
                  </button>
                  {'  ·  '}
                </>
              )}
              Already bought it? <a className="text-sky-400" href="/my-manual">Find your purchase →</a>
            </p>
          </div>
        )}

        {entitled && toc.assets.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="text-sm text-emerald-400">✓ You own this manual</span>
            {toc.assets.map(a => (
              <button
                key={a.id}
                onClick={() => handleDownload(a.id)}
                disabled={downloading === a.id}
                className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:border-emerald-500 disabled:opacity-60"
              >
                {downloading === a.id ? 'Downloading…' : <>↓ {a.label} <span className="text-neutral-500">({formatBytes(a.bytes)})</span></>}
              </button>
            ))}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </header>

      <div className="mt-8 grid gap-8 md:grid-cols-[260px_1fr]">
        {/* Below md the chapter list is 21 rows of nav standing between a phone
            visitor and the words they came for — collapse it to one control. */}
        <label className="md:hidden">
          <span className="text-xs uppercase tracking-widest text-neutral-500">Chapter</span>
          <select
            value={activeSlug ?? ''}
            onChange={e => openChapter(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-200"
          >
            {toc.chapters.map((c, i) => (
              <option key={c.slug} value={c.slug}>
                {String(i + 1).padStart(2, '0')} · {c.title}{!entitled && !c.free ? ' 🔒' : ''}
              </option>
            ))}
          </select>
        </label>

        <nav className="hidden space-y-1 md:block md:sticky md:top-6 md:max-h-[calc(100vh-3rem)] md:self-start md:overflow-y-auto">
          {toc.chapters.map((c, i) => (
            <button
              key={c.slug}
              onClick={() => openChapter(c.slug)}
              title={c.blurb}
              aria-current={activeSlug === c.slug ? 'true' : undefined}
              className={`block w-full rounded px-3 py-2 text-left text-sm ${
                activeSlug === c.slug ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-900'
              }`}
            >
              <span className="mr-2 text-neutral-600">{String(i + 1).padStart(2, '0')}</span>
              {c.title}
              {!entitled && (c.free
                ? <span className="ml-2 text-[10px] uppercase text-emerald-400">free</span>
                : <span className="ml-2 text-[10px] text-neutral-600">🔒</span>)}
            </button>
          ))}
        </nav>

        <article ref={articleRef} onClick={handleArticleClick} className="min-h-[320px] scroll-mt-6">
          {chapterLoading && <p className="text-neutral-500">Loading chapter…</p>}

          {!chapterLoading && isLocked(chapter) && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-8">
              <h2 className="text-2xl font-semibold text-neutral-100">{chapter.title}</h2>
              <p className="mt-2 text-neutral-400">{chapter.blurb}</p>
              <p className="mt-6 text-neutral-500">
                This chapter is part of the paid manual. Unlock all {toc.chapters.length} chapters for {chapter.priceLabel}.
              </p>
              {chapter.signedIn ? (
                <button
                  onClick={handleBuy}
                  disabled={buying}
                  className="mt-4 rounded-md bg-emerald-500 px-5 py-2.5 font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
                >
                  {buying ? 'Opening checkout…' : `Unlock for ${chapter.priceLabel}`}
                </button>
              ) : (
                <SignInButton mode="modal">
                  <button className="mt-4 rounded-md bg-emerald-500 px-5 py-2.5 font-semibold text-black hover:bg-emerald-400">
                    Sign in to unlock
                  </button>
                </SignInButton>
              )}
              {freeChapters.length > 0 && (
                <p className="mt-4 text-sm text-neutral-500">
                  Want to read one first?{' '}
                  <button onClick={() => openChapter(freeChapters[0].slug)} className="text-sky-400 underline-offset-2 hover:underline">
                    “{freeChapters[0].title}” is free →
                  </button>
                </p>
              )}
              <p className="mt-4 text-xs text-neutral-600">
                Already bought it? <a className="text-sky-400" href="/my-manual">Find your purchase →</a>
              </p>
            </div>
          )}

          {!chapterLoading && chapter && !isLocked(chapter) && (
            // Chapter HTML is first-party content authored in this repo's own
            // release bundle — not user input — so rendering it directly is safe.
            <div className="manual-prose" dangerouslySetInnerHTML={{ __html: chapter.html }} />
          )}

          {!chapterLoading && !chapter && (
            <p className="text-neutral-500">This chapter couldn't be loaded. Try another one.</p>
          )}

          {/* Reading straight through shouldn't mean going back to the sidebar
              after every chapter. */}
          {!chapterLoading && (prev || next) && (
            <nav className="mt-12 flex flex-wrap gap-3 border-t border-neutral-800 pt-6 text-sm">
              {prev && (
                <button
                  onClick={() => openChapter(prev.slug)}
                  className="flex-1 min-w-[220px] rounded-md border border-neutral-800 px-4 py-3 text-left text-neutral-300 hover:border-neutral-600"
                >
                  <span className="block text-xs text-neutral-500">← Previous</span>
                  {prev.title}{!entitled && !prev.free && <span className="ml-2 text-neutral-600">🔒</span>}
                </button>
              )}
              {next && (
                <button
                  onClick={() => openChapter(next.slug)}
                  className="flex-1 min-w-[220px] rounded-md border border-neutral-800 px-4 py-3 text-right text-neutral-300 hover:border-neutral-600"
                >
                  <span className="block text-xs text-neutral-500">Next →</span>
                  {next.title}{!entitled && !next.free && <span className="ml-2 text-neutral-600">🔒</span>}
                </button>
              )}
            </nav>
          )}
        </article>
      </div>
    </main>
  );
}
