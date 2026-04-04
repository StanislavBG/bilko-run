import { useState, useEffect, useRef } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { ToolHero, ScoreCard, SectionBreakdown, CrossPromo } from '../components/tool-page/index.js';

interface ToolVerdict { name: string; monthly_cost: number; verdict: 'KEEP' | 'SWITCH' | 'CUT'; reason: string; alternative: string | null; savings: number; }
interface SectionScore { score: number; max: number; feedback: string; }

interface AuditResult {
  total_score: number;
  grade: string;
  monthly_spend: number;
  annual_spend: number;
  potential_savings_monthly: number;
  potential_savings_annual: number;
  section_scores: {
    cost_efficiency: SectionScore;
    overlap: SectionScore;
    self_host: SectionScore;
    complexity: SectionScore;
    future_risk: SectionScore;
  };
  tools: ToolVerdict[];
  top_savings: string[];
  roast: string;
}

const PILLAR_LABELS: Record<string, string> = {
  cost_efficiency: 'Cost Efficiency',
  overlap: 'Tool Overlap',
  self_host: 'Self-Host Potential',
  complexity: 'Stack Complexity',
  future_risk: 'Future Risk',
};

const VERDICT_COLORS = { KEEP: 'bg-green-100 text-green-700', SWITCH: 'bg-yellow-100 text-yellow-700', CUT: 'bg-red-100 text-red-700' };

