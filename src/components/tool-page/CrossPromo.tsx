import { Link } from 'react-router-dom';
import { getTool } from '../../config/tools.js';

export function CrossPromo({ currentTool }: { currentTool: string }) {
  const promos = getTool(currentTool)?.crossPromo;
  if (!promos || promos.length === 0) return null;

  const resolved = promos
    .map(p => {
      const target = getTool(p.slug);
      return target ? { slug: target.slug, name: target.name, hook: p.hook } : null;
    })
    .filter((p): p is { slug: string; name: string; hook: string } => p !== null);

  if (resolved.length === 0) return null;

  return (
    <div className="max-w-2xl mx-auto px-6 pb-12">
      <div className="bg-warm-50/80 rounded-2xl shadow-elevation-1 p-6">
        <h3 className="text-label text-warm-400 mb-4">Next up</h3>
        <div className="space-y-3">
          {resolved.map(p => (
            <Link key={p.slug} to={`/projects/${p.slug}`}
              className="group flex items-center gap-3 p-3 rounded-xl bg-white shadow-elevation-1 hover:shadow-elevation-2 hover:-translate-y-0.5 transition-all">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-warm-800 group-hover:text-warm-900 transition-colors">{p.name}</span>
                <p className="text-xs text-warm-500 mt-0.5">{p.hook}</p>
              </div>
              <svg className="w-4 h-4 text-warm-400 group-hover:text-fire-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
