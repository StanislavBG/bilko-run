import { Link } from 'react-router-dom';
import { useEffect } from 'react';

export function NotFoundPage() {
  useEffect(() => {
    document.title = '404 — bilko.run';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  return (
    <section className="max-w-2xl mx-auto px-6 py-24 text-center">
      <div className="text-6xl mb-4">🔥</div>
      <h1 className="text-4xl font-black text-warm-900 mb-3">Page not found</h1>
      <p className="text-warm-500 mb-8">This page doesn't exist. Maybe it got roasted too hard.</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/"
          className="px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl transition-all"
        >
          Go home
        </Link>
        <Link
          to="/projects/page-roast"
          className="px-6 py-3 border-2 border-warm-300 hover:border-warm-400 text-warm-700 font-semibold rounded-xl transition-all"
        >
          Roast something
        </Link>
      </div>
    </section>
  );
}
