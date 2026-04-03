import { useState, useEffect, useRef } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { ToolHero, ScoreCard, SectionBreakdown, CompareLayout, Rewrites, CrossPromo } from '../components/tool-page/index.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface PillarScore { score: number; max: number; feedback: string; }

interface ScorerResult {
  total_score: number;
  grade: string;
  pillar_scores: {
    hook: PillarScore;
    value_prop: PillarScore;
    emotional: PillarScore;
    cta_conversion: PillarScore;
  };
  verdict: string;
  rewrites?: Array<{ text: string; predicted_score: number; optimized_for: string }>;
}

interface CompareResponse {
  adCopyA: ScorerResult;
  adCopyB: ScorerResult;
  comparison: { winner: 'A' | 'B' | 'tie'; margin: number; verdict: string; analysis?: string };
}

interface SwipeEntry { text: string; predicted_score: number; optimized_for: string; platform: string; date: string; }
const SWIPE_KEY = 'bilko_swipe_file';
function loadSwipe(): SwipeEntry[] { try { return JSON.parse(localStorage.getItem(SWIPE_KEY) || '[]'); } catch { return []; } }

const PILLAR_LABELS: Record<string, string> = {
  hook: 'Hook Strength',
  value_prop: 'Value Proposition',
  emotional: 'Emotional Architecture',
  cta_conversion: 'CTA & Conversion',
};

type Platform = 'facebook' | 'google' | 'linkedin';

const PLATFORMS: { value: Platform; label: string; charLimit: number; limitLabel: string }[] = [
  { value: 'facebook', label: 'Facebook', charLimit: 125, limitLabel: '125 primary' },
  { value: 'google', label: 'Google', charLimit: 90, limitLabel: '90 desc' },
  { value: 'linkedin', label: 'LinkedIn', charLimit: 150, limitLabel: '150 intro' },
];

