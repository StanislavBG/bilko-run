import { useState } from 'react';
import { gradeColorLight } from './colors.js';

export function ScoreCard({ score, grade, verdict, toolName }: {
  score: number; grade: string; verdict: string; toolName: string;
}) {
  const [copied, setCopied] = useState(false);
  const shareText = `Just scored ${score}/100 (${grade}) on ${toolName} 🔥\n\n"${verdict}"\n\nFree at bilko.run`;

  return (
    <div className="bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900 rounded-2xl p-6 md:p-8 text-center relative overflow-hidden animate-slide-up">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,107,26,0.12),transparent_60%)]" />
      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-widest text-fire-400 mb-4">{toolName}</p>
        <div className="flex items-center justify-center gap-4 mb-3">
          <span className="text-6xl md:text-7xl font-black text-white">{score}</span>
          <div className="text-left">
            <div className={`text-4xl md:text-5xl font-black ${gradeColorLight(grade)}`}>{grade}</div>
            <div className="text-xs text-warm-500">/100</div>
          </div>
        </div>
        <p className="text-fire-300 font-bold italic text-sm md:text-base max-w-md mx-auto mb-4">
          &ldquo;{verdict}&rdquo;
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <button
            onClick={() => { navigator.clipboard.writeText(shareText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
            className="px-4 py-2 border border-warm-700 hover:border-warm-500 text-warm-400 hover:text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {copied ? 'Copied!' : 'Copy Result'}
          </button>
          <button
            onClick={() => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank', 'width=550,height=420')}
            className="px-4 py-2 bg-warm-800 hover:bg-warm-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Share on X
          </button>
        </div>
      </div>
    </div>
  );
}
