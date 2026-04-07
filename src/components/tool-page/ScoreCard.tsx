import { useState } from 'react';
import { gradeColorLight } from './colors.js';
import { type ToolTheme, getToolTheme } from './themes.js';

export function ScoreCard({ score, grade, verdict, toolName, toolSlug }: {
  score: number; grade: string; verdict: string; toolName: string;
  /** Tool slug for theme colors */
  toolSlug?: string;
}) {
  const [copied, setCopied] = useState(false);
  const shareText = `Just scored ${score}/100 (${grade}) on ${toolName} 🔥\n\n"${verdict}"\n\nFree at bilko.run`;
  const theme: ToolTheme = getToolTheme(toolSlug ?? 'page-roast');

  return (
    <div className={`bg-gradient-to-br ${theme.heroGradient} rounded-2xl p-6 md:p-8 text-center relative overflow-hidden animate-slide-up shadow-dark-elevation`}>
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(circle at 50% 30%, ${theme.glowColor}, transparent 60%)` }}
      />
      {/* Top edge highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      <div className="relative">
        <p className={`text-label ${theme.accentText} mb-4`}>{toolName}</p>
        <div className="flex items-center justify-center gap-4 mb-3">
          <span className="text-6xl md:text-7xl font-black text-white" style={{ letterSpacing: '-0.04em' }}>{score}</span>
          <div className="text-left">
            <div className={`text-4xl md:text-5xl font-black ${gradeColorLight(grade)}`} style={{ letterSpacing: '-0.03em' }}>{grade}</div>
            <div className="text-xs text-warm-500">/100</div>
          </div>
        </div>
        <p className={`${theme.accentText} font-bold italic text-sm md:text-base max-w-md mx-auto mb-5`}>
          &ldquo;{verdict}&rdquo;
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <button
            onClick={() => { navigator.clipboard.writeText(shareText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
            className="px-4 py-2 border border-white/10 hover:border-white/20 text-warm-400 hover:text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {copied ? 'Copied!' : 'Copy Result'}
          </button>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify({ score, grade, verdict, tool: toolName }, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `${toolName.toLowerCase().replace(/\s+/g, '-')}-result.json`; a.click(); URL.revokeObjectURL(url);
            }}
            className="px-4 py-2 border border-white/10 hover:border-white/20 text-warm-400 hover:text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Download JSON
          </button>
          <button
            onClick={() => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank', 'width=550,height=420')}
            className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Share on X
          </button>
        </div>
      </div>
    </div>
  );
}