export function StackAuditPage() {
  const { result, loading, error, needsTokens, submit, reset, signInRef } = useToolApi<AuditResult>('stack-audit');
  const [tools, setTools] = useState('');
  const [teamSize, setTeamSize] = useState(5);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'StackAudit — Find Waste in Your SaaS Stack';
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

      <ToolHero title="Find waste in your SaaS stack" tagline="Paste your tools. AI finds overlap, cheaper alternatives, and exactly how much you can save.">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 md:p-5 shadow-2xl max-w-2xl mx-auto">
          <textarea
            value={tools}
            onChange={e => setTools(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit({ tools: tools.trim(), teamSize }); } }}
            placeholder={"Slack - $12/user/month - 5 users\nGitHub - $4/user/month - 3 users\nVercel - $20/month\nSupabase - $25/month\nFigma - $15/user/month\nNotion - $10/user/month\nMailchimp - $20/month\n\nOr just list names: Slack, GitHub, Vercel, Supabase, Figma, Linear, Notion"}
            rows={8}
            className="w-full px-5 py-4 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 text-sm focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner resize-none font-mono"
          />
          <div className="flex items-center gap-3 mt-3">
            <label className="text-xs font-bold text-warm-400">Team size:</label>
            <input type="range" min={1} max={50} value={teamSize} onChange={e => setTeamSize(parseInt(e.target.value))}
              className="flex-1 accent-fire-500" />
            <span className="text-sm font-bold text-white w-8 text-center">{teamSize}</span>
          </div>
          <button
            onClick={() => submit({ tools: tools.trim(), teamSize })}
            disabled={loading || tools.trim().length < 10}
            className="w-full mt-3 py-3.5 bg-gradient-to-r from-fire-500 to-fire-600 hover:from-fire-600 hover:to-fire-700 disabled:from-warm-500 disabled:to-warm-600 text-white font-black rounded-xl shadow-lg transition-all disabled:shadow-none"
          >
            {loading ? 'Auditing your stack...' : 'Audit My Stack'}
          </button>
          <p className="mt-2 text-xs text-warm-500 text-center">List your tools with prices (optional) &middot; Cmd+Enter to submit</p>
        </div>
      </ToolHero>

      {error && <div className="max-w-2xl mx-auto px-6 mb-6"><div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div></div>}
      {needsTokens && <div className="max-w-2xl mx-auto px-6 mb-6"><div className="bg-fire-50 border border-fire-200 rounded-2xl p-6 text-center"><p className="text-warm-800 font-semibold mb-1">Out of credits</p><p className="text-sm text-warm-600"><a href="/pricing" className="text-fire-500 hover:underline font-bold">Grab tokens</a> to keep auditing.</p></div></div>}
      {loading && <div className="max-w-2xl mx-auto px-6 py-12"><div className="flex items-center justify-center gap-3"><div className="h-5 w-5 rounded-full border-2 border-fire-500 border-t-transparent animate-spin" /><span className="text-sm text-warm-500">Scanning your stack for waste, overlap, and savings...</span></div></div>}

      {result && (
        <div ref={resultRef} className="max-w-2xl mx-auto px-6 pt-10 space-y-6 pb-16">
          <ScoreCard score={result.total_score} grade={result.grade} verdict={result.roast} toolName="StackAudit" />

          {/* Savings banner */}
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center animate-slide-up">
            <p className="text-3xl font-black text-green-700">${result.potential_savings_monthly}<span className="text-lg font-bold">/mo</span></p>
            <p className="text-sm text-green-600 mt-1">${result.potential_savings_annual}/year in potential savings</p>
            <p className="text-xs text-warm-500 mt-2">Current spend: ${result.monthly_spend}/mo (${result.annual_spend}/yr)</p>
          </div>

          {/* Top savings */}
          {result.top_savings?.length > 0 && (
            <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-green-600 mb-4">Biggest Savings Opportunities</h3>
              <div className="space-y-3">
                {result.top_savings.map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold">{i + 1}</span>
                    <p className="text-sm text-warm-700 pt-1.5">{s}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-tool verdicts */}
          {result.tools?.length > 0 && (
            <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '150ms' }}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">Tool-by-Tool Analysis</h3>
              <div className="space-y-3">
                {result.tools.map((t, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 border border-warm-100 rounded-xl">
                    <span className={`flex-shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase ${VERDICT_COLORS[t.verdict]}`}>{t.verdict}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-warm-800">{t.name}</span>
                        <span className="text-xs text-warm-400">${t.monthly_cost}/mo</span>
                        {t.savings > 0 && <span className="text-xs font-bold text-green-600">save ${t.savings}/mo</span>}
                      </div>
                      <p className="text-xs text-warm-600 mt-0.5">{t.reason}</p>
                      {t.alternative && <p className="text-xs text-fire-600 mt-0.5 font-medium">Switch to: {t.alternative}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <SectionBreakdown pillars={result.section_scores} labels={PILLAR_LABELS} />

          {result && (
            <div className="bg-warm-50 rounded-xl border border-warm-100 p-4 animate-slide-up" style={{ animationDelay: '300ms' }}>
              <p className="text-xs font-bold text-warm-700 mb-1">Compliance note</p>
              <p className="text-xs text-warm-500">Beyond cost, check if your tools are SOC 2 and GDPR compliant. Non-compliant SaaS in your stack = liability. Ask each vendor for their compliance certifications — if they can't provide them, that's a red flag.</p>
            </div>
          )}

          <div className="bg-warm-50 rounded-xl border border-warm-100 p-3 text-center text-xs text-warm-500 animate-slide-up">
            Enterprise stack audit tools charge $10,000+/year. You just paid $1.
          </div>

          <CrossPromo currentTool="stack-audit" />

          <div className="text-center pt-4">
            <button onClick={() => { reset(); setTools(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl shadow-md shadow-fire-500/20 transition-all">
              Audit Another Stack
            </button>
          </div>
        </div>
      )}

      {/* Below-fold content */}
      {!result && !loading && (
        <>
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-12">
              <h2 className="text-lg font-black text-warm-900 mb-6">What we analyze</h2>
              <div className="space-y-5">
                {[
                  { name: 'Cost Efficiency', pts: '30 pts', desc: 'Are you overpaying? Are there free alternatives? Could you downgrade tiers?' },
                  { name: 'Tool Overlap', pts: '25 pts', desc: 'Are multiple tools doing the same job? Could one tool replace three?' },
                  { name: 'Self-Host Potential', pts: '20 pts', desc: 'Could you run it yourself for free? Is it worth the trade-off at your scale?' },
                  { name: 'Stack Complexity', pts: '15 pts', desc: 'Is your stack right-sized for your team? Too many tools creates integration pain.' },
                  { name: 'Future Risk', pts: '10 pts', desc: 'Are you locked into vendors? Are your key tools getting more expensive?' },
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
            <h2 className="text-lg font-black text-warm-900 mb-6">The problem</h2>
            <div className="space-y-4 text-sm text-warm-600 leading-relaxed">
              <p>"I run a 12 person company and I just did our annual software audit and the number genuinely startled me. We are paying for 23 separate software subscriptions." — r/Entrepreneur, 461 upvotes</p>
              <p>"We cut nine subscriptions in a single afternoon and nobody noticed." — reply with 283 comments</p>
              <p>Enterprise audit tools (Zylo, Zluri) cost $10,000+/year. StackAudit costs $1.</p>
            </div>
          </section>

          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-12">
              <h2 className="text-lg font-black text-warm-900 mb-6">FAQ</h2>
              <div className="space-y-5">
                {[
                  { q: 'What format should I use?', a: 'List your tools with prices if you know them. "Slack - $12/user/month - 5 users" works great. Just tool names work too — we\'ll estimate costs.' },
                  { q: 'How accurate are the savings estimates?', a: 'They\'re directional, not exact. The alternative pricing is based on public data. Use this as a starting point for your audit, not a final decision.' },
                  { q: 'Will you recommend I cancel everything?', a: 'No. Some tools are worth every penny. We flag what\'s wasteful, redundant, or has a better alternative — not everything.' },
                  { q: 'How is this different from Zylo or Zluri?', a: 'They cost $10K+/year, require IT integration, and target enterprises with 300+ apps. StackAudit costs $1, runs in 30 seconds, and is built for small teams with 10-30 tools.' },
                ].map(({ q, a }) => (
                  <div key={q}>
                    <p className="text-sm font-bold text-warm-900">{q}</p>
                    <p className="text-sm text-warm-600 mt-0.5">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-warm-100/30 border-t border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-10 text-center">
              <p className="text-warm-900 font-bold text-base mb-3">The average small team wastes $200-500/month on tools they don't use. Find yours.</p>
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
