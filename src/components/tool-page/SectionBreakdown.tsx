import { barColor } from './colors.js';

export interface PillarScore {
  score: number;
  max: number;
  feedback: string;
}

export function SectionBreakdown({ pillars, labels }: {
  pillars: Record<string, PillarScore>;
  labels: Record<string, string>;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-elevation-1 p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
      <h3 className="text-label text-warm-400 mb-6">Score Breakdown</h3>
      <div className="space-y-6">
        {Object.entries(pillars).map(([key, pillar]) => {
          const pct = Math.round((pillar.score / pillar.max) * 100);
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-warm-800">{labels[key] ?? key}</span>
                <span className="text-sm font-bold text-warm-700 tabular-nums">{pillar.score}/{pillar.max}</span>
              </div>
              <div className="h-2 bg-warm-100 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColor(pct)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-sm text-warm-500 leading-relaxed">{pillar.feedback}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
