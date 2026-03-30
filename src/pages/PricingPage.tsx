import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export function PricingPage() {
  useEffect(() => {
    document.title = 'Pricing — bilko.run';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  return (
    <>
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-8 md:pt-24 md:pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-warm-900 tracking-tight">
          Simple pricing. No subscriptions.
        </h1>
        <p className="mt-4 text-lg text-warm-500">
          Try free. Buy credits when you need more. That's it.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-16 md:pb-24">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Free */}
          <div className="bg-white rounded-2xl border border-warm-200/60 p-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-2">Free</h2>
            <div className="text-4xl font-black text-warm-900 mb-1">$0</div>
            <p className="text-sm text-warm-500 mb-6">1 free roast on sign-up</p>
            <ul className="space-y-3 text-sm text-warm-600 mb-8">
              {[
                '1 free PageRoast analysis',
                'Full score breakdown (4 sections)',
                'Savage roast line',
                'Top 3 fixes',
                'Shareable score card',
              ].map(f => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">&#x2713;</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to="/projects/page-roast"
              className="block w-full py-3 text-center text-sm font-bold text-warm-700 border-2 border-warm-200 hover:border-warm-300 rounded-xl transition-colors"
            >
              Get started free
            </Link>
          </div>

          {/* Credits */}
          <div className="bg-white rounded-2xl border-2 border-fire-300 p-8 relative shadow-lg shadow-fire-100/30">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-fire-500 text-white text-xs font-bold px-3 py-0.5 rounded-full">
              Most Popular
            </div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Credits</h2>
            <div className="text-4xl font-black text-warm-900 mb-1">$5</div>
            <p className="text-sm text-warm-500 mb-6">5 credits, use anytime</p>
            <ul className="space-y-3 text-sm text-warm-600 mb-8">
              {[
                'PageRoast = 1 credit',
                'A/B Compare = 2 credits',
                'Credits never expire',
                'Works across all tools',
                'Buy more anytime',
              ].map(f => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-fire-500 mt-0.5 flex-shrink-0">&#x2713;</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to="/projects/page-roast"
              className="block w-full py-3 text-center text-sm font-bold text-white bg-fire-500 hover:bg-fire-600 rounded-xl shadow-md shadow-fire-500/20 transition-all"
            >
              Start roasting
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-warm-400">
          No subscriptions. No hidden fees. One-time purchase. Powered by Stripe.
        </p>
      </section>
    </>
  );
}
