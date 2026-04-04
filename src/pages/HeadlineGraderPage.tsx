import { useState, useEffect, useRef } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { ToolHero, ScoreCard, SectionBreakdown, CompareLayout, Rewrites, CrossPromo } from '../components/tool-page/index.js';

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

interface HistoryEntry { headline: string; score: number; grade: string; date: string; }
const HISTORY_KEY = 'bilko_headline_history';
function loadHistory(): HistoryEntry[] { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } }
function saveToHistory(entry: HistoryEntry) {
  const h = loadHistory().filter(e => e.headline !== entry.headline);
  h.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 10)));
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

function analyzeHeadline(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const powerWords = ['free', 'new', 'proven', 'secret', 'instant', 'guaranteed', 'discover', 'exclusive', 'limited', 'ultimate', 'best', 'easy', 'fast', 'now', 'today', 'save', 'boost', 'hack', 'master', 'unlock'];
  const emotionalWords = ['love', 'hate', 'fear', 'amazing', 'shocking', 'incredible', 'terrible', 'brilliant', 'dangerous', 'stunning', 'obsessed', 'devastating', 'thrilling', 'heartbreaking', 'jaw-dropping'];
  const powerCount = words.filter(w => powerWords.includes(w.toLowerCase())).length;
  const emotionalCount = words.filter(w => emotionalWords.includes(w.toLowerCase())).length;
  const readingTimeSec = Math.max(0.5, words.length * 0.3);
  const type = text.endsWith('?') ? 'Question' : text.match(/^\d|how to|ways to|steps to|tips/i) ? 'List/How-to' : text.match(/^why|^what|^when/i) ? 'Question' : 'Statement';
  return { wordCount: words.length, powerCount, emotionalCount, readingTimeSec, type };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function HeadlineGraderPage() {
  const {
    result, compareResult, loading, error, needsTokens,
    email, isSignedIn, submit, submitCompare, reset, signInRef, SignInButton: ClerkSignIn,
  } = useToolApi<GradeResult>('headline-grader');

  const [tab, setTab] = useState<'score' | 'compare' | 'generate'>('score');
  const [headline, setHeadline] = useState('');
  const [headlineA, setHeadlineA] = useState('');
  const [headlineB, setHeadlineB] = useState('');
  const [context, setContext] = useState('general');
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [description, setDescription] = useState('');
  const [generateResult, setGenerateResult] = useState<any | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => { document.title = 'Headline Grader — bilko.run'; }, []);

  // Auto-save scored headlines
  useEffect(() => {
    if (result && headline) {
      const entry = { headline, score: result.total_score, grade: result.grade, date: new Date().toISOString() };
      saveToHistory(entry);
      setHistory(loadHistory());
    }
  }, [result]);

  function handleTabChange(next: 'score' | 'compare' | 'generate') {
    setTab(next);
    reset();
    setGenerateResult(null);
    setGenError(null);
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

  const API = import.meta.env.VITE_API_URL || '/api';

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !isSignedIn) {
      signInRef.current?.click();
      return;
    }
    setGenerating(true);
    setGenerateResult(null);
    setGenError(null);
    try {
      const res = await fetch(`${API}/demos/headline-grader/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim(), context, count: 5, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setGenerateResult(data);
    } catch (err: any) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
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
        title="Score or generate headlines"
        tagline="AI grades your headlines — or writes new ones from your description"
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
              {headline.trim() && (() => {
                const { wordCount, powerCount, emotionalCount, readingTimeSec, type } = analyzeHeadline(headline);
                return (
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-warm-400">{wordCount} words</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-warm-400">{readingTimeSec.toFixed(1)}s read</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${powerCount >= 1 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                      {powerCount} power {powerCount >= 1 ? '\u2713' : '\u2014 add 1+'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${emotionalCount >= 1 ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                      {emotionalCount} emotional {emotionalCount >= 1 ? '\u2713' : '\u2014 aim for 10-15%'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-warm-400">{type}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${wordCount >= 6 && wordCount <= 12 ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                      {wordCount >= 6 && wordCount <= 12 ? 'Good length' : wordCount < 6 ? 'Too short' : 'Consider trimming'}
                    </span>
                  </div>
                );
              })()}
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
        ) : tab === 'compare' ? (
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
        ) : (
          <form onSubmit={handleGenerate} className="max-w-xl mx-auto text-left space-y-4">
            <div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe your product, service, or page... e.g. 'AI tool that scores landing pages and gives conversion feedback in 30 seconds'"
                rows={4}
                className="w-full rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-warm-500 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-fire-500/50 resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <select value={context} onChange={e => setContext(e.target.value)}
                className="rounded-lg bg-white/10 border border-white/20 text-warm-300 text-sm px-3 py-2 focus:outline-none">
                {CONTEXT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} className="bg-warm-900 text-white">{o.label}</option>
                ))}
              </select>
              <button type="submit" disabled={generating || !description.trim()}
                className="flex-1 bg-fire-500 hover:bg-fire-600 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm">
                {generating ? 'Generating...' : '\u2728 Generate 5 Headlines'}
              </button>
            </div>
            <p className="text-xs text-warm-500 text-center">Describe what you're selling. AI generates headlines optimized for 4 frameworks.</p>
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
            {/* Quick diagnosis — weakest pillar */}
            {(() => {
              const scores = result.framework_scores;
              const entries = Object.entries(scores) as [string, { score: number; max: number }][];
              const weakest = entries.reduce((a, b) => (a[1].score / a[1].max) < (b[1].score / b[1].max) ? a : b);
              const tips: Record<string, string> = {
                rule_of_one: 'Your headline tries to say too many things. Pick ONE idea and cut everything else.',
                value_equation: 'The benefit isn\'t specific enough. Add a number, timeframe, or concrete outcome.',
                readability: 'Too complex. Shorten words, cut jargon, aim for a 5th-grade reading level.',
                proof_promise_plan: 'No proof element. Add a number, result, or credential to make it believable.',
              };
              const labels: Record<string, string> = { rule_of_one: 'Rule of One', value_equation: 'Value Equation', readability: 'Readability', proof_promise_plan: 'Proof + Promise' };
              return (
                <div className="bg-fire-50 border border-fire-200 rounded-2xl p-5 animate-slide-up" style={{ animationDelay: '50ms' }}>
                  <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-1">Biggest opportunity</p>
                  <p className="text-sm font-bold text-warm-900">{labels[weakest[0]]}: {weakest[1].score}/{weakest[1].max}</p>
                  <p className="text-sm text-warm-600 mt-1">{tips[weakest[0]]}</p>
                </div>
              );
            })()}
            <SectionBreakdown pillars={result.framework_scores} labels={PILLAR_LABELS} />
            {result.rewrites && result.rewrites.length > 0 && (
              <Rewrites rewrites={result.rewrites} noun="rewrite" />
            )}

            <div className="text-center pt-4">
              <button
                onClick={() => { reset(); setHeadline(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl shadow-md shadow-fire-500/20 transition-all"
              >
                Score Another Headline
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

        {/* Generate results */}
        {generateResult && !generating && (
          <>
            {generateResult.strategy_note && (
              <div className="bg-fire-50 border border-fire-200 rounded-2xl p-5 animate-slide-up">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-1">Strategy</p>
                <p className="text-sm text-warm-700">{generateResult.strategy_note}</p>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">Generated Headlines ({generateResult.headlines?.length ?? 0})</h3>
              <div className="space-y-3">
                {(generateResult.headlines ?? []).map((h: any, i: number) => (
                  <div key={i} className="border border-warm-100 rounded-xl p-4 hover:border-fire-200 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-warm-900 font-bold leading-relaxed">{h.text}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-bold text-fire-500 uppercase bg-fire-50 px-2 py-0.5 rounded">{h.technique}</span>
                          <span className="text-[10px] text-warm-400">Strongest: {h.framework_strength}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">~{h.predicted_score}</span>
                        <button onClick={() => { navigator.clipboard.writeText(h.text); }}
                          className="text-xs text-warm-400 hover:text-fire-500 transition-colors">Copy</button>
                        <button onClick={() => { setHeadline(h.text); setTab('score'); }}
                          className="text-xs text-fire-500 hover:text-fire-600 font-semibold transition-colors">Score it</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {genError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 animate-slide-up">{genError}</div>
        )}

        {generating && (
          <div className="flex items-center justify-center gap-3 py-8 animate-slide-up">
            <div className="h-5 w-5 rounded-full border-2 border-fire-500 border-t-transparent animate-spin" />
            <span className="text-sm text-warm-500 font-medium">Generating headlines...</span>
          </div>
        )}
      </div>

      {/* ── Cross Promo ──────────────────────────────────────────────── */}
      <CrossPromo currentTool="headline-grader" />

      {/* ── Below-fold engagement content ────────────────────────────── */}
      {!result && !compareResult && !generateResult && !loading && !generating && (
        <>
          {/* How it scores */}
          <div className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-12">
              <h2 className="text-lg font-black text-warm-900 mb-6">How it scores</h2>
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-bold text-warm-900">Rule of One <span className="text-warm-400 font-normal">(30 pts)</span></p>
                  <p className="text-sm text-warm-500 mt-0.5">One dominant idea. Not three competing ones crammed into a run-on sentence.</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-warm-900">Value Equation <span className="text-warm-400 font-normal">(30 pts)</span></p>
                  <p className="text-sm text-warm-500 mt-0.5">Dream outcome x likelihood / time x effort. Hormozi math applied to your 12 words.</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-warm-900">Readability <span className="text-warm-400 font-normal">(20 pts)</span></p>
                  <p className="text-sm text-warm-500 mt-0.5">Grade-5 reading level is the goal. Your headline isn't a PhD thesis.</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-warm-900">Proof + Promise + Plan <span className="text-warm-400 font-normal">(20 pts)</span></p>
                  <p className="text-sm text-warm-500 mt-0.5">Promise something specific. Prove it's possible. Hint at the plan.</p>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto px-6 py-12">
            <h2 className="text-lg font-black text-warm-900 mb-6">Frequently asked questions</h2>
            <div className="space-y-5">
              <div>
                <p className="text-sm font-bold text-warm-900">What makes a good headline?</p>
                <p className="text-sm text-warm-600 mt-0.5">One idea, specific benefit, emotional hook, under 60 characters. That's it. Most headlines fail at "one idea."</p>
              </div>
              <div>
                <p className="text-sm font-bold text-warm-900">Why 60 characters?</p>
                <p className="text-sm text-warm-600 mt-0.5">Google truncates at 60. If your headline gets cut off, you just wasted the most important piece of copy on your page.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-warm-900">Are the rewrites any good?</p>
                <p className="text-sm text-warm-600 mt-0.5">They're a starting point. AI rewrites optimize for specific framework weaknesses. Use them as inspiration, not gospel.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-warm-900">Do I use the same credits?</p>
                <p className="text-sm text-warm-600 mt-0.5">Yep. 1 credit per score, 2 for A/B compare. Same credits work across all bilko.run tools.</p>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-10 text-center">
              <p className="text-warm-900 font-bold text-base mb-3">Still tweaking your headline? That's the right instinct. Score it.</p>
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

      {/* Headline History */}
      {history.length > 0 && (
        <div className="max-w-2xl mx-auto px-6 pb-12">
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">Recent Headlines ({history.length})</h3>
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-warm-50 last:border-0">
                  <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                    h.grade.startsWith('A') ? 'bg-green-100 text-green-700' :
                    h.grade.startsWith('B') ? 'bg-blue-100 text-blue-700' :
                    h.grade.startsWith('C') ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>{h.grade}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-warm-800 truncate">{h.headline}</p>
                    <p className="text-xs text-warm-400">{h.score}/100</p>
                  </div>
                  <button onClick={() => { setHeadline(h.headline); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="text-xs text-fire-500 hover:text-fire-600 font-semibold flex-shrink-0">Re-score</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
