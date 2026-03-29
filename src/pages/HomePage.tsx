import { Link } from 'react-router-dom';

const SOCIAL_LINKS = [
  { href: 'https://x.com/BilkoBibitkov', label: 'X / Twitter', icon: 'x' },
  { href: 'https://linkedin.com/in/bilkobibitkov', label: 'LinkedIn', icon: 'linkedin' },
  { href: 'https://github.com/StanislavBG', label: 'GitHub', icon: 'github' },
] as const;

const PROJECTS = [
  {
    name: 'PageRoast',
    line: 'AI roasts your landing page in 60 seconds',
    metric: 'Live',
    href: '/projects/page-roast',
    live: true,
  },
  {
    name: 'HeadlineGrader',
    line: 'Score headlines with proven copywriting frameworks',
    metric: 'Building',
    href: '/projects',
    live: false,
  },
  {
    name: 'AdScorer',
    line: 'Grade ad copy before you spend the budget',
    metric: 'Building',
    href: '/projects',
    live: false,
  },
  {
    name: 'Stepproof',
    line: 'Behavioral regression tests for AI workflows',
    metric: 'Shipped',
    href: '/projects',
    live: false,
  },
  {
    name: 'AgentTrace',
    line: 'Local observability for AI agents',
    metric: 'Shipped',
    href: '/projects',
    live: false,
  },
  {
    name: 'ContentGrade',
    line: 'Holistic content quality scoring',
    metric: 'Building',
    href: '/projects',
    live: false,
  },
];

function SocialIcon({ type }: { type: string }) {
  if (type === 'x') return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
  );
  if (type === 'linkedin') return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
  );
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
  );
}

export function HomePage() {
  return (
    <>
      {/* Hero — Pieter Levels / Marc Lou pattern: identity + proof strip + socials */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-fire-50/40 via-warm-50 to-warm-50" />
        <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-10 md:pt-28 md:pb-14 text-center">
          {/* Identity */}
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-warm-900 animate-slide-up">
            Bilko
          </h1>
          <p className="mt-3 text-xl md:text-2xl text-warm-600 font-medium animate-slide-up" style={{ animationDelay: '60ms' }}>
            I build AI tools and ship them.
          </p>

          {/* Proof strip */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-warm-500 animate-slide-up" style={{ animationDelay: '120ms' }}>
            <span><strong className="text-warm-800 text-base">8</strong> tools shipped</span>
            <span className="text-warm-300">|</span>
            <span><strong className="text-warm-800 text-base">1</strong> person</span>
            <span className="text-warm-300">|</span>
            <span><strong className="text-warm-800 text-base">0</strong> VC dollars</span>
          </div>

          {/* Social links */}
          <div className="mt-6 flex items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '180ms' }}>
            {SOCIAL_LINKS.map(({ href, label, icon }) => (
              <a
                key={icon}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-warm-600 hover:text-warm-900 hover:bg-warm-100 transition-all text-sm font-medium"
                title={label}
              >
                <SocialIcon type={icon} />
                <span className="hidden sm:inline">{label}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Featured tool CTA — one clear action */}
      <section className="max-w-2xl mx-auto px-6 pb-16">
        <Link
          to="/projects/page-roast"
          className="group block bg-white rounded-2xl border border-warm-200/60 hover:border-fire-300 shadow-sm hover:shadow-lg hover:shadow-fire-100/50 transition-all hover:-translate-y-0.5 p-6 md:p-8"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-green-700">Live Now</span>
            </div>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-warm-900 group-hover:text-fire-600 transition-colors">
            PageRoast
          </h2>
          <p className="mt-2 text-warm-600 leading-relaxed">
            Paste any URL. AI scores your landing page across 4 CRO frameworks, gives you a brutal one-liner, and tells you exactly what to fix. Takes 60 seconds.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-fire-500 font-semibold group-hover:text-fire-600">
            Try it free
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 group-hover:translate-x-1 transition-transform" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </div>
        </Link>
      </section>

      {/* All projects — simple list, Marc Lou style with metrics */}
      <section className="border-t border-warm-200/60 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-20">
          <h2 className="text-2xl font-extrabold text-warm-900 mb-8">Projects</h2>
          <div className="divide-y divide-warm-100">
            {PROJECTS.map((p) => {
              const inner = (
                <div className="flex items-center justify-between py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-warm-900">{p.name}</span>
                      {p.live && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                    </div>
                    <p className="text-sm text-warm-500 mt-0.5 truncate">{p.line}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ml-4 ${
                    p.metric === 'Live' ? 'bg-green-100 text-green-700' :
                    p.metric === 'Shipped' ? 'bg-blue-100 text-blue-700' :
                    'bg-warm-100 text-warm-500'
                  }`}>
                    {p.metric}
                  </span>
                </div>
              );

              return p.live ? (
                <Link key={p.name} to={p.href} className="block hover:bg-warm-50 -mx-4 px-4 rounded-lg transition-colors">
                  {inner}
                </Link>
              ) : (
                <div key={p.name} className="opacity-70">{inner}</div>
              );
            })}
          </div>
          <Link to="/projects" className="inline-block mt-6 text-sm font-semibold text-fire-500 hover:text-fire-600">
            View all projects &rarr;
          </Link>
        </div>
      </section>

      {/* About — short, personal, builder voice */}
      <section className="border-t border-warm-200/40">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-20">
          <h2 className="text-2xl font-extrabold text-warm-900 mb-4">About</h2>
          <div className="text-warm-600 leading-relaxed space-y-3">
            <p>
              I'm a solo builder shipping AI-powered tools for makers, marketers, and founders.
              Everything on this site is built by one person — no team, no funding, no permission needed.
            </p>
            <p>
              I build with Claude and Gemini, ship on Render, and sell with Stripe.
              If it helps someone make better content or ship faster, I'll probably build it.
            </p>
          </div>
          <div className="mt-6 flex gap-3">
            {SOCIAL_LINKS.map(({ href, label, icon }) => (
              <a
                key={icon}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-warm-200 text-warm-600 hover:text-warm-900 hover:border-warm-300 transition-all text-sm font-medium"
              >
                <SocialIcon type={icon} />
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
