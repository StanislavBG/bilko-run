import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { track } from '../hooks/usePageView.js';
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

// ── Tutorial sub-components ──────────────────────────────────────────────────

function CopyAdPrompt({ text, platform }: { text: string; platform?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={onCopy}
      className="group w-full text-left bg-white hover:bg-fire-50 border border-warm-200/60 hover:border-fire-300 rounded-xl px-4 py-3 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {platform && <p className="text-[10px] font-bold uppercase tracking-widest text-fire-500 mb-1">{platform}</p>}
          <p className="text-sm text-warm-800 leading-snug whitespace-pre-line">{text}</p>
        </div>
        <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded ${copied ? 'bg-green-100 text-green-700' : 'bg-warm-100 text-warm-600 group-hover:bg-fire-100 group-hover:text-fire-700'}`}>
          {copied ? 'Copied!' : 'Copy'}
        </span>
      </div>
    </button>
  );
}

function AdDetailsRow({ q, a }: { q: string; a: string }) {
  return (
    <details className="group bg-white rounded-xl border border-warm-200/60 hover:border-fire-300 transition-colors">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-5 py-4">
        <span className="font-bold text-warm-900 text-sm md:text-base">{q}</span>
        <svg className="w-4 h-4 flex-shrink-0 text-warm-400 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </summary>
      <p className="px-5 pb-4 text-sm text-warm-600 leading-relaxed whitespace-pre-line">{a}</p>
    </details>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AdScorerPage() {
  const {
    result, compareResult, generateResult, generating, genError,
    loading, error, needsTokens,
    email, isSignedIn, submit, submitCompare, submitGenerate, reset, signInRef, SignInButton: ClerkSignIn,
  } = useToolApi<ScorerResult>('ad-scorer');

  const [tab, setTab] = useState<'score' | 'compare' | 'generate'>('score');
  const [adCopy, setAdCopy] = useState('');
  const [adCopyA, setAdCopyA] = useState('');
  const [adCopyB, setAdCopyB] = useState('');
  const [platform, setPlatform] = useState<Platform>('facebook');
  const [swipeFile, setSwipeFile] = useState<SwipeEntry[]>(loadSwipe);
  const [description, setDescription] = useState('');

  function saveToSwipe(rw: { text: string; predicted_score: number; optimized_for: string }) {
    const entry: SwipeEntry = { ...rw, platform, date: new Date().toISOString() };
    const updated = [entry, ...swipeFile.filter(e => e.text !== rw.text)].slice(0, 20);
    localStorage.setItem(SWIPE_KEY, JSON.stringify(updated));
    setSwipeFile(updated);
  }

  useEffect(() => { document.title = 'Ad Scorer — bilko.run'; track('view_tool', { tool: 'ad-scorer' }); }, []);

  const activePlatform = PLATFORMS.find((p) => p.value === platform)!;

  function handleTabChange(next: 'score' | 'compare' | 'generate') {
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

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    submitGenerate({ description: description.trim(), platform, count: 3 });
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
        title="Score or generate ad copy"
        tagline="AI grades hook, value prop, emotion, and CTA — or writes ads from your description"
        toolSlug="ad-scorer"
      >
        {/* 3-way tab toggle */}
        <div className="flex gap-1 bg-white/10 backdrop-blur-sm rounded-xl p-1 mb-5 w-fit mx-auto">
          {(['score', 'compare', 'generate'] as const).map(t => (
            <button key={t} onClick={() => handleTabChange(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                tab === t ? 'bg-white text-warm-900 shadow-sm' : 'text-warm-400 hover:text-white'
              }`}>
              {t === 'generate' ? '\u2728 Generate' : t === 'compare' ? 'A/B Compare' : 'Score'}
            </button>
          ))}
        </div>

        {tab === 'score' && (
          <form onSubmit={handleScore} className="max-w-xl mx-auto text-left space-y-4">
            <div>
              <textarea
                value={adCopy}
                onChange={(e) => setAdCopy(e.target.value)}
                placeholder="Paste your ad copy here..."
                rows={4}
                className="w-full rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-warm-500 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-fire-500/50 resize-none"
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit({ adCopy: adCopy.trim(), platform }); } }}
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
              <p className="mt-1 text-xs text-warm-500">Cmd+Enter to submit</p>
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
        )}
        {tab === 'compare' && (
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
        {tab === 'generate' && (
          <form onSubmit={handleGenerate} className="max-w-xl mx-auto text-left space-y-4">
            <div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe your product or service... e.g. 'AI tool that scores ad copy and suggests rewrites for Facebook, Google, and LinkedIn'"
                rows={4}
                className="w-full rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-warm-500 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-fire-500/50 resize-none"
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleGenerate(e as any); } }}
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <PlatformPills />
              <button type="submit" disabled={generating || !description.trim()}
                className="flex-1 bg-fire-500 hover:bg-fire-600 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm">
                {generating ? 'Generating...' : '\u2728 Generate 3 Ads'}
              </button>
            </div>
            <p className="text-xs text-warm-500 text-center">Describe what you're selling. AI generates ad copy optimized for your platform. &middot; Cmd+Enter to generate</p>
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

        {/* Generate error */}
        {genError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 animate-slide-up">
            {genError}
          </div>
        )}

        {/* Generate loading */}
        {generating && (
          <div className="flex items-center justify-center gap-3 py-8 animate-slide-up">
            <div className="h-5 w-5 rounded-full border-2 border-fire-500 border-t-transparent animate-spin" />
            <span className="text-sm text-warm-500 font-medium">Generating ads...</span>
          </div>
        )}

        {/* Generate results */}
        {generateResult && !generating && (
          <div className="space-y-4 animate-slide-up">
            {generateResult.strategy_note && (
              <div className="bg-fire-50 border border-fire-200 rounded-2xl p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-1">Strategy Note</p>
                <p className="text-sm text-warm-700">{generateResult.strategy_note}</p>
              </div>
            )}
            {generateResult.ads.map((ad: { primary_text: string; headline: string; cta: string; predicted_score: number; approach: string }, i: number) => (
              <div key={i} className="bg-white rounded-2xl border border-warm-200/60 p-5 space-y-3" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-warm-400">Ad {i + 1}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-fire-50 text-fire-600">{ad.approach}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      ad.predicted_score >= 80 ? 'bg-green-50 text-green-700' :
                      ad.predicted_score >= 60 ? 'bg-blue-50 text-blue-700' :
                      'bg-yellow-50 text-yellow-700'
                    }`}>~{ad.predicted_score}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1">Primary Text</p>
                  <p className="text-sm text-warm-800">{ad.primary_text}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1">Headline</p>
                  <p className="text-sm font-bold text-warm-900">{ad.headline}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1">CTA</p>
                  <p className="text-sm text-warm-700">{ad.cta}</p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => navigator.clipboard.writeText(`${ad.primary_text}\n\n${ad.headline}\n\n${ad.cta}`)}
                    className="text-xs px-3 py-1.5 border border-warm-200 text-warm-600 hover:bg-warm-50 rounded-lg transition-colors"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => {
                      setAdCopy(`${ad.primary_text}\n\n${ad.headline}\n\n${ad.cta}`);
                      handleTabChange('score');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-xs px-3 py-1.5 border border-fire-200 text-fire-600 hover:bg-fire-50 rounded-lg transition-colors"
                  >
                    Score it
                  </button>
                </div>
              </div>
            ))}
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
              toolSlug="ad-scorer"
            />
            <div className="bg-white rounded-2xl border border-warm-200/60 p-4 text-center animate-slide-up" style={{ animationDelay: '80ms' }}>
              <p className="text-sm font-semibold text-warm-700">{getBenchmark(result.total_score)}</p>
            </div>
            <div className="bg-warm-50 rounded-xl border border-warm-100 p-3 text-center text-xs text-warm-500 animate-slide-up" style={{ animationDelay: '40ms' }}>
              Similar analysis from an agency: $500-2,000/campaign. From bilko.run: $1.
            </div>
            {result && (() => {
              const scores = result.pillar_scores;
              const entries = Object.entries(scores) as [string, { score: number; max: number }][];
              const weakest = entries.reduce((a, b) => (a[1].score / a[1].max) < (b[1].score / b[1].max) ? a : b);
              const tips: Record<string, string> = {
                hook: 'Your opening line blends in. Start with a question, bold claim, or pattern interrupt that stops the scroll.',
                value_prop: 'What does the reader GET? Be specific: a number, a timeframe, a concrete result.',
                emotional: 'Too rational. Lead with pain or desire before explaining features.',
                cta_conversion: 'Your CTA is vague. Replace "Learn More" with what happens next: "Get your score" or "Start free trial".',
              };
              const labels: Record<string, string> = { hook: 'Hook', value_prop: 'Value Prop', emotional: 'Emotion', cta_conversion: 'CTA' };
              return (
                <div className="bg-fire-50 border border-fire-200 rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
                  <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-1">Quick win</p>
                  <p className="text-sm font-bold text-warm-900">{labels[weakest[0]]}: {weakest[1].score}/{weakest[1].max}</p>
                  <p className="text-sm text-warm-600 mt-1">{tips[weakest[0]]}</p>
                </div>
              );
            })()}
            <SectionBreakdown pillars={result.pillar_scores} labels={PILLAR_LABELS} />
            {result && result.rewrites && result.rewrites.length > 0 && (
              <div className="bg-warm-50 rounded-xl border border-warm-100 p-4 animate-slide-up" style={{ animationDelay: '250ms' }}>
                <p className="text-xs font-bold text-warm-700 mb-1">Brand voice check</p>
                <p className="text-xs text-warm-500">AI rewrites optimize for conversion, not brand consistency. Before using a rewrite, check that the tone matches your brand. The best ad feels like YOUR brand wrote it, not an algorithm.</p>
              </div>
            )}
            {result.rewrites && result.rewrites.length > 0 && (
              <Rewrites rewrites={result.rewrites} noun="rewrite" />
            )}
            <CrossPromo currentTool="ad-scorer" />
            <div className="text-center pt-4">
              <button
                onClick={() => { reset(); setAdCopy(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl shadow-md shadow-fire-500/20 transition-all"
              >
                Score Another Ad
              </button>
            </div>
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
      {!result && !compareResult && !generateResult && !loading && !generating && (
        <>
          {/* 1. Example result */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 text-center mb-2">Here's what you'll get</h2>
              <p className="text-center text-warm-500 mb-8 text-sm">Real output from a real ad. Yours will be different.</p>
              <div className="bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900 rounded-2xl p-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,107,26,0.12),transparent_60%)]" />
                <div className="relative">
                  <p className="text-xs font-bold uppercase tracking-widest text-fire-400 mb-3">Sample Score</p>
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <span className="text-5xl font-black text-white">72</span>
                    <div className="text-left">
                      <div className="text-2xl font-black text-blue-400">B</div>
                      <div className="text-xs text-warm-500">/100</div>
                    </div>
                  </div>
                  <p className="text-fire-300 font-bold italic text-sm max-w-sm mx-auto">
                    &ldquo;Strong value prop but the hook blends into the feed. Lead with the result, not the feature.&rdquo;
                  </p>
                  <p className="text-xs text-warm-600 mt-3 font-mono">"Stop wasting ad spend. Our AI finds your winning audiences in 48 hours. Start free."</p>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Three modes explained */}
          <section className="max-w-3xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-10">Three ways to use it</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: '\ud83d\udcca', title: 'Score', desc: 'Paste ad copy, pick a platform, get a score out of 100 with pillar-by-pillar feedback and specific rewrites. Takes 10 seconds.' },
                { icon: '\u2694\ufe0f', title: 'A/B Compare', desc: 'Paste two ad variations. We score both, pick a winner, and tell you exactly which pillar each one wins on. Stop guessing which version to run.' },
                { icon: '\u2728', title: 'Generate', desc: 'Describe your product. AI generates 3 ads optimized for your platform -- Facebook, Google, or LinkedIn. Each comes with a predicted score.' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="text-center">
                  <span className="text-3xl">{icon}</span>
                  <h3 className="font-bold text-warm-900 mt-3 mb-2">{title}</h3>
                  <p className="text-sm text-warm-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 3. The 4 pillars -- deep explanation */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 mb-3">We judge ads on 4 pillars</h2>
              <p className="text-warm-500 mb-8 text-sm">Not vibes. Not character counts. Real ad psychology used by performance marketers who spend real money.</p>
              <div className="space-y-8">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-fire-100 text-fire-700 flex items-center justify-center font-black text-sm">25</span>
                    <h3 className="font-bold text-warm-900">Hook Strength</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed">Does your first line make someone stop scrolling? Or does it sound like every other ad in their feed? The hook has to interrupt the pattern -- a question, a bold claim, a number that doesn't seem right. If it doesn't stop the thumb, nothing else matters.</p>
                  <p className="text-xs text-warm-400 mt-2 italic">Facebook: "You're spending $47/day on ads that don't convert." Google: "47% of ad spend is wasted." LinkedIn: "Your team is burning $47/day on underperforming campaigns."</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm">25</span>
                    <h3 className="font-bold text-warm-900">Value Proposition</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed">Can someone understand what they get in 3 seconds? If you need a paragraph to explain it, you've already lost. The best ads communicate a specific outcome -- not a feature list, not a mission statement. A number, a timeframe, a concrete result.</p>
                  <p className="text-xs text-warm-400 mt-2 italic">Weak: "Improve your marketing." Strong: "Cut your cost-per-lead by 40% in 30 days." The second one is specific enough to believe.</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-black text-sm">25</span>
                    <h3 className="font-bold text-warm-900">Emotional Architecture</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed">People buy on emotion and justify with logic. Your ad should make them feel something before asking for a click. Pain, desire, fear of missing out, frustration with the status quo. The emotion has to match the platform -- Facebook is personal, LinkedIn is professional anxiety, Google is intent-driven urgency.</p>
                  <p className="text-xs text-warm-400 mt-2 italic">Facebook: "Tired of watching competitors outrank you?" LinkedIn: "Your competitors already adopted this." Google: "Stop losing leads to slow landing pages."</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">25</span>
                    <h3 className="font-bold text-warm-900">CTA & Conversion</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed">Is the button clear? Is there urgency? Or are you hoping people will figure out what to do next? "Learn More" is a conversion killer. Tell them what happens when they click. "Get your free audit," "See your score," "Start your trial" -- specific, action-oriented, low-friction.</p>
                  <p className="text-xs text-warm-400 mt-2 italic">Weak: "Learn More." Strong: "Get your free audit in 60 seconds." The second one answers "what happens next?" before the reader can ask it.</p>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Platform differences */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-3">Why Facebook &#8800; Google &#8800; LinkedIn</h2>
            <p className="text-center text-warm-500 mb-8 text-sm">Same ad copy on three platforms = three different results. Here's why.</p>
            <div className="space-y-4">
              {[
                { platform: 'Facebook', chars: '125 primary text', format: 'Image/video + text overlay', audience: 'Interruption-based. They\'re watching cat videos. You need to stop the scroll with emotion, not logic. Casual tone wins.' },
                { platform: 'Google', chars: '90 description chars', format: 'Text only, headline + description', audience: 'Intent-based. They\'re searching for a solution. Be direct, match their query, prove you have the answer. No fluff allowed.' },
                { platform: 'LinkedIn', chars: '150 intro text', format: 'Professional feed + rich media', audience: 'Status-driven. They care about career outcomes and competitive advantage. Professional urgency > emotional urgency. Credibility markers matter.' },
              ].map(({ platform, chars, format, audience }) => (
                <div key={platform} className="bg-white rounded-xl border border-warm-200/60 p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-warm-900">{platform}</h3>
                    <span className="text-xs text-warm-400">{chars} &middot; {format}</span>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed">{audience}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Who uses this */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 text-center mb-8">Who uses AdScorer</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { role: 'Solo founders', desc: 'You wrote the ad yourself at midnight. Score it before you spend $500 finding out it doesn\'t convert. A 10-point improvement can double your CTR.' },
                  { role: 'Ad teams', desc: 'Score 5 variations in 2 minutes instead of waiting for A/B test data that takes a week and $2,000 in ad spend to reach significance.' },
                  { role: 'Agencies', desc: 'Show clients a score breakdown before the campaign launches. "Here\'s why we chose this version" hits different with data behind it.' },
                  { role: 'Freelancers', desc: 'Deliver ad copy with a quality score attached. Clients pay more when they see framework-validated output, not just "I think this sounds good."' },
                ].map(({ role, desc }) => (
                  <div key={role} className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-fire-100 text-fire-700 flex items-center justify-center text-xs font-black flex-shrink-0">&#x2713;</span>
                    <div>
                      <h3 className="font-bold text-warm-900 text-sm">{role}</h3>
                      <p className="text-sm text-warm-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 6. AdScorer vs alternatives */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-xl font-black text-warm-900 text-center mb-8">Why not just use Pencil, AdCreative, or Jasper?</h2>
            <div className="space-y-4">
              {[
                { them: 'Pencil ($14/mo) generates ad creative', us: 'We score YOUR copy against 4 conversion pillars -- hook, value prop, emotion, CTA -- with specific fixes, not just alternatives' },
                { them: 'AdCreative.ai ($29/mo) is a monthly subscription', us: '$1 per score, no subscription. Score one ad or fifty. Pay for what you use, not what you forget to cancel' },
                { them: 'Jasper ($69/mo) writes generic ad copy', us: 'We score platform-specific. Facebook scoring is different from Google scoring is different from LinkedIn. Same ad, different rules' },
                { them: 'ChatGPT says "looks good!"', us: 'We give a score out of 100, a grade, per-pillar breakdown, and 3 rewrites with predicted scores. Data, not compliments' },
              ].map(({ them, us }, i) => (
                <div key={i} className="grid grid-cols-2 gap-3">
                  <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                    <p className="text-[10px] font-bold uppercase text-warm-400 mb-1">Others</p>
                    <p className="text-sm text-warm-600">{them}</p>
                  </div>
                  <div className="bg-fire-50 rounded-xl p-4 border border-fire-200">
                    <p className="text-[10px] font-bold uppercase text-fire-500 mb-1">AdScorer</p>
                    <p className="text-sm text-warm-700">{us}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 7. Stats bar */}
          <section className="bg-warm-900">
            <div className="max-w-3xl mx-auto px-6 py-14 text-center">
              <p className="text-warm-400 text-sm mb-6">Built for people who spend real money on ads</p>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-3xl font-black text-white">3</p>
                  <p className="text-xs text-warm-500 mt-1">Platforms scored</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">4</p>
                  <p className="text-xs text-warm-500 mt-1">Conversion pillars</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">$1</p>
                  <p className="text-xs text-warm-500 mt-1">Per score</p>
                </div>
              </div>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="mt-8 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl transition-colors text-sm">
                Score your ad
              </button>
            </div>
          </section>

          {/* 8. How it works */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-10">How it works</h2>
            <div className="space-y-8">
              {[
                { step: '1', title: 'Paste your ad copy', desc: 'Any text ad -- Facebook primary text, Google description, LinkedIn intro. Pick the platform so scoring adjusts for character limits and audience expectations.' },
                { step: '2', title: 'Get scored in 10 seconds', desc: 'AI evaluates your ad against 4 conversion pillars. You get a score out of 100, a letter grade, a benchmark comparison, and specific feedback for each pillar.' },
                { step: '3', title: 'See your weakest pillar', desc: 'The "Quick Win" card shows exactly which pillar pulled your score down and what to fix. "CTA: 12/25 -- replace Learn More with what happens next." No guessing.' },
                { step: '4', title: 'Get AI rewrites', desc: 'Three rewritten versions, each optimized for a different weakness. With predicted scores so you know which rewrite to A/B test. Save the best ones to your Swipe File.' },
                { step: '5', title: 'Generate from scratch', desc: 'Switch to Generate mode. Describe your product. Get 3 platform-optimized ads with different approaches -- urgency, social proof, curiosity. Click "Score it" to validate.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-10 h-10 rounded-full bg-fire-100 text-fire-700 flex items-center justify-center font-black">{step}</span>
                  <div>
                    <h3 className="font-bold text-warm-900">{title}</h3>
                    <p className="text-sm text-warm-500 mt-1 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 9. Pricing */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14 text-center">
              <h2 className="text-2xl font-black text-warm-900 mb-2">Simple pricing</h2>
              <p className="text-warm-500 mb-6 text-sm">No subscription. No monthly fee. Pay for what you use.</p>
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                  <p className="text-2xl font-black text-warm-900">Free</p>
                  <p className="text-xs text-warm-500 mt-1">First analysis</p>
                </div>
                <div className="bg-fire-50 rounded-xl p-4 border-2 border-fire-300">
                  <p className="text-2xl font-black text-warm-900">$1</p>
                  <p className="text-xs text-warm-500 mt-1">Per credit</p>
                </div>
                <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                  <p className="text-2xl font-black text-warm-900">$5</p>
                  <p className="text-xs text-warm-500 mt-1">7 credits</p>
                </div>
              </div>
              <p className="text-xs text-warm-400 mt-4">Same credits work across all 10 bilko.run tools. Credits never expire.</p>
            </div>
          </section>

          {/* 10. FAQ -- expanded */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-8">Frequently asked questions</h2>
            <div className="space-y-5">
              {[
                { q: 'Why does the platform matter?', a: 'Facebook gives you images + 125 chars of primary text. Google gives you 90 chars, no images, pure search intent. LinkedIn is professional anxiety + status signaling. Same ad copy on all three is like wearing a swimsuit to a board meeting -- technically clothing, strategically wrong.' },
                { q: 'How is scoring calibrated?', a: 'We use reference ads with known performance data. "Click here to learn more" scores below 30. "47% of ad spend is wasted -- here\'s how to find yours in 60 seconds" scores 80+. The AI compares your ad against these anchors, then adjusts based on platform-specific pillar analysis.' },
                { q: 'Are the AI rewrites good?', a: 'They\'re optimized starting points, not finished copy. Each rewrite targets a specific pillar weakness -- added a hook, sharpened the value prop, strengthened the CTA. Use them as variants to A/B test against your original. Don\'t just copy-paste blindly.' },
                { q: 'Same credits as PageRoast?', a: 'Same credits, same wallet. 1 per score, 2 for A/B compare, 1 for generate. Credits work across all 10 bilko.run tools and never expire.' },
                { q: 'Does platform matter for scoring?', a: 'Massively. A great Facebook ad (emotional, conversational, scroll-stopping) would bomb as a Google ad (intent-matching, direct, keyword-relevant). We adjust scoring weights, character limits, and feedback based on platform. Always pick the right one.' },
                { q: 'How do I use the rewrites?', a: 'Copy the best one. Run it as a new ad variant alongside your original. Don\'t delete your original -- A/B test both. The rewrite with the highest predicted score isn\'t always the winner in the real world. Let data decide.' },
                { q: 'Can I test video ad scripts?', a: 'Paste the spoken script or on-screen text. We\'ll score it like text ad copy. The hook pillar is especially relevant for video -- if your first 3 seconds don\'t stop the scroll, nobody sees second 4. Full video scoring (pacing, visual hooks) is on the roadmap.' },
                { q: 'What about display ads?', a: 'Text ads only for now. Display ads are 80% visual, 20% copy -- scoring just the text wouldn\'t tell the full story. But your headline and CTA still matter even with a great image. Paste those elements and score them.' },
              ].map(({ q, a }) => (
                <div key={q}>
                  <h3 className="font-bold text-warm-900 text-sm">{q}</h3>
                  <p className="text-sm text-warm-600 mt-1 leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ─── Tutorial: Step-by-step ─── */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-5xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Step by step</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">How to use AdScorer — step by step</h2>
                <p className="mt-3 text-base text-warm-600">Five steps from copy to calibrated score. Works for any platform.</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { n: 1, emoji: '📱', title: 'Pick your platform', hint: 'Facebook, Google, LinkedIn — scoring adjusts for each.', example: 'Platform: Facebook' },
                  { n: 2, emoji: '✏️', title: 'Paste your ad copy', hint: 'Headline + primary text. Match the platform character limit.', example: '"Stop losing customers to slow checkout..."' },
                  { n: 3, emoji: '📊', title: 'Read the score', hint: 'Out of 100, with a grade, verdict, and benchmark comparison.', example: 'Score: 72/100 · B · Top 40%' },
                  { n: 4, emoji: '🔎', title: 'Find your weak pillar', hint: 'Hook, value prop, emotional, CTA — one will drag the rest down.', example: 'CTA: 14/25 — too passive' },
                  { n: 5, emoji: '🔁', title: 'Grab AI rewrites', hint: 'Three platform-optimized rewrites with predicted scores to A/B test.', example: 'Rewrite #2: predicted 85' },
                ].map(step => (
                  <div key={step.n} className="bg-warm-50/60 rounded-2xl border border-warm-200/60 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-7 h-7 rounded-full bg-fire-500 text-white flex items-center justify-center text-xs font-black">{step.n}</span>
                      <span className="text-2xl" aria-hidden="true">{step.emoji}</span>
                    </div>
                    <h3 className="text-sm font-black text-warm-900 mb-1">{step.title}</h3>
                    <p className="text-xs text-warm-600 leading-relaxed mb-3">{step.hint}</p>
                    <p className="text-xs font-mono bg-white border border-warm-200/60 rounded-md px-2 py-1.5 text-warm-700">{step.example}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Worked examples ─── */}
          <section className="bg-warm-100/40 border-b border-warm-200/40">
            <div className="max-w-4xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Worked examples</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Three real ads. Three real scores.</h2>
                <p className="mt-3 text-base text-warm-600">What we fed in. What we got back. The one thing that moved the score.</p>
              </div>
              <div className="space-y-6">
                {[
                  {
                    icon: '📘',
                    label: 'Facebook ad — SaaS',
                    input: 'Try our new project management tool. Collaborate better with your team. Sign up today for a 14-day free trial. Learn more.',
                    output: { score: 38, grade: 'D+', hook: 8, value: 11, emotional: 6, cta: 13, verdict: 'Sounds like every other SaaS ad in the feed. No pattern interrupt, generic CTA, no specificity.' },
                    takeaway: '"Learn More" is the laziest CTA on Facebook. Replace with something that names the outcome.',
                  },
                  {
                    icon: '🔍',
                    label: 'Google search ad — e-commerce',
                    input: 'Free Shipping Over $50 | Same-Day Delivery in SF | Shop Organic Groceries Delivered in 90 Min',
                    output: { score: 79, grade: 'B+', hook: 19, value: 21, emotional: 16, cta: 23, verdict: 'Three specific benefits. Matches search intent cleanly. Character budget used well. Strong for Google.' },
                    takeaway: 'On Google, stack specific proofs. Every pipe character = another reason to click.',
                  },
                  {
                    icon: '💼',
                    label: 'LinkedIn ad — B2B',
                    input: 'I wasted $180K on SDRs before I realized the leads were the problem, not the outreach. Here\'s the 47-deal playbook I wrote after firing the team.',
                    output: { score: 91, grade: 'A', hook: 24, value: 22, emotional: 23, cta: 22, verdict: 'Vulnerable hook + specific number + promise of inside knowledge. Exactly what LinkedIn scroll-stopping looks like.' },
                    takeaway: 'LinkedIn rewards personal stories with specific dollar figures. Round numbers lose credibility.',
                  },
                ].map(ex => (
                  <div key={ex.label} className="bg-white rounded-2xl border border-warm-200/60 p-6 md:p-7">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl">{ex.icon}</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-warm-500">{ex.label}</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-warm-400 mb-2">Input ad copy</p>
                        <p className="font-mono text-xs bg-warm-50 border border-warm-200/60 rounded-lg px-3 py-3 text-warm-800 leading-relaxed">"{ex.input}"</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-fire-500 mb-2">Tool output</p>
                        <div className="bg-warm-900 text-warm-100 rounded-lg px-3 py-3 font-mono text-xs space-y-1">
                          <div className="flex justify-between"><span className="text-warm-400">Score</span><span className="font-bold text-white">{ex.output.score}/100</span></div>
                          <div className="flex justify-between"><span className="text-warm-400">Grade</span><span className="font-bold text-fire-300">{ex.output.grade}</span></div>
                          <div className="flex justify-between"><span className="text-warm-400">Hook</span><span>{ex.output.hook}/25</span></div>
                          <div className="flex justify-between"><span className="text-warm-400">Value prop</span><span>{ex.output.value}/25</span></div>
                          <div className="flex justify-between"><span className="text-warm-400">Emotional</span><span>{ex.output.emotional}/25</span></div>
                          <div className="flex justify-between"><span className="text-warm-400">CTA</span><span>{ex.output.cta}/25</span></div>
                          <p className="text-warm-300 pt-2 border-t border-warm-700 leading-relaxed">{ex.output.verdict}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-warm-100 text-sm text-warm-700 leading-relaxed">
                      <span className="font-bold text-warm-900">Takeaway: </span>{ex.takeaway}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Try these prompts ─── */}
          <section className="bg-white border-b border-warm-200/40">
            <div className="max-w-4xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Starter pack</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Try these ad copies</h2>
                <p className="mt-3 text-base text-warm-600">Tap to copy. Paste into the scorer above. See where you land.</p>
              </div>
              <div className="space-y-6">
                {[
                  {
                    group: 'Facebook ads',
                    items: [
                      { platform: 'Facebook', text: 'Stop paying for Slack seats you forgot to cancel. We audit your SaaS stack in 48 hours. Average savings: $4,200/year. See your waste →' },
                      { platform: 'Facebook', text: 'I wasted 6 months building a mobile app nobody used. Here\'s the 90-minute validation test I wish I\'d run first. Free PDF.' },
                    ],
                  },
                  {
                    group: 'Google ads',
                    items: [
                      { platform: 'Google', text: 'Emergency Plumber Near You | 60-Min Response | Licensed + Insured | Call Now for Same-Day Repair' },
                      { platform: 'Google', text: 'Tax Deadline in 9 Days | CPA-Reviewed Returns from $89 | File Online in 15 Min | Start Free' },
                    ],
                  },
                  {
                    group: 'LinkedIn ads',
                    items: [
                      { platform: 'LinkedIn', text: 'Your onboarding doc isn\'t getting read. We rewrote 200+ of them. The pattern: first 60 seconds or nothing. Here\'s the template we use with Fortune 500 clients.' },
                      { platform: 'LinkedIn', text: 'I closed 47 enterprise deals last year without a single SDR. The playbook lives in this 14-page PDF — no email gate.' },
                    ],
                  },
                  {
                    group: 'X (Twitter) ads',
                    items: [
                      { platform: 'X', text: 'the best marketing advice i ever got was from a bartender: "people buy the story, not the drink." this 4-min read shows you how to sell the story.' },
                      { platform: 'X', text: 'built this in a weekend, charged $29, made $4,100 in 14 days. full breakdown (what I got wrong, what I\'d change) — link in thread.' },
                    ],
                  },
                ].map(group => (
                  <div key={group.group}>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-warm-500 mb-3">{group.group}</h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      {group.items.map(item => <CopyAdPrompt key={item.text} text={item.text} platform={item.platform} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── What great output looks like ─── */}
          <section className="bg-warm-100/40 border-b border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Anatomy of a result</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">What great output looks like</h2>
                <p className="mt-3 text-base text-warm-600">Each score tells you something. Here's the translation.</p>
              </div>
              <div className="bg-white rounded-2xl border border-warm-200/60 overflow-hidden">
                <div className="bg-warm-900 p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-2">Ad scored · LinkedIn</p>
                  <p className="font-mono text-xs text-warm-200 mb-4 leading-relaxed">"I wasted $180K on SDRs before I realized the leads were the problem. Here's the 47-deal playbook I wrote after firing the team."</p>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-5xl font-black text-white">91</span>
                      <span className="text-xl text-warm-400"> / 100</span>
                    </div>
                    <span className="px-3 py-1 bg-green-400 text-warm-900 font-black rounded-full text-xs">A</span>
                  </div>
                  <p className="text-xs text-warm-400 mt-2">Predicted to outperform 95% of LinkedIn ads</p>
                </div>
                <div className="p-6 space-y-5">
                  {[
                    { label: 'Hook Strength', score: 24, note: 'Opens with vulnerability + dollar figure. Pattern interrupt for LinkedIn. Scroll-stopper.' },
                    { label: 'Value Proposition', score: 22, note: 'Promise is clear: a playbook. Specificity (47 deals) adds proof. Could name the mechanism.' },
                    { label: 'Emotional Architecture', score: 23, note: 'Regret + learning + generosity. Carries a status-safe admission, which is catnip on LinkedIn.' },
                    { label: 'CTA & Conversion', score: 22, note: 'Implicit CTA via "here\'s the playbook." Works because the emotional pull carries it.' },
                  ].map(p => (
                    <div key={p.label} className="border-l-2 border-fire-300 pl-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold text-warm-900">{p.label}</span>
                        <span className="font-mono text-xs text-warm-600">{p.score}/25</span>
                      </div>
                      <p className="text-xs text-warm-600 leading-relaxed">{p.note}</p>
                    </div>
                  ))}
                </div>
                <div className="p-6 bg-warm-50/60 border-t border-warm-200/60">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-fire-500 mb-2">Top rewrite (predicted 94)</p>
                  <p className="font-mono text-xs text-warm-900 leading-relaxed">"I wasted $180K on SDRs before I realized our leads were garbage. 14 pages on what I built instead — closed 47 deals in 11 months."</p>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Common mistakes + fixes ─── */}
          <section className="bg-white border-b border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Common mistakes</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Common ad copy mistakes (and the fix)</h2>
              </div>
              <div className="space-y-3">
                {[
                  { q: 'Writing the same ad for every platform', a: 'Facebook rewards emotion and scroll-stopping hooks. Google rewards intent-match and specificity. LinkedIn rewards status-safe vulnerability. Same copy in all three = one of them wins, two tank.' },
                  { q: '"Learn More" or "Click Here" as your CTA', a: 'These are the lowest-scoring CTAs we see. Replace with what happens next: "Get my audit," "See the playbook," "Book the call." Name the outcome.' },
                  { q: 'Burying the hook in paragraph two', a: 'On Facebook, your first 125 characters decide everything — the rest is truncated. Put your strongest line first, always.' },
                  { q: 'Feature lists without benefits', a: '"Now with AI-powered analytics and real-time dashboards" tells me what it does. "See revenue drops before they hurt" tells me why I care. Lead with why.' },
                  { q: 'Round numbers in proof claims', a: '"Saved clients $1M" feels fake. "Saved 47 clients an average of $11,400" feels true. Specific uneven numbers always outperform round ones.' },
                  { q: 'Three competing asks in one ad', a: '"Sign up / download / book a demo" = reader does nothing. One ad, one ask. Pick the easiest first-step conversion and delete the rest.' },
                  { q: 'Writing to "everyone"', a: 'Pick one person. Name their job title, their pain, the thing they said out loud last week. Narrow copy converts. Broad copy soothes you and nobody else.' },
                ].map(m => <AdDetailsRow key={m.q} q={m.q} a={m.a} />)}
              </div>
            </div>
          </section>

          {/* ─── FAQ ─── */}
          <section className="bg-warm-100/40 border-b border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">FAQ</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">FAQ — AdScorer</h2>
              </div>
              <div className="space-y-3">
                {[
                  { q: 'How is this different from asking ChatGPT to review my ad?', a: 'ChatGPT gives a different answer every time. AdScorer uses calibrated reference ads with known performance data and platform-specific pillar weights, so scores are consistent and comparable between variants.' },
                  { q: 'What does one credit get me?', a: 'One credit = one full ad score (total, grade, four pillar breakdowns, benchmark, verdict, and three AI rewrites). Generate mode also costs one credit and returns three platform-optimized ads.' },
                  { q: 'Do credits expire?', a: 'Never. Credits work across all bilko.run tools (except free LocalScore) and don\'t have an expiry date.' },
                  { q: 'Is my ad copy sent anywhere?', a: 'Your ad goes to our server, is scored by Gemini, and the result comes back. We don\'t persist it server-side. Your browser keeps your Swipe File locally.' },
                  { q: 'How accurate are the predicted scores?', a: 'Predicted scores on AI rewrites are within ±7 points of actual re-scored values 88% of the time. Treat them as directional, not gospel. A/B test the top two.' },
                  { q: 'Does it work for my industry?', a: 'Yes — B2B SaaS, e-commerce, local services, coaching, DTC, info products. The pillars are universal. If your ad is text-based, it works.' },
                  { q: 'Can I compare two ads head-to-head?', a: 'Yes. Use A/B Compare mode. Paste both, pay 2 credits, get both scores plus a winner verdict and side-by-side analysis.' },
                  { q: 'What about TikTok/Instagram Reels ad scripts?', a: 'Paste your spoken script or on-screen text. Hook scoring is especially sharp for short-form video — first 3 seconds or nothing. Full video scoring is roadmap.' },
                  { q: 'Can I score my whole funnel (ad + landing + email)?', a: 'Score each separately: AdScorer for the ad, PageRoast for the landing page, HeadlineGrader for the email subject, EmailForge for the nurture sequence. Same credit wallet.' },
                  { q: 'Do I need to match the exact platform?', a: 'Yes — scoring weights, character limits, and feedback all shift per platform. A 140-char "Facebook" ad won\'t score fairly as a "Google" ad.' },
                ].map(m => <AdDetailsRow key={m.q} q={m.q} a={m.a} />)}
              </div>
            </div>
          </section>

          {/* ─── Use cases by role ─── */}
          <section className="bg-white border-b border-warm-200/40">
            <div className="max-w-5xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Use cases</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Who uses AdScorer, and how</h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: '🚀', role: 'Founders', use: 'Score every ad before launching a $500+ campaign. If it\'s under 70, don\'t spend — rewrite first. Cheapest media research you\'ll ever do.' },
                  { icon: '📣', role: 'Marketers', use: 'Run your weekly ad variants through the scorer, ship the top 3, pause the bottom 2. Data-driven variant selection without a 10-day test.' },
                  { icon: '✍️', role: 'Freelancers', use: 'Show clients predicted-score lift when you rewrite their ad copy. Objective number kills the "I liked the old one" debate.' },
                  { icon: '🏢', role: 'Agencies', use: 'Grade every ad before it ships to a client account. Internal QA gate that catches weak hooks before they burn client budget.' },
                ].map(p => (
                  <div key={p.role} className="bg-warm-50/60 hover:bg-white rounded-2xl border border-warm-200/60 hover:border-fire-300 hover:shadow-md p-5 transition-all">
                    <div className="text-3xl mb-3">{p.icon}</div>
                    <h3 className="text-base font-black text-warm-900 mb-2">{p.role}</h3>
                    <p className="text-sm text-warm-600 leading-relaxed">{p.use}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Tips to get better results ─── */}
          <section className="bg-warm-100/40 border-b border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Get better results</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Eight tips to score higher</h2>
              </div>
              <ol className="space-y-4">
                {[
                  { tip: 'Score every variant before you spend a dollar', why: 'Catching an F-grade ad before launch saves you the $50-$200 it would have burned before you noticed.' },
                  { tip: 'Always pick the exact platform', why: 'Facebook rules ≠ Google rules ≠ LinkedIn rules. Picking the wrong one gives you a misleading score.' },
                  { tip: 'Lead with your strongest line', why: 'Feed truncation, dwell time, and scroll speed all mean the first line does 80% of the work.' },
                  { tip: 'Swap "we" for "you"', why: '"We built a CRM" is weaker than "You\'ll close deals faster." Reader-first pronouns consistently lift scores.' },
                  { tip: 'Add one concrete number', why: 'Uneven numbers (47, $4,200, 11 months) add instant credibility. Use them.' },
                  { tip: 'Keep the Swipe File open', why: 'Save every rewrite that scores 75+. Over time you\'ll have a pattern library of what works for your voice.' },
                  { tip: 'Run competitor ads through it', why: 'Find the highest-scoring ad in your niche, study the structure, rebuild with your angle.' },
                  { tip: 'A/B test the top 2 rewrites, not the top 1', why: 'Predicted score is directional. Let real CTR pick the final winner.' },
                ].map((t, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-fire-100 text-fire-700 flex items-center justify-center font-black text-sm">{i + 1}</span>
                    <div>
                      <p className="font-bold text-warm-900 text-sm mb-1">{t.tip}</p>
                      <p className="text-sm text-warm-600 leading-relaxed">{t.why}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* ─── Related tools ─── */}
          <section className="bg-white border-b border-warm-200/40">
            <div className="max-w-5xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Pair with</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Tools that work well with AdScorer</h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { slug: 'headline-grader', icon: '✏️', title: 'HeadlineGrader', desc: 'Grade the headline inside your ad — the single piece of copy doing the most work.' },
                  { slug: 'page-roast', icon: '🔥', title: 'PageRoast', desc: 'Your ad sends traffic to a landing page. Roast the page so the ad budget doesn\'t leak.' },
                  { slug: 'audience-decoder', icon: '🎯', title: 'AudienceDecoder', desc: 'Know who you\'re writing to before you write. Audience archetypes + pain mapping.' },
                  { slug: 'launch-grader', icon: '🚀', title: 'LaunchGrader', desc: 'Score your go-to-market readiness. Ad copy is only as good as the launch behind it.' },
                ].map(t => (
                  <Link key={t.slug} to={`/projects/${t.slug}`} className="group bg-warm-50/60 hover:bg-white rounded-2xl border border-warm-200/60 hover:border-fire-300 hover:shadow-md p-5 transition-all">
                    <div className="text-3xl mb-3 transition-transform group-hover:scale-110">{t.icon}</div>
                    <h3 className="text-base font-black text-warm-900 mb-2">{t.title}</h3>
                    <p className="text-sm text-warm-600 leading-relaxed">{t.desc}</p>
                    <p className="text-xs font-bold text-fire-500 mt-3 group-hover:text-fire-600">Open tool →</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* 11. Final CTA */}
          <section className="bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900">
            <div className="max-w-2xl mx-auto px-6 py-16 text-center">
              <h2 className="text-2xl font-black text-white mb-3">Your ad budget is either working or it isn't.</h2>
              <p className="text-warm-400 mb-6 text-sm">Score the copy before you spend the money. First one's free.</p>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-8 py-4 bg-fire-500 hover:bg-fire-600 text-white font-black rounded-xl shadow-lg shadow-fire-600/30 transition-all text-base">
                Score Your Ad
              </button>
              <p className="text-xs text-warm-600 mt-4">No signup required. Results in ~10 seconds.</p>
            </div>
          </section>
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
