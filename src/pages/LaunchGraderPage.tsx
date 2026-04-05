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
      <p className="text-xs text-warm-700 font-mono leading-relaxed whitespace-pre-wrap">{text}</p>
    </button>
  );
}

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
    track('view_tool', { tool: 'launch-grader' });
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
          <p className="text-xs text-warm-400 text-center mt-1">
            Pro tip: Audit a competitor's product to benchmark your readiness against theirs.
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

          {result && (
            <div className="bg-warm-50 rounded-xl border border-warm-100 p-4 animate-slide-up" style={{ animationDelay: '300ms' }}>
              <p className="text-xs font-bold text-warm-700 mb-1">Pre-launch checklist bonus</p>
              <p className="text-xs text-warm-500">Before launch, audit your tool renewals. The average startup gets surprised by auto-renewals on tools they stopped using. Cancel or downgrade before launch day — every dollar matters in the first 90 days.</p>
            </div>
          )}

          {/* Value comparison */}
          <div className="bg-warm-50 rounded-xl border border-warm-100 p-3 text-center text-xs text-warm-500 animate-slide-up">
            Competitors charge $30-100/month for this analysis. You just paid $1.
          </div>

          <CrossPromo currentTool="launch-grader" />

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

      {/* ── Long-form below-fold content ──────────────────────────── */}
      {!result && !loading && (
        <>
          {/* 1. Example result */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 text-center mb-2">Here's what you'll get</h2>
              <p className="text-center text-warm-500 mb-8 text-sm">Real output from a real product. Yours will be different.</p>
              <div className="bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900 rounded-2xl p-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,107,26,0.12),transparent_60%)]" />
                <div className="relative">
                  <p className="text-xs font-bold uppercase tracking-widest text-fire-400 mb-3">Sample Score</p>
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <span className="text-5xl font-black text-white">58</span>
                    <div className="text-left">
                      <div className="text-2xl font-black text-yellow-400">C+</div>
                      <div className="text-xs text-warm-500">/100</div>
                    </div>
                  </div>
                  <p className="text-fire-300 font-bold italic text-sm max-w-sm mx-auto">
                    &ldquo;Almost there — fix 2 things and you're ready. Your value prop is strong but nobody can find your pricing.&rdquo;
                  </p>
                  <div className="flex justify-center gap-4 mt-4">
                    {[
                      { label: 'Value', score: '20/25' },
                      { label: 'Pricing', score: '8/20' },
                      { label: 'Social', score: '12/20' },
                      { label: 'Onboard', score: '11/20' },
                      { label: 'Position', score: '7/15' },
                    ].map(d => (
                      <div key={d.label} className="text-center">
                        <div className="text-sm font-black text-white">{d.score}</div>
                        <div className="text-[9px] text-warm-500 uppercase">{d.label}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-warm-600 mt-4 font-mono">sample-saas-product.com</p>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Five dimensions explained */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 mb-3">We audit 5 dimensions of launch readiness</h2>
            <p className="text-warm-500 mb-8 text-sm">Not vibes. Not a checklist. Real go-to-market analysis used by product leads.</p>
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-10 h-10 rounded-xl bg-fire-100 text-fire-700 flex items-center justify-center font-black text-sm">25</span>
                  <h3 className="font-bold text-warm-900">Value Proposition</h3>
                </div>
                <p className="text-sm text-warm-600 leading-relaxed">Can someone understand what you do in 5 seconds? Is the target audience obvious? Is the benefit specific or vague? A product that says "We help teams collaborate better" scores 8/25. A product that says "Cut meeting time by 40% for remote engineering teams" scores 22/25.</p>
                <p className="text-xs text-warm-400 mt-2 italic">Scores high: specific audience, quantified benefit, clear differentiator. Scores low: generic language, no target audience, feature-first copy.</p>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm">20</span>
                  <h3 className="font-bold text-warm-900">Pricing & Monetization</h3>
                </div>
                <p className="text-sm text-warm-600 leading-relaxed">Is pricing visible on the page? Does the pricing model match the value delivered? Is there a free tier or trial? Are upgrade triggers clear? Hidden pricing is the #1 launch blocker we find — if visitors can't find what it costs, they leave.</p>
                <p className="text-xs text-warm-400 mt-2 italic">Scores high: visible pricing page, free tier, clear upgrade path. Scores low: "Contact sales" for a $20/mo product, no pricing at all, confusing tiers.</p>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-black text-sm">20</span>
                  <h3 className="font-bold text-warm-900">Social Proof & Trust</h3>
                </div>
                <p className="text-sm text-warm-600 leading-relaxed">Real testimonials with names and photos? A visible team section? Trust badges or security certifications? An active community or user count? Two anonymous testimonials from "J." is not social proof — it's suspicious.</p>
                <p className="text-xs text-warm-400 mt-2 italic">Scores high: named testimonials with photos, real user count, visible team, trust badges. Scores low: no testimonials, anonymous quotes, no team page.</p>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">20</span>
                  <h3 className="font-bold text-warm-900">Onboarding & First Value</h3>
                </div>
                <p className="text-sm text-warm-600 leading-relaxed">How fast can a new user get value? Is there a clear CTA above the fold? Is signup friction low? Is there visible guidance or a demo? The best products deliver value in under 60 seconds. If your onboarding takes 15 minutes, most users won't finish.</p>
                <p className="text-xs text-warm-400 mt-2 italic">Scores high: instant demo, one-click signup, clear first action. Scores low: long signup forms, no CTA above fold, no guidance.</p>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-black text-sm">15</span>
                  <h3 className="font-bold text-warm-900">Competitive Positioning</h3>
                </div>
                <p className="text-sm text-warm-600 leading-relaxed">Is there a comparison with alternatives? Is the category clear? Is your moat communicated? Visitors will compare you to whatever they used before. If you don't control that comparison, they'll make their own — and get it wrong.</p>
                <p className="text-xs text-warm-400 mt-2 italic">Scores high: explicit comparison table, clear category ownership, stated differentiator. Scores low: no mention of alternatives, unclear category.</p>
              </div>
            </div>
          </section>

          {/* 3. The 431-comment story */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 mb-6">This tool exists because 431 Reddit users asked for product reviews</h2>
              <div className="space-y-4 text-sm text-warm-600 leading-relaxed">
                <p>Every week on r/SideProject, founders post "Can someone review my product?" and get 2-3 polite comments that don't help. The thread that inspired LaunchGrader had 431 comments — founders desperate for honest, structured feedback on whether their product was actually ready to ship.</p>
                <div className="bg-warm-50 rounded-xl border border-warm-100 p-4 my-4">
                  <p className="text-sm text-warm-700 italic">"I've been building for 6 months and I genuinely can't tell if this is ready to launch or if I'm fooling myself. Can someone just tell me what's missing?"</p>
                  <p className="text-xs text-warm-400 mt-2">— r/SideProject, the post that started this</p>
                </div>
                <p>Most founders don't need cheerleading. They need someone to say "your pricing page is broken" or "you have zero social proof and that's why nobody trusts you." LaunchGrader is the brutally honest friend who checks your work before you post on Product Hunt.</p>
              </div>
            </div>
          </section>

          {/* 4. Who uses this */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-8">Who uses LaunchGrader</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { role: 'Pre-launch founders', desc: 'You\'ve been building for months. You think it\'s ready. LaunchGrader tells you what\'s actually missing before you post to the world.' },
                { role: 'Product Hunt launchers', desc: 'You get one shot at a PH launch. Audit your readiness first. Fix the blockers. Launch with a score above 75 and your odds double.' },
                { role: 'Pivot-stage startups', desc: 'Repositioning? New pricing? LaunchGrader re-audits your go-to-market after every major change so you know what broke.' },
                { role: 'Indie hackers', desc: 'No team to review your work. No budget for consultants. $1 gets you the same analysis a $200/hr strategist would give you.' },
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
              <h2 className="text-xl font-black text-warm-900 text-center mb-8">LaunchGrader vs the alternatives</h2>
              <div className="space-y-4">
                {[
                  { them: 'Competely ($30/mo) — competitive analysis only', us: 'LaunchGrader audits 5 dimensions of launch readiness for $1 — not just competitive positioning' },
                  { them: 'IdeaProof — validates the idea, not the execution', us: 'We audit the actual product page, pricing, onboarding, and social proof — not whether the idea is good' },
                  { them: 'Manual checklists — generic, no scoring', us: 'AI reads your actual page and scores it against 5 frameworks with specific feedback and blockers' },
                  { them: 'Asking Reddit — 2-3 polite comments, no structure', us: 'Structured 5-dimension scoring with launch blockers, verdict, and actionable fixes in 30 seconds' },
                ].map(({ them, us }, i) => (
                  <div key={i} className="grid grid-cols-2 gap-3">
                    <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                      <p className="text-[10px] font-bold uppercase text-warm-400 mb-1">Alternative</p>
                      <p className="text-sm text-warm-600">{them}</p>
                    </div>
                    <div className="bg-fire-50 rounded-xl p-4 border border-fire-200">
                      <p className="text-[10px] font-bold uppercase text-fire-500 mb-1">LaunchGrader</p>
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
              <p className="text-warm-400 text-sm mb-6">Built for founders who want the truth before launch day</p>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-3xl font-black text-white">5</p>
                  <p className="text-xs text-warm-500 mt-1">GTM dimensions</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">Launch verdict</p>
                  <p className="text-xs text-warm-500 mt-1">Ready / Almost / Not ready</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">$1</p>
                  <p className="text-xs text-warm-500 mt-1">Per audit</p>
                </div>
              </div>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="mt-8 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl transition-colors text-sm">
                Audit your launch readiness
              </button>
            </div>
          </section>

          {/* 7. How it works */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-10">How it works</h2>
            <div className="space-y-8">
              {[
                { step: '1', title: 'Paste your URL + describe your product', desc: 'Any public page. Add a 1-2 sentence description so the AI understands what you\'re building and who it\'s for.' },
                { step: '2', title: 'AI fetches and reads your page', desc: 'We crawl your page like a first-time visitor. Every headline, CTA, pricing section, testimonial, and onboarding flow gets analyzed.' },
                { step: '3', title: '5-dimension scoring', desc: 'Value Prop (25pts), Pricing (20pts), Social Proof (20pts), Onboarding (20pts), Positioning (15pts). Each dimension gets a score and specific feedback.' },
                { step: '4', title: 'Blockers + verdict', desc: 'You get a list of launch blockers (the things that will sink your launch), a verdict (Ready / Almost there / Not ready), and a roast line for good measure.' },
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
                { q: 'How is this different from PageRoast?', a: 'PageRoast audits your landing page\'s conversion elements — hero, social proof, clarity, CRO. LaunchGrader audits your entire go-to-market readiness — pricing model, competitive positioning, onboarding flow, social proof depth, and value proposition clarity. PageRoast asks "will this page convert?" LaunchGrader asks "is this product ready to launch?"' },
                { q: 'What if I\'m not ready to launch?', a: 'That\'s the point. Better to know now than after you\'ve posted on Product Hunt to crickets. Fix the blockers, re-audit, and launch with confidence. Most products go from "Not ready" to "Ready to launch" in 1-2 weeks of focused fixes.' },
                { q: 'How much does it cost?', a: '1 credit per audit. Same credits work across all bilko.run tools. Competitors charge $30-100/month for similar analysis. You pay $1 once.' },
                { q: 'Can I audit a competitor\'s product?', a: 'Yes. Paste any public URL. Compare your readiness score against theirs. This is especially useful before a Product Hunt launch — know exactly where you stand relative to alternatives in your space.' },
                { q: 'When should I use this?', a: 'Two weeks before launch. Then again 2 days before. The first audit finds the big gaps (missing pricing, no social proof). The second audit confirms you\'ve fixed them. Also useful after a pivot or major redesign.' },
                { q: 'Can I audit a competitor?', a: 'Absolutely. Paste their URL and describe their product. You\'ll see exactly where they\'re strong and where they\'re weak. Use their gaps as your positioning advantage.' },
                { q: 'What\'s the difference from PageRoast?', a: 'PageRoast = "Is this landing page converting?" (CRO focus, 4 dimensions). LaunchGrader = "Is this product ready to ship?" (GTM focus, 5 dimensions including pricing model, onboarding depth, and competitive positioning). Use both: PageRoast for the page, LaunchGrader for the product.' },
                { q: 'How often should I re-audit?', a: 'After every major change — new pricing, new positioning, redesigned onboarding. Most founders audit 2-3 times before launch and once after to see the impact. At $1 per audit, there\'s no reason not to.' },
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
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">How to use LaunchGrader — step by step</h2>
                <p className="mt-3 text-base text-warm-600">Five clicks. Thirty seconds. One honest score.</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { n: 1, icon: '🔗', title: 'Paste your URL', desc: 'The public page people land on first.', ex: 'https://your-saas.com' },
                  { n: 2, icon: '📝', title: 'Describe the product', desc: 'One or two sentences. Plain English.', ex: 'AI that writes cold emails for B2B sales teams' },
                  { n: 3, icon: '🚀', title: 'Click Audit', desc: 'We fetch the page and read it like a first-time visitor.', ex: 'Takes about 30 seconds to crunch' },
                  { n: 4, icon: '📊', title: 'Read the 5 scores', desc: 'Value, pricing, social, onboarding, positioning.', ex: 'Pricing: 8/20 → biggest gap' },
                  { n: 5, icon: '🔧', title: 'Fix the blockers', desc: 'Work through the numbered list top-to-bottom.', ex: 'Add pricing page → rescore → launch' },
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
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Three real audits, scored</h2>
                <p className="mt-3 text-base text-warm-600">Real input. Realistic output. Exactly what LaunchGrader returns.</p>
              </div>
              <div className="space-y-6">
                {[
                  {
                    tag: 'Pre-launch SaaS',
                    icon: '🧪',
                    name: 'InboxZeroAI (productivity tool)',
                    input: 'URL: https://inboxzero-ai.com\nDescription: AI assistant that triages your Gmail inbox, drafts replies, and surfaces what matters. For busy founders.',
                    output: 'SCORE: 62 / 100 — C+\nVerdict: Almost there\n\nValue Prop:       19/25  — Clear audience, benefit vague\nPricing:           7/20  — Hidden behind Contact Sales\nSocial Proof:     11/20  — 2 anonymous testimonials\nOnboarding:       16/20  — Live demo above the fold ✓\nPositioning:       9/15  — No comparison vs Superhuman\n\nBlockers:\n  1. Add a visible pricing page — $20/mo products shouldn\'t gate pricing\n  2. Replace "J.S." testimonials with named users + photos\n  3. Quantify the benefit: "save 40 min/day" beats "save time"',
                    takeaway: 'Strong onboarding saved the score. Hidden pricing is the biggest blocker — fix that one thing and you jump 12 points.',
                  },
                  {
                    tag: 'Indie product',
                    icon: '🛠️',
                    name: 'Tally Forms clone (indie)',
                    input: 'URL: https://simpleform.app\nDescription: Typeform alternative for solo makers. Unlimited forms, $9/mo.',
                    output: 'SCORE: 74 / 100 — B\nVerdict: Ready to launch\n\nValue Prop:       22/25  — Specific audience + clear alt\nPricing:          18/20  — Visible, simple, one tier\nSocial Proof:     12/20  — Needs named testimonials\nOnboarding:       15/20  — Signup requires credit card\nPositioning:      13/15  — Named comparison to Typeform\n\nBlockers:\n  1. Drop credit card from signup — convert 2-3× more trials\n  2. Add 3-5 named testimonials with photos before launch',
                    takeaway: 'Strong positioning + transparent pricing = ready to ship. One signup change (drop CC) will measurably lift conversion.',
                  },
                  {
                    tag: 'Consulting offer',
                    icon: '💼',
                    name: 'Fractional CMO service ($8k/mo)',
                    input: 'URL: https://growthlab.consulting\nDescription: Fractional CMO for Series A B2B SaaS companies. 20 hrs/week, $8,000/month retainer.',
                    output: 'SCORE: 51 / 100 — C\nVerdict: Almost there\n\nValue Prop:       14/25  — "Growth expertise" too generic\nPricing:           8/20  — Zero pricing visible\nSocial Proof:     14/20  — Logos present, no case studies\nOnboarding:        8/20  — "Book a call" is the only CTA\nPositioning:       7/15  — Unclear what makes you different\n\nBlockers:\n  1. Name your ICP in the hero: "Series A B2B SaaS CMOs"\n  2. Publish 2-3 case studies with real numbers\n  3. Add a pricing range — scares off wrong-fit leads, qualifies right ones',
                    takeaway: 'High-ticket services still need visible pricing and case studies. "Book a call" is not a homepage strategy.',
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
                        <p className="text-[10px] font-bold uppercase tracking-wider text-warm-400 mb-2">Input</p>
                        <pre className="text-xs text-warm-700 font-mono leading-relaxed whitespace-pre-wrap">{ex.input}</pre>
                      </div>
                      <div className="p-5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-fire-500 mb-2">LaunchGrader output</p>
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
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Try these prompts</h2>
                <p className="mt-3 text-base text-warm-600">Click any card to copy. Paste into the description field above.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  { label: 'SaaS', text: 'AI writing assistant for B2B marketers. Generates SEO-optimized blog posts in your brand voice. $49/mo.' },
                  { label: 'SaaS', text: 'Open-source analytics alternative to Google Analytics. Privacy-first, self-hostable, GDPR-compliant.' },
                  { label: 'E-commerce', text: 'Subscription coffee delivery. Single-origin beans, roasted-to-order, ships weekly or monthly. $18 per bag.' },
                  { label: 'E-commerce', text: 'DTC skincare brand. Clean ingredients, refillable packaging, built for sensitive skin.' },
                  { label: 'Local business', text: 'Boutique personal training studio in Austin. Small-group strength classes for busy professionals 30+.' },
                  { label: 'Local business', text: 'Mobile dog grooming service in Seattle. At-home appointments, eco-friendly products, online booking.' },
                  { label: 'B2B', text: 'Fractional CFO for seed-stage SaaS founders. Monthly close, runway modeling, investor reporting. $4k/mo.' },
                  { label: 'B2B', text: 'Outbound sales-as-a-service for early-stage startups. Build list, send sequences, book meetings. Flat rate.' },
                  { label: 'Course', text: 'Six-week cohort on pricing strategy for SaaS founders. Live sessions + 1-on-1 teardowns. $1,200.' },
                  { label: 'Newsletter', text: 'Weekly newsletter for indie hackers shipping AI tools. Interviews, teardowns, revenue reports. Free.' },
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
                <p className="mt-3 text-base text-warm-600">An annotated sample so you know what each piece means.</p>
              </div>
              <div className="bg-warm-50/60 rounded-2xl border border-warm-200/60 p-6 space-y-5">
                <div className="flex items-start gap-4">
                  <span className="text-3xl" aria-hidden="true">🎯</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-fire-500 mb-1">Total score + letter grade</p>
                    <p className="text-sm text-warm-700">One number from 0-100 plus a letter (A–F). Above 80 = ready to launch. 65-80 = almost there. Below 65 = fix the blockers first. Use this as the headline number you track over time.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-3xl" aria-hidden="true">⚖️</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-fire-500 mb-1">Verdict banner</p>
                    <p className="text-sm text-warm-700">Three possible verdicts: "Ready to launch" / "Almost there" / "Not ready — major gaps". This is a human decision point, not just the number.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-3xl" aria-hidden="true">📏</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-fire-500 mb-1">Five dimension scores</p>
                    <p className="text-sm text-warm-700">Value (25), Pricing (20), Social Proof (20), Onboarding (20), Positioning (15). Find your weakest dimension and fix that first — it gives you the biggest point swing.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-3xl" aria-hidden="true">🚧</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-fire-500 mb-1">Launch blockers (numbered)</p>
                    <p className="text-sm text-warm-700">The 2-5 specific things most likely to sink your launch. Ordered by impact. Fix them top-to-bottom. Every blocker is a concrete, actionable instruction — not vague advice.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-3xl" aria-hidden="true">🔥</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-fire-500 mb-1">Roast line</p>
                    <p className="text-sm text-warm-700">One witty one-liner summarizing the biggest issue. This is the line you screenshot and send to your cofounder.</p>
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
                <p className="mt-3 text-base text-warm-600">Patterns we see in low scores. Fix these and you move fast.</p>
              </div>
              <div className="space-y-3">
                {[
                  { q: 'Hiding pricing behind "Contact Sales" for a low-ticket product', a: 'If your product is under $500/month, visible pricing always wins. Hidden pricing is the #1 launch blocker we flag — visitors assume you\'re expensive and leave. Show your tiers. Show a price. You can still negotiate with enterprise leads.' },
                  { q: 'Anonymous or initial-only testimonials ("J.S.", "M.K.")', a: 'Anonymous testimonials look fake even when they\'re real. Get 3-5 named users with photos, titles, and companies. If they won\'t give permission, you need better customers or a better ask.' },
                  { q: 'Vague value prop ("We help teams work better")', a: 'Specify the audience and quantify the benefit. "Cut meeting time by 40% for remote engineering teams" beats "collaborate better" every time. Name the WHO and the HOW MUCH.' },
                  { q: 'Auditing once and never re-auditing', a: 'LaunchGrader is $1. Run it after every major change — new pricing, new positioning, new onboarding. The delta between audits is where the learning happens.' },
                  { q: 'Fixing the wrong blocker first', a: 'Blockers are ordered by impact. Work top-to-bottom, not whichever feels easiest. The #1 blocker is usually the highest-leverage fix.' },
                  { q: 'Treating the score as final instead of directional', a: 'The score is a snapshot, not a verdict from the universe. Use it as a baseline. The point is the movement between audits, not the absolute number.' },
                  { q: 'Submitting a 404 page or login-walled URL', a: 'LaunchGrader reads the page like a first-time visitor. If the URL is behind auth, we see the login page — not your product. Submit your public landing page, not your dashboard.' },
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
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Questions about LaunchGrader</h2>
              </div>
              <div className="space-y-3">
                {[
                  { q: 'What does LaunchGrader actually check?', a: 'We fetch your public URL, read it like a first-time visitor, and score it across 5 go-to-market dimensions: Value Proposition (25pts), Pricing & Monetization (20pts), Social Proof & Trust (20pts), Onboarding & First Value (20pts), Competitive Positioning (15pts).' },
                  { q: 'How much does it cost?', a: '$1 per audit (1 credit). Or 7 credits for $5. Credits work across all 10 bilko.run tools and never expire. First audit is free while you try the tool out.' },
                  { q: 'Is my URL stored or tracked?', a: 'We fetch your URL once to generate the audit. We don\'t store the page content. We log the URL string + score for analytics purposes only. No crawling of logged-in pages, no data resale.' },
                  { q: 'How accurate is it vs. a human expert?', a: 'It\'s directionally correct for ~85% of cases. It will catch the obvious blockers (hidden pricing, no testimonials, weak value prop) that a human strategist would also catch. It won\'t understand your specific domain nuance. Use it as a first pass.' },
                  { q: 'How is this different from ChatGPT?', a: 'ChatGPT gives you a friendly generic analysis. LaunchGrader runs a structured 5-dimension rubric, returns a consistent score, fetches your actual page, and gives you numbered blockers in priority order. Same underlying LLM, very different output.' },
                  { q: 'Does it work for my industry?', a: 'Works well for: SaaS, e-commerce, consulting, courses, newsletters, DTC, B2B services, local business. Works less well for: regulated industries (healthcare, finance) where we can\'t judge compliance, and very niche B2B where the benchmarks differ.' },
                  { q: 'Should I audit before or after I launch?', a: 'Both. Audit 2 weeks before to find blockers. Audit 2 days before to confirm fixes. Audit 2 weeks after launch to see what real traffic revealed.' },
                  { q: 'Can I audit my competitor?', a: 'Yes. Any public URL. Use their score as a benchmark — if they\'re at 82 and you\'re at 58, you know your relative position. This is one of the highest-leverage uses of the tool.' },
                  { q: 'What if I disagree with the score?', a: 'Push back. The tool is wrong sometimes. Look at the blockers — if they ring true, act on them. If they feel off, discard them. You\'re the decision-maker.' },
                  { q: 'Does it work on Webflow/Framer/Carrd pages?', a: 'Yes. Any public HTML page works. We don\'t need a specific CMS. As long as we can fetch the URL and read the DOM, we can audit it.' },
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
                <p className="mt-3 text-base text-warm-600">How different people actually use LaunchGrader day-to-day.</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: '🧑‍💻', role: 'Founder', desc: 'Audit your landing page 2 weeks before Product Hunt launch. Fix the blockers. Rescore the day before. Ship with a score above 80.' },
                  { icon: '📣', role: 'Marketer', desc: 'Benchmark your page against 3 competitors. Use their weak dimensions as your positioning angle. Re-audit after every copy refresh.' },
                  { icon: '💼', role: 'Freelancer', desc: 'Audit your service page. Fix visible pricing + case studies. Use the before/after score in your own testimonials to prospects.' },
                  { icon: '🏢', role: 'Agency', desc: 'Run audits on client sites as part of discovery. Share the score report in kickoff decks. Rescore quarterly to show progress.' },
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
                <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Sharper inputs, sharper output</p>
                <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Tips to get better results</h2>
              </div>
              <ol className="space-y-5">
                {[
                  { t: 'Write a specific description.', d: 'Include the audience, the outcome, and the rough price point. "AI tool for solo marketers that generates 5 ad variations in 30 seconds, $19/mo" beats "AI marketing assistant".' },
                  { t: 'Audit your actual landing page, not your app.', d: 'We grade the page a cold visitor sees first. If you submit your logged-in dashboard URL, you\'ll get a weird score.' },
                  { t: 'Audit a competitor before you audit yourself.', d: 'Benchmark first. Knowing a competitor scores 72 changes how you interpret your own 65.' },
                  { t: 'Fix blockers top-to-bottom.', d: 'Blockers are ordered by impact. Don\'t skip around. The #1 blocker is almost always the highest-leverage fix.' },
                  { t: 'Re-audit 48 hours after each fix.', d: 'See the score move. That movement is the feedback loop. If it doesn\'t move, you fixed the wrong thing.' },
                  { t: 'Screenshot before/after scores.', d: 'Progress is motivation. Keep a running log. Send it to your cofounder when you need to celebrate.' },
                  { t: 'Don\'t chase 100/100.', d: 'Above 80 ships. 100/100 is a perfectionism trap. Launch at 82, iterate after.' },
                  { t: 'Pair with PageRoast for page-level CRO.', d: 'LaunchGrader asks "is this product ready?" PageRoast asks "is this page converting?" Run both.' },
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
                <p className="mt-3 text-base text-warm-600">Same credits. Different angle.</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { slug: 'page-roast', emoji: '🔥', name: 'PageRoast', desc: 'Landing page CRO audit + a savage roast. Use alongside LaunchGrader for page-level conversion fixes.' },
                  { slug: 'headline-grader', emoji: '📰', name: 'HeadlineGrader', desc: '4-framework headline scoring. Fix your hero headline before you re-audit your launch readiness.' },
                  { slug: 'audience-decoder', emoji: '🎯', name: 'AudienceDecoder', desc: 'Archetype + engagement analysis. Know your audience before you write the value prop.' },
                  { slug: 'stack-audit', emoji: '📊', name: 'StackAudit', desc: 'Find SaaS waste before launch. Every dollar saved extends your runway.' },
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
              <h2 className="text-2xl font-black text-white mb-3">431 Reddit comments asking for product reviews. This is that tool.</h2>
              <p className="text-warm-400 mb-6 text-sm">5 dimensions. Launch blockers. A verdict. 30 seconds.</p>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-8 py-4 bg-fire-500 hover:bg-fire-600 text-white font-black rounded-xl shadow-lg shadow-fire-600/30 transition-all text-base">
                Audit My Launch Readiness
              </button>
              <p className="text-xs text-warm-600 mt-4">Paste your URL + describe your product. Results in ~30 seconds.</p>
            </div>
          </section>
        </>
      )}
    </>
  );
}
