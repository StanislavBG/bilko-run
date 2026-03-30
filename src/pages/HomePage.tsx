import { Link } from 'react-router-dom';

const SOCIAL_LINKS = [
  { href: 'https://x.com/BilkoBibitkov', label: 'X / Twitter', icon: 'x' },
  { href: 'https://linkedin.com/in/bilkobibitkov', label: 'LinkedIn', icon: 'linkedin' },
  { href: 'https://github.com/StanislavBG', label: 'GitHub', icon: 'github' },
] as const;

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
      {/* Hero — all about Bilko */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-fire-50/30 via-warm-50 to-warm-50" />
        <div className="relative max-w-3xl mx-auto px-6 pt-24 pb-16 md:pt-36 md:pb-24 text-center">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-warm-900 animate-slide-up">
            Bilko
          </h1>
          <p className="mt-4 text-xl md:text-2xl text-warm-600 font-medium animate-slide-up" style={{ animationDelay: '60ms' }}>
            Solopreneur. Builder. Shipper.
          </p>

          <div className="mt-6 flex items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '120ms' }}>
            {SOCIAL_LINKS.map(({ href, label, icon }) => (
              <a
                key={icon}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-warm-600 hover:text-warm-900 hover:bg-warm-100 transition-all text-sm font-medium"
                title={label}
              >
                <SocialIcon type={icon} />
                <span className="hidden sm:inline">{label}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="max-w-2xl mx-auto px-6 pb-16 md:pb-24">
        <div className="text-warm-600 leading-relaxed space-y-4 text-lg">
          <p>
            I quit waiting for permission and started building. One person, no funding, no team — just
            ideas that won't shut up and an unreasonable belief that shipping beats planning.
          </p>
          <p>
            I build AI-powered tools for people who make things on the internet. Marketers who need
            honest feedback before they launch. Founders who want data, not opinions. Developers who
            ship AI and need to test it.
          </p>
          <p>
            Everything here is built with Claude, Gemini, and a lot of coffee. If it helps someone
            ship better work, I'll build it.
          </p>
        </div>
      </section>

      {/* What I believe in */}
      <section className="border-t border-warm-200/60 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
          <h2 className="text-2xl font-extrabold text-warm-900 mb-8">How I work</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: 'Ship first', desc: 'An imperfect thing in the wild beats a perfect thing in my head. I ship weekly, learn daily, fix fast.' },
              { title: 'Solo by choice', desc: 'No co-founders, no investors, no board meetings. Just me and the users. Every decision is instant.' },
              { title: 'Build in public', desc: 'Revenue, failures, lessons — I share it all. Follow along on X and LinkedIn.' },
            ].map(({ title, desc }) => (
              <div key={title}>
                <h3 className="font-bold text-warm-900 mb-2">{title}</h3>
                <p className="text-sm text-warm-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What I'm working on */}
      <section className="border-t border-warm-200/40">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
          <h2 className="text-2xl font-extrabold text-warm-900 mb-3">What I'm building</h2>
          <p className="text-warm-500 mb-8">AI tools for content, marketing, and developer workflows.</p>

          <div className="space-y-4">
            <Link
              to="/projects/page-roast"
              className="group flex items-center justify-between p-4 -mx-4 rounded-xl hover:bg-warm-50 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-warm-900 group-hover:text-fire-600 transition-colors">PageRoast</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-xs font-semibold text-green-700">Live</span>
                </div>
                <p className="text-sm text-warm-500 mt-0.5">AI roasts your landing page. Scores, savage feedback, fixes.</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-warm-400 group-hover:text-fire-500 group-hover:translate-x-1 transition-all" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </Link>

            <Link
              to="/projects"
              className="group flex items-center justify-between p-4 -mx-4 rounded-xl hover:bg-warm-50 transition-colors"
            >
              <div>
                <span className="font-bold text-warm-900 group-hover:text-fire-600 transition-colors">More tools</span>
                <p className="text-sm text-warm-500 mt-0.5">HeadlineGrader, AdScorer, Stepproof, AgentTrace, and more.</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-warm-400 group-hover:text-fire-500 group-hover:translate-x-1 transition-all" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Connect */}
      <section className="border-t border-warm-200/40 bg-warm-100/30">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-20 text-center">
          <h2 className="text-2xl font-extrabold text-warm-900 mb-3">Let's connect</h2>
          <p className="text-warm-500 mb-6">I post about building, shipping, and what I'm learning along the way.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {SOCIAL_LINKS.map(({ href, label, icon }) => (
              <a
                key={icon}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-warm-200 bg-white text-warm-700 hover:text-warm-900 hover:border-warm-400 hover:shadow-sm transition-all text-sm font-semibold"
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
