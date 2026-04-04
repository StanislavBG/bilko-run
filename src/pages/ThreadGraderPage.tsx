import { useState, useEffect, useRef } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { ToolHero, ScoreCard, SectionBreakdown, CompareLayout, Rewrites, CrossPromo } from '../components/tool-page/index.js';

interface PillarScore { score: number; max: number; feedback: string; }
interface TweetBreakdown { tweet_index: number; text_preview: string; score: number; note: string; }

interface GraderResult {
  total_score: number;
  grade: string;
  pillar_scores: {
    hook: PillarScore;
    tension: PillarScore;
    payoff: PillarScore;
    share_trigger: PillarScore;
  };
  tweet_breakdown?: TweetBreakdown[];
  rewrites?: Array<{ label: string; text: string; why_better: string }>;
  verdict: string;
}

const PILLAR_LABELS: Record<string, string> = {
  hook: 'Hook Strength',
  tension: 'Tension Chain',
  payoff: 'Payoff',
  share_trigger: 'Share Trigger',
};

interface HookEntry { text: string; label: string; date: string; }
const HOOKS_KEY = 'bilko_hook_library';
function loadHooks(): HookEntry[] { try { return JSON.parse(localStorage.getItem(HOOKS_KEY) || '[]'); } catch { return []; } }

function countTweets(text: string): number {
  return text.split(/---|\n\n/).filter(t => t.trim().length > 0).length;
}

function viralPotential(score: number) {
  if (score >= 85) return { label: 'High Viral Potential', color: 'text-green-600 bg-green-50', note: 'This thread has all the signals. Ship it.' };
  if (score >= 65) return { label: 'Moderate Potential', color: 'text-blue-600 bg-blue-50', note: 'Good bones. The hook could be sharper.' };
  if (score >= 45) return { label: 'Low Potential', color: 'text-yellow-600 bg-yellow-50', note: 'Needs work. Most readers will drop off early.' };
  return { label: 'Rewrite', color: 'text-red-600 bg-red-50', note: 'Start over. The hook isn\'t stopping anyone.' };
}

