import React, { useState } from 'react';
import { API } from '../data/api.js';
import { EmailCapture, PricingTiers, ProGate, RateLimitGate, ShareButton } from './ContentGradeShared.js';

interface PillarScore {
  score: number;
  max: number;
  feedback: string;
}

interface AdRewrite {
  text: string;
  predicted_score: number;
  optimized_for: string;
}

interface ScorerResult {
  total_score: number;
  grade: string;
  pillar_scores: {
    hook: PillarScore;
    value_prop: PillarScore;
    emotional: PillarScore;
    cta_conversion: PillarScore;
  };
  verdict: string;
  rewrites?: AdRewrite[];
  upgrade_hook?: string;
}

interface CompareResult {
  adCopyA: ScorerResult;
  adCopyB: ScorerResult;
  comparison: {
    winner: 'A' | 'B' | 'tie';
    margin: number;
    verdict: string;
    pillar_winners: {
      hook: 'A' | 'B' | 'tie';
      value_prop: 'A' | 'B' | 'tie';
      emotional: 'A' | 'B' | 'tie';
      cta_conversion: 'A' | 'B' | 'tie';
    };
    suggested_hybrid: string;
    strategic_analysis: string;
  };
}

const GRADE_COLORS: Record<string, string> = {
  'A+': '#4caf50', A: '#4caf50', 'A-': '#4caf50',
  'B+': '#4a90d9', B: '#4a90d9', 'B-': '#4a90d9',
  'C+': '#ffd54f', C: '#ffd54f', 'C-': '#ffd54f',
  D: '#ff9800', F: '#ef5350',
};

const PILLAR_LABELS: Record<string, string> = {
  hook: 'Hook Strength',
  value_prop: 'Value Proposition',
  emotional: 'Emotional Architecture',
  cta_conversion: 'CTA & Conversion',
};

const PLATFORMS = ['facebook', 'google', 'linkedin'] as const;
const ACCENT = '#00bfa5';

function PillarBar({ pillarKey, pillar }: { pillarKey: string; pillar: PillarScore }) {
  const label = PILLAR_LABELS[pillarKey] ?? pillarKey;
  const pct = Math.round((pillar.score / pillar.max) * 100);
  const color = pct >= 80 ? '#4caf50' : pct >= 60 ? '#4a90d9' : pct >= 40 ? '#ffd54f' : '#ef5350';

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#ccc' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#ddd' }}>{pillar.score}/{pillar.max}</span>
      </div>
      <div style={{ height: 6, background: '#1a1a2e', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', background: color, borderRadius: 3,
          width: `${pct}%`, transition: 'width 0.7s ease',
        }} />
      </div>
      <p style={{ marginTop: 6, fontSize: 11, color: '#777', lineHeight: 1.4 }}>{pillar.feedback}</p>
    </div>
  );
}

