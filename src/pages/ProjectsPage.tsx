import { useEffect } from 'react';
import { Link } from 'react-router-dom';

interface Project {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  status: 'live' | 'coming-soon' | 'beta';
  category: 'content' | 'devtools' | 'marketing';
  features: string[];
}

const PROJECTS: Project[] = [
  {
    slug: 'page-roast',
    name: 'PageRoast',
    tagline: 'Brutally honest landing page audits',
    description: 'Paste any URL. Get a scored CRO audit across 4 frameworks — hero, social proof, clarity, and conversion architecture. Plus a savage roast line you\'ll want to screenshot.',
    status: 'live',
    category: 'content',
    features: ['CRO scoring (0-100)', 'A/B Compare mode', 'Shareable results', 'Actionable fixes'],
  },
  {
    slug: 'headline-grader',
    name: 'HeadlineGrader',
    tagline: 'Score headlines like a pro copywriter',
    description: 'AI grades your headlines against 4 proven frameworks — Rule of One, Hormozi Value Equation, Readability, and Proof+Promise+Plan. Get a score, a diagnosis, and AI rewrites.',
    status: 'live',
    category: 'content',
    features: ['Framework-based scoring', 'AI rewrites', 'SERP preview', 'A/B Compare'],
  },
  {
    slug: 'ad-scorer',
    name: 'AdScorer',
    tagline: 'Grade ads before you spend the budget',
    description: 'Platform-specific ad copy grading for Google, Meta, and LinkedIn. Scores hook strength, value prop, emotional architecture, and CTA conversion.',
    status: 'live',
    category: 'marketing',
    features: ['Platform-specific rules', 'Copy rewrites', 'A/B Compare', '4-pillar scoring'],
  },
  {
    slug: 'thread-grader',
    name: 'ThreadGrader',
    tagline: 'Score your X/Twitter threads',
    description: 'AI scores hook strength, tension chain, payoff quality, and share triggers. Plus tweet-by-tweet breakdown and hook rewrites.',
    status: 'live',
    category: 'content',
    features: ['Hook analysis', 'Tweet breakdown', 'Hook rewrites', 'A/B Compare'],
  },
  {
    slug: 'email-forge',
    name: 'EmailForge',
    tagline: 'Generate email sequences that convert',
    description: 'AI creates 5-email sequences using AIDA, PAS, Hormozi, Cialdini, and Storytelling frameworks. Cold outreach, nurture, launch, or re-engagement.',
    status: 'live',
    category: 'marketing',
    features: ['5-email sequences', '5 frameworks', 'Open/click estimates', 'A/B Compare'],
  },
  {
    slug: 'audience-decoder',
    name: 'AudienceDecoder',
    tagline: 'Decode who actually follows you',
    description: 'Paste your social content. AI identifies audience archetypes, content patterns, engagement model, growth opportunities, and builds a content calendar.',
    status: 'live',
    category: 'content',
    features: ['Audience archetypes', 'Engagement scoring', 'Growth opportunities', 'Content calendar'],
  },
  {
    slug: 'stepproof',
    name: 'Stepproof',
    tagline: 'Regression tests for AI pipelines',
    description: 'Write YAML scenarios, run them N times, check if your LLM can follow instructions. Preset scenarios or bring your own. Like unit tests, but for AI.',
    status: 'live',
    category: 'devtools',
    features: ['YAML scenarios', 'Preset library', 'LLM judge assertions', 'BYOK support'],
  },
  {
    slug: 'agent-trace',
    name: 'AgentTrace',
    tagline: 'Local observability for AI agents',
    description: 'Wrap any agent command with OpenTelemetry spans. SQLite storage, zero cloud dependency. See what your agents actually do.',
    status: 'coming-soon',
    category: 'devtools',
    features: ['OpenTelemetry GenAI spans', 'Local SQLite storage', 'Zero cloud', 'CLI interface'],
  },
];

const STATUS_STYLES = {
  live: 'bg-green-100 text-green-700 border-green-200',
  beta: 'bg-amber-100 text-amber-700 border-amber-200',
  'coming-soon': 'bg-warm-200 text-warm-500 border-warm-300',
} as const;

const STATUS_LABELS = {
  live: 'Live',
  beta: 'Beta',
  'coming-soon': 'Coming Soon',
} as const;

const CATEGORY_LABELS = {
  content: 'Content',
  devtools: 'Dev Tools',
  marketing: 'Marketing',
} as const;

export function ProjectsPage() {
  useEffect(() => {
    document.title = 'Projects — bilko.run';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  return (
    <>
      {/* Header */}
      <section className="bg-gradient-to-b from-warm-100/50 to-warm-50 border-b border-warm-200/40">
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-12 md:pt-20 md:pb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-warm-900 tracking-tight">
            Projects
          </h1>
          <p className="mt-4 text-lg text-warm-500 max-w-2xl">
            AI-powered tools I've built and shipped. All free to start, most open source.
            Built with Claude, deployed for anyone who makes things on the internet.
          </p>
        </div>
      </section>

      {/* Project Grid */}
      <section className="max-w-6xl mx-auto px-6 py-12 md:py-16">
        <div className="grid md:grid-cols-2 gap-6 stagger-children">
          {PROJECTS.map((project) => {
            const isLive = project.status === 'live';
            const Wrapper = isLive ? Link : 'div';
            const wrapperProps = isLive
              ? { to: `/projects/${project.slug}` as string }
              : {};

            return (
              <Wrapper
                key={project.slug}
                {...wrapperProps as any}
                className={`group relative bg-white rounded-2xl p-6 border transition-all ${
                  isLive
                    ? 'border-warm-200/60 hover:border-fire-300 hover:shadow-lg hover:shadow-fire-100/50 hover:-translate-y-1 cursor-pointer'
                    : 'border-warm-200/40 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-warm-400">
                      {CATEGORY_LABELS[project.category]}
                    </span>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_STYLES[project.status]}`}>
                    {STATUS_LABELS[project.status]}
                  </span>
                </div>

                <h3 className={`text-xl font-bold mb-1 ${isLive ? 'text-warm-900 group-hover:text-fire-600 transition-colors' : 'text-warm-700'}`}>
                  {project.name}
                </h3>
                <p className="text-sm font-medium text-warm-600 mb-3">{project.tagline}</p>
                <p className="text-sm text-warm-500 leading-relaxed mb-4">
                  {project.description}
                </p>

                <div className="flex flex-wrap gap-2">
                  {project.features.map((feature) => (
                    <span
                      key={feature}
                      className="text-xs px-2.5 py-1 rounded-lg bg-warm-100 text-warm-600 border border-warm-200/60"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {isLive && (
                  <div className="mt-4 text-sm font-semibold text-fire-500 group-hover:text-fire-600 flex items-center gap-1">
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
      <section className="bg-warm-100/50 border-t border-warm-200/40">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-extrabold text-warm-900">
            Start with the one that matters most
          </h2>
          <p className="mt-3 text-warm-500">
            PageRoast is live and free. Paste a URL, get scored in 60 seconds.
          </p>
          <Link
            to="/projects/page-roast"
            className="inline-flex items-center justify-center gap-2 mt-6 px-8 py-4 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl shadow-lg shadow-fire-500/20 transition-all hover:-translate-y-0.5"
          >
            Roast My Page
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </Link>
        </div>
      </section>
    </>
  );
}
