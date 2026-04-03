import { type ReactNode } from 'react';

export function ToolHero({ title, tagline, children, tab, onTabChange, hasCompare }: {
  title: string;
  tagline: string;
  children: ReactNode;
  tab?: 'score' | 'compare';
  onTabChange?: (tab: 'score' | 'compare') => void;
  hasCompare?: boolean;
}) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,107,26,0.12),transparent_70%)]" />

      <div className="relative max-w-3xl mx-auto px-6 py-16 md:py-24 text-center">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.1] animate-slide-up">
          {title}
        </h1>
        <p className="mt-3 text-base md:text-lg text-warm-400 max-w-lg mx-auto animate-slide-up" style={{ animationDelay: '60ms' }}>
          {tagline}
        </p>

        {hasCompare && tab && onTabChange && (
          <div className="mt-8 animate-slide-up" style={{ animationDelay: '120ms' }}>
            <div className="flex gap-1 bg-white/10 backdrop-blur-sm rounded-xl p-1 mb-5 w-fit mx-auto">
              <button
                onClick={() => onTabChange('score')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === 'score' ? 'bg-white text-warm-900 shadow-sm' : 'text-warm-400 hover:text-white'
                }`}
              >
                Score
              </button>
              <button
                onClick={() => onTabChange('compare')}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === 'compare' ? 'bg-white text-warm-900 shadow-sm' : 'text-warm-400 hover:text-white'
                }`}
              >
                A/B Compare
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 animate-slide-up" style={{ animationDelay: '160ms' }}>
          {children}
        </div>
      </div>
    </section>
  );
}
