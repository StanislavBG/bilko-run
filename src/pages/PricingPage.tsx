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
          Your first roast is free. After that, credits start at $1. That's it.
        </p>
        <p className="mt-2 text-sm text-warm-400">
          It's like hiring a conversion copywriter — for $1 instead of $200/hour.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-12 md:pb-16">
        <div className="grid md:grid-cols-3 gap-5 items-start">
          {/* Free */}
          <div className="bg-white rounded-2xl border border-warm-200/60 p-7">
            <h2 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-3">Free</h2>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-black text-warm-900">$0</span>
            </div>
            <p className="text-sm text-warm-500 mb-5">See what you're missing</p>
            <ul className="space-y-2.5 text-sm text-warm-600 mb-7">
              {[
                '1 free roast on sign-up',
                'Full 4-section score breakdown',
                'The savage one-liner',
                '3 highest-impact fixes',
                'Shareable score card',
              ].map(f => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-warm-400 mt-0.5 flex-shrink-0">&#x2713;</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to="/projects/page-roast"
              className="block w-full py-3 text-center text-sm font-bold text-warm-600 border border-warm-200 hover:border-warm-300 rounded-xl transition-colors"
            >
              Get your free roast
            </Link>
          </div>

          {/* 1 Credit */}
          <div className="bg-white rounded-2xl border border-warm-200/60 p-7">
            <h2 className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-3">Pay as you go</h2>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-black text-warm-900">$1</span>
              <span className="text-sm text-warm-400 ml-0.5">/ credit</span>
            </div>
            <p className="text-sm text-warm-500 mb-5">Just need one analysis? Done.</p>
            <ul className="space-y-2.5 text-sm text-warm-600 mb-7">
              {[
                'Everything in Free',
                'All 8 tools = 1 credit each',
                'A/B Compare = 2 credits',
                'Credits never expire',
                'Download results as JSON',
              ].map(f => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-fire-400 mt-0.5 flex-shrink-0">&#x2713;</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to="/projects/page-roast"
              className="block w-full py-3 text-center text-sm font-bold text-fire-600 border-2 border-fire-200 hover:border-fire-400 rounded-xl transition-colors"
            >
              Try any tool
            </Link>
          </div>

          {/* 7 Credits — Best Value */}
          <div className="bg-white rounded-2xl border-2 border-fire-400 p-7 relative shadow-lg shadow-fire-100/40 md:-mt-2 md:mb-[-8px]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-fire-500 text-white text-[11px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
              Best Value
            </div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-3 mt-1">Credit Bundle</h2>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-black text-warm-900">$5</span>
              <span className="text-sm text-warm-400 ml-0.5">/ 7 credits</span>
            </div>
            <p className="text-sm text-warm-500 mb-5">$0.71 per roast — save 29%</p>
            <ul className="space-y-2.5 text-sm text-warm-600 mb-7">
              {[
                'Everything in Free',
                'PageRoast = 1 credit',
                'A/B Compare = 2 credits',
                'Credits never expire',
                'Download results as JSON',
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
              Try any tool
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
              { q: 'What if I don\'t use all my credits?', a: 'They never expire. Buy today, use the last one next year. No pressure.' },
              { q: 'Can I get a refund?', a: 'Credits are consumed instantly on analysis. All purchases are final — but your first roast is free, so you know what you\'re getting.' },
              { q: 'Is my payment secure?', a: 'Payments are processed by Stripe. We never see your card number.' },
              { q: 'What\'s the A/B Compare?', a: 'Paste two URLs — your page vs. a competitor. We score both and pick a winner. Costs 2 credits because we\'re working twice as hard.' },
              { q: 'How does this compare to other tools?', a: 'Tools like Bestever ($99/mo), AdCreative.ai ($29/mo), and Lapis ($99/mo) charge monthly subscriptions for similar analysis. bilko.run gives you 8 tools for $1/credit with no subscription. Score a headline, grade an ad, roast a landing page — all from the same wallet.' },
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
