import { useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Product {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  status: 'live' | 'coming-soon' | 'beta';
  category: 'content' | 'business' | 'devtools';
  features: string[];
  accent: string;
  accentDot: string;
}

const PRODUCTS: Product[] = [
  {
    slug: 'page-roast',
    name: 'PageRoast',
    tagline: 'Brutally honest landing page audits',
    description: 'Paste any URL. Get a scored CRO audit across 4 frameworks — hero, social proof, clarity, and conversion architecture. Plus a savage roast line you\'ll want to screenshot.',
    status: 'live',
    category: 'business',
    features: ['CRO scoring (0-100)', 'A/B Compare mode', 'Shareable results', 'Actionable fixes'],
    accent: 'hover:border-fire-300',
    accentDot: 'bg-fire-500',
  },
  {
    slug: 'headline-grader',
    name: 'HeadlineGrader',
    tagline: 'Score headlines like a pro copywriter',
    description: 'AI grades your headlines against 4 proven frameworks — Rule of One, Hormozi Value Equation, Readability, and Proof+Promise+Plan. Get a score, a diagnosis, and AI rewrites.',
    status: 'live',
    category: 'content',
    features: ['Framework-based scoring', 'AI rewrites', 'SERP preview', 'A/B Compare'],
    accent: 'hover:border-indigo-300',
    accentDot: 'bg-indigo-500',
  },
  {
    slug: 'ad-scorer',
    name: 'AdScorer',
    tagline: 'Grade ads before you spend the budget',
    description: 'Platform-specific ad copy grading for Google, Meta, and LinkedIn. Scores hook strength, value prop, emotional architecture, and CTA conversion.',
    status: 'live',
    category: 'content',
    features: ['Platform-specific rules', 'Copy rewrites', 'A/B Compare', '4-pillar scoring'],
    accent: 'hover:border-emerald-300',
    accentDot: 'bg-emerald-500',
  },
  {
    slug: 'thread-grader',
    name: 'ThreadGrader',
    tagline: 'Score your X/Twitter threads',
    description: 'AI scores hook strength, tension chain, payoff quality, and share triggers. Plus tweet-by-tweet breakdown and hook rewrites.',
    status: 'live',
    category: 'content',
    features: ['Hook analysis', 'Tweet breakdown', 'Hook rewrites', 'A/B Compare'],
    accent: 'hover:border-sky-300',
    accentDot: 'bg-sky-500',
  },
  {
    slug: 'email-forge',
    name: 'EmailForge',
    tagline: 'Generate email sequences that convert',
    description: 'AI creates 5-email sequences using AIDA, PAS, Hormozi, Cialdini, and Storytelling frameworks. Cold outreach, nurture, launch, or re-engagement.',
    status: 'live',
    category: 'content',
    features: ['5-email sequences', '5 frameworks', 'Open/click estimates', 'A/B Compare'],
    accent: 'hover:border-amber-300',
    accentDot: 'bg-amber-500',
  },
  {
    slug: 'audience-decoder',
    name: 'AudienceDecoder',
    tagline: 'Decode who actually follows you',
    description: 'Paste your social content. AI identifies audience archetypes, content patterns, engagement model, growth opportunities, and builds a content calendar.',
    status: 'live',
    category: 'content',
    features: ['Audience archetypes', 'Engagement scoring', 'Growth opportunities', 'Content calendar'],
    accent: 'hover:border-purple-300',
    accentDot: 'bg-purple-500',
  },
  {
    slug: 'launch-grader',
    name: 'LaunchGrader',
    tagline: 'Is your product ready to launch?',
    description: 'AI audits your go-to-market readiness across 5 dimensions: value prop, pricing, social proof, onboarding, and competitive positioning. Get a score, blockers, and a verdict.',
    status: 'live',
    category: 'business',
    features: ['5-dimension audit', 'Launch blockers', 'Readiness verdict', 'Competitor comparison'],
    accent: 'hover:border-teal-300',
    accentDot: 'bg-teal-500',
  },
  {
    slug: 'stack-audit',
    name: 'StackAudit',
    tagline: 'Find waste in your SaaS stack',
    description: 'Paste your tool list. AI finds overlap, cheaper alternatives, self-hosted options, and calculates exactly how much you can save. Enterprise audit for $1.',
    status: 'live',
    category: 'business',
    features: ['Cost analysis', 'Overlap detection', 'Alternative suggestions', 'Savings calculator'],
    accent: 'hover:border-slate-300',
    accentDot: 'bg-slate-500',
  },
  {
    slug: 'local-score',
    name: 'LocalScore',
    tagline: 'Private document analysis — runs in your browser',
    description: 'FREE — Analyze contracts, financials, meeting notes, and sensitive documents with AI that runs entirely in your browser. Your data never leaves your device. Zero cost, zero servers, zero risk.',
    status: 'live',
    category: 'business',
    features: ['100% local', 'Zero API costs', 'Works offline', 'GDPR-friendly'],
    accent: 'hover:border-green-300',
    accentDot: 'bg-green-500',
  },
  {
    slug: 'stepproof',
    name: 'Stepproof',
    tagline: 'Regression tests for AI pipelines',
    description: 'Write YAML scenarios, run them N times, check if your LLM can follow instructions. Preset scenarios or bring your own. Like unit tests, but for AI.',
    status: 'live',
    category: 'devtools',
    features: ['YAML scenarios', 'Preset library', 'LLM judge assertions', 'BYOK support'],
    accent: 'hover:border-cyan-300',
    accentDot: 'bg-cyan-500',
  },
  {
    slug: 'agent-trace',
    name: 'AgentTrace',
    tagline: 'Local observability for AI agents',
    description: 'Wrap any agent command with OpenTelemetry spans. SQLite storage, zero cloud dependency. See what your agents actually do.',
    status: 'coming-soon',
    category: 'devtools',
    features: ['OpenTelemetry GenAI spans', 'Local SQLite storage', 'Zero cloud', 'CLI interface'],
    accent: 'hover:border-warm-300',
    accentDot: 'bg-warm-400',
  },
];

const STATUS_STYLES = {
  live: 'bg-green-50 text-green-600',
  beta: 'bg-amber-50 text-amber-600',
  'coming-soon': 'bg-warm-100 text-warm-400',
} as const;

const STATUS_LABELS = {
  live: 'Live',
  beta: 'Beta',
  'coming-soon': 'Coming Soon',
} as const;

const CATEGORY_LABELS = {
  content: 'Content & Copy',
  business: 'Business',
  devtools: 'Developer Tools',
} as const;

export function ProjectsPage() {
  useEffect(() => {
    document.title = 'Products — bilko.run';
    return () => { document.title = 'Bilko — AI Advisory for Small Business'; };
  }, []);

  return (
    <>
      {/* Header */}
      <section className="border-b border-warm-200/40">
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-12 md:pt-20 md:pb-16">
          <h1 className="text-display-xl text-warm-900">
            Products
          </h1>
          <p className="mt-4 text-lg text-warm-500 max-w-2xl leading-relaxed">
            AI-powered tools I've built. All free to start.
          </p>
        </div>
      </section>

      {/* Product Grid */}
      <section className="max-w-6xl mx-auto px-6 py-12 md:py-16">
        <div className="grid md:grid-cols-2 gap-5 stagger-children">
          {PRODUCTS.map((product) => {
            const isLive = product.status === 'live';
            const Wrapper = isLive ? Link : 'div';
            const wrapperProps = isLive
              ? { to: `/products/${product.slug}` as string }
              : {};

            return (
              <Wrapper
                key={product.slug}
                {...wrapperProps as any}
                className={`group relative bg-white rounded-2xl p-6 transition-all ${
                  isLive
                    ? `card-base ${product.accent} hover:shadow-elevation-2 hover:-translate-y-1 cursor-pointer`
                    : 'border border-warm-200/40 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full ${product.accentDot}`} />
                    <span className="text-label text-warm-400">
                      {CATEGORY_LABELS[product.category]}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${STATUS_STYLES[product.status]}`}>
                    {STATUS_LABELS[product.status]}
                  </span>
                </div>

                <h3 className={`text-xl font-bold mb-1 ${isLive ? 'text-warm-900 group-hover:text-warm-950 transition-colors' : 'text-warm-700'}`}>
                  {product.name}
                </h3>
                <p className="text-sm font-medium text-warm-600 mb-3">{product.tagline}</p>
                <p className="text-sm text-warm-500 leading-relaxed mb-4">
                  {product.description}
                </p>

                <div className="flex flex-wrap gap-2">
                  {product.features.map((feature) => (
                    <span
                      key={feature}
                      className="text-xs px-2.5 py-1 rounded-lg bg-warm-50 text-warm-500 border border-warm-100/80"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {isLive && (
                  <div className="mt-5 text-sm font-semibold text-warm-600 group-hover:text-warm-800 flex items-center gap-1 transition-colors">
                    Try it free
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 group-hover:translate-x-1 transition-transform" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  </div>
                )}
              </Wrapper>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-warm-200/40">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <h2 className="text-display-md text-warm-900">
            Start with the one that matters most
          </h2>
          <p className="mt-4 text-warm-500 max-w-lg mx-auto leading-relaxed">
            Every tool has a free first analysis. Or try <Link to="/products/local-score" className="text-green-600 hover:underline font-semibold">LocalScore</Link> — completely free, runs in your browser.
          </p>
          <Link
            to="/products/page-roast"
            className="inline-flex items-center justify-center gap-2 mt-8 px-8 py-4 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl shadow-lg shadow-fire-500/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-fire-500/25"
          >
            Try PageRoast
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </Link>
        </div>
      </section>
    </>
  );
}
