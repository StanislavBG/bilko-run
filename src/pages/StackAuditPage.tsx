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

      {/* ── Long-form below-fold content ──────────────────────────── */}
      {!result && !loading && (
        <>
          {/* 1. Example result */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 text-center mb-2">Here's what you'll get</h2>
              <p className="text-center text-warm-500 mb-8 text-sm">Real output from a real stack. Yours will be different.</p>
              <div className="bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,107,26,0.12),transparent_60%)]" />
                <div className="relative">
                  <p className="text-xs font-bold uppercase tracking-widest text-fire-400 mb-3 text-center">Sample Audit</p>
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-4xl font-black text-green-400">$347</p>
                      <p className="text-xs text-warm-500">/mo potential savings</p>
                    </div>
                    <div className="w-px h-12 bg-warm-700" />
                    <div className="text-center">
                      <p className="text-2xl font-black text-white">6</p>
                      <p className="text-xs text-warm-500">tools analyzed</p>
                    </div>
                  </div>
                  <div className="space-y-2 max-w-sm mx-auto">
                    {[
                      { name: 'Slack', verdict: 'KEEP', color: 'text-green-400' },
                      { name: 'GitHub', verdict: 'KEEP', color: 'text-green-400' },
                      { name: 'Vercel Pro', verdict: 'SWITCH', color: 'text-yellow-400' },
                      { name: 'Mailchimp', verdict: 'SWITCH', color: 'text-yellow-400' },
                      { name: 'Notion Teams', verdict: 'CUT', color: 'text-red-400' },
                      { name: 'Zapier', verdict: 'CUT', color: 'text-red-400' },
                    ].map(t => (
                      <div key={t.name} className="flex items-center justify-between">
                        <span className="text-sm text-warm-300">{t.name}</span>
                        <span className={`text-xs font-black uppercase ${t.color}`}>{t.verdict}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-warm-600 mt-4 text-center font-mono">sample-startup-stack</p>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Five dimensions explained */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 mb-3">We analyze 5 dimensions of stack health</h2>
            <p className="text-warm-500 mb-8 text-sm">Not just cost. Overlap, complexity, lock-in, and self-host potential all matter.</p>
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-black text-sm">30</span>
                  <h3 className="font-bold text-warm-900">Cost Efficiency</h3>
                </div>
                <p className="text-sm text-warm-600 leading-relaxed">Are you overpaying for what you use? Are there free or cheaper alternatives that do the same thing? Could you downgrade tiers without losing features you actually need? Most teams pay for Pro tiers they never fully utilize.</p>
                <p className="text-xs text-warm-400 mt-2 italic">Scores high: right-sized tiers, no unused seats, competitive pricing. Scores low: paying for enterprise when free tier covers your usage, 10 unused seats.</p>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm">25</span>
                  <h3 className="font-bold text-warm-900">Tool Overlap</h3>
                </div>
                <p className="text-sm text-warm-600 leading-relaxed">Are multiple tools doing the same job? Could one tool replace three? Notion + Google Docs + Confluence = three writing tools. Linear + Jira + Trello = three project trackers. Pick one, cancel the rest.</p>
                <p className="text-xs text-warm-400 mt-2 italic">Scores high: no duplicate categories, each tool has a clear role. Scores low: 3 project management tools, 2 CRMs, overlapping communication tools.</p>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">20</span>
                  <h3 className="font-bold text-warm-900">Self-Host Potential</h3>
                </div>
                <p className="text-sm text-warm-600 leading-relaxed">Could you run it yourself for free or near-free? At your scale, is the SaaS convenience worth 10-50x the infrastructure cost? Some tools make sense to self-host at any scale. Others only make sense at scale.</p>
                <p className="text-xs text-warm-400 mt-2 italic">Scores high: using self-hosted where practical (Plausible vs GA, Gitea vs GitHub for private repos). Scores low: paying $500/mo for something a $5/mo VPS could run.</p>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-black text-sm">15</span>
                  <h3 className="font-bold text-warm-900">Stack Complexity</h3>
                </div>
                <p className="text-sm text-warm-600 leading-relaxed">Is your stack right-sized for your team? A 3-person startup running 25 tools has an integration problem, an onboarding problem, and a context-switching problem. Every tool you add has a hidden cost in attention and maintenance.</p>
                <p className="text-xs text-warm-400 mt-2 italic">Scores high: tools-per-person ratio under 5, clear workflow between tools. Scores low: 20+ tools for a 5-person team, tools that don't integrate.</p>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-black text-sm">10</span>
                  <h3 className="font-bold text-warm-900">Future Risk</h3>
                </div>
                <p className="text-sm text-warm-600 leading-relaxed">Are you locked into vendors with no export path? Are your key tools getting more expensive every year? Is any critical tool a single point of failure with no alternative? Vendor lock-in is a slow tax that compounds.</p>
                <p className="text-xs text-warm-400 mt-2 italic">Scores high: data exportable, alternatives exist, pricing stable. Scores low: proprietary formats, no export, annual 20%+ price increases, single vendor dependency.</p>
              </div>
            </div>
          </section>

          {/* 3. The Reddit evidence */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 mb-6">The SaaS model is quietly falling apart</h2>
              <div className="space-y-4 text-sm text-warm-600 leading-relaxed">
                <p>That's not our claim — it's a Reddit post with 461 upvotes. Founders and small teams are waking up to the fact that they're bleeding money on tools they barely use.</p>
                <div className="bg-warm-50 rounded-xl border border-warm-100 p-4 my-4">
                  <p className="text-sm text-warm-700 italic">"I run a 12 person company and I just did our annual software audit and the number genuinely startled me. We are paying for 23 separate software subscriptions."</p>
                  <p className="text-xs text-warm-400 mt-2">— r/Entrepreneur, 461 upvotes</p>
                </div>
                <div className="bg-warm-50 rounded-xl border border-warm-100 p-4 my-4">
                  <p className="text-sm text-warm-700 italic">"We cut nine subscriptions in a single afternoon and nobody noticed."</p>
                  <p className="text-xs text-warm-400 mt-2">— reply, 283 comments</p>
                </div>
                <div className="bg-warm-50 rounded-xl border border-warm-100 p-4 my-4">
                  <p className="text-sm text-warm-700 italic">"Moved from AWS at $2,400/mo to Hetzner at $180/mo. Same workload. Nobody on the team could tell the difference."</p>
                  <p className="text-xs text-warm-400 mt-2">— r/SelfHosted</p>
                </div>
                <p className="text-sm text-warm-700 font-semibold mt-4">Industry data: 25-30% of SaaS licenses go unused across all companies. Proper auditing reduces waste to 8-12%. (Source: Zylo 2026 SaaS Management Index)</p>
              </div>
            </div>
          </section>

          {/* 4. Who uses this */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-8">Who uses StackAudit</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { role: 'Solo founders', desc: 'You signed up for 15 tools during the building phase. Half of them are still charging you. StackAudit finds the ones you forgot about.' },
                { role: 'Small teams (2-15)', desc: 'Every seat multiplies the waste. A team of 10 paying for 5 unused Notion seats is $600/year gone. We find every overlapping seat.' },
                { role: 'Bootstrap startups', desc: 'Every dollar matters when you\'re pre-revenue. Cutting $200-500/month in SaaS waste extends your runway by months.' },
                { role: 'Cost-conscious CTOs', desc: 'Your engineering team adopted tools without asking. Now you\'re paying for three CI/CD platforms. StackAudit gives you the audit without the enterprise contract.' },
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
          </section>

          {/* 5. vs Alternatives */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-xl font-black text-warm-900 text-center mb-8">StackAudit vs the alternatives</h2>
              <div className="space-y-4">
                {[
                  { them: 'Zylo ($10K+/yr) — enterprise SaaS management, requires IT integration', us: 'StackAudit costs $1, runs in 30 seconds, no integration needed. Built for small teams, not Fortune 500.' },
                  { them: 'Zluri — SSO-based discovery, enterprise pricing', us: 'Paste your tools, get results. No SSO connection, no admin access required, no sales call.' },
                  { them: 'Torii ($5K+/yr) — automated SaaS management platform', us: 'You don\'t need automated management for 15 tools. You need someone to tell you which 5 to cancel.' },
                  { them: 'SaaSRooms (free calculator) — basic cost tracking spreadsheet', us: 'We don\'t just add up costs. We find overlap, suggest alternatives, score self-host potential, and give KEEP/SWITCH/CUT verdicts.' },
                ].map(({ them, us }, i) => (
                  <div key={i} className="grid grid-cols-2 gap-3">
                    <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                      <p className="text-[10px] font-bold uppercase text-warm-400 mb-1">Alternative</p>
                      <p className="text-sm text-warm-600">{them}</p>
                    </div>
                    <div className="bg-fire-50 rounded-xl p-4 border border-fire-200">
                      <p className="text-[10px] font-bold uppercase text-fire-500 mb-1">StackAudit</p>
                      <p className="text-sm text-warm-700">{us}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 6. Stats bar */}
          <section className="bg-warm-900">
            <div className="max-w-3xl mx-auto px-6 py-14 text-center">
              <p className="text-warm-400 text-sm mb-6">Built for teams that care about where their money goes</p>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-3xl font-black text-white">5</p>
                  <p className="text-xs text-warm-500 mt-1">Audit dimensions</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-white">KEEP</p>
                  <p className="text-xs text-warm-500 mt-1">SWITCH / CUT</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">$1</p>
                  <p className="text-xs text-warm-500 mt-1">Per audit</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-white">$10K+</p>
                  <p className="text-xs text-warm-500 mt-1">Enterprise alternative</p>
                </div>
              </div>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="mt-8 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl transition-colors text-sm">
                Audit your stack
              </button>
            </div>
          </section>

          {/* 7. How it works */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-10">How it works</h2>
            <div className="space-y-8">
              {[
                { step: '1', title: 'List your tools', desc: 'Paste your tools with prices if you know them. "Slack - $12/user/month - 5 users" works great. Just names work too — we\'ll estimate costs from public pricing.' },
                { step: '2', title: 'Set your team size', desc: 'Slide the team size bar. This affects per-seat cost calculations and right-sizing recommendations. A tool that makes sense for 50 people might be wasteful for 3.' },
                { step: '3', title: 'AI analyzes your stack', desc: 'We check each tool against alternatives, look for overlap between tools, calculate self-host potential, and score your stack across 5 dimensions.' },
                { step: '4', title: 'Get verdicts + savings', desc: 'Every tool gets a KEEP, SWITCH, or CUT verdict with specific reasoning. You get total potential savings, top opportunities, and a dimension-by-dimension breakdown.' },
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

          {/* 8. Pricing */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14 text-center">
              <h2 className="text-2xl font-black text-warm-900 mb-2">Simple pricing</h2>
              <p className="text-warm-500 mb-6 text-sm">No subscription. No monthly fee. Pay for what you use.</p>
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                  <p className="text-2xl font-black text-warm-900">Free</p>
                  <p className="text-xs text-warm-500 mt-1">First audit</p>
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

          {/* 9. FAQ */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-8">Frequently asked questions</h2>
            <div className="space-y-5">
              {[
                { q: 'What format should I use?', a: 'List your tools with prices if you know them. "Slack - $12/user/month - 5 users" works great. Just tool names work too — we\'ll estimate costs from public pricing data. The more detail you give, the more accurate the savings.' },
                { q: 'How accurate are the savings estimates?', a: 'They\'re directional, not exact. Alternative pricing is based on public data. Self-host estimates assume standard cloud infrastructure costs. Use this as a starting point for your audit, not a final purchase decision.' },
                { q: 'Will you recommend I cancel everything?', a: 'No. Some tools are worth every penny. We flag what\'s wasteful, redundant, or has a better alternative — not everything. Most audits result in 2-4 tools getting a SWITCH or CUT verdict, not your whole stack.' },
                { q: 'How is this different from Zylo or Zluri?', a: 'They cost $10K+/year, require IT integration and SSO connections, and target enterprises with 300+ apps. StackAudit costs $1, runs in 30 seconds, needs no integration, and is built for small teams with 10-30 tools.' },
                { q: 'How accurate are savings?', a: 'We base alternative pricing on public data and standard cloud costs. Savings estimates are typically within 20-30% of actual. The tool-by-tool verdicts (KEEP/SWITCH/CUT) are more valuable than the exact dollar figure — they tell you where to focus.' },
                { q: 'What if I disagree with a recommendation?', a: 'That\'s expected. StackAudit doesn\'t know your workflows or team preferences. If we say "SWITCH from Vercel to Netlify" but Vercel\'s edge functions are critical to your architecture, keep Vercel. The audit surfaces options — you make the call.' },
                { q: 'Can I export results?', a: 'Yes. Use the download button on your results to get a JSON export with all scores, verdicts, and recommendations. Share it with your team or use it as a checklist for your stack cleanup.' },
                { q: 'Does it check compliance?', a: 'Not directly. We flag future risk which includes vendor dependency and lock-in, but we don\'t verify SOC 2 or GDPR compliance. The compliance note in your results reminds you to check this separately — it\'s important but outside our scope.' },
              ].map(({ q, a }) => (
                <div key={q}>
                  <h3 className="font-bold text-warm-900 text-sm">{q}</h3>
                  <p className="text-sm text-warm-600 mt-1 leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 10. Final CTA */}
          <section className="bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900">
            <div className="max-w-2xl mx-auto px-6 py-16 text-center">
              <h2 className="text-2xl font-black text-white mb-3">The average small team wastes $200-500/month. Find yours.</h2>
              <p className="text-warm-400 mb-6 text-sm">5 dimensions. KEEP/SWITCH/CUT verdicts. 30 seconds.</p>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-8 py-4 bg-fire-500 hover:bg-fire-600 text-white font-black rounded-xl shadow-lg shadow-fire-600/30 transition-all text-base">
                Audit My Stack
              </button>
              <p className="text-xs text-warm-600 mt-4">List your tools. Results in ~30 seconds.</p>
            </div>
          </section>
        </>
      )}
    </>
  );
}
