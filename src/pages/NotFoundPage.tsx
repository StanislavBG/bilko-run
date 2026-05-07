import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { track } from '../hooks/usePageView.js';

// All AI tools live as static-path siblings now; cross-promo to them needs a full
// page load (Fastify serves the static bundle), so use <a href> not <Link to>.
const TOOL_LINKS = [
  { href: '/projects/page-roast/', label: 'PageRoast', desc: 'Roast your landing page' },
  { href: '/projects/headline-grader/', label: 'HeadlineGrader', desc: 'Score your headline' },
  { href: '/projects/stack-audit/', label: 'StackAudit', desc: 'Cut SaaS costs' },
  { href: '/projects/local-score/', label: 'LocalScore', desc: 'Private doc analysis' },
  { href: '/projects/launch-grader/', label: 'LaunchGrader', desc: 'Launch readiness audit' },
];

export function NotFoundPage() {
  useEffect(() => { track('not_found'); }, []);
  return (
    <section className="max-w-2xl mx-auto px-6 py-20 text-center">
      <p className="text-6xl font-black text-warm-200 mb-4">404</p>
      <h1 className="text-2xl font-extrabold text-warm-900 mb-2">Page not found</h1>
      <p className="text-warm-500 mb-8">This page doesn't exist. But these do:</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-left mb-8">
        {TOOL_LINKS.map(({ href, label, desc }) => (
          <a key={href} href={href} className="group bg-warm-50 rounded-xl p-4 border border-warm-200/60 hover:border-fire-300 transition-all">
            <p className="text-sm font-bold text-warm-800 group-hover:text-fire-600">{label}</p>
            <p className="text-xs text-warm-500">{desc}</p>
          </a>
        ))}
        <Link to="/blog" className="group bg-warm-50 rounded-xl p-4 border border-warm-200/60 hover:border-fire-300 transition-all">
          <p className="text-sm font-bold text-warm-800 group-hover:text-fire-600">Blog</p>
          <p className="text-xs text-warm-500">Lessons from building</p>
        </Link>
      </div>
      <Link to="/" className="text-fire-500 hover:text-fire-600 font-semibold text-sm">Back to homepage &rarr;</Link>
    </section>
  );
}
