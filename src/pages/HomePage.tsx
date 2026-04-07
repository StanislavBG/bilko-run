import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

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
  const [email, setEmail] = useState('');
  const [subscribeStatus, setSubscribeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    document.title = 'Bilko — Builder, Tools, Blog';
  }, []);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribeStatus('loading');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setSubscribeStatus('success');
        setEmail('');
      } else {
        setSubscribeStatus('error');
      }
    } catch {
      setSubscribeStatus('error');
    }
  }

  const tools = [
    { name: 'PageRoast', desc: 'Landing page CRO audit + savage roast', path: '/products/page-roast', tag: 'Marketing', accent: 'bg-fire-500' },
    { name: 'HeadlineGrader', desc: '4-framework headline scoring', path: '/products/headline-grader', tag: 'Marketing', accent: 'bg-indigo-500' },
    { name: 'AdScorer', desc: 'Platform-specific ad grading', path: '/products/ad-scorer', tag: 'Marketing', accent: 'bg-emerald-500' },
    { name: 'ThreadGrader', desc: 'X/Twitter thread viral analysis', path: '/products/thread-grader', tag: 'Marketing', accent: 'bg-sky-500' },
    { name: 'EmailForge', desc: '5-email sequence generator', path: '/products/email-forge', tag: 'Marketing', accent: 'bg-amber-500' },
    { name: 'AudienceDecoder', desc: 'Audience archetype + engagement', path: '/products/audience-decoder', tag: 'Marketing', accent: 'bg-purple-500' },
    { name: 'LaunchGrader', desc: 'Go-to-market readiness audit', path: '/products/launch-grader', tag: 'Marketing', accent: 'bg-teal-500' },
    { name: 'StackAudit', desc: 'SaaS tool stack cost + waste finder', path: '/products/stack-audit', tag: 'Ops', accent: 'bg-slate-500' },
    { name: 'Stepproof', desc: 'YAML scenario tests for AI pipelines', path: '/products/stepproof', tag: 'Dev', accent: 'bg-cyan-500' },
    { name: 'LocalScore', desc: 'Private doc analysis via WebGPU', path: '/products/local-score', tag: 'Free', free: true, accent: 'bg-green-500' },
  ];

  return (
    <article className="max-w-5xl mx-auto px-6">

      {/* ── Hero ──────────────────────────────────────────── */}
      <header className="pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="flex flex-col md:flex-row items-start gap-8 animate-slide-up">
          <img
            src="/bilko.jpg"
            alt="Bilko"
            className="w-24 h-24 md:w-28 md:h-28 rounded-2xl object-cover shadow-elevation-3 shrink-0"
          />
          <div className="flex-1">
            <h1 className="text-display-xl text-warm-900 font-display">
              I build AI tools
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-fire-500 via-fire-400 to-fire-600">
                that earn their keep.
              </span>
            </h1>
            <p className="mt-4 text-lg text-warm-500 max-w-lg leading-relaxed">
              10 shipped tools. No subscriptions. $1/credit.
              Each one does one thing well — score, audit, generate, roast.
            </p>
            <div className="flex items-center gap-4 mt-6">
              <a href="https://x.com/BilkoBibitkov" target="_blank" rel="noopener noreferrer"
                className="text-warm-400 hover:text-warm-700 transition-colors"><SocialIcon type="x" /></a>
              <a href="https://www.linkedin.com/in/bilko-bibitkov-23b5b13b1/" target="_blank" rel="noopener noreferrer"
                className="text-warm-400 hover:text-warm-700 transition-colors"><SocialIcon type="linkedin" /></a>
              <a href="https://github.com/BilkoBibitkov" target="_blank" rel="noopener noreferrer"
                className="text-warm-400 hover:text-warm-700 transition-colors"><SocialIcon type="github" /></a>
              <div className="w-px h-5 bg-warm-200" />
              <Link to="/blog" className="text-sm font-semibold text-warm-600 hover:text-fire-500 transition-colors">
                Read the blog &rarr;
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── What I do + Newsletter ────────────────────────── */}
      <section className="grid md:grid-cols-5 gap-5 pb-16 animate-slide-up" style={{ animationDelay: '80ms' }}>
        <div className="md:col-span-3 rounded-2xl bg-warm-900 p-7 relative overflow-hidden shadow-dark-elevation">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,107,26,0.08),transparent_60%)]" />
          <div className="relative">
            <span className="text-label text-warm-400">What I do</span>
            <p className="mt-4 text-base leading-relaxed text-warm-200">
              I help small businesses figure out AI — what to use, how to set it up,
              how to make it actually work. Not buzzwords. Working solutions that pay
              for themselves.
            </p>
            <div className="flex gap-5 mt-5">
              {['Strategy', 'Implementation', 'Support'].map(s => (
                <span key={s} className="flex items-center gap-2 text-sm text-warm-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-fire-500" />{s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-2 rounded-2xl bg-warm-900 p-7 relative overflow-hidden shadow-dark-elevation">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,107,26,0.1),transparent_60%)]" />
          <div className="relative">
            <span className="text-label text-warm-400">Newsletter</span>
            <p className="text-sm text-warm-400 mt-3 mb-4">AI tips for small businesses. No spam.</p>
            <form onSubmit={handleSubscribe} className="space-y-2.5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-warm-700/60 bg-warm-800/50 text-white placeholder:text-warm-500 text-sm focus:outline-none focus:ring-2 focus:ring-fire-500/40 focus:border-fire-500/60 transition-all"
              />
              <button
                type="submit"
                disabled={subscribeStatus === 'loading'}
                className="w-full px-4 py-2.5 bg-fire-500 hover:bg-fire-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-fire-900/30 transition-all disabled:opacity-60"
              >
                {subscribeStatus === 'loading' ? '...' : 'Subscribe'}
              </button>
            </form>
            {subscribeStatus === 'success' && (
              <p className="text-xs text-green-400 mt-2">You're in.</p>
            )}
            {subscribeStatus === 'error' && (
              <p className="text-xs text-red-400 mt-2">Something went wrong.</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Tools ─────────────────────────────────────────── */}
      <section className="pb-16 animate-slide-up" style={{ animationDelay: '160ms' }}>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-display-sm text-warm-900">Tools</h2>
          <span className="text-sm text-warm-400">10 shipped &middot; $1/credit &middot; free to try</span>
        </div>
        <div className="rounded-2xl shadow-elevation-1 overflow-hidden bg-white">
          {tools.map((tool, i) => (
            <Link key={tool.name} to={tool.path}
              className={`group flex items-center gap-4 px-5 py-4 hover:bg-warm-50 transition-colors ${i < tools.length - 1 ? 'border-b border-warm-100/80' : ''}`}>
              <span className={`w-2 h-2 rounded-full ${tool.accent} shrink-0`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 ${
                tool.free ? 'bg-green-50 text-green-600' :
                tool.tag === 'Dev' ? 'bg-violet-50 text-violet-600' :
                tool.tag === 'Ops' ? 'bg-sky-50 text-sky-600' :
                'bg-warm-100/80 text-warm-500'
              }`}>{tool.tag}</span>
              <span className="font-semibold text-sm text-warm-800 group-hover:text-warm-900 transition-colors w-36 shrink-0">{tool.name}</span>
              <span className="text-sm text-warm-500 truncate">{tool.desc}</span>
              <svg className="w-4 h-4 text-warm-300 group-hover:text-fire-500 group-hover:translate-x-0.5 ml-auto shrink-0 transition-all" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Projects ──────────────────────────────────────── */}
      <section className="pb-16 animate-slide-up" style={{ animationDelay: '200ms' }}>
        <h2 className="text-display-sm text-warm-900 mb-5">Projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="https://bglabs.app" target="_blank" rel="noopener noreferrer"
            className="group card-interactive p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <h3 className="font-bold text-warm-800 group-hover:text-warm-900 transition-colors">BG Labs</h3>
            </div>
            <p className="text-sm text-warm-500 leading-relaxed">AI canvas animations. Describe it, embed it, ship it.</p>
            <span className="text-xs text-warm-400 mt-3 block">bglabs.app &nearr;</span>
          </a>
          <a href="https://provocations.dev" target="_blank" rel="noopener noreferrer"
            className="group card-interactive p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <h3 className="font-bold text-warm-800 group-hover:text-warm-900 transition-colors">Provocations</h3>
            </div>
            <p className="text-sm text-warm-500 leading-relaxed">AI workspace with 14 expert personas that challenge your thinking.</p>
            <span className="text-xs text-warm-400 mt-3 block">provocations.dev &nearr;</span>
          </a>
          <Link to="/products/content-tools"
            className="group card-interactive p-6 !border-fire-200/60 hover:!border-fire-400 bg-fire-50/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-fire-500" />
              <h3 className="font-bold text-warm-800 group-hover:text-fire-600 transition-colors">Content & Copy</h3>
            </div>
            <p className="text-sm text-warm-500 leading-relaxed">7 AI scoring tools for headlines, ads, threads, emails, audiences.</p>
            <span className="text-xs text-fire-400 mt-3 block">bilko.run/products &rarr;</span>
          </Link>
        </div>
      </section>

      {/* ── How I help ────────────────────────────────────── */}
      <section className="pb-20 animate-slide-up" style={{ animationDelay: '240ms' }}>
        <h2 className="text-display-sm text-warm-900 mb-5">How I help</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              title: 'AI Strategy',
              body: 'Audit your workflows, find where AI saves real time and money. Practical moves that pay for themselves.',
              icon: (
                <svg className="w-5 h-5 text-fire-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              ),
            },
            {
              title: 'Implementation',
              body: 'I build the automations, set up the tools, connect the systems. Working solutions, not strategy decks.',
              icon: (
                <svg className="w-5 h-5 text-fire-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.46-5.46a8.01 8.01 0 1111.31 0l-5.46 5.46a.75.75 0 01-.39 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              ),
            },
            {
              title: 'Ongoing Support',
              body: 'AI moves fast. I stay current so you don\'t have to. When something breaks or a better tool ships, I handle it.',
              icon: (
                <svg className="w-5 h-5 text-fire-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              ),
            },
          ].map(s => (
            <div key={s.title} className="card-base p-6 bg-warm-50/50">
              <div className="w-9 h-9 rounded-xl bg-fire-50 flex items-center justify-center mb-3">
                {s.icon}
              </div>
              <h3 className="font-bold text-warm-900 mb-1.5">{s.title}</h3>
              <p className="text-sm text-warm-500 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
