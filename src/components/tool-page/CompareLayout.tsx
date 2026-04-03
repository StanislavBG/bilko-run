import type { PillarScore } from './SectionBreakdown.js';
import { gradeColor, barColor } from './colors.js';

interface CompareCardProps {
  label: string;
  score: number;
  grade: string;
  verdict: string;
  pillars: Record<string, PillarScore>;
  pillarLabels: Record<string, string>;
  isWinner: boolean;
  isDimmed: boolean;
}

function CompareCard({ label, score, grade, verdict, pillars, pillarLabels, isWinner, isDimmed }: CompareCardProps) {
  return (
    <div className={`relative bg-white rounded-2xl border-2 p-5 transition-opacity ${
      isWinner ? 'border-green-300 shadow-lg shadow-green-100/50' : isDimmed ? 'border-warm-200 opacity-60' : 'border-warm-200'
    }`}>
      {isWinner && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-0.5 rounded-full">WINNER</div>
      )}
      <div className="text-center mb-4">
        <div className="text-xs uppercase tracking-wider text-warm-400 font-bold mb-2">{label}</div>
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl font-black text-warm-900">{score}</span>
          <span className={`text-2xl font-black ${gradeColor(grade)}`}>{grade}</span>
        </div>
        <p className="text-sm text-warm-600 italic mt-2 line-clamp-2">&ldquo;{verdict}&rdquo;</p>
      </div>
      <div className="space-y-2 border-t border-warm-100 pt-3">
        {Object.entries(pillars).map(([key, s]) => {
          const pct = Math.round((s.score / s.max) * 100);
          return (
            <div key={key}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-warm-500">{pillarLabels[key] ?? key}</span>
                <span className="font-bold text-warm-600">{s.score}/{s.max}</span>
              </div>
              <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CompareLayout({ winner, margin, verdict, analysis, cardA, cardB, pillarLabels }: {
  winner: 'A' | 'B' | 'tie';
  margin: number;
  verdict: string;
  analysis?: string;
  cardA: { label: string; score: number; grade: string; verdict: string; pillars: Record<string, PillarScore> };
  cardB: { label: string; score: number; grade: string; verdict: string; pillars: Record<string, PillarScore> };
  pillarLabels: Record<string, string>;
}) {
  return (
    <div className="space-y-6">
      {/* Winner Banner */}
      {winner !== 'tie' ? (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center animate-slide-up">
          <p className="text-2xl font-black text-green-700">{cardA.label.includes(winner) ? cardA.label : cardB.label} wins</p>
          <p className="text-sm text-green-600 mt-1">+{margin} points ahead</p>
        </div>
      ) : (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 text-center animate-slide-up">
          <p className="text-2xl font-black text-yellow-700">It's a tie!</p>
        </div>
      )}

      {/* Side-by-side */}
      <div className="grid md:grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <CompareCard {...cardA} pillarLabels={pillarLabels} isWinner={winner === 'A'} isDimmed={winner === 'B'} />
        <CompareCard {...cardB} pillarLabels={pillarLabels} isWinner={winner === 'B'} isDimmed={winner === 'A'} />
      </div>

      {/* Verdict */}
      <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
        <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-3">Verdict</h3>
        <p className="text-sm text-warm-700 leading-relaxed">{verdict}</p>
      </div>

      {/* Analysis */}
      {analysis && (
        <div className="bg-gradient-to-r from-fire-50 to-warm-50 rounded-2xl border border-fire-200 p-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-3">Strategic Analysis</h3>
          <p className="text-sm text-warm-700 leading-relaxed">{analysis}</p>
        </div>
      )}
    </div>
  );
}
