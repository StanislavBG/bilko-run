import { type ReactNode } from 'react';
import { type ToolTheme, getToolTheme } from './themes.js';

export function ToolHero({ title, tagline, children, tab, onTabChange, hasCompare, toolSlug }: {
  title: string;
  tagline: string;
  children: ReactNode;
  tab?: 'score' | 'compare';
  onTabChange?: (tab: 'score' | 'compare') => void;
  hasCompare?: boolean;
  /** Tool slug for theme colors — e.g. 'headline-grader', 'ad-scorer' */
  toolSlug?: string;
}) {
  const theme: ToolTheme = getToolTheme(toolSlug ?? 'page-roast');

  return (
    <section className="relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${theme.heroGradient}`} />
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse at center, ${theme.glowColor}, transparent 70%)` }}
      />
      {/* Subtle top highlight for depth (Stripe-style inset) */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="relative max-w-3xl mx-auto px-6 py-16 md:py-24 text-center">
        <h1 className="text-display-lg text-white animate-slide-up">
          {title}
        </h1>
        <p className="mt-4 text-base md:text-lg text-warm-400 max-w-lg mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '60ms' }}>
          {tagline}
        </p>

        {hasCompare && tab && onTabChange && (
          <div className="mt-8 animate-slide-up" style={{ animationDelay: '120ms' }}>
            <div className="flex gap-1 bg-white/[0.08] backdrop-blur-sm rounded-xl p-1 mb-5 w-fit mx-auto">
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

        <p className="mt-4 text-xs text-warm-500 flex items-center justify-center gap-2">
          <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
          Free to try &middot; Results in ~30 seconds &middot; No credit card
        </p>
      </div>
    </section>
  );
}
