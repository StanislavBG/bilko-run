import { useState, useEffect, useRef } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { ToolHero, ScoreCard, SectionBreakdown, CompareLayout, Rewrites } from '../components/tool-page/index.js';

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

export function ThreadGraderPage() {
  const { result, compareResult, loading, error, submit, submitCompare, reset, signInRef } = useToolApi<GraderResult>('thread-grader');

  const [tab, setTab] = useState<'score' | 'compare'>('score');
  const [thread, setThread] = useState('');
  const [threadA, setThreadA] = useState('');
  const [threadB, setThreadB] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);
  const [hooks, setHooks] = useState<HookEntry[]>(loadHooks);

  function saveHook(rw: { text: string; label: string }) {
    const entry: HookEntry = { text: rw.text, label: rw.label, date: new Date().toISOString() };
    const updated = [entry, ...hooks.filter(h => h.text !== rw.text)].slice(0, 20);
    localStorage.setItem(HOOKS_KEY, JSON.stringify(updated));
    setHooks(updated);
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
        title="Grade your thread"
        tagline="AI scores hook strength, tension flow, and share triggers"
        tab={tab}
        onTabChange={t => { setTab(t); reset(); }}
        hasCompare
      >
        {tab === 'score' ? (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 md:p-5 shadow-2xl max-w-2xl mx-auto">
            <div className="relative">
              <textarea
                value={thread}
                onChange={e => setThread(e.target.value)}
                placeholder={"Tweet 1: Your hook goes here...\n\n---\n\nTweet 2: Build tension...\n\n---\n\nTweet 3: Deliver the payoff..."}
                rows={8}
                className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner resize-none"
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
            <p className="mt-2 text-xs text-warm-500">Separate tweets with --- or blank lines</p>
          </div>
        ) : (
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
        )}
      </ToolHero>

      {error && (
        <div className="max-w-2xl mx-auto px-6 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
        </div>
      )}

      {result && (
        <div ref={resultRef} className="max-w-2xl mx-auto px-6 pt-10 space-y-6 pb-16">
          <ScoreCard score={result.total_score} grade={result.grade} verdict={result.verdict} toolName="ThreadGrader" />
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
