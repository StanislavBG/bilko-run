import { useState, useEffect, useRef } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { ToolHero, ScoreCard, SectionBreakdown, CompareLayout, Rewrites } from '../components/tool-page/index.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface FrameworkScore { score: number; max: number; feedback: string; }

interface GradeResult {
  total_score: number;
  grade: string;
  framework_scores: {
    rule_of_one: FrameworkScore;
    value_equation: FrameworkScore;
    readability: FrameworkScore;
    proof_promise_plan: FrameworkScore;
  };
  diagnosis: string;
  rewrites?: Array<{ text: string; predicted_score: number; optimized_for: string; technique: string }>;
}

interface CompareResponse {
  headlineA: GradeResult;
  headlineB: GradeResult;
  comparison: { winner: 'A' | 'B' | 'tie'; margin: number; verdict: string; analysis?: string };
}

const PILLAR_LABELS: Record<string, string> = {
  rule_of_one: 'Rule of One',
  value_equation: 'Value Equation',
  readability: 'Readability',
  proof_promise_plan: 'Proof + Promise + Plan',
};

const CONTEXT_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'email', label: 'Email Subject' },
  { value: 'ad', label: 'Ad Copy' },
  { value: 'landing', label: 'Landing Page' },
  { value: 'blog', label: 'Blog Post' },
  { value: 'social', label: 'Social Post' },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export function HeadlineGraderPage() {
  const {
    result, compareResult, loading, error, needsTokens,
    email, isSignedIn, submit, submitCompare, reset, signInRef, SignInButton: ClerkSignIn,
  } = useToolApi<GradeResult>('headline-grader');

  const [tab, setTab] = useState<'score' | 'compare'>('score');
  const [headline, setHeadline] = useState('');
  const [headlineA, setHeadlineA] = useState('');
  const [headlineB, setHeadlineB] = useState('');
  const [context, setContext] = useState('general');

  useEffect(() => { document.title = 'Headline Grader — bilko.run'; }, []);

  function handleTabChange(next: 'score' | 'compare') {
    setTab(next);
    reset();
  }

  function handleScore(e: React.FormEvent) {
    e.preventDefault();
    if (!headline.trim()) return;
    submit({ headline: headline.trim(), context });
  }

  function handleCompare(e: React.FormEvent) {
    e.preventDefault();
    if (!headlineA.trim() || !headlineB.trim()) return;
    submitCompare({ headlineA: headlineA.trim(), headlineB: headlineB.trim() });
  }

  const compare = compareResult as CompareResponse | null;
  const charLen = tab === 'score' ? headline.length : 0;

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
        title="Score your headline"
        tagline="AI grades it against 4 proven copywriting frameworks"
        tab={tab}
        onTabChange={handleTabChange}
        hasCompare
      >
        {tab === 'score' ? (
          <form onSubmit={handleScore} className="max-w-xl mx-auto text-left space-y-4">
            <div>
              <textarea
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Paste your headline here..."
                rows={2}
                className="w-full rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-warm-500 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-fire-500/50 resize-none"
              />
              <p className={`text-xs mt-1 text-right ${charLen > 60 ? 'text-red-400' : 'text-warm-500'}`}>
                {charLen}/60 chars
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="rounded-lg bg-white/10 border border-white/20 text-warm-300 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-fire-500/50"
              >
                {CONTEXT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-warm-900 text-white">{o.label}</option>
                ))}
              </select>

              <button
                type="submit"
                disabled={loading || !headline.trim()}
                className="flex-1 bg-fire-500 hover:bg-fire-600 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm"
              >
                {loading ? 'Scoring...' : 'Score Headline'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCompare} className="max-w-xl mx-auto text-left space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1 block">Headline A</label>
              <textarea
                value={headlineA}
                onChange={(e) => setHeadlineA(e.target.value)}
                placeholder="First headline..."
                rows={2}
                className="w-full rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-warm-500 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-fire-500/50 resize-none"
              />
              <p className={`text-xs mt-1 text-right ${headlineA.length > 60 ? 'text-red-400' : 'text-warm-500'}`}>
                {headlineA.length}/60 chars
              </p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1 block">Headline B</label>
              <textarea
                value={headlineB}
                onChange={(e) => setHeadlineB(e.target.value)}
                placeholder="Second headline..."
                rows={2}
                className="w-full rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-warm-500 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-fire-500/50 resize-none"
              />
              <p className={`text-xs mt-1 text-right ${headlineB.length > 60 ? 'text-red-400' : 'text-warm-500'}`}>
                {headlineB.length}/60 chars
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !headlineA.trim() || !headlineB.trim()}
              className="w-full bg-fire-500 hover:bg-fire-600 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm"
            >
              {loading ? 'Comparing...' : 'Compare Headlines'}
            </button>
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
              <a href="/pricing" className="text-fire-500 hover:underline font-bold">Grab tokens</a> to keep grading.
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
              verdict={result.diagnosis}
              toolName="Headline Grader"
            />
            <SectionBreakdown pillars={result.framework_scores} labels={PILLAR_LABELS} />
            {result.rewrites && result.rewrites.length > 0 && (
              <Rewrites rewrites={result.rewrites} noun="rewrite" />
            )}
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
              label: 'Headline A',
              score: compare.headlineA.total_score,
              grade: compare.headlineA.grade,
              verdict: compare.headlineA.diagnosis,
              pillars: compare.headlineA.framework_scores,
            }}
            cardB={{
              label: 'Headline B',
              score: compare.headlineB.total_score,
              grade: compare.headlineB.grade,
              verdict: compare.headlineB.diagnosis,
              pillars: compare.headlineB.framework_scores,
            }}
            pillarLabels={PILLAR_LABELS}
          />
        )}
      </div>
    </div>
  );
}
