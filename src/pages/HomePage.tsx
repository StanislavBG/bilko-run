import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const SOCIAL_LINKS = [
  { href: 'https://x.com/BilkoBibitkov', label: 'X / Twitter', icon: 'x' },
  { href: 'https://www.linkedin.com/in/bilko-bibitkov-23b5b13b1/', label: 'LinkedIn', icon: 'linkedin' },
  { href: 'https://github.com/BilkoBibitkov', label: 'GitHub', icon: 'github' },
] as const;

function SocialIconLarge({ type }: { type: string }) {
  if (type === 'x') return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
  );
  if (type === 'linkedin') return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
  );
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
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
      <header className="pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="flex flex-col sm:flex-row items-center gap-6 mb-10 animate-slide-up">
          <img
            src="/bilko.jpg"
            alt="Bilko"
            className="w-28 h-28 md:w-36 md:h-36 rounded-2xl object-cover shadow-lg shadow-warm-300/30 flex-shrink-0"
          />
          <div className="text-center sm:text-left">
            <h1 className="text-3xl md:text-4xl font-black text-warm-900">Bilko</h1>
            <p className="text-warm-500 text-base mt-1">Your AI-educated neighbor.</p>
          </div>
        </div>

        <div className="prose-warm animate-slide-up" style={{ animationDelay: '80ms' }}>
          <p className="text-lg md:text-xl text-warm-600 max-w-xl leading-relaxed">
            I help small businesses figure out AI — what to use, how to set it up,
            and how to make it actually work. Strategy, implementation, support.
            No jargon, no retainers.
          </p>
        </div>
      </header>

      {/* -- Email Capture -- */}
      <section className="pb-12">
        <div className="rounded-2xl border border-warm-200/60 bg-warm-50/50 p-6 md:p-8">
          <h2 className="text-lg font-bold text-warm-900 mb-2">Get AI tips that actually help</h2>
          <p className="text-sm text-warm-500 mb-4">Practical advice for small businesses. No spam, no fluff.</p>
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="flex-1 px-4 py-3 rounded-xl border border-warm-200 bg-white text-warm-900 placeholder:text-warm-400 text-sm focus:outline-none focus:ring-2 focus:ring-fire-500/30 focus:border-fire-400 transition-all"
            />
            <button
              type="submit"
              disabled={subscribeStatus === 'loading'}
              className="px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold text-sm rounded-xl shadow-sm shadow-fire-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-60"
            >
              {subscribeStatus === 'loading' ? 'Subscribing...' : 'Subscribe'}
            </button>
          </form>
          {subscribeStatus === 'success' && (
            <p className="text-sm text-green-600 mt-3">You're in. Check your inbox.</p>
          )}
          {subscribeStatus === 'error' && (
            <p className="text-sm text-red-500 mt-3">Something went wrong. Try again.</p>
          )}
        </div>
      </section>

      <Divider />

      {/* -- How I Help -- */}
      <section className="py-12 md:py-16">
        <h2 className="text-xl md:text-2xl font-extrabold text-warm-900 mb-8">How I help</h2>
        <div className="space-y-8">
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
        <p className="text-warm-500 mb-8">
          AI tools I've built for real problems. Grouped by what they do.
        </p>

        <div className="space-y-6">
          <Link to="/products/content-tools"
            className="group block rounded-2xl p-6 border border-warm-200/60 bg-warm-50/50 hover:border-fire-300 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-warm-800 group-hover:text-fire-600 transition-colors text-lg">Content & Copy Tools</h3>
                <p className="text-sm text-warm-500 mt-1">HeadlineGrader, AdScorer, ThreadGrader, EmailForge, AudienceDecoder</p>
                <p className="text-sm text-warm-600 mt-2">AI tools that analyze and improve your content. Free to try.</p>
              </div>
              <svg className="w-5 h-5 text-warm-300 group-hover:text-fire-500 flex-shrink-0 ml-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </div>
          </Link>

          <Link to="/products/business-tools"
            className="group block rounded-2xl p-6 border border-warm-200/60 bg-warm-50/50 hover:border-fire-300 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-warm-800 group-hover:text-fire-600 transition-colors text-lg">Business Tools</h3>
                <p className="text-sm text-warm-500 mt-1">PageRoast, LaunchGrader, StackAudit, LocalScore</p>
                <p className="text-sm text-warm-600 mt-2">Audit your landing page, launch readiness, SaaS stack, or sensitive documents.</p>
              </div>
              <svg className="w-5 h-5 text-warm-300 group-hover:text-fire-500 flex-shrink-0 ml-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </div>
          </Link>

          <Link to="/products/dev-tools"
            className="group block rounded-2xl p-6 border border-warm-200/60 bg-warm-50/50 hover:border-fire-300 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-warm-800 group-hover:text-fire-600 transition-colors text-lg">Developer Tools</h3>
                <p className="text-sm text-warm-500 mt-1">Stepproof, AgentTrace</p>
                <p className="text-sm text-warm-600 mt-2">Testing and observability for AI pipelines.</p>
              </div>
              <svg className="w-5 h-5 text-warm-300 group-hover:text-fire-500 flex-shrink-0 ml-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </div>
          </Link>
        </div>
      </section>

      <Divider />

      {/* -- Contact / Connect -- */}
      <section className="py-12 md:py-16">
        <h2 className="text-xl md:text-2xl font-extrabold text-warm-900 mb-4">Let's talk</h2>
        <div className="space-y-4 text-warm-600 leading-relaxed mb-8">
          <p>
            If you run a small business and want to know if AI can help — it probably can.
            DM me on X or connect on LinkedIn.
          </p>
        </div>

        {/* Social contact cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {SOCIAL_LINKS.map(({ href, label, icon }) => (
            <a key={icon} href={href} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-warm-200/60 bg-warm-50/50 hover:border-fire-300 hover:shadow-md transition-all group text-center">
              <div className="w-12 h-12 rounded-full bg-warm-100 group-hover:bg-fire-50 flex items-center justify-center text-warm-500 group-hover:text-fire-600 transition-colors">
                <SocialIconLarge type={icon} />
              </div>
              <div>
                <p className="font-bold text-warm-800 group-hover:text-fire-600 transition-colors">{label}</p>
                <p className="text-xs text-warm-400 mt-0.5">
                  {icon === 'x' && '@BilkoBibitkov'}
                  {icon === 'linkedin' && 'Bilko Bibitkov'}
                  {icon === 'github' && 'BilkoBibitkov'}
                </p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Bottom spacer */}
      <div className="pb-12" />
    </article>
  );
}
