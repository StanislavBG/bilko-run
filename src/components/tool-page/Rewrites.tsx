import { useState } from 'react';

interface Rewrite {
  text: string;
  predicted_score?: number;
  optimized_for?: string;
  technique?: string;
  label?: string;
  why_better?: string;
}

export function Rewrites({ rewrites, noun = 'rewrite' }: { rewrites: Rewrite[]; noun?: string }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (!rewrites || rewrites.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
      <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">
        AI {noun}s ({rewrites.length})
      </h3>
      <div className="space-y-3">
        {rewrites.map((rw, i) => (
          <div key={i} className="border border-warm-100 rounded-xl p-4 hover:border-fire-200 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {(rw.label || rw.optimized_for) && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-fire-500 mb-1 block">
                    {rw.label || rw.optimized_for?.replace(/_/g, ' ')}
                  </span>
                )}
                <p className="text-sm text-warm-800 font-medium leading-relaxed">{rw.text}</p>
                {rw.why_better && (
                  <p className="text-xs text-warm-500 mt-1 italic">{rw.why_better}</p>
                )}
                {rw.technique && (
                  <p className="text-xs text-warm-400 mt-1">{rw.technique}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {rw.predicted_score !== undefined && (
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    ~{rw.predicted_score}
                  </span>
                )}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(rw.text);
                    setCopiedIdx(i);
                    setTimeout(() => setCopiedIdx(null), 1500);
                  }}
                  className="text-xs text-warm-400 hover:text-fire-500 transition-colors"
                >
                  {copiedIdx === i ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
