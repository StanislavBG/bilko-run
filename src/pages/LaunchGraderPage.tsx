import { useState, useEffect, useRef } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { ToolHero, ScoreCard, SectionBreakdown, CrossPromo } from '../components/tool-page/index.js';

interface SectionScore { score: number; max: number; feedback: string; }

interface LaunchResult {
  total_score: number;
  grade: string;
  section_scores: {
    value_prop: SectionScore;
    pricing: SectionScore;
    social_proof: SectionScore;
    onboarding: SectionScore;
    positioning: SectionScore;
  };
  launch_blockers: string[];
  verdict: string;
  roast: string;
}

const PILLAR_LABELS: Record<string, string> = {
  value_prop: 'Value Proposition',
  pricing: 'Pricing & Monetization',
  social_proof: 'Social Proof & Trust',
  onboarding: 'Onboarding & First Value',
  positioning: 'Competitive Positioning',
};

const VERDICT_COLORS: Record<string, string> = {
  'Ready to launch': 'bg-green-50 border-green-200 text-green-700',
  'Almost there': 'bg-yellow-50 border-yellow-200 text-yellow-700',
  'Not ready — major gaps': 'bg-red-50 border-red-200 text-red-700',
};

export function LaunchGraderPage() {
  const { result, loading, error, needsTokens, submit, reset, signInRef } = useToolApi<LaunchResult>('launch-grader');

  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'LaunchGrader — Is Your Product Ready to Launch?';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  useEffect(() => {
    if (result && resultRef.current) resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [result]);

  return (
    <>
      <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
        <button ref={signInRef} className="hidden" aria-hidden="true" />
      </SignInButton>

      <ToolHero
        title="Is your product ready to launch?"
        tagline="AI audits your go-to-market readiness across 5 dimensions. Get a score, blockers, and a verdict."
      >
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 md:p-5 shadow-2xl max-w-2xl mx-auto">
          <div className="space-y-3">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit({ url: url.trim(), description: description.trim() }); } }}
              placeholder="https://your-product.com"
              className="w-full px-5 py-4 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 text-base focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner"
            />
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit({ url: url.trim(), description: description.trim() }); } }}
              placeholder="Describe your product in 1-2 sentences... e.g. 'AI tool that helps founders score their landing pages and get conversion feedback in 30 seconds'"
              rows={3}
              className="w-full px-5 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 text-sm focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner resize-none"
            />
          </div>
          <button
            onClick={() => submit({ url: url.trim(), description: description.trim() })}
            disabled={loading || !url.trim() || description.trim().length < 10}
            className="w-full mt-3 py-3.5 bg-gradient-to-r from-fire-500 to-fire-600 hover:from-fire-600 hover:to-fire-700 disabled:from-warm-500 disabled:to-warm-600 text-white font-black rounded-xl shadow-lg transition-all disabled:shadow-none"
          >
            {loading ? 'Auditing...' : 'Audit My Launch Readiness'}
          </button>
          <p className="mt-2 text-xs text-warm-500 text-center">
            Paste your URL + describe what it does &middot; ~30 seconds &middot; Cmd+Enter to submit
          </p>
        </div>
      </ToolHero>

      {error && (
        <div className="max-w-2xl mx-auto px-6 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
        </div>
      )}

      {needsTokens && (
        <div className="max-w-2xl mx-auto px-6 mb-6">
          <div className="bg-fire-50 border border-fire-200 rounded-2xl p-6 text-center">
            <p className="text-warm-800 font-semibold mb-1">Out of credits</p>
            <p className="text-sm text-warm-600"><a href="/pricing" className="text-fire-500 hover:underline font-bold">Grab tokens</a> to keep auditing.</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="max-w-2xl mx-auto px-6 py-12">
          <div className="flex items-center justify-center gap-3">
            <div className="h-5 w-5 rounded-full border-2 border-fire-500 border-t-transparent animate-spin" />
            <span className="text-sm text-warm-500">Reading your page, checking your pricing, judging your social proof...</span>
          </div>
        </div>
      )}

      {result && (
        <div ref={resultRef} className="max-w-2xl mx-auto px-6 pt-10 space-y-6 pb-16">
          <ScoreCard score={result.total_score} grade={result.grade} verdict={result.roast} toolName="LaunchGrader" />

          {/* Verdict Banner */}
          {result.verdict && (
            <div className={`rounded-2xl border-2 p-5 text-center animate-slide-up ${VERDICT_COLORS[result.verdict] ?? 'bg-warm-50 border-warm-200 text-warm-700'}`}>
              <p className="text-lg font-black">{result.verdict}</p>
            </div>
          )}

          {/* Launch Blockers */}
          {result.launch_blockers && result.launch_blockers.length > 0 && (
            <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-4">Launch Blockers</h3>
              <div className="space-y-3">
                {result.launch_blockers.map((blocker, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </span>
                    <p className="text-sm text-warm-700 leading-relaxed pt-1.5">{blocker}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <SectionBreakdown pillars={result.section_scores} labels={PILLAR_LABELS} />

          {/* Value comparison */}
          <div className="bg-warm-50 rounded-xl border border-warm-100 p-3 text-center text-xs text-warm-500 animate-slide-up">
            Competitors charge $30-100/month for this analysis. You just paid $1.
          </div>

          <CrossPromo currentTool="page-roast" />

          <div className="text-center pt-4">
            <button
              onClick={() => { reset(); setUrl(''); setDescription(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl shadow-md shadow-fire-500/20 transition-all"
            >
              Audit Another Product
            </button>
          </div>
        </div>
      )}

      {/* Below-fold content */}
      {!result && !loading && (
        <>
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-12">
              <h2 className="text-lg font-black text-warm-900 mb-6">What we audit</h2>
              <div className="space-y-5">
                {[
                  { name: 'Value Proposition', pts: '25 pts', desc: 'Can someone understand what you do in 5 seconds? Is the target audience clear? What makes you different?' },
                  { name: 'Pricing & Monetization', pts: '20 pts', desc: 'Is pricing visible? Does the model match the value? Is there a free tier? Are upgrade triggers clear?' },
                  { name: 'Social Proof & Trust', pts: '20 pts', desc: 'Testimonials? Real team visible? Trust badges? Active community?' },
                  { name: 'Onboarding & First Value', pts: '20 pts', desc: 'Clear CTA? Quick time-to-value? Low signup friction? Guidance visible?' },
                  { name: 'Competitive Positioning', pts: '15 pts', desc: 'Competitor comparison? Clear category? Moat communicated?' },
                ].map(s => (
                  <div key={s.name}>
                    <p className="text-sm font-bold text-warm-900">{s.name} <span className="text-warm-400 font-normal">({s.pts})</span></p>
                    <p className="text-sm text-warm-500 mt-0.5">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="max-w-2xl mx-auto px-6 py-12">
            <h2 className="text-lg font-black text-warm-900 mb-6">FAQ</h2>
            <div className="space-y-5">
              {[
                { q: 'How is this different from PageRoast?', a: 'PageRoast audits your landing page\'s conversion elements. LaunchGrader audits your entire go-to-market readiness — pricing, positioning, social proof, onboarding, and competitive gaps.' },
                { q: 'What if I\'m not ready to launch?', a: 'That\'s the point. Better to know now than after you\'ve posted on Product Hunt to crickets. Fix the blockers, re-audit, launch with confidence.' },
                { q: 'How much does it cost?', a: '1 credit per audit. Same credits work across all bilko.run tools. Competitors charge $30-100/month for similar analysis.' },
                { q: 'Can I audit a competitor\'s product?', a: 'Yes. Paste any public URL. Compare your readiness score against theirs.' },
              ].map(({ q, a }) => (
                <div key={q}>
                  <p className="text-sm font-bold text-warm-900">{q}</p>
                  <p className="text-sm text-warm-600 mt-0.5">{a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-10 text-center">
              <p className="text-warm-900 font-bold text-base mb-3">431 Reddit comments asking for product reviews. This is that tool.</p>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="bg-fire-500 hover:bg-fire-600 text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm">
                Back to top
              </button>
            </div>
          </section>
        </>
      )}
    </>
  );
}