function getBenchmark(score: number): string {
  if (score >= 90) return 'Predicted to outperform 95% of ads on this platform';
  if (score >= 75) return 'Predicted to outperform 70% of ads';
  if (score >= 60) return 'In the top 40% of ads we\'ve scored';
  if (score >= 40) return 'Average — room for improvement';
  return 'Below average — check the fixes';
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AdScorerPage() {
  const {
    result, compareResult, loading, error, needsTokens,
    email, isSignedIn, submit, submitCompare, reset, signInRef, SignInButton: ClerkSignIn,
  } = useToolApi<ScorerResult>('ad-scorer');

  const [tab, setTab] = useState<'score' | 'compare'>('score');
  const [adCopy, setAdCopy] = useState('');
  const [adCopyA, setAdCopyA] = useState('');
  const [adCopyB, setAdCopyB] = useState('');
  const [platform, setPlatform] = useState<Platform>('facebook');
  const [swipeFile, setSwipeFile] = useState<SwipeEntry[]>(loadSwipe);

  function saveToSwipe(rw: { text: string; predicted_score: number; optimized_for: string }) {
    const entry: SwipeEntry = { ...rw, platform, date: new Date().toISOString() };
    const updated = [entry, ...swipeFile.filter(e => e.text !== rw.text)].slice(0, 20);
    localStorage.setItem(SWIPE_KEY, JSON.stringify(updated));
    setSwipeFile(updated);
  }

  useEffect(() => { document.title = 'Ad Scorer — bilko.run'; }, []);

  const activePlatform = PLATFORMS.find((p) => p.value === platform)!;

  function handleTabChange(next: 'score' | 'compare') {
    setTab(next);
    reset();
  }

  function handleScore(e: React.FormEvent) {
    e.preventDefault();
    if (!adCopy.trim()) return;
    submit({ adCopy: adCopy.trim(), platform });
  }

  function handleCompare(e: React.FormEvent) {
    e.preventDefault();
    if (!adCopyA.trim() || !adCopyB.trim()) return;
    submitCompare({ adCopyA: adCopyA.trim(), adCopyB: adCopyB.trim(), platform });
  }

  const compare = compareResult as CompareResponse | null;

  function PlatformPills() {
    return (
      <div className="flex gap-1 bg-white/10 backdrop-blur-sm rounded-xl p-1">
        {PLATFORMS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPlatform(p.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              platform === p.value
                ? 'bg-white text-warm-900 shadow-sm'
                : 'text-warm-400 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Hidden sign-in trigger */}
      <div className="hidden">
        <SignInButton mode="modal">
          <button ref={signInRef} />
        </SignInButton>
      </div>

      {/* ── Hero + Input ─────────────────────────────────────────────── */}
      <ToolHero
        title="Score your ad copy"
        tagline="AI grades hook, value prop, emotion, and CTA in seconds"
        tab={tab}
        onTabChange={handleTabChange}
        hasCompare
      >
        {tab === 'score' ? (
          <form onSubmit={handleScore} className="max-w-xl mx-auto text-left space-y-4">
            <div>
              <textarea
                value={adCopy}
                onChange={(e) => setAdCopy(e.target.value)}
                placeholder="Paste your ad copy here..."
                rows={4}
                className="w-full rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-warm-500 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-fire-500/50 resize-none"
              />
              {(() => {
                const charUsed = adCopy.length;
                const charLimit = activePlatform.charLimit;
                const pct = Math.min(100, Math.round((charUsed / charLimit) * 100));
                const barColor = pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-yellow-500' : 'bg-green-500';
                return (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <span className={`text-xs ${pct > 100 ? 'text-red-400' : 'text-warm-500'}`}>{charUsed}/{charLimit}</span>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <PlatformPills />

              <button
                type="submit"
                disabled={loading || !adCopy.trim()}
                className="flex-1 bg-fire-500 hover:bg-fire-600 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm"
              >
                {loading ? 'Scoring...' : 'Score Ad'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCompare} className="max-w-xl mx-auto text-left space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1 block">Ad Copy A</label>
              <textarea
                value={adCopyA}
                onChange={(e) => setAdCopyA(e.target.value)}
                placeholder="First ad variation..."
                rows={3}
                className="w-full rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-warm-500 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-fire-500/50 resize-none"
              />
              <p className={`text-xs mt-1 text-right ${adCopyA.length > activePlatform.charLimit ? 'text-red-400' : 'text-warm-500'}`}>
                {adCopyA.length}/{activePlatform.charLimit} chars
              </p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1 block">Ad Copy B</label>
              <textarea
                value={adCopyB}
                onChange={(e) => setAdCopyB(e.target.value)}
                placeholder="Second ad variation..."
                rows={3}
                className="w-full rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-warm-500 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-fire-500/50 resize-none"
              />
              <p className={`text-xs mt-1 text-right ${adCopyB.length > activePlatform.charLimit ? 'text-red-400' : 'text-warm-500'}`}>
                {adCopyB.length}/{activePlatform.charLimit} chars
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <PlatformPills />

              <button
                type="submit"
                disabled={loading || !adCopyA.trim() || !adCopyB.trim()}
                className="flex-1 bg-fire-500 hover:bg-fire-600 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm"
              >
                {loading ? 'Comparing...' : 'Compare Ads'}
              </button>
            </div>
          </form>
        )}
      </ToolHero>

      {/* ── Results ──────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 animate-slide-up">
            {error}
          </div>
        )}

        {/* Needs tokens */}
        {needsTokens && (
          <div className="bg-fire-50 border border-fire-200 rounded-2xl p-6 text-center animate-slide-up">
            <p className="text-warm-800 font-semibold mb-1">Out of free credits</p>
            <p className="text-sm text-warm-600">
              <a href="/pricing" className="text-fire-500 hover:underline font-bold">Grab tokens</a> to keep scoring.
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-8 animate-slide-up">
            <div className="h-5 w-5 rounded-full border-2 border-fire-500 border-t-transparent animate-spin" />
            <span className="text-sm text-warm-500 font-medium">Analyzing...</span>
          </div>
        )}

        {/* Score result */}
        {result && !loading && (
          <>
            <ScoreCard
              score={result.total_score}
              grade={result.grade}
              verdict={result.verdict}
              toolName="Ad Scorer"
            />
            <div className="bg-white rounded-2xl border border-warm-200/60 p-4 text-center animate-slide-up" style={{ animationDelay: '80ms' }}>
              <p className="text-sm font-semibold text-warm-700">{getBenchmark(result.total_score)}</p>
            </div>
            <SectionBreakdown pillars={result.pillar_scores} labels={PILLAR_LABELS} />
            {result.rewrites && result.rewrites.length > 0 && (
              <Rewrites rewrites={result.rewrites} noun="rewrite" />
            )}
            <CrossPromo currentTool="ad-scorer" />
          </>
        )}

        {/* Compare result */}
        {compare && !loading && (
          <CompareLayout
            winner={compare.comparison.winner}
            margin={compare.comparison.margin}
            verdict={compare.comparison.verdict}
            analysis={compare.comparison.analysis}
            cardA={{
              label: 'Ad Copy A',
              score: compare.adCopyA.total_score,
              grade: compare.adCopyA.grade,
              verdict: compare.adCopyA.verdict,
              pillars: compare.adCopyA.pillar_scores,
            }}
            cardB={{
              label: 'Ad Copy B',
              score: compare.adCopyB.total_score,
              grade: compare.adCopyB.grade,
              verdict: compare.adCopyB.verdict,
              pillars: compare.adCopyB.pillar_scores,
            }}
            pillarLabels={PILLAR_LABELS}
          />
        )}
      </div>

      {/* ── Below-fold engagement content ────────────────────────────── */}
      {!result && !compareResult && !loading && (
        <>
          {/* What we check */}
          <div className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-12">
              <h2 className="text-lg font-black text-warm-900 mb-6">What we check</h2>
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-bold text-warm-900">Hook <span className="text-warm-400 font-normal">(25 pts)</span></p>
                  <p className="text-sm text-warm-500 mt-0.5">Does your first line make someone stop scrolling? Or does it sound like every other ad in their feed?</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-warm-900">Value Prop <span className="text-warm-400 font-normal">(25 pts)</span></p>
                  <p className="text-sm text-warm-500 mt-0.5">Can someone understand what they get in 3 seconds? If you need a paragraph to explain it, you've already lost.</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-warm-900">Emotional <span className="text-warm-400 font-normal">(25 pts)</span></p>
                  <p className="text-sm text-warm-500 mt-0.5">People buy on emotion and justify with logic. Your ad should make them feel something before asking for a click.</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-warm-900">CTA & Conversion <span className="text-warm-400 font-normal">(25 pts)</span></p>
                  <p className="text-sm text-warm-500 mt-0.5">Is the button clear? Is there urgency? Or are you hoping people will figure out what to do next?</p>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto px-6 py-12">
            <h2 className="text-lg font-black text-warm-900 mb-6">Frequently asked questions</h2>
            <div className="space-y-5">
              <div>
                <p className="text-sm font-bold text-warm-900">Why does the platform matter?</p>
                <p className="text-sm text-warm-600 mt-0.5">Facebook gives you images + 125 chars. Google gives you 90 chars, no images. LinkedIn is professional. Different rules, different scores.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-warm-900">Will this work for display ads?</p>
                <p className="text-sm text-warm-600 mt-0.5">Text ads only for now. Display/video scoring is coming. But your copy still matters even with a great image.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-warm-900">How do I use the rewrites?</p>
                <p className="text-sm text-warm-600 mt-0.5">Copy the best one. Test it as a new variant. Don't delete your original -- A/B test both.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-warm-900">Same credits as PageRoast?</p>
                <p className="text-sm text-warm-600 mt-0.5">Same credits, same wallet. 1 per score, 2 for compare.</p>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-10 text-center">
              <p className="text-warm-900 font-bold text-base mb-3">Your ad budget is waiting. Score the copy first.</p>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="bg-fire-500 hover:bg-fire-600 text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm"
              >
                Back to top
              </button>
            </div>
          </div>
        </>
      )}

      {/* Swipe File */}
      {swipeFile.length > 0 && (
        <div className="max-w-2xl mx-auto px-6 pb-12">
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400">My Swipe File ({swipeFile.length})</h3>
              <button onClick={() => { navigator.clipboard.writeText(swipeFile.map(s => s.text).join('\n\n---\n\n')); }}
                className="text-xs text-fire-500 hover:text-fire-600 font-semibold">Copy all</button>
            </div>
            <div className="space-y-2">
              {swipeFile.slice(0, 8).map((s, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-warm-50 last:border-0">
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">~{s.predicted_score}</span>
                  <p className="text-sm text-warm-700 flex-1 line-clamp-2">{s.text}</p>
                  <span className="text-[10px] font-bold text-warm-400 uppercase flex-shrink-0">{s.platform}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Save to Swipe File buttons — injected via rewrites enhancement */}
      {result?.rewrites?.filter(r => (r.predicted_score ?? 0) > 70).length ? (
        <div className="max-w-2xl mx-auto px-6 pb-6">
          <div className="flex flex-wrap gap-2">
            {result.rewrites!.filter(r => (r.predicted_score ?? 0) > 70).map((rw, i) => (
              <button key={i} onClick={() => saveToSwipe(rw)}
                className="text-xs px-3 py-1.5 border border-fire-200 text-fire-600 hover:bg-fire-50 rounded-lg transition-colors">
                Save rewrite #{i + 1} to Swipe File
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
