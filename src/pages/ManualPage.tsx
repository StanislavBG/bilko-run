/**
 * /manual — the buy + read surface for the Session Manager Field Manual ($19.99).
 *
 * Three states, one page (deliberately not three routes — a buyer landing here
 * from a Stripe receipt, a signed-out visitor, and an owner all use one URL):
 *   1. anonymous       → TOC + free sample chapter + sign-in-to-buy
 *   2. signed in, not entitled → same, plus a real Buy button
 *   3. entitled        → full reader + download buttons
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth, useUser, SignInButton } from '@clerk/clerk-react';
import { usePageView } from '../hooks/usePageView.js';
import {
  fetchManualToc, fetchManualStatus, fetchManualChapter, requestManualDownload,
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

  // Open the first chapter by default so the page is never an empty shell.
  useEffect(() => {
    if (!activeSlug && toc?.chapters.length) setActiveSlug(toc.chapters[0].slug);
  }, [toc, activeSlug]);

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

  const handleBuy = useCallback(async () => {
    if (!email) { setError('Sign in first so we can attach the purchase to your account.'); return; }
    setBuying(true);
    setError('');
    const result = await startSessionManagerCheckout(email);
    if (!result.ok) { setError(result.error ?? 'Checkout failed.'); setBuying(false); }
  }, [email]);

  const handleDownload = useCallback(async (assetId: string) => {
    setError('');
    const result = await requestManualDownload(assetId, getToken);
    if (!result.ok) { setError(result.error); return; }
    window.location.href = result.download.url;
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

        {!entitled && (
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-5">
            <div className="flex-1 min-w-[240px]">
              <p className="text-lg font-semibold text-neutral-100">{MANUAL_PRICE_LABEL} · one time</p>
              <p className="text-sm text-neutral-400">
                Every chapter, every screenshot, and every future revision. Buy once — updates are free forever.
              </p>
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
          </div>
        )}

        {entitled && toc.assets.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="text-sm text-emerald-400">✓ You own this manual</span>
            {toc.assets.map(a => (
              <button
                key={a.id}
                onClick={() => handleDownload(a.id)}
                className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:border-emerald-500"
              >
                ↓ {a.label} <span className="text-neutral-500">({formatBytes(a.bytes)})</span>
              </button>
            ))}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </header>

      <div className="mt-8 grid gap-8 md:grid-cols-[260px_1fr]">
        <nav className="space-y-1">
          {toc.chapters.map((c, i) => (
            <button
              key={c.slug}
              onClick={() => setActiveSlug(c.slug)}
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

        <article className="min-h-[320px]">
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
        </article>
      </div>
    </main>
  );
}
