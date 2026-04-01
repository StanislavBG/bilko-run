import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '/api';

const SOCIAL_LINKS = [
  { href: 'https://x.com/BilkoBibitkov', label: 'X / Twitter', icon: 'x' },
  { href: 'https://www.linkedin.com/in/bilko-bibitkov-23b5b13b1/', label: 'LinkedIn', icon: 'linkedin' },
  { href: 'https://github.com/BilkoBibitkov', label: 'GitHub', icon: 'github' },
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
  const [stats, setStats] = useState<{ totalRoasts: number; totalUsers: number } | null>(null);

  useEffect(() => {
    fetch(`${API}/roasts/stats`).then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  return (
    <>
      {/* Hero — visitor benefit first */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-fire-50/40 via-warm-50 to-warm-50" />
        <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-12 md:pt-32 md:pb-20 text-center">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-warm-900 leading-[1.1] animate-slide-up">
            Find out why your landing page
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fire-500 to-fire-600">
              isn't converting.
            </span>
          </h1>

          <p className="mt-5 text-lg md:text-xl text-warm-600 max-w-xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '80ms' }}>
            AI scores your page, roasts the weak spots, and tells you exactly what to fix. Free. 30 seconds.
          </p>

          {/* CTA + social proof */}
          <div className="mt-8 animate-slide-up" style={{ animationDelay: '160ms' }}>
            <Link
              to="/projects/page-roast"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-fire-500 hover:bg-fire-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-fire-500/20 hover:shadow-fire-500/30 transition-all hover:-translate-y-0.5"
            >
              🔥 Roast My Page — Free
            </Link>
            <p className="mt-3 text-sm text-warm-500">
              1 free roast, no credit card required
              {stats && stats.totalRoasts > 0 && (
                <span> &middot; <strong className="text-warm-700">{stats.totalRoasts}+ pages roasted</strong></span>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Product preview — show the score card */}
      <section className="max-w-2xl mx-auto px-6 -mt-4 pb-16">
        <div className="bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900 rounded-2xl p-6 md:p-8 text-center relative overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,107,26,0.15),transparent_60%)]" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-400 mb-3">Sample Result</p>
            <div className="flex items-center justify-center gap-4 mb-2">
              <span className="text-5xl md:text-6xl font-black text-white">62</span>
              <div className="text-left">
                <div className="text-3xl md:text-4xl font-black text-yellow-400">C+</div>
                <div className="text-xs text-warm-500">/100</div>
              </div>
            </div>
            <p className="text-fire-300 font-bold italic text-sm md:text-base max-w-md mx-auto">
              &ldquo;Your landing page has the conversion power of a 'Please take one' sign at a dentist's office.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* What it checks — benefit-focused */}
      <section className="border-t border-warm-200/60 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-20">
          <h2 className="text-2xl font-extrabold text-warm-900 text-center mb-10">AI audits 4 things that make or break conversions</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: '🎯', title: 'Hero Section', desc: 'Is your headline clear? Is the CTA visible? Can someone understand your product in 5 seconds?' },
              { icon: '⭐', title: 'Social Proof', desc: 'Real testimonials or fake-looking quotes from "J."? Trust logos or empty promises?' },
              { icon: '💡', title: 'Clarity & Persuasion', desc: 'Benefits or feature dumps? Short sentences or walls of text? Are you selling or lecturing?' },
              { icon: '🔥', title: 'Conversion Architecture', desc: 'How many CTAs? How much friction? Is the path to payment obvious or hidden?' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex gap-4 items-start">
                <span className="text-2xl flex-shrink-0">{icon}</span>
                <div>
                  <h3 className="font-bold text-warm-900">{title}</h3>
                  <p className="text-sm text-warm-500 leading-relaxed mt-1">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built by Bilko — founder's note */}
      <section className="border-t border-warm-200/40">
        <div className="max-w-2xl mx-auto px-6 py-16 md:py-20">
          <div className="flex items-start gap-5">
            <div className="flex-shrink-0 w-14 h-14 rounded-full bg-fire-100 text-fire-600 flex items-center justify-center text-2xl font-black">
              B
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-warm-900 mb-2">Built by Bilko</h2>
              <p className="text-warm-600 leading-relaxed">
                I built PageRoast because I was tired of launching pages and getting zero feedback.
                I'm a solo builder — no team, no funding, no board meetings. Just me and Claude,
                shipping tools for people who make things on the internet.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {SOCIAL_LINKS.map(({ href, label, icon }) => (
                  <a
                    key={icon}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-fire-600 transition-colors"
                  >
                    <SocialIcon type={icon} />
                    {label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* More tools teaser */}
      <section className="border-t border-warm-200/40 bg-warm-100/30">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-20 text-center">
          <h2 className="text-2xl font-extrabold text-warm-900 mb-3">More tools coming</h2>
          <p className="text-warm-500 mb-6">HeadlineGrader, AdScorer, Stepproof, AgentTrace — all built solo, all shipping soon.</p>
          <Link
            to="/projects"
            className="text-sm font-semibold text-fire-500 hover:text-fire-600"
          >
            View all projects &rarr;
          </Link>
        </div>
      </section>
    </>
  );
}
