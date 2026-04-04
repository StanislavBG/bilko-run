import { useEffect } from 'react';
import { Link } from 'react-router-dom';

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

function Divider() {
  return <div className="max-w-xs mx-auto border-t border-warm-200/60 my-0" />;
}

export function HomePage() {
  useEffect(() => {
    document.title = 'Bilko — Builder, Tools, Lessons';
  }, []);

  return (
    <article className="max-w-2xl mx-auto px-6">

      {/* ── Intro ── */}
      <header className="pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="flex items-center gap-5 mb-8 animate-slide-up">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-fire-400 to-fire-600 text-white flex items-center justify-center text-3xl md:text-4xl font-black shadow-lg shadow-fire-500/20 flex-shrink-0">
            B
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-warm-900">Bilko</h1>
            <p className="text-warm-500 text-sm mt-0.5">Builder. Solo. Shipping AI tools from a laptop.</p>
          </div>
        </div>

        <div className="flex gap-2 mb-10">
          {SOCIAL_LINKS.map(({ href, label, icon }) => (
            <a key={icon} href={href} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-warm-200/60 text-warm-500 hover:text-fire-600 hover:border-warm-300 text-sm transition-colors">
              <SocialIcon type={icon} />
              <span className="hidden sm:inline">{label}</span>
            </a>
          ))}
        </div>

        <div className="prose-warm animate-slide-up" style={{ animationDelay: '80ms' }}>
          <p className="text-xl md:text-2xl font-bold text-warm-900 leading-snug mb-6">
            I build AI tools for founders, marketers, and developers who make
            things on the internet and don't have time to be bad at marketing.
          </p>
          <p className="text-warm-600 leading-relaxed">
            This is my corner of the internet. I use it to share what I'm building,
            what I've learned, and what I think about building software alone
            in the age of AI. If you're here, you're probably building something too.
            Good. Keep reading.
          </p>
          <p className="mt-4 text-sm text-warm-400">
            10 AI tools live &middot; Score, generate, and compare &middot; Free to start &middot; No agency needed
          </p>
        </div>
      </header>

      <Divider />

      {/* ── The Story ── */}
      <section className="py-12 md:py-16">
        <h2 className="text-xl md:text-2xl font-extrabold text-warm-900 mb-6">The short version</h2>
        <div className="space-y-4 text-warm-600 leading-relaxed">
          <p>
            I launched my first product to zero signups.
          </p>
          <p>
            The code was fine. The design was fine. The product actually worked. But the landing
            page — the only thing standing between a stranger and my product — was terrible. I
            didn't know it was terrible because I'd never studied what makes a landing page work.
            I thought "clear" meant the same as "clever." I thought one testimonial from a friend
            counted as social proof. I thought hiding the price made me seem premium.
          </p>
          <p>
            I was wrong about all of it.
          </p>
          <p>
            Over the next year, I studied conversion rate optimization, direct response copywriting,
            and landing page psychology. I read Joanna Wiebe, Peep Laja, Harry Dry. I learned
            that the headline is worth more than the rest of the page combined. That "social proof"
            means real people with real names saying specific things — not <em>"Great product!" — J.</em>
          </p>
          <p>
            I learned that most of this knowledge is locked behind $200/hour consultants and
            agencies that won't talk to you unless you're spending $10k/month on ads.
          </p>
          <p>
            So I started building tools that do what those consultants do — but in 30 seconds,
            for a dollar. Not generic AI summaries. Real analysis, using real frameworks,
            against your actual content.
          </p>
          <p className="font-semibold text-warm-800">
            That's bilko.run. Tools for makers who ship.
          </p>
        </div>
      </section>

      <Divider />

      {/* ── What I Believe ── */}
      <section className="py-12 md:py-16">
        <h2 className="text-xl md:text-2xl font-extrabold text-warm-900 mb-8">Things I believe</h2>
        <div className="space-y-8">
          <div>
            <h3 className="font-bold text-warm-900 mb-2">Most products fail at marketing, not engineering.</h3>
            <p className="text-warm-600 leading-relaxed">
              Developers spend months building features and minutes on the page that sells them.
              Then they wonder why nobody signs up. The landing page is the product's first
              impression, its elevator pitch, and its sales team — all at once. If you get it
              wrong, nothing downstream matters. Your beautiful dashboard, your elegant API,
              your 99.99% uptime — invisible. Because nobody got past your hero section.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-warm-900 mb-2">One person with AI can outship a team of ten.</h3>
            <p className="text-warm-600 leading-relaxed">
              This isn't aspirational — it's my daily experience. I use Claude as my architect,
              pair programmer, and code reviewer. I use Gemini to power the analysis tools.
              The entire bilko.run codebase — frontend, backend, database, payments, deployment —
              is maintained by one person. Not because I'm unusually productive, but because
              the tools have gotten that good. The gap between "idea" and "shipped product"
              has collapsed. The bottleneck is no longer engineering capacity. It's knowing
              what to build.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-warm-900 mb-2">Feedback should be specific, not supportive.</h3>
            <p className="text-warm-600 leading-relaxed">
              "Looks great!" is the most dangerous feedback a founder can get. It costs nothing
              to say and teaches nothing. The tools I build are designed to be honest, not nice.
              PageRoast doesn't tell you your page is good if it isn't. It tells you your
              hero section is vague, your social proof is weak, and your CTA is buried — then
              gives you specific fixes. The roast line exists because brutal honesty delivered
              with humor is more useful than polite dishonesty delivered with emojis.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-warm-900 mb-2">Building in public is a forcing function.</h3>
            <p className="text-warm-600 leading-relaxed">
              When I share what I'm building, I'm not doing it for engagement. I'm doing it
              because public accountability is the best antidote to perfectionism. If I say
              "shipping HeadlineGrader this month," I have to actually ship HeadlineGrader
              this month. The internet remembers. The alternative is spending six months
              polishing something in private that nobody asked for. I've done that. It's bad.
            </p>
          </div>

          <div>
            <h3 className="font-bold text-warm-900 mb-2">The best pricing model is the one that doesn't punish experimentation.</h3>
            <p className="text-warm-600 leading-relaxed">
              I hate subscriptions for tools I use twice a month. So bilko.run uses credits.
              Your first roast is free. After that, $1 per credit or $5 for seven. No recurring
              charges. No "you forgot to cancel" moment. No annual upsell. Buy when you need it,
              don't when you don't. If the tool is useful, you'll come back. If it isn't,
              I shouldn't be charging you monthly for it.
            </p>
          </div>
        </div>
      </section>

      <Divider />

      {/* ── What I'm Building ── */}
      <section className="py-12 md:py-16">
        <h2 className="text-xl md:text-2xl font-extrabold text-warm-900 mb-3">What I'm building</h2>
        <p className="text-warm-500 mb-8">
          Each tool takes a piece of the marketing or dev stack that used to require a
          specialist and makes it accessible to anyone in seconds.
        </p>

        <div className="space-y-6">
          {/* PageRoast */}
          <Link to="/projects/page-roast"
            className="group block rounded-2xl p-6 border-2 border-fire-200 bg-gradient-to-r from-fire-50/50 to-warm-50 hover:border-fire-400 hover:shadow-lg hover:shadow-fire-100/40 transition-all relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">LIVE</span>
              <span className="text-xs font-bold text-warm-400 uppercase tracking-wider">Content</span>
            </div>
            <h3 className="text-lg font-black text-warm-900 group-hover:text-fire-600 transition-colors mb-1">
              PageRoast
            </h3>
            <p className="text-sm font-medium text-fire-600 mb-3">Brutally honest landing page audits</p>
            <p className="text-sm text-warm-600 leading-relaxed">
              Paste any URL. AI reads every word on your page and scores it across four CRO
              frameworks: hero clarity, social proof quality, persuasion effectiveness, and
              conversion architecture. You get a score out of 100, a letter grade, section-by-section
              feedback with specific fixes, and a savage one-liner roast that people keep
              screenshotting and sharing. A/B Compare mode lets you pit your page against a
              competitor's — both get scored, one gets crowned, the other gets roasted.
            </p>
            <p className="text-sm text-fire-500 font-semibold mt-3 group-hover:text-fire-600">
              Try it free &rarr;
            </p>
          </Link>

          {/* Live tools */}
          {[
            { name: 'HeadlineGrader', slug: 'headline-grader', cat: 'Content', tagline: 'Score headlines like a pro copywriter',
              desc: 'Scores your headline against Masterson\'s Rule, Hormozi\'s Value Equation, and classic direct response frameworks. Specific scores, AI rewrites, reasons why it works or doesn\'t.', live: true },
            { name: 'AdScorer', slug: 'ad-scorer', cat: 'Marketing', tagline: 'Grade ad copy before you spend the budget',
              desc: 'Platform-specific grading for Facebook, Google, and LinkedIn. Scores hook, value prop, emotional architecture, and CTA. Rewrites included.', live: true },
            { name: 'ThreadGrader', slug: 'thread-grader', cat: 'Content', tagline: 'Score threads that don\'t die on tweet 2',
              desc: 'Scores hook strength, tension chain, payoff, and share triggers. Tweet-by-tweet breakdown shows exactly where readers drop off.', live: true },
            { name: 'EmailForge', slug: 'email-forge', cat: 'Marketing', tagline: 'Generate email sequences that convert',
              desc: 'Creates 5-email sequences using AIDA, PAS, Hormozi, Cialdini, and Storytelling frameworks. Full sequences with estimated open/click rates.', live: true },
            { name: 'AudienceDecoder', slug: 'audience-decoder', cat: 'Content', tagline: 'Decode who actually follows you',
              desc: 'Identifies audience archetypes, content patterns, engagement model, growth opportunities, and builds a content calendar. Your audience, decoded.', live: true },
            { name: 'LaunchGrader', slug: 'launch-grader', cat: 'Marketing', tagline: 'Is your product ready to launch?',
              desc: 'AI audits go-to-market readiness across 5 dimensions: value prop, pricing, social proof, onboarding, and positioning. Get a score, blockers, and a verdict.', live: true },
            { name: 'StackAudit', slug: 'stack-audit', cat: 'Operations', tagline: 'Find waste in your SaaS stack',
              desc: 'Paste your tool list. AI finds overlap, cheaper alternatives, self-hosted options, and calculates exactly how much you\'d save. Enterprise audit for $1.', live: true },
            { name: 'LocalScore', slug: 'local-score', cat: 'Privacy', tagline: 'Private document analysis — in your browser',
              desc: 'Analyze contracts, financials, and sensitive docs with AI that runs entirely in your browser. Your data never leaves your device. Free. Powered by Gemma via WebGPU.', live: true },
            { name: 'Stepproof', slug: 'stepproof', cat: 'Dev Tools', tagline: 'Regression tests for AI pipelines',
              desc: 'Write YAML scenarios, run them N times, check assertions. Preset scenarios or BYOK. Like unit tests, but for LLMs.', live: true },
            { name: 'AgentTrace', slug: 'agent-trace', cat: 'Dev Tools', tagline: 'Local observability for AI agents',
              desc: 'When your agent runs for 3 minutes and produces garbage, you need to know why. OpenTelemetry spans, local SQLite, zero cloud. CLI tool — install via npm.', live: false },
          ].map(tool => (
            tool.live ? (
              <Link key={tool.name} to={`/projects/${tool.slug}`}
                className="group rounded-2xl p-6 border border-warm-200/60 bg-warm-50/50 hover:border-fire-300 hover:shadow-md transition-all block">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">LIVE</span>
                  <span className="text-xs font-bold text-warm-400 uppercase tracking-wider">{tool.cat}</span>
                </div>
                <h3 className="font-bold text-warm-800 group-hover:text-fire-600 transition-colors mb-1">{tool.name}</h3>
                <p className="text-sm font-medium text-warm-600 mb-2">{tool.tagline}</p>
                <p className="text-sm text-warm-500 leading-relaxed">{tool.desc}</p>
              </Link>
            ) : (
              <div key={tool.name} className="rounded-2xl p-6 border border-warm-200/60 bg-warm-50/50 opacity-70">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warm-200 text-warm-500">CLI ONLY</span>
                  <span className="text-xs font-bold text-warm-400 uppercase tracking-wider">{tool.cat}</span>
                </div>
                <h3 className="font-bold text-warm-800 mb-1">{tool.name}</h3>
                <p className="text-sm font-medium text-warm-600 mb-2">{tool.tagline}</p>
                <p className="text-sm text-warm-500 leading-relaxed">{tool.desc}</p>
              </div>
            )
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link to="/projects" className="text-sm font-semibold text-fire-500 hover:text-fire-600">
            View all projects &rarr;
          </Link>
        </div>
      </section>

      <Divider />

      {/* ── How I Work ── */}
      <section className="py-12 md:py-16">
        <h2 className="text-xl md:text-2xl font-extrabold text-warm-900 mb-6">How the sausage gets made</h2>
        <div className="space-y-4 text-warm-600 leading-relaxed">
          <p>
            The tech stack is TypeScript everywhere. React and Vite on the frontend. Fastify and
            Turso (hosted SQLite) on the backend. Gemini for the AI analysis. Clerk for auth.
            Stripe for payments. Deployed on Render.
          </p>
          <p>
            I write almost all of the code collaboratively with Claude. Not "generate code and
            paste it" — actual back-and-forth where Claude reviews architecture decisions,
            catches bugs, suggests optimizations, and occasionally tells me my approach is wrong.
            I treat it like a senior engineer on the team. The difference is it's available
            at 2am and doesn't need a standup.
          </p>
          <p>
            This changes what's possible for a solo builder. I can ship a full-stack SaaS — auth,
            payments, AI analysis, admin dashboard, analytics — in days, not months. The
            constraint isn't "can I build it?" anymore. It's "should I build it?" That's a
            much better problem to have.
          </p>
          <p>
            I also try to build things that work at the speed of thought. PageRoast returns
            results in about 30 seconds. That's the target for everything: faster than
            hiring someone, more specific than Googling it, and cheap enough that you
            don't need to think about the price.
          </p>
        </div>
      </section>

      <Divider />

      {/* ── Lessons ── */}
      <section className="py-12 md:py-16">
        <h2 className="text-xl md:text-2xl font-extrabold text-warm-900 mb-8">Lessons from building alone</h2>
        <div className="space-y-6">
          {[
            { title: 'Ship before you\'re ready.',
              body: 'The first version of PageRoast was embarrassing. The UI was rough. The scoring was imprecise. The roast lines weren\'t funny enough. I shipped it anyway. People used it. They gave feedback. I fixed things. If I\'d waited until it was "ready," I\'d still be waiting. The market doesn\'t care about your code quality. It cares about whether your tool solves a problem.' },
            { title: 'Your landing page is never done.',
              body: 'I\'ve rewritten the bilko.run homepage four times. Each time I thought it was good. Each time, the data said otherwise. Bounce rate too high. Nobody clicking the CTA. Hero section too vague. The page you\'re reading right now is version five. It will change again. If you\'re not uncomfortable with how often you rewrite your copy, you\'re not rewriting it enough.' },
            { title: 'Charge from day one.',
              body: 'I gave my first tool away for free for months. I was afraid that charging would kill growth. Instead, free users gave zero feedback, requested infinite features, and churned immediately when I introduced pricing. Paid users told me exactly what was wrong, asked for specific improvements, and stuck around. Price is a filter. Charge early.' },
            { title: 'AI is a multiplier, not a replacement.',
              body: 'Claude doesn\'t write my code for me. It writes code with me. The difference matters. I still make every architecture decision. I still review every line. I still debug when things break. But the speed at which I can go from "I want this feature" to "this feature is live" has collapsed from days to hours. AI multiplied my output by 5x-10x. It didn\'t replace the judgment calls that matter.' },
            { title: 'Solo doesn\'t mean alone.',
              body: 'I don\'t have co-founders or employees, but I\'m not isolated. I share what I\'m building on X and LinkedIn. I talk to users. I read what other solo builders are doing. The internet is full of people building things alone — and most of them are happy to help each other. The solo builder community is the most generous community I\'ve been part of.' },
          ].map(({ title, body }) => (
            <div key={title}>
              <h3 className="font-bold text-warm-900 mb-2">{title}</h3>
              <p className="text-warm-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <Divider />

      {/* ── From the Blog ── */}
      <section className="py-12 md:py-16">
        <h2 className="text-xl md:text-2xl font-extrabold text-warm-900 mb-3">From the blog</h2>
        <p className="text-warm-500 mb-6 text-sm">Lessons from building 7 AI tools solo. New posts weekly.</p>
        <Link to="/blog/how-pageroast-went-from-frustration-to-product"
          className="group block rounded-2xl p-6 border border-warm-200/60 bg-warm-50/50 hover:border-fire-300 hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Product</span>
            <span className="text-xs text-warm-400">Latest post</span>
          </div>
          <h3 className="font-bold text-warm-800 group-hover:text-fire-600 transition-colors mb-1">
            How PageRoast Went From "I Need Feedback" to a Product That Roasts Landing Pages for Fun
          </h3>
          <p className="text-sm text-warm-500 leading-relaxed line-clamp-2">
            The story of building PageRoast — from launching to zero signups, learning CRO the hard way, and turning frustration into a tool.
          </p>
          <p className="mt-2 text-sm font-semibold text-fire-500 group-hover:text-fire-600">Read the full story &rarr;</p>
        </Link>
        <div className="mt-4 text-center">
          <Link to="/blog" className="text-sm font-semibold text-fire-500 hover:text-fire-600">View all posts &rarr;</Link>
        </div>
      </section>

      <Divider />

      {/* ── CTA / Connect ── */}
      <section className="py-12 md:py-16">
        <h2 className="text-xl md:text-2xl font-extrabold text-warm-900 mb-4">If you've read this far</h2>
        <div className="space-y-4 text-warm-600 leading-relaxed mb-8">
          <p>
            You're probably building something. Or thinking about it. Or stuck in the middle
            of it. Either way — I'd like to hear about it.
          </p>
          <p>
            I'm most active on X, where I share what I'm working on, honest numbers from
            my projects, and occasional opinions about solo building. I write longer posts
            on LinkedIn. All the code is on GitHub.
          </p>
          <p>
            If you have a landing page, go{' '}
            <Link to="/projects/page-roast" className="text-fire-600 font-semibold hover:text-fire-700 underline decoration-fire-200 hover:decoration-fire-400">
              roast it
            </Link>
            . It's free. You'll learn something. It might hurt.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 mb-12">
          {SOCIAL_LINKS.map(({ href, label, icon }) => (
            <a key={icon} href={href} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-warm-200 hover:border-warm-300 text-warm-600 hover:text-fire-600 text-sm font-semibold rounded-lg transition-colors">
              <SocialIcon type={icon} />
              {label}
            </a>
          ))}
        </div>

        <div className="bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900 rounded-2xl p-6 md:p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,107,26,0.12),transparent_60%)]" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-400 mb-3">Featured</p>
            <h3 className="text-xl md:text-2xl font-black text-white mb-2">PageRoast</h3>
            <p className="text-warm-400 text-sm mb-5 max-w-md mx-auto">
              AI scores your landing page and delivers a one-liner so savage
              you'll screenshot it before you fix anything.
            </p>
            <Link to="/projects/page-roast"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl shadow-lg shadow-fire-600/30 transition-all hover:-translate-y-0.5">
              Get Your Free Roast
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom spacer */}
      <div className="pb-12" />
    </article>
  );
}