function CompareScoreCard({ label, result, isWinner, isDimmed }: {
  label: string;
  result: ScorerResult;
  isWinner: boolean;
  isDimmed: boolean;
}) {
  const gradeColor = GRADE_COLORS[result.grade] ?? '#777';
  return (
    <div style={{
      flex: 1,
      background: isWinner ? '#0a2a25' : '#12121f',
      border: `1px solid ${isWinner ? '#1a4a3a' : '#1a1a2e'}`,
      borderRadius: 12,
      padding: 16,
      opacity: isDimmed ? 0.6 : 1,
      transition: 'opacity 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 2 }}>{label}</span>
        {isWinner && (
          <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: '#4caf5020', color: '#4caf50', border: '1px solid #4caf5033', fontFamily: 'monospace', fontWeight: 700 }}>WINNER</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 40, fontWeight: 900, color: '#fff' }}>{result.total_score}</span>
        <span style={{ fontSize: 24, fontWeight: 900, color: gradeColor }}>{result.grade}</span>
      </div>
      {(Object.keys(PILLAR_LABELS) as Array<keyof typeof PILLAR_LABELS>).map(key => {
        const val = result.pillar_scores[key as keyof ScorerResult['pillar_scores']];
        const pct = Math.round((val.score / val.max) * 100);
        const color = pct >= 80 ? '#4caf50' : pct >= 60 ? '#4a90d9' : pct >= 40 ? '#ffd54f' : '#ef5350';
        return (
          <div key={key} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 9, color: '#666' }}>{PILLAR_LABELS[key]}</span>
              <span style={{ fontSize: 9, color: '#888', fontWeight: 700 }}>{val.score}/{val.max}</span>
            </div>
            <div style={{ height: 3, background: '#1a1a2e', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: color, borderRadius: 2, width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Score Mode ─────────────────────────────────────────────────────────────────

function ScoreMode({ adCopy, setAdCopy }: { adCopy: string; setAdCopy: (v: string) => void }) {
  const [platform, setPlatform] = useState<string>('facebook');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScorerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function score() {
    if (!adCopy.trim() || adCopy.trim().length < 10) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`${API}/demos/ad-scorer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adCopy: adCopy.trim(), platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data as ScorerResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scoring failed.');
    } finally {
      setLoading(false);
    }
  }

  const gradeColor = result ? (GRADE_COLORS[result.grade] ?? '#777') : '#777';

  return (
    <>
      {/* Platform selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
        {PLATFORMS.map(p => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            style={{
              padding: '5px 14px', fontSize: 11, fontWeight: 600, borderRadius: 6,
              border: platform === p ? `1px solid ${ACCENT}` : '1px solid #1a1a2e',
              background: platform === p ? '#0a2a25' : '#12121f',
              color: platform === p ? ACCENT : '#555',
              cursor: 'pointer', textTransform: 'capitalize',
            }}
          >{p}</button>
        ))}
      </div>

      {/* Input */}
      <div style={{ marginBottom: 20 }}>
        <textarea
          style={{
            width: '100%', background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 10,
            padding: '12px 14px', fontSize: 14, color: '#e0e0e0', resize: 'none',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
          rows={6}
          placeholder={`Paste your ${platform} ad copy here...`}
          value={adCopy}
          onChange={e => setAdCopy(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) score(); }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 10, color: '#444' }}>
            {adCopy.length}/2000 chars · Ctrl+Enter to score
          </span>
          <button
            onClick={score}
            disabled={loading || adCopy.trim().length < 10}
            style={{
              padding: '8px 20px', background: loading || adCopy.trim().length < 10 ? '#333' : ACCENT,
              color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', borderRadius: 8,
              cursor: loading || adCopy.trim().length < 10 ? 'not-allowed' : 'pointer',
              opacity: loading || adCopy.trim().length < 10 ? 0.5 : 1,
            }}
          >
            {loading ? 'Scoring...' : 'Score It'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#2e1a1a', border: '1px solid #5a2a2a', borderRadius: 10,
          padding: 12, marginBottom: 16, color: '#ef5350', fontSize: 12,
        }}>{error}</div>
      )}

      {result && (
        <div>
          {/* Score hero */}
          <div style={{
            background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
            padding: 24, textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 10 }}>
              <span style={{ fontSize: 56, fontWeight: 900, color: '#fff' }}>{result.total_score}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: gradeColor }}>{result.grade}</div>
                <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 2 }}>/ 100</div>
              </div>
            </div>
            <p style={{ color: ACCENT, fontSize: 14, fontWeight: 600, fontStyle: 'italic', maxWidth: 480, margin: '0 auto 12px' }}>
              "{result.verdict}"
            </p>
            <ShareButton
              shareText={`My ad copy scored ${result.total_score}/100 on AdScorer by Content Intelligence Stack. Grade yours → https://contentintelligence.ai`}
              accentColor={ACCENT}
            />
          </div>

          {/* Free: best rewrite (index 0) */}
          {result.rewrites && result.rewrites.length > 0 && (
            <div style={{
              background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
              padding: 20, marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, margin: 0 }}>
                  Best Rewrite
                </h2>
                <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: '#4caf5020', color: '#4caf50', border: '1px solid #4caf5033', fontFamily: 'monospace', fontWeight: 600, letterSpacing: 1 }}>FREE</span>
              </div>
              <div style={{
                padding: 12, borderRadius: 8, background: '#0d0d1a', border: '1px solid #1a1a2e',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{
                    flexShrink: 0, width: 28, height: 28, borderRadius: 14,
                    background: '#0a2a25', border: '1px solid #1a4a3a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: ACCENT,
                  }}>{result.rewrites[0].predicted_score}</div>
                  <span style={{ fontSize: 10, color: '#555' }}>
                    Optimized for: <span style={{ color: '#777' }}>{PILLAR_LABELS[result.rewrites[0].optimized_for] ?? result.rewrites[0].optimized_for}</span>
                  </span>
                </div>
                <p style={{ color: '#ddd', fontSize: 13, margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{result.rewrites[0].text}</p>
              </div>
            </div>
          )}

          <EmailCapture tool="ad-scorer" score={result.total_score} />

          {/* Pro gate: pillar breakdown + remaining rewrites + upgrade hook */}
          <ProGate accentColor={ACCENT} label="Full Ad Analysis">
            <div style={{
              background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
              padding: 20, marginBottom: 16,
            }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
                Pillar Breakdown
              </h2>
              {Object.entries(result.pillar_scores).map(([key, val]) => (
                <PillarBar key={key} pillarKey={key} pillar={val} />
              ))}
            </div>

            {result.rewrites && result.rewrites.length > 1 && (
              <div style={{
                background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
                padding: 20, marginBottom: 16,
              }}>
                <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>
                  All AI Rewrites
                </h2>
                {result.rewrites.slice(1).map((r, i) => (
                  <div key={i} style={{
                    padding: 12, borderRadius: 8, background: '#0d0d1a', border: '1px solid #1a1a2e',
                    marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{
                        flexShrink: 0, width: 28, height: 28, borderRadius: 14,
                        background: '#0a2a25', border: '1px solid #1a4a3a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: ACCENT,
                      }}>{r.predicted_score}</div>
                      <span style={{ fontSize: 10, color: '#555' }}>
                        Optimized for: <span style={{ color: '#777' }}>{PILLAR_LABELS[r.optimized_for] ?? r.optimized_for}</span>
                      </span>
                    </div>
                    <p style={{ color: '#ddd', fontSize: 13, margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{r.text}</p>
                  </div>
                ))}
              </div>
            )}

            {result.upgrade_hook && (
              <div style={{
                background: '#0a2a25', border: '1px solid #1a4a3a', borderRadius: 14,
                padding: 16, textAlign: 'center',
              }}>
                <p style={{ color: ACCENT, fontSize: 12, fontWeight: 500, margin: 0 }}>{result.upgrade_hook}</p>
              </div>
            )}
          </ProGate>

          <PricingTiers accentColor={ACCENT} />
        </div>
      )}
    </>
  );
}

// ── Compare Mode ───────────────────────────────────────────────────────────────

function CompareMode({ onTryHybrid }: { onTryHybrid: (text: string) => void }) {
  const [adCopyA, setAdCopyA] = useState('');
  const [adCopyB, setAdCopyB] = useState('');
  const [platform, setPlatform] = useState<string>('facebook');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function compare() {
    if (!adCopyA.trim() || !adCopyB.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API}/demos/ad-scorer/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adCopyA: adCopyA.trim(), adCopyB: adCopyB.trim(), platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data as CompareResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Comparison failed.');
    } finally {
      setLoading(false);
    }
  }

  const canCompare = adCopyA.trim().length >= 10 && adCopyB.trim().length >= 10;
  const pw = result?.comparison.pillar_winners;

  return (
    <>
      {/* Platform selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, justifyContent: 'center' }}>
        {PLATFORMS.map(p => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            style={{
              padding: '5px 14px', fontSize: 11, fontWeight: 600, borderRadius: 6,
              border: platform === p ? `1px solid ${ACCENT}` : '1px solid #1a1a2e',
              background: platform === p ? '#0a2a25' : '#12121f',
              color: platform === p ? ACCENT : '#555',
              cursor: 'pointer', textTransform: 'capitalize',
            }}
          >{p}</button>
        ))}
      </div>

      {/* Side-by-side inputs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {(['A', 'B'] as const).map(side => {
          const val = side === 'A' ? adCopyA : adCopyB;
          const setter = side === 'A' ? setAdCopyA : setAdCopyB;
          return (
            <div key={side} style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>
                Ad Copy {side}
              </div>
              <textarea
                style={{
                  width: '100%', background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 10,
                  padding: '10px 12px', fontSize: 13, color: '#e0e0e0', resize: 'none',
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
                rows={5}
                placeholder={`Paste ${platform} ad copy ${side}...`}
                value={val}
                onChange={e => setter(e.target.value)}
              />
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button
          onClick={compare}
          disabled={loading || !canCompare}
          style={{
            padding: '8px 20px', background: loading || !canCompare ? '#333' : ACCENT,
            color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', borderRadius: 8,
            cursor: loading || !canCompare ? 'not-allowed' : 'pointer',
            opacity: loading || !canCompare ? 0.5 : 1,
          }}
        >
          {loading ? 'Comparing...' : 'Compare'}
        </button>
      </div>

      {error && (
        <div style={{
          background: '#2e1a1a', border: '1px solid #5a2a2a', borderRadius: 10,
          padding: 12, marginBottom: 16, color: '#ef5350', fontSize: 12,
        }}>{error}</div>
      )}

      {result && (
        <div>
          {/* Winner banner */}
          {result.comparison.winner !== 'tie' ? (
            <div style={{
              background: '#0d1f0d', border: '1px solid #1e4a1e', borderRadius: 10,
              padding: '12px 20px', marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#4caf50', fontWeight: 800, fontSize: 15 }}>
                  Ad Copy {result.comparison.winner} wins
                </div>
                <div style={{ color: '#2e7d32', fontSize: 11, marginTop: 2 }}>
                  +{result.comparison.margin} pts · {Math.round((result.comparison.margin / Math.max(
                    result.comparison.winner === 'A' ? result.adCopyB.total_score : result.adCopyA.total_score, 1
                  )) * 100)}% stronger
                </div>
              </div>
              <ShareButton
                shareText={`Ad Copy ${result.comparison.winner} won my A/B test on AdScorer by ${result.comparison.margin} points. Try Content Intelligence Stack → https://contentintelligence.ai`}
                accentColor="#4caf50"
              />
            </div>
          ) : (
            <div style={{
              background: '#1a1a2e', border: '1px solid #2a2a4e', borderRadius: 10,
              padding: '10px 16px', marginBottom: 16, textAlign: 'center',
              color: '#ffd54f', fontWeight: 700, fontSize: 13,
            }}>
              It's a tie — both copies score equally
            </div>
          )}

          {/* Score cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, paddingTop: 16 }}>
            <CompareScoreCard
              label="Ad Copy A"
              result={result.adCopyA}
              isWinner={result.comparison.winner === 'A'}
              isDimmed={result.comparison.winner === 'B'}
            />
            <CompareScoreCard
              label="Ad Copy B"
              result={result.adCopyB}
              isWinner={result.comparison.winner === 'B'}
              isDimmed={result.comparison.winner === 'A'}
            />
          </div>

          {/* Pillar winners table */}
          {pw && (
            <div style={{
              background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
              padding: 20, marginBottom: 16,
            }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>
                Pillar Winners
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
                    {['Pillar', 'A Score', 'B Score', 'Winner'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: '#555', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(PILLAR_LABELS) as Array<keyof typeof PILLAR_LABELS>).map(key => {
                    const winner = pw[key as keyof typeof pw];
                    const aScore = result.adCopyA.pillar_scores[key as keyof ScorerResult['pillar_scores']].score;
                    const bScore = result.adCopyB.pillar_scores[key as keyof ScorerResult['pillar_scores']].score;
                    return (
                      <tr key={key} style={{ borderBottom: '1px solid #0d0d1a' }}>
                        <td style={{ padding: '8px', color: '#aaa' }}>{PILLAR_LABELS[key]}</td>
                        <td style={{ padding: '8px', color: winner === 'A' ? '#4caf50' : '#666', fontWeight: winner === 'A' ? 700 : 400 }}>{aScore}</td>
                        <td style={{ padding: '8px', color: winner === 'B' ? '#4caf50' : '#666', fontWeight: winner === 'B' ? 700 : 400 }}>{bScore}</td>
                        <td style={{ padding: '8px', color: winner === 'tie' ? '#ffd54f' : '#4caf50', fontWeight: 700 }}>
                          {winner === 'tie' ? 'Tie' : `Copy ${winner}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Verdict */}
          <div style={{
            background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
            padding: 20, marginBottom: 16,
          }}>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
              Analysis
            </h2>
            <p style={{ color: '#bbb', fontSize: 13, lineHeight: 1.6, margin: '0 0 10px' }}>{result.comparison.verdict}</p>
            {result.comparison.strategic_analysis && (
              <p style={{ color: '#777', fontSize: 12, lineHeight: 1.5, margin: 0, borderTop: '1px solid #1a1a2e', paddingTop: 10 }}>
                <span style={{ color: ACCENT, fontWeight: 600 }}>Next test: </span>
                {result.comparison.strategic_analysis}
              </p>
            )}
          </div>

          {/* Suggested hybrid */}
          <div style={{
            background: '#0a2520', border: '1px solid #1a4a3a', borderRadius: 14,
            padding: 20,
          }}>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: ACCENT, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
              Suggested Hybrid
            </h2>
            <p style={{ color: '#e0e0e0', fontSize: 13, fontWeight: 600, lineHeight: 1.6, marginBottom: 14 }}>
              {result.comparison.suggested_hybrid}
            </p>
            <button
              onClick={() => {
                const hybridText = result.comparison.suggested_hybrid.split(' | ')[0].trim();
                onTryHybrid(hybridText);
              }}
              style={{
                padding: '7px 16px', background: ACCENT, color: '#fff',
                fontWeight: 600, fontSize: 12, border: 'none', borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Try this copy →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Root Component ─────────────────────────────────────────────────────────────

export function AdScorerView() {
  const [tab, setTab] = useState<'score' | 'compare'>('score');
  const [adCopy, setAdCopy] = useState('');

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6, fontFamily: 'monospace' }}>
          ContentGrade Suite
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#e0e0e0', letterSpacing: -0.5 }}>
          Ad<span style={{ color: ACCENT }}>Scorer</span>
        </h1>
        <p style={{ color: '#777', fontSize: 14, marginTop: 6 }}>
          Paste your ad copy. Get a <span style={{ color: '#ccc', fontWeight: 500 }}>direct response audit</span> in seconds.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 }}>
          {['Hook Strength', 'Value Prop', 'Emotional Arc', 'CTA & Conversion'].map(f => (
            <span key={f} style={{
              fontSize: 10, padding: '3px 10px', borderRadius: 12,
              background: '#12121f', color: '#666', border: '1px solid #1a1a2e',
            }}>{f}</span>
          ))}
        </div>
      </div>

      {/* Tab toggle */}
      <div style={{
        display: 'flex', gap: 4, background: '#12121f', border: '1px solid #1a1a2e',
        borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content',
      }}>
        <button
          onClick={() => setTab('score')}
          style={{
            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: tab === 'score' ? ACCENT : 'transparent',
            color: tab === 'score' ? '#fff' : '#666',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          Score
        </button>
        <button
          onClick={() => setTab('compare')}
          style={{
            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: tab === 'compare' ? '#0a2a25' : 'transparent',
            color: tab === 'compare' ? ACCENT : '#444',
            transition: 'background 0.2s, color 0.2s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          A/B Compare
          <span style={{
            fontSize: 8, padding: '1px 6px', borderRadius: 4,
            background: `${ACCENT}22`, color: ACCENT, border: `1px solid ${ACCENT}33`,
            fontFamily: 'monospace', fontWeight: 700, letterSpacing: 0.5,
          }}>PRO</span>
        </button>
      </div>

      {tab === 'score' && (
        <ScoreMode adCopy={adCopy} setAdCopy={setAdCopy} />
      )}
      {tab === 'compare' && (
        <div>
          <ProGate accentColor={ACCENT} label="A/B Compare Mode">
            <CompareMode onTryHybrid={(text) => { setAdCopy(text); setTab('score'); }} />
          </ProGate>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 40, textAlign: 'center', fontSize: 10, color: '#333' }}>
        Direct response ad scoring using proven performance frameworks · Powered by local Claude session
      </div>
    </div>
  );
}
