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

function Divider() {
  return <div className="max-w-xs mx-auto border-t border-warm-200/60 my-0" />;
}

export function HomePage() {
  const [email, setEmail] = useState('');
  const [subscribeStatus, setSubscribeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    document.title = 'Bilko — AI Advisory for Small Business';
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

  return (
    <article className="max-w-2xl mx-auto px-6">

      {/* -- Hero -- */}
      <header className="pt-16 pb-8 md:pt-24 md:pb-12">
        <div className="flex flex-col items-center text-center mb-8 animate-slide-up">
          <img
            src="/bilko.jpg"
            alt="Bilko"
            className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover shadow-lg shadow-warm-300/30 mb-5"
          />
          <h1 className="text-3xl md:text-4xl font-black text-warm-900">Bilko</h1>
          <p className="text-warm-500 text-lg mt-1">Your AI-educated neighbor.</p>
        </div>

        <p className="text-lg md:text-xl text-warm-600 max-w-xl mx-auto leading-relaxed text-center animate-slide-up" style={{ animationDelay: '80ms' }}>
          I help small businesses figure out AI — what to use, how to set it up,
          and how to make it actually work.
        </p>
      </header>

      {/* -- Follow + Connect (right after hero) -- */}
      <section className="pb-10">
        <div className="flex flex-wrap justify-center gap-3 mb-6 animate-slide-up" style={{ animationDelay: '120ms' }}>
          <a href="https://x.com/BilkoBibitkov" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl border border-warm-200/60 bg-white hover:border-fire-300 hover:shadow-md transition-all group">
            <SocialIcon type="x" />
            <div className="text-left">
              <p className="text-sm font-bold text-warm-800 group-hover:text-fire-600 transition-colors">Follow on X</p>
              <p className="text-xs text-warm-400">@BilkoBibitkov</p>
            </div>
          </a>
          <a href="https://www.linkedin.com/in/bilko-bibitkov-23b5b13b1/" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl border border-warm-200/60 bg-white hover:border-fire-300 hover:shadow-md transition-all group">
            <SocialIcon type="linkedin" />
            <div className="text-left">
              <p className="text-sm font-bold text-warm-800 group-hover:text-fire-600 transition-colors">Connect</p>
              <p className="text-xs text-warm-400">LinkedIn</p>
            </div>
          </a>
          <a href="https://github.com/BilkoBibitkov" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl border border-warm-200/60 bg-white hover:border-fire-300 hover:shadow-md transition-all group">
            <SocialIcon type="github" />
            <div className="text-left">
              <p className="text-sm font-bold text-warm-800 group-hover:text-fire-600 transition-colors">GitHub</p>
              <p className="text-xs text-warm-400">BilkoBibitkov</p>
            </div>
          </a>
        </div>

        <Link to="/blog"
          className="flex items-center justify-center gap-2 text-sm font-semibold text-fire-500 hover:text-fire-600 transition-colors mb-6">
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd" /><path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z" /></svg>
          Read the blog &rarr;
        </Link>
      </section>

      {/* -- Email Capture -- */}
      <section className="pb-12">
        <div className="rounded-2xl bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900 p-6 md:p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,107,26,0.12),transparent_60%)]" />
          <div className="relative">
            <h2 className="text-lg font-bold text-white mb-1">Get AI tips that actually help</h2>
            <p className="text-sm text-warm-400 mb-5">Practical advice for small businesses. No spam, no fluff.</p>
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="flex-1 px-4 py-3 rounded-xl border border-warm-700 bg-warm-800/50 text-white placeholder:text-warm-500 text-sm focus:outline-none focus:ring-2 focus:ring-fire-500/50 focus:border-fire-400 transition-all"
              />
              <button
                type="submit"
                disabled={subscribeStatus === 'loading'}
                className="px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-fire-600/30 transition-all hover:-translate-y-0.5 disabled:opacity-60"
              >
                {subscribeStatus === 'loading' ? 'Subscribing...' : 'Subscribe'}
              </button>
            </form>
            {subscribeStatus === 'success' && (
              <p className="text-sm text-green-400 mt-3">You're in. Check your inbox.</p>
            )}
            {subscribeStatus === 'error' && (
              <p className="text-sm text-red-400 mt-3">Something went wrong. Try again.</p>
            )}
          </div>
        </div>
      </section>

      <Divider />

      {/* -- How I Help -- */}
      <section className="py-12 md:py-16">
        <h2 className="text-xl md:text-2xl font-extrabold text-warm-900 mb-8">How I help</h2>
        <div className="space-y-6">
          <div className="rounded-2xl p-6 border border-warm-200/60 bg-warm-50/50">
            <h3 className="font-bold text-warm-900 mb-2">AI Strategy</h3>
            <p className="text-warm-600 leading-relaxed">
              I'll audit your workflows and tell you where AI saves real time and money.
              Not buzzwords — practical moves that pay for themselves.
            </p>
          </div>
          <div className="rounded-2xl p-6 border border-warm-200/60 bg-warm-50/50">
            <h3 className="font-bold text-warm-900 mb-2">Implementation</h3>
            <p className="text-warm-600 leading-relaxed">
              I don't just advise. I build the automations, set up the tools, connect
              the systems. You get working solutions, not a strategy deck.
            </p>
          </div>
          <div className="rounded-2xl p-6 border border-warm-200/60 bg-warm-50/50">
            <h3 className="font-bold text-warm-900 mb-2">Ongoing Support</h3>
            <p className="text-warm-600 leading-relaxed">
              AI moves fast. I stay current so you don't have to. When something breaks
              or a better tool comes out, I handle it.
            </p>
          </div>
        </div>
      </section>

      <Divider />

      {/* -- Products -- */}
      <section className="py-12 md:py-16">
        <h2 className="text-xl md:text-2xl font-extrabold text-warm-900 mb-3">Products</h2>
        <p className="text-warm-500 mb-6">AI tools I've built for real problems. Free to try.</p>

        <div className="space-y-4">
          <Link to="/products/content-tools"
            className="group block rounded-2xl p-6 border-2 border-fire-200 bg-gradient-to-r from-fire-50/50 to-warm-50 hover:border-fire-400 hover:shadow-lg hover:shadow-fire-100/40 transition-all">
            <h3 className="font-bold text-warm-900 group-hover:text-fire-600 transition-colors text-lg">Content & Copy</h3>
            <p className="text-sm text-warm-600 mt-1">Score and improve your writing — headlines, ads, threads, email sequences, audience analysis.</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {['Headlines', 'Ads', 'Threads', 'Email', 'Audience'].map(f => (
                <span key={f} className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/80 text-warm-600 border border-warm-200/60">{f}</span>
              ))}
            </div>
          </Link>

          <div className="grid grid-cols-2 gap-4">
            <Link to="/products/page-roast"
              className="group block rounded-2xl p-5 border border-warm-200/60 bg-warm-50/50 hover:border-fire-300 hover:shadow-md transition-all">
              <h3 className="font-bold text-warm-800 group-hover:text-fire-600 transition-colors">PageRoast</h3>
              <p className="text-xs text-warm-500 mt-1">Landing page CRO audit</p>
            </Link>
            <Link to="/products/launch-grader"
              className="group block rounded-2xl p-5 border border-warm-200/60 bg-warm-50/50 hover:border-fire-300 hover:shadow-md transition-all">
              <h3 className="font-bold text-warm-800 group-hover:text-fire-600 transition-colors">LaunchGrader</h3>
              <p className="text-xs text-warm-500 mt-1">Go-to-market readiness</p>
            </Link>
            <Link to="/products/stack-audit"
              className="group block rounded-2xl p-5 border border-warm-200/60 bg-warm-50/50 hover:border-fire-300 hover:shadow-md transition-all">
              <h3 className="font-bold text-warm-800 group-hover:text-fire-600 transition-colors">StackAudit</h3>
              <p className="text-xs text-warm-500 mt-1">Find SaaS waste</p>
            </Link>
            <Link to="/products/local-score"
              className="group block rounded-2xl p-5 border border-warm-200/60 bg-warm-50/50 hover:border-fire-300 hover:shadow-md transition-all">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-warm-800 group-hover:text-fire-600 transition-colors">LocalScore</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">Free</span>
              </div>
              <p className="text-xs text-warm-500 mt-1">Private doc analysis</p>
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom spacer */}
      <div className="pb-12" />
    </article>
  );
}