export function ThreadGraderPage() {
  const { result, compareResult, loading, error, needsTokens, email, isSignedIn, submit, submitCompare, reset, signInRef } = useToolApi<GraderResult>('thread-grader');

  const [tab, setTab] = useState<'score' | 'compare' | 'generate'>('score');
  const [thread, setThread] = useState('');
  const [threadA, setThreadA] = useState('');
  const [threadB, setThreadB] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);
  const [hooks, setHooks] = useState<HookEntry[]>(loadHooks);
  const [topic, setTopic] = useState('');
  const [genTweetCount, setGenTweetCount] = useState(7);
  const [generateResult, setGenerateResult] = useState<{ thread: Array<{ position: number; text: string; purpose: string }>; hook_technique: string; predicted_viral_score: number; strategy_note: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  function saveHook(rw: { text: string; label: string }) {
    const entry: HookEntry = { text: rw.text, label: rw.label, date: new Date().toISOString() };
    const updated = [entry, ...hooks.filter(h => h.text !== rw.text)].slice(0, 20);
    localStorage.setItem(HOOKS_KEY, JSON.stringify(updated));
    setHooks(updated);
  }

  const API = import.meta.env.VITE_API_URL || '/api';

  function handleTabChange(next: 'score' | 'compare' | 'generate') {
    setTab(next);
    reset();
    setGenerateResult(null);
    setGenError(null);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || !isSignedIn) {
      signInRef.current?.click();
      return;
    }
    setGenerating(true);
    setGenerateResult(null);
    setGenError(null);
    try {
      const res = await fetch(`${API}/demos/thread-grader/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), tweetCount: genTweetCount, email }),
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

  useEffect(() => {
    document.title = 'ThreadGrader — Score Your X/Twitter Threads';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  useEffect(() => {
    if ((result || compareResult) && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [result, compareResult]);

  const tweetCount = countTweets(thread);

  return (
    <>
      <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
        <button ref={signInRef} className="hidden" aria-hidden="true" />
      </SignInButton>

      <ToolHero
        title="Grade or generate threads"
        tagline="AI scores hook strength, tension flow, and share triggers — or writes threads for you"
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
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 md:p-5 shadow-2xl max-w-2xl mx-auto">
            <div className="relative">
              <textarea
                value={thread}
                onChange={e => setThread(e.target.value)}
                placeholder={"Tweet 1: Your hook goes here...\n\n---\n\nTweet 2: Build tension...\n\n---\n\nTweet 3: Deliver the payoff..."}
                rows={8}
                className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner resize-none"
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit({ threadText: thread }); } }}
              />
              {thread.length > 0 && (
                <span className="absolute bottom-3 right-3 text-xs font-semibold text-warm-400 bg-white/80 px-2 py-0.5 rounded">
                  {tweetCount} tweet{tweetCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button
              onClick={() => submit({ threadText: thread })}
              disabled={loading || thread.trim().length < 20}
              className="w-full mt-3 py-3.5 bg-gradient-to-r from-fire-500 to-fire-600 hover:from-fire-600 hover:to-fire-700 disabled:from-warm-500 disabled:to-warm-600 text-white font-black rounded-xl shadow-lg transition-all disabled:shadow-none"
            >
              {loading ? 'Grading...' : 'Grade Thread'}
            </button>
            <p className="mt-2 text-xs text-warm-500">Separate tweets with --- or blank lines &middot; Cmd+Enter to submit</p>
          </div>
        ) : tab === 'compare' ? (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 md:p-5 shadow-2xl max-w-3xl mx-auto">
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1.5 block text-left">Thread A</label>
                <textarea value={threadA} onChange={e => setThreadA(e.target.value)} placeholder="Paste thread A..." rows={6}
                  className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner resize-none" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1.5 block text-left">Thread B</label>
                <textarea value={threadB} onChange={e => setThreadB(e.target.value)} placeholder="Paste thread B..." rows={6}
                  className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner resize-none" />
              </div>
            </div>
            <button
              onClick={() => submitCompare({ threadA, threadB })}
              disabled={loading || threadA.trim().length < 20 || threadB.trim().length < 20}
              className="w-full py-3.5 bg-gradient-to-r from-fire-500 to-fire-600 hover:from-fire-600 hover:to-fire-700 disabled:from-warm-500 disabled:to-warm-600 text-white font-black rounded-xl shadow-lg transition-all disabled:shadow-none"
            >
              {loading ? 'Comparing...' : 'Compare Threads'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleGenerate} className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 md:p-5 shadow-2xl max-w-2xl mx-auto space-y-4">
            <div>
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="What should the thread be about? e.g. '7 lessons from building a SaaS to $10k MRR' or 'Why most landing pages fail (and how to fix yours)'"
                rows={4}
                className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-2 block text-left">
                Tweet count: {genTweetCount}
              </label>
              <input
                type="range"
                min={3}
                max={15}
                value={genTweetCount}
                onChange={e => setGenTweetCount(Number(e.target.value))}
                className="w-full accent-fire-500"
              />
              <div className="flex justify-between text-[10px] text-warm-500 mt-1">
                <span>3</span>
                <span>15</span>
              </div>
            </div>
            <button type="submit" disabled={generating || !topic.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-fire-500 to-fire-600 hover:from-fire-600 hover:to-fire-700 disabled:from-warm-500 disabled:to-warm-600 text-white font-black rounded-xl shadow-lg transition-all disabled:shadow-none">
              {generating ? 'Generating...' : '\u2728 Generate Thread'}
            </button>
            <p className="text-xs text-warm-500 text-center">Describe your topic. AI generates a full thread with hook, tension, and payoff.</p>
          </form>
        )}
      </ToolHero>

      {error && (
        <div className="max-w-2xl mx-auto px-6 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
        </div>
      )}

      {needsTokens && (
        <div className="max-w-2xl mx-auto px-6 mb-6">
          <div className="bg-fire-50 border border-fire-200 rounded-2xl p-6 text-center">
            <p className="text-warm-800 font-semibold mb-1">Out of free credits</p>
            <p className="text-sm text-warm-600"><a href="/pricing" className="text-fire-500 hover:underline font-bold">Grab tokens</a> to keep grading.</p>
          </div>
        </div>
      )}

      {/* Generate error */}
      {genError && (
        <div className="max-w-2xl mx-auto px-6 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{genError}</div>
        </div>
      )}

      {/* Generate loading */}
      {generating && (
        <div className="max-w-2xl mx-auto px-6 py-8 flex items-center justify-center gap-3">
          <div className="h-5 w-5 rounded-full border-2 border-fire-500 border-t-transparent animate-spin" />
          <span className="text-sm text-warm-500 font-medium">Generating thread...</span>
        </div>
      )}

      {/* Generate results */}
      {generateResult && !generating && (
        <div className="max-w-2xl mx-auto px-6 pt-10 space-y-6 pb-16 animate-slide-up">
          {/* Viral score card */}
          {(() => {
            const score = generateResult.predicted_viral_score;
            const color = score >= 80 ? 'text-green-600 bg-green-50 border-green-200' :
              score >= 60 ? 'text-blue-600 bg-blue-50 border-blue-200' :
              score >= 40 ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
              'text-red-600 bg-red-50 border-red-200';
            return (
              <div className={`rounded-2xl border p-5 ${color}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-70">Predicted Viral Score</p>
                    <p className="text-3xl font-black mt-1">{score}/100</p>
                  </div>
                  {generateResult.hook_technique && (
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/60">{generateResult.hook_technique}</span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Strategy note */}
          {generateResult.strategy_note && (
            <div className="bg-fire-50 border border-fire-200 rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-1">Strategy Note</p>
              <p className="text-sm text-warm-700">{generateResult.strategy_note}</p>
            </div>
          )}

          {/* Thread display */}
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">Generated Thread ({generateResult.thread.length} tweets)</h3>
            {generateResult.thread.map((tweet, i) => {
              const purposeColors: Record<string, string> = {
                hook: 'bg-fire-50 text-fire-600',
                tension: 'bg-yellow-50 text-yellow-700',
                payoff: 'bg-green-50 text-green-700',
                cta: 'bg-blue-50 text-blue-700',
              };
              const badgeColor = purposeColors[tweet.purpose?.toLowerCase()] || 'bg-warm-50 text-warm-600';
              return (
                <div key={i} className="flex items-start gap-3 p-3 border border-warm-100 rounded-xl">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs bg-warm-100 text-warm-600">
                    {tweet.position}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badgeColor}`}>{tweet.purpose}</span>
                    </div>
                    <p className="text-sm text-warm-800 whitespace-pre-wrap">{tweet.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigator.clipboard.writeText(generateResult.thread.map(t => t.text).join('\n\n'))}
              className="px-5 py-2.5 border border-warm-200 text-warm-700 hover:bg-warm-50 font-bold rounded-xl transition-colors text-sm"
            >
              Copy Full Thread
            </button>
            <button
              onClick={() => {
                setThread(generateResult.thread.map(t => t.text).join('\n\n---\n\n'));
                handleTabChange('score');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-5 py-2.5 border border-fire-200 text-fire-600 hover:bg-fire-50 font-bold rounded-xl transition-colors text-sm"
            >
              Score it
            </button>
          </div>
        </div>
      )}

      {result && (
        <div ref={resultRef} className="max-w-2xl mx-auto px-6 pt-10 space-y-6 pb-16">
          <ScoreCard score={result.total_score} grade={result.grade} verdict={result.verdict} toolName="ThreadGrader" />
          {(() => {
            const vp = viralPotential(result.total_score);
            return (
              <div className={`rounded-2xl border border-warm-200/60 p-5 animate-slide-up ${vp.color}`} style={{ animationDelay: '80ms' }}>
                <p className="text-sm font-bold">{vp.label}</p>
                <p className="text-xs mt-1 opacity-80">{vp.note}</p>
              </div>
            );
          })()}
          {/* Algorithm Intel */}
          <div className="bg-warm-50 rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '250ms' }}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">X Algorithm Intel (2026)</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white rounded-lg p-3 border border-warm-100">
                <span className="font-bold text-warm-800">Reply = 27x a like</span>
                <p className="text-warm-500 mt-0.5">Replies are the strongest engagement signal. Write threads that provoke replies.</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-warm-100">
                <span className="font-bold text-warm-800">Bookmark = 5x a like</span>
                <p className="text-warm-500 mt-0.5">Bookmarks signal high-value content. Add a "save this" call-to-action.</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-warm-100">
                <span className="font-bold text-warm-800">First 30 min = critical</span>
                <p className="text-warm-500 mt-0.5">Engagement velocity in the first hour determines reach. Post when your audience is online.</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-warm-100">
                <span className="font-bold text-warm-800">Links kill reach (-50-90%)</span>
                <p className="text-warm-500 mt-0.5">External links are penalized. Put the link in a reply, not the thread.</p>
              </div>
            </div>
          </div>
          <SectionBreakdown pillars={result.pillar_scores} labels={PILLAR_LABELS} />

          {/* Per-tweet breakdown */}
          {result.tweet_breakdown && result.tweet_breakdown.length > 0 && (
            <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '150ms' }}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">Tweet-by-Tweet Breakdown</h3>
              <div className="space-y-3">
                {result.tweet_breakdown.map((tw) => {
                  const color = tw.score >= 8 ? 'bg-green-100 text-green-700' :
                    tw.score >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
                  return (
                    <div key={tw.tweet_index} className="flex items-start gap-3 p-3 border border-warm-100 rounded-xl">
                      <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${color}`}>
                        {tw.score}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-warm-800 font-medium">Tweet {tw.tweet_index}</p>
                        <p className="text-xs text-warm-500 italic truncate">{tw.text_preview}</p>
                        <p className="text-xs text-warm-600 mt-1">{tw.note}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {result.rewrites && <Rewrites rewrites={result.rewrites} noun="hook rewrite" />}
          {result.rewrites && result.rewrites.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.rewrites.map((rw, i) => (
                <button key={i} onClick={() => saveHook(rw)}
                  className="text-xs px-3 py-1.5 border border-fire-200 text-fire-600 hover:bg-fire-50 rounded-lg transition-colors">
                  Save hook: {rw.label}
                </button>
              ))}
            </div>
          )}
          <CrossPromo currentTool="thread-grader" />
          <div className="text-center pt-4">
            <button
              onClick={() => { reset(); setThread(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl shadow-md shadow-fire-500/20 transition-all"
            >
              Score Another Thread
            </button>
          </div>
        </div>
      )}

      {compareResult && (
        <div ref={resultRef} className="max-w-4xl mx-auto px-6 pt-10 space-y-6 pb-16">
          <CompareLayout
            winner={compareResult.comparison.winner}
            margin={compareResult.comparison.margin}
            verdict={compareResult.comparison.verdict}
            analysis={compareResult.comparison.strategic_analysis}
            cardA={{ label: 'Thread A', score: compareResult.threadA.total_score, grade: compareResult.threadA.grade, verdict: compareResult.threadA.verdict, pillars: compareResult.threadA.pillar_scores }}
            cardB={{ label: 'Thread B', score: compareResult.threadB.total_score, grade: compareResult.threadB.grade, verdict: compareResult.threadB.verdict, pillars: compareResult.threadB.pillar_scores }}
            pillarLabels={PILLAR_LABELS}
          />
        </div>
      )}

      {/* ── Below-fold engagement content ────────────────────────────── */}
      {!result && !compareResult && !generateResult && !loading && !generating && (
        <>
          {/* What we grade */}
          <div className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-12">
              <h2 className="text-lg font-black text-warm-900 mb-6">What we grade</h2>
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-bold text-warm-900">Hook <span className="text-warm-400 font-normal">(30 pts)</span></p>
                  <p className="text-sm text-warm-500 mt-0.5">Tweet 1 is everything. If your hook doesn't stop the scroll, tweets 2-10 are a monologue to nobody.</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-warm-900">Tension <span className="text-warm-400 font-normal">(25 pts)</span></p>
                  <p className="text-sm text-warm-500 mt-0.5">Each tweet should make the reader need the next one. Not want. Need. Like a cliffhanger, but shorter.</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-warm-900">Payoff <span className="text-warm-400 font-normal">(25 pts)</span></p>
                  <p className="text-sm text-warm-500 mt-0.5">Promise something in the hook, deliver it by the end. The internet never forgives a bait-and-switch.</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-warm-900">Share Trigger <span className="text-warm-400 font-normal">(20 pts)</span></p>
                  <p className="text-sm text-warm-500 mt-0.5">Quote-worthy insights, surprising stats, hot takes people can't resist retweeting.</p>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto px-6 py-12">
            <h2 className="text-lg font-black text-warm-900 mb-6">Frequently asked questions</h2>
            <div className="space-y-5">
              <div>
                <p className="text-sm font-bold text-warm-900">How do I separate tweets?</p>
                <p className="text-sm text-warm-600 mt-0.5">Use --- or leave a blank line between tweets. We count them automatically.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-warm-900">Why is the hook worth 30 points?</p>
                <p className="text-sm text-warm-600 mt-0.5">Because 80% of readers decide on tweet 1. If you lose them there, your thread is a diary entry.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-warm-900">Can I grade LinkedIn posts too?</p>
                <p className="text-sm text-warm-600 mt-0.5">Paste any long-form content. The frameworks work for any multi-section piece. We just call them tweets.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-warm-900">Same credits?</p>
                <p className="text-sm text-warm-600 mt-0.5">Same credits across all tools. 1 per grade, 2 for A/B compare.</p>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-10 text-center">
              <p className="text-warm-900 font-bold text-base mb-3">Still writing threads nobody reads? Let's fix that.</p>
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

      {/* Hook Library */}
      {hooks.length > 0 && (
        <div className="max-w-2xl mx-auto px-6 pb-12">
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">My Hooks ({hooks.length})</h3>
            <div className="space-y-2">
              {hooks.map((h, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-warm-50 last:border-0">
                  <span className="text-[10px] font-bold text-fire-500 uppercase bg-fire-50 px-2 py-0.5 rounded-full flex-shrink-0">{h.label}</span>
                  <p className="text-sm text-warm-700 flex-1">{h.text}</p>
                  <button onClick={() => { navigator.clipboard.writeText(h.text); }} className="text-xs text-warm-400 hover:text-fire-500 flex-shrink-0">Copy</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
