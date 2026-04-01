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
          No subscriptions. No BS.
        </h1>
        <p className="mt-4 text-lg text-warm-500">
          Your first roast is free. After that, $1 per roast. That's it.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-12 md:pb-16">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Free */}
          <div className="bg-white rounded-2xl border border-warm-200/60 p-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-2">Free</h2>
            <div className="text-4xl font-black text-warm-900 mb-1">$0</div>
            <p className="text-sm text-warm-500 mb-6">See what you're missing</p>
            <ul className="space-y-3 text-sm text-warm-600 mb-8">
              {[
                '1 free roast on sign-up',
                'Full 4-section score breakdown',
                'The savage one-liner',
                '3 highest-impact fixes',
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
              Get your free roast
            </Link>
          </div>

          {/* Credits */}
          <div className="bg-white rounded-2xl border-2 border-fire-300 p-8 relative shadow-lg shadow-fire-100/30">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-fire-500 text-white text-xs font-bold px-3 py-0.5 rounded-full">
              Best Value
            </div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Credits</h2>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-warm-900">$5</span>
              <span className="text-sm text-warm-500">/ 5 credits</span>
            </div>
            <p className="text-sm text-warm-500 mb-6 mt-1">$1 per roast. Pay once, use anytime.</p>
            <ul className="space-y-3 text-sm text-warm-600 mb-8">
              {[
                'PageRoast = 1 credit',
                'A/B Compare = 2 credits',
                'Credits never expire',
                'Download full results as JSON',
                'Buy more whenever you need',
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
      </section>

      {/* FAQ */}
      <section className="border-t border-warm-200/40 bg-warm-100/30">
        <div className="max-w-2xl mx-auto px-6 py-12 md:py-16">
          <h2 className="text-xl font-extrabold text-warm-900 text-center mb-8">Common questions</h2>
          <div className="space-y-5">
            {[
              { q: 'Why not a subscription?', a: 'Because you don\'t roast pages every day. Pay for what you use, not what you don\'t.' },
              { q: 'What if I don\'t use all my credits?', a: 'They never expire. Buy 5 today, use the last one next year. No pressure.' },
              { q: 'Can I get a refund?', a: 'Credits are consumed instantly on analysis. All purchases are final — but your first roast is free, so you know what you\'re getting.' },
              { q: 'Is my payment secure?', a: 'Payments are processed by Stripe. We never see your card number.' },
              { q: 'What\'s the A/B Compare?', a: 'Paste two URLs — your page vs. a competitor. We score both and pick a winner. Costs 2 credits because we\'re working twice as hard.' },
            ].map(({ q, a }) => (
              <div key={q}>
                <h3 className="font-bold text-warm-900 mb-1 text-sm">{q}</h3>
                <p className="text-sm text-warm-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-12 text-center">
        <p className="text-sm text-warm-400">
          One-time purchase. Powered by Stripe. No hidden fees. Built by one person.
        </p>
      </section>
    </>
  );
}
