import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { track } from '../hooks/usePageView.js';
import { ToolHero, ScoreCard, SectionBreakdown, CrossPromo } from '../components/tool-page/index.js';

// ── Inline sub-components for tutorial sections ──────────────────────────────

function CopyPromptCard({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }
  return (
    <button onClick={copy}
      className="group text-left bg-white hover:bg-fire-50 border border-warm-200/60 hover:border-fire-300 rounded-xl p-4 transition-all w-full">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-fire-500">{label}</span>
        <span className={`text-[10px] font-bold uppercase transition-colors ${copied ? 'text-green-600' : 'text-warm-400 group-hover:text-fire-500'}`}>
          {copied ? 'Copied!' : 'Copy'}
        </span>
      </div>
      <pre className="text-xs text-warm-700 font-mono leading-relaxed whitespace-pre-wrap">{text}</pre>
    </button>
  );
}

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
    track('view_tool', { tool: 'stack-audit' });
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

      <ToolHero title="Find waste in your SaaS stack" tagline="Paste your tools. AI finds overlap, cheaper alternatives, and exactly how much you can save." toolSlug="stack-audit">
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
          <ScoreCard score={result.total_score} grade={result.grade} verdict={result.roast} toolName="StackAudit" toolSlug="stack-audit" />

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

          {/* ── Tutorial & example-heavy sections ──────────────────────── */}

          {/* Step-by-step guide */}
          <section className="bg-warm-100/40 border-y border-warm-200/40">
            <div className="max-w-5xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Step by step</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">How to use StackAudit — step by step</h2>
                <p className="mt-3 text-base text-warm-600">Five steps. No integrations, no SSO, no sales calls.</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { n: 1, icon: '📋', title: 'Export your tool list', desc: 'Pull from your billing dashboard or bank statement.', ex: 'Slack, Notion, Vercel, Figma, Zapier...' },
                  { n: 2, icon: '💸', title: 'Add prices if you know them', desc: 'Format: Name - $X/user/month - Y users.', ex: 'Slack - $12/user/month - 8 users' },
                  { n: 3, icon: '👥', title: 'Set your team size', desc: 'Slide the bar. Affects per-seat right-sizing.', ex: 'Team of 8 → 8 on the slider' },
                  { n: 4, icon: '🔍', title: 'Run the audit', desc: 'We score overlap, cost, complexity, self-host, risk.', ex: '~30 seconds to analyze 15-20 tools' },
                  { n: 5, icon: '✂️', title: 'Act on KEEP/SWITCH/CUT', desc: 'Work the CUT list first — fastest savings.', ex: 'Cancel 2 tools → save $340/mo' },
                ].map(s => (
                  <div key={s.n} className="bg-white rounded-2xl border border-warm-200/60 p-5 relative">
                    <span className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-fire-500 text-white flex items-center justify-center text-sm font-black shadow-md">{s.n}</span>
                    <div className="text-3xl mb-3" aria-hidden="true">{s.icon}</div>
                    <h3 className="text-sm font-black text-warm-900 mb-1">{s.title}</h3>
                    <p className="text-xs text-warm-600 leading-relaxed mb-3">{s.desc}</p>
                    <div className="bg-warm-50 rounded-lg px-3 py-2 border border-warm-100">
                      <p className="text-[10px] font-bold uppercase text-warm-400 mb-0.5">Example</p>
                      <p className="text-xs text-warm-700 font-mono leading-snug">{s.ex}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Worked examples gallery */}
          <section className="bg-white border-b border-warm-200/40">
            <div className="max-w-4xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Worked examples</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Four real stacks, audited</h2>
                <p className="mt-3 text-base text-warm-600">Realistic inputs. Real savings. See where the waste hides.</p>
              </div>
              <div className="space-y-6">
                {[
                  {
                    tag: '5-person startup',
                    icon: '🚀',
                    name: 'Seed-stage B2B SaaS',
                    input: 'Slack - $12/user/month - 5 users\nNotion - $10/user/month - 5 users\nLinear - $8/user/month - 5 users\nGitHub Team - $4/user/month - 4 users\nVercel Pro - $20/month\nSupabase Pro - $25/month\nFigma Pro - $15/user/month - 3 users\nZoom Pro - $16/user/month - 5 users\nLoom Business - $12/user/month - 5 users\nMailchimp - $35/month\nMixpanel Growth - $25/month\nZapier Pro - $49/month',
                    output: 'Monthly spend: $642  |  Annual: $7,704\nPotential savings: $284/mo  ($3,408/yr)\n\nKEEP:   Slack, GitHub, Vercel, Supabase, Figma (5)\nSWITCH: Mailchimp → Resend ($20/mo → $0), Mixpanel → PostHog\nCUT:    Loom (overlap w/ Slack huddles), Zapier (low usage),\n        Zoom Pro (Google Meet already in use)\n\nTop savings:\n  1. Cut Loom Business: save $60/mo (5 seats, barely used)\n  2. Switch Mailchimp → Resend: save $35/mo (under 1k contacts)\n  3. Drop Zapier: save $49/mo (replace w/ 3 Supabase edge fns)',
                    takeaway: 'Classic overlap pattern: Loom + Slack huddles, Zoom + Meet, Mixpanel + PostHog. $284/mo = ~1 month of runway per quarter.',
                  },
                  {
                    tag: 'Solo consultant',
                    icon: '💼',
                    name: 'Fractional CMO (1 person)',
                    input: 'Google Workspace - $18/month\nNotion - $10/month\nCalendly Pro - $12/month\nZoom Pro - $16/month\nLoom Business - $12/month\nCanva Pro - $15/month\nGrammarly Premium - $12/month\nAhrefs Lite - $99/month\nBuffer Essentials - $15/month\nStripe Atlas - $0 (one-time paid)\nMercury - $0 (free tier)',
                    output: 'Monthly spend: $209  |  Annual: $2,508\nPotential savings: $127/mo  ($1,524/yr)\n\nKEEP:   Google Workspace, Mercury, Stripe, Calendly\nSWITCH: Loom → Granola (free), Ahrefs Lite → SEranking ($39/mo),\n        Buffer → free Bluesky/LinkedIn manual\nCUT:    Grammarly (Apple built-in writes fine),\n        Zoom Pro (Google Meet covers 1:1s)\n\nTop savings:\n  1. Downgrade Ahrefs → SEranking: save $60/mo\n  2. Cut Grammarly + Zoom Pro: save $28/mo\n  3. Replace Loom: save $12/mo',
                    takeaway: 'Solo operators over-tool. $127/mo is nearly a Mercury credit card payment. Ahrefs downgrade alone covers 6 months of all other tools.',
                  },
                  {
                    tag: 'Agency',
                    icon: '🏢',
                    name: '12-person marketing agency',
                    input: 'Google Workspace - $18/user/month - 12 users\nSlack Pro - $7.25/user/month - 12 users\nNotion Team - $10/user/month - 12 users\nClickUp Business - $12/user/month - 12 users\nAsana Premium - $11/user/month - 8 users\nHubSpot Professional - $800/month\nAhrefs Standard - $199/month\nSEMrush Guru - $229/month\nCanva Teams - $30/month\nFigma Pro - $15/user/month - 6 users\nLoom Business - $12/user/month - 12 users\nHarvest - $12/user/month - 12 users\nDropbox Business - $20/user/month - 12 users',
                    output: 'Monthly spend: $2,873  |  Annual: $34,476\nPotential savings: $891/mo  ($10,692/yr)\n\nKEEP:   Google Workspace, Slack, HubSpot, Figma, Harvest\nSWITCH: ClickUp + Asana → just Asana (save $144/mo),\n        Dropbox → Google Drive (save $240/mo)\nCUT:    Ahrefs OR SEMrush (overlap), Loom (Slack huddles)\n\nTop savings:\n  1. Pick one PM tool: save $144/mo (two overlapping for 8+ users)\n  2. Drop Dropbox: save $240/mo (Google Drive already paid)\n  3. Consolidate Ahrefs/SEMrush: save $229/mo\n  4. Cut Loom seats: save $144/mo',
                    takeaway: 'Agencies accumulate tools during client campaigns that never get cancelled. Overlap between PM tools + SEO tools = biggest wins.',
                  },
                  {
                    tag: 'E-commerce operator',
                    icon: '🛒',
                    name: 'DTC Shopify store (3 people)',
                    input: 'Shopify Advanced - $299/month\nKlaviyo - $150/month\nGorgias Basic - $60/month\nJudge.me - $15/month\nRecharge - $60/month\nReturnly - $149/month\nTripleWhale - $129/month\nNorthbeam - $500/month\nAfterShip - $119/month\nCanva Pro - $15/month\nGoogle Workspace - $18/user - 3 users\nNotion - $10/user - 3 users',
                    output: 'Monthly spend: $1,580  |  Annual: $18,960\nPotential savings: $608/mo  ($7,296/yr)\n\nKEEP:   Shopify, Klaviyo, Gorgias, Judge.me, Recharge\nSWITCH: Northbeam → TripleWhale only (save $500/mo — overlap),\n        Returnly → Loop ($59/mo, save $90/mo)\nCUT:    AfterShip (Shopify Shipping covers it for your volume)\n\nTop savings:\n  1. Pick ONE attribution tool: save $500/mo (TripleWhale OR Northbeam)\n  2. Cut AfterShip: save $119/mo at your volume\n  3. Switch Returnly: save $90/mo',
                    takeaway: 'E-commerce stacks accumulate attribution tools during ad-scaling phases. One attribution platform is enough — pick the cheaper one.',
                  },
                ].map((ex, i) => (
                  <div key={i} className="bg-warm-50/60 rounded-2xl border border-warm-200/60 overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-warm-200/60">
                      <span className="text-2xl" aria-hidden="true">{ex.icon}</span>
                      <div className="flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-fire-500">{ex.tag}</span>
                        <h3 className="text-base font-black text-warm-900">{ex.name}</h3>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-warm-200/60">
                      <div className="p-5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-warm-400 mb-2">Input stack</p>
                        <pre className="text-xs text-warm-700 font-mono leading-relaxed whitespace-pre-wrap">{ex.input}</pre>
                      </div>
                      <div className="p-5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-fire-500 mb-2">StackAudit output</p>
                        <pre className="text-xs text-warm-800 font-mono leading-relaxed whitespace-pre-wrap">{ex.output}</pre>
                      </div>
                    </div>
                    <div className="px-5 py-4 bg-fire-50/60 border-t border-fire-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-fire-600 mb-1">Key takeaway</p>
                      <p className="text-sm text-warm-800 leading-relaxed">{ex.takeaway}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Try these prompts */}
          <section className="bg-warm-100/40 border-b border-warm-200/40">
            <div className="max-w-4xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Starter pack</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Try these stacks</h2>
                <p className="mt-3 text-base text-warm-600">Click any card to copy. Paste into the tools field above.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  { label: 'Indie SaaS', text: 'Vercel Pro - $20/month\nSupabase Pro - $25/month\nGitHub Pro - $4/month\nLinear - $8/month\nStripe - $0\nPostHog - $0\nResend - $20/month' },
                  { label: '5-person startup', text: 'Slack - $12/user/month - 5 users\nNotion - $10/user/month - 5 users\nLinear - $8/user/month - 5 users\nGitHub Team - $4/user/month - 5 users\nVercel Pro - $20/month\nFigma Pro - $15/user/month - 3 users\nZoom Pro - $16/user/month - 5 users\nMailchimp - $35/month' },
                  { label: 'Solo consultant', text: 'Google Workspace - $18/month\nNotion - $10/month\nCalendly Pro - $12/month\nZoom Pro - $16/month\nLoom - $12/month\nCanva Pro - $15/month\nGrammarly - $12/month\nAhrefs Lite - $99/month' },
                  { label: 'Agency (10)', text: 'Google Workspace - $18/user/month - 10 users\nSlack Pro - $7.25/user/month - 10 users\nClickUp Business - $12/user/month - 10 users\nHubSpot Pro - $800/month\nAhrefs Standard - $199/month\nSEMrush Guru - $229/month\nFigma Pro - $15/user/month - 5 users\nCanva Teams - $30/month' },
                  { label: 'E-commerce', text: 'Shopify Advanced - $299/month\nKlaviyo - $150/month\nGorgias - $60/month\nRecharge - $60/month\nTripleWhale - $129/month\nNorthbeam - $500/month\nReturnly - $149/month\nJudge.me - $15/month' },
                  { label: 'Bootstrap dev', text: 'GitHub Pro - $4/month\nNetlify - $0\nRender - $7/month\nTurso - $0\nCloudflare - $0\nSentry - $26/month\nPlausible - $9/month' },
                  { label: 'Design studio', text: 'Figma Pro - $15/user/month - 4 users\nAdobe CC - $60/user/month - 4 users\nDropbox Business - $20/user/month - 4 users\nNotion - $10/user/month - 4 users\nCanva Teams - $30/month\nMiro Team - $10/user/month - 4 users' },
                  { label: 'Content team', text: 'Notion Team - $10/user/month - 6 users\nGrammarly Business - $15/user/month - 6 users\nAhrefs Standard - $199/month\nSurferSEO - $89/month\nCanva Pro - $15/month\nFrase - $45/month\nMailerLite - $15/month' },
                ].map((p, i) => (
                  <CopyPromptCard key={i} label={p.label} text={p.text} />
                ))}
              </div>
            </div>
          </section>

          {/* What great output looks like */}
          <section className="bg-white border-b border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Calibrate your expectations</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">What great output looks like</h2>
                <p className="mt-3 text-base text-warm-600">An annotated audit so you know what to act on first.</p>
              </div>
              <div className="bg-warm-50/60 rounded-2xl border border-warm-200/60 p-6 space-y-5">
                <div className="flex items-start gap-4">
                  <span className="text-3xl" aria-hidden="true">💰</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-fire-500 mb-1">Savings banner (big green number)</p>
                    <p className="text-sm text-warm-700">Your potential monthly + annual savings. This is the most important number on the page. Track the delta across audits.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-3xl" aria-hidden="true">🏆</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-fire-500 mb-1">Top savings opportunities (numbered)</p>
                    <p className="text-sm text-warm-700">The 3-5 highest-impact moves, ordered by dollar savings. Start here. Each one has a concrete action and an estimated monthly save.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-3xl" aria-hidden="true">🏷️</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-fire-500 mb-1">KEEP / SWITCH / CUT verdict per tool</p>
                    <p className="text-sm text-warm-700">Every tool gets a verdict with reasoning. KEEP = worth it. SWITCH = there\'s a better/cheaper alternative. CUT = redundant or underused. The explanation matters as much as the verdict.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-3xl" aria-hidden="true">📊</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-fire-500 mb-1">5-dimension score breakdown</p>
                    <p className="text-sm text-warm-700">Cost (30), Overlap (25), Self-Host (20), Complexity (15), Future Risk (10). Your lowest-scoring dimension tells you the pattern behind your waste.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-3xl" aria-hidden="true">🔥</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-fire-500 mb-1">Roast line + compliance note</p>
                    <p className="text-sm text-warm-700">A witty one-liner that captures the biggest pattern, plus a reminder to verify SOC 2 / GDPR on the tools you keep.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Common mistakes + fixes */}
          <section className="bg-warm-100/40 border-b border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Don't do these</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Common mistakes + fixes</h2>
                <p className="mt-3 text-base text-warm-600">The patterns that leave real money on the table.</p>
              </div>
              <div className="space-y-3">
                {[
                  { q: 'Only listing tools you remember paying for', a: 'Pull your last 3 months of credit card statements. You\'ll find 2-4 subscriptions you completely forgot about. The forgotten ones are almost always 100% waste.' },
                  { q: 'Not listing unused seats', a: 'A tool at $12/user billed for 10 users when only 4 use it = $72/month waste. Always list actual active users vs billed seats. The audit finds more savings when you\'re honest about usage.' },
                  { q: 'Keeping tools "just in case"', a: '"Just in case" is the most expensive phrase in SaaS. If you haven\'t used it in 60 days, cancel it. You can re-sign up in 5 minutes if you need it back.' },
                  { q: 'Ignoring overlap because each tool has "one unique feature"', a: 'Every tool has one unique feature. That\'s how they stay alive. But if you have 3 PM tools and you mostly use the task list in each, pick one and migrate.' },
                  { q: 'Auditing once per year instead of quarterly', a: 'SaaS pricing increases and new subscriptions both compound. Audit quarterly — at $1 per audit, it costs less than a coffee and catches creep before it becomes a budget meeting.' },
                  { q: 'Cancelling without migrating data first', a: 'Export first. Then wait 30 days. Then cancel. Many tools will offer a retention discount when you start the cancellation flow — take it or leave it on your terms.' },
                  { q: 'Chasing self-host savings that cost more in engineering time', a: 'Self-hosting Plausible saves $9/mo but costs 3 hours/month in maintenance. At any dev rate, that\'s a loss. Only self-host where the engineering time is negligible.' },
                ].map((m, i) => (
                  <details key={i} className="group bg-white rounded-xl border border-warm-200/60 hover:border-fire-300 transition-colors">
                    <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-5 py-4">
                      <span className="text-sm font-bold text-warm-900">{m.q}</span>
                      <svg className="w-4 h-4 text-warm-400 transition-transform group-open:rotate-180 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </summary>
                    <p className="px-5 pb-4 text-sm text-warm-600 leading-relaxed">{m.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ accordion */}
          <section className="bg-white border-b border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">FAQ</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Questions about StackAudit</h2>
              </div>
              <div className="space-y-3">
                {[
                  { q: 'What does StackAudit actually check?', a: 'We run your tool list through 5 dimensions: Cost Efficiency (30pts), Tool Overlap (25pts), Self-Host Potential (20pts), Stack Complexity (15pts), Future Risk (10pts). Each tool gets a KEEP/SWITCH/CUT verdict with reasoning.' },
                  { q: 'How much does it cost?', a: '$1 per audit (1 credit). Or 7 credits for $5. Credits work across all 10 bilko.run tools and never expire. First audit is free while you try the tool out.' },
                  { q: 'Is my tool list stored?', a: 'We log the list + verdicts for analytics only. We never share your stack with anyone. No vendor ever sees what tools you listed. Keep secrets out of the field — list tool names, not API keys.' },
                  { q: 'How accurate are the savings estimates?', a: 'Directionally correct within ±20-30%. Alternative pricing is based on public pricing pages as of 2026. Your actual savings depend on your negotiation, usage, and migration effort.' },
                  { q: 'How is this different from ChatGPT?', a: 'ChatGPT gives you a generic "here are cheaper alternatives" answer. StackAudit runs a structured 5-dimension rubric, gives specific dollar savings per tool, and returns KEEP/SWITCH/CUT verdicts you can act on immediately.' },
                  { q: 'Does it work for my industry?', a: 'Works well for: SaaS, agencies, consultancies, e-commerce, marketing teams, dev teams. Less useful for: heavily-regulated industries (banking, healthcare) where tool choice is compliance-constrained.' },
                  { q: 'Will you recommend cancelling everything?', a: 'No. Most audits result in 2-5 tools getting SWITCH or CUT — not your whole stack. Some tools are genuinely worth every penny. We only flag waste, not purity.' },
                  { q: 'Can I export the audit?', a: 'Yes. Use the download button on your results to get a JSON file with all verdicts, scores, and reasoning. Share with your team or use as your cancellation checklist.' },
                  { q: 'How often should I re-audit?', a: 'Quarterly. SaaS pricing increases + new subscriptions both compound silently. A quarterly audit catches creep before your annual budget review.' },
                  { q: 'Does it check SOC 2 / GDPR?', a: 'Not directly. We flag vendor lock-in and future risk, but compliance verification is out of scope. The compliance note in your results reminds you to check separately.' },
                ].map((f, i) => (
                  <details key={i} className="group bg-warm-50/60 rounded-xl border border-warm-200/60 hover:border-fire-300 transition-colors">
                    <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-5 py-4">
                      <span className="text-sm font-bold text-warm-900">{f.q}</span>
                      <svg className="w-4 h-4 text-warm-400 transition-transform group-open:rotate-180 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </summary>
                    <p className="px-5 pb-4 text-sm text-warm-600 leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* Use cases by role */}
          <section className="bg-warm-100/40 border-b border-warm-200/40">
            <div className="max-w-5xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">By role</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Use cases by role</h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: '🧑‍💻', role: 'Founder', desc: 'Audit your stack before your next fundraise or budget review. Cut $200-500/mo before the board meeting. Extend runway without hiring freezes.' },
                  { icon: '📣', role: 'Marketer', desc: 'Audit your martech stack (Mailchimp, HubSpot, ad platforms). Find overlapping analytics tools. Consolidate vendor logos in your budget line.' },
                  { icon: '💼', role: 'Freelancer', desc: 'Solo operators over-tool. Audit once per quarter, cancel what you forgot. Offer stack audits to clients as a deliverable in your engagement.' },
                  { icon: '🏢', role: 'Agency', desc: 'Every client engagement adds tools. Audit quarterly to cancel old client access. Use audits as a discovery deliverable for new clients.' },
                ].map(p => (
                  <div key={p.role} className="bg-white rounded-2xl border border-warm-200/60 p-5 hover:border-fire-300 transition-colors">
                    <div className="text-3xl mb-3" aria-hidden="true">{p.icon}</div>
                    <h3 className="text-base font-black text-warm-900 mb-2">{p.role}</h3>
                    <p className="text-sm text-warm-600 leading-relaxed">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Tips to get better results */}
          <section className="bg-white border-b border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Better inputs, better savings</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Tips to get better results</h2>
              </div>
              <ol className="space-y-5">
                {[
                  { t: 'Pull from your billing dashboard, not memory.', d: 'The tools you forget about are the ones bleeding money. Export your subscriptions from your bank or Stripe/PayPal billing history.' },
                  { t: 'List actual active users, not billed seats.', d: 'Unused seats are the fastest savings. "Billed for 10, 4 actually use it" flags as a CUT opportunity.' },
                  { t: 'Include price per user explicitly.', d: 'Format: "Slack - $12/user/month - 8 users" gives us the best analysis. Ambiguous price strings get ambiguous verdicts.' },
                  { t: 'Audit quarterly, not annually.', d: 'SaaS creep is a slow leak. Catching it every 3 months prevents the panic budget meeting.' },
                  { t: 'Act on CUTs first, SWITCHes second.', d: 'CUTs are free — cancel and done. SWITCHes cost migration time. Prioritize by savings-per-hour-of-effort.' },
                  { t: 'Do the cancellation dance.', d: 'Click "cancel" in each tool before actually cancelling. 60% of tools offer 20-40% retention discounts. Take the discount or cancel anyway.' },
                  { t: 'Keep a "cut list" between audits.', d: 'If you\'re not sure about a tool, pause it for 30 days. If no one screams, cancel. If they do, you know it\'s a KEEP.' },
                  { t: 'Share the audit with your finance person.', d: 'The savings number is the conversation-starter. Download the JSON and send it — they\'ll approve the cuts faster than a slide deck.' },
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-fire-100 text-fire-700 flex items-center justify-center text-sm font-black">{i + 1}</span>
                    <div>
                      <p className="text-sm font-bold text-warm-900">{tip.t}</p>
                      <p className="text-sm text-warm-600 mt-1 leading-relaxed">{tip.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* Related tools */}
          <section className="bg-warm-100/40 border-b border-warm-200/40">
            <div className="max-w-5xl mx-auto px-6 py-16">
              <div className="max-w-2xl mx-auto text-center mb-10">
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Tools that pair with this</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Related tools</h2>
                <p className="mt-3 text-base text-warm-600">Same credits. Different problem.</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { slug: 'launch-grader', emoji: '🚀', name: 'LaunchGrader', desc: 'Audit your go-to-market readiness. Combine with StackAudit to cut costs before launch day.' },
                  { slug: 'page-roast', emoji: '🔥', name: 'PageRoast', desc: 'Landing page CRO audit. Trim the stack, then trim the page.' },
                  { slug: 'email-forge', emoji: '✉️', name: 'EmailForge', desc: 'Replace your $150/mo Mailchimp copywriter with a 5-email generator. Stack savings compound.' },
                  { slug: 'ad-scorer', emoji: '🎯', name: 'AdScorer', desc: 'Grade your ads before you spend on them. Stack savings + better ads = better unit economics.' },
                ].map(t => (
                  <Link key={t.slug} to={`/projects/${t.slug}`} className="group bg-white rounded-2xl border border-warm-200/60 hover:border-fire-300 hover:shadow-md p-5 transition-all">
                    <div className="text-3xl mb-3" aria-hidden="true">{t.emoji}</div>
                    <h3 className="text-base font-black text-warm-900 mb-1 group-hover:text-fire-600 transition-colors">{t.name}</h3>
                    <p className="text-sm text-warm-600 leading-relaxed">{t.desc}</p>
                    <p className="mt-3 text-xs font-bold text-fire-500 group-hover:text-fire-600">Open tool &rarr;</p>
                  </Link>
                ))}
              </div>
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
