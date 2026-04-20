import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LISTING_TOOLS, type ToolStatus, type ToolCategory } from '../config/tools.js';

const STATUS_STYLES: Record<ToolStatus, string> = {
  live: 'bg-green-50 text-green-600',
  beta: 'bg-amber-50 text-amber-600',
  'coming-soon': 'bg-warm-100 text-warm-400',
};

const STATUS_LABELS: Record<ToolStatus, string> = {
  live: 'Live',
  beta: 'Beta',
  'coming-soon': 'Coming Soon',
};

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  content: 'Content & Copy',
  business: 'Business',
  devtools: 'Developer Tools',
};

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
          {LISTING_TOOLS.map((tool) => {
            const isLive = tool.status === 'live';
            const Wrapper = isLive ? Link : 'div';
            const wrapperProps = isLive
              ? { to: `/products/${tool.slug}` as string }
              : {};

            return (
              <Wrapper
                key={tool.slug}
                {...wrapperProps as any}
                className={`group relative bg-white rounded-2xl p-6 transition-all ${
                  isLive
                    ? `card-base ${tool.accent.hoverBorder} hover:shadow-elevation-2 hover:-translate-y-1 cursor-pointer`
                    : 'border border-warm-200/40 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full ${tool.accent.bg}`} />
                    <span className="text-label text-warm-400">
                      {CATEGORY_LABELS[tool.category]}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${STATUS_STYLES[tool.status]}`}>
                    {STATUS_LABELS[tool.status]}
                  </span>
                </div>

                <h3 className={`text-xl font-bold mb-1 ${isLive ? 'text-warm-900 group-hover:text-warm-950 transition-colors' : 'text-warm-700'}`}>
                  {tool.name}
                </h3>
                <p className="text-sm font-medium text-warm-600 mb-3">{tool.tagline}</p>
                <p className="text-sm text-warm-500 leading-relaxed mb-4">
                  {tool.description}
                </p>

                <div className="flex flex-wrap gap-2">
                  {tool.features.map((feature) => (
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
