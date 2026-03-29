import React, { useState } from 'react';
import { API } from '../data/api.js';
import { EmailCapture, PricingTiers, ProGate, ShareButton } from './ContentGradeShared.js';

interface PillarScore {
  score: number;
  max: number;
  feedback: string;
}

interface TweetBreakdown {
  tweet_index: number;
  text_preview: string;
  score: number;
  note: string;
}

interface ThreadRewrite {
  label: string;
  text: string;
  why_better: string;
}

interface GraderResult {
  total_score: number;
  grade: string;
  pillar_scores: {
    hook: PillarScore;
    tension: PillarScore;
    payoff: PillarScore;
    share_trigger: PillarScore;
  };
  tweet_breakdown?: TweetBreakdown[];
  rewrites?: ThreadRewrite[];
  verdict: string;
  upgrade_hook?: string;
}

interface CompareResult {
  threadA: GraderResult;
  threadB: GraderResult;
  comparison: {
    winner: 'A' | 'B' | 'tie';
    margin: number;
    verdict: string;
    pillar_winners: {
      hook: 'A' | 'B' | 'tie';
      tension: 'A' | 'B' | 'tie';
      payoff: 'A' | 'B' | 'tie';
      share_trigger: 'A' | 'B' | 'tie';
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
  tension: 'Tension Chain',
  payoff: 'Payoff',
  share_trigger: 'Share Trigger',
};

const ACCENT = '#1da1f2'; // Twitter blue

function countTweets(text: string): number {
  const seps = text.split(/---|\n\n/).map(t => t.trim()).filter(Boolean);
  return Math.max(1, seps.length);
}

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
  result: GraderResult;
  isWinner: boolean;
  isDimmed: boolean;
}) {
  const gradeColor = GRADE_COLORS[result.grade] ?? '#777';
  return (
    <div style={{
      flex: 1,
      background: isWinner ? '#0a1e2e' : '#12121f',
      border: `1px solid ${isWinner ? '#1a3a5a' : '#1a1a2e'}`,
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
        const val = result.pillar_scores[key as keyof GraderResult['pillar_scores']];
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

function ScoreMode({ threadText, setThreadText }: { threadText: string; setThreadText: (v: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GraderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tweetScoreShared, setTweetScoreShared] = useState(false);

  const tweetCount = countTweets(threadText);

  async function grade() {
    if (!threadText.trim() || threadText.trim().length < 20) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API}/demos/thread-grader`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadText: threadText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data as GraderResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scoring failed.');
    } finally {
      setLoading(false);
    }
  }

  function tweetScore() {
    if (!result) return;
    const text = encodeURIComponent(
      `My thread scored ${result.total_score}/100 on ThreadGrader — try yours: https://contentintelligence.ai`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    setTweetScoreShared(true);
  }

  const gradeColor = result ? (GRADE_COLORS[result.grade] ?? '#777') : '#777';

  return (
    <>
      {/* Input */}
      <div style={{ marginBottom: 20 }}>
        <textarea
          style={{
            width: '100%', background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 10,
            padding: '12px 14px', fontSize: 13, color: '#e0e0e0', resize: 'vertical',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.6,
          }}
          rows={10}
          placeholder={`Paste your full thread here. Separate tweets with --- or a blank line.\n\nExample:\nMost people write threads wrong.\n\nHere's the mistake killing your reach:\n---\nThey start with context.\n\nReaders don't care about your context yet.\n---\nStart with the hook. Earn the context.`}
          value={threadText}
          onChange={e => setThreadText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) grade(); }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 10, color: '#444' }}>
            {tweetCount} tweet{tweetCount !== 1 ? 's' : ''} · {threadText.length}/5000 chars · Ctrl+Enter to grade
          </span>
          <button
            onClick={grade}
            disabled={loading || threadText.trim().length < 20}
            style={{
              padding: '8px 20px', background: loading || threadText.trim().length < 20 ? '#333' : ACCENT,
              color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', borderRadius: 8,
              cursor: loading || threadText.trim().length < 20 ? 'not-allowed' : 'pointer',
              opacity: loading || threadText.trim().length < 20 ? 0.5 : 1,
            }}
          >
            {loading ? 'Grading...' : 'Grade Thread'}
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
            <p style={{ color: ACCENT, fontSize: 14, fontWeight: 600, fontStyle: 'italic', maxWidth: 480, margin: '0 auto 16px' }}>
              "{result.verdict}"
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              <ShareButton
                shareText={`My thread scored ${result.total_score}/100 on ThreadGrader. Grade yours → https://contentintelligence.ai`}
                accentColor={ACCENT}
              />
              <button
                onClick={tweetScore}
                style={{
                  padding: '7px 14px', background: tweetScoreShared ? '#0a2a3a' : '#1a3a5a',
                  color: tweetScoreShared ? '#4caf50' : ACCENT,
                  border: `1px solid ${tweetScoreShared ? '#1a5a2a' : '#1a5a7a'}`,
                  borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}
              >
                {tweetScoreShared ? '✓ Tweeted!' : 'Tweet Your Score'}
              </button>
            </div>
          </div>

          {/* Free: Hook pillar */}
          <div style={{
            background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
            padding: 20, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, margin: 0 }}>
                Hook Analysis
              </h2>
              <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: '#4caf5020', color: '#4caf50', border: '1px solid #4caf5033', fontFamily: 'monospace', fontWeight: 600, letterSpacing: 1 }}>FREE</span>
            </div>
            <PillarBar pillarKey="hook" pillar={result.pillar_scores.hook} />
          </div>

          {/* Free: Best rewrite */}
          {result.rewrites && result.rewrites.length > 0 && (
            <div style={{
              background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
              padding: 20, marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, margin: 0 }}>
                  Best Hook Rewrite
                </h2>
                <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: '#4caf5020', color: '#4caf50', border: '1px solid #4caf5033', fontFamily: 'monospace', fontWeight: 600, letterSpacing: 1 }}>FREE</span>
              </div>
              <div style={{
                padding: 14, borderRadius: 8, background: '#0d0d1a', border: '1px solid #1a1a2e',
              }}>
                <div style={{ fontSize: 10, color: ACCENT, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {result.rewrites[0].label}
                </div>
                <p style={{ color: '#ddd', fontSize: 13, margin: '0 0 8px', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {result.rewrites[0].text}
                </p>
                <p style={{ color: '#666', fontSize: 11, margin: 0, fontStyle: 'italic' }}>
                  {result.rewrites[0].why_better}
                </p>
              </div>
            </div>
          )}

          <EmailCapture tool="thread-grader" score={result.total_score} />

          {/* Pro gate: full breakdown + tweet table + all rewrites */}
          <ProGate accentColor={ACCENT} label="Full Thread Analysis">
            {/* Pillar breakdown */}
            <div style={{
              background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
              padding: 20, marginBottom: 16,
            }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
                Full Pillar Breakdown
              </h2>
              {Object.entries(result.pillar_scores).map(([key, val]) => (
                <PillarBar key={key} pillarKey={key} pillar={val} />
              ))}
            </div>

            {/* Tweet-by-tweet breakdown */}
            {result.tweet_breakdown && result.tweet_breakdown.length > 0 && (
              <div style={{
                background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
                padding: 20, marginBottom: 16,
              }}>
                <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>
                  Tweet-by-Tweet Breakdown
                </h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
                      {['#', 'Preview', 'Score', 'Note'].map(h => (
                        <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: '#555', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.tweet_breakdown.map((t, i) => {
                      const scoreColor = t.score >= 8 ? '#4caf50' : t.score >= 5 ? '#ffd54f' : '#ef5350';
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #0d0d1a' }}>
                          <td style={{ padding: '8px', color: '#555', fontFamily: 'monospace', fontWeight: 700 }}>{t.tweet_index}</td>
                          <td style={{ padding: '8px', color: '#aaa', maxWidth: 200 }}>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.text_preview}
                            </span>
                          </td>
                          <td style={{ padding: '8px', color: scoreColor, fontWeight: 700 }}>{t.score}/10</td>
                          <td style={{ padding: '8px', color: '#777', fontSize: 11 }}>{t.note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* All hook rewrites */}
            {result.rewrites && result.rewrites.length > 1 && (
              <div style={{
                background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
                padding: 20, marginBottom: 16,
              }}>
                <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>
                  All Hook Rewrites
                </h2>
                {result.rewrites.slice(1).map((r, i) => (
                  <div key={i} style={{
                    padding: 14, borderRadius: 8, background: '#0d0d1a', border: '1px solid #1a1a2e',
                    marginBottom: 8,
                  }}>
                    <div style={{ fontSize: 10, color: ACCENT, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                      {r.label}
                    </div>
                    <p style={{ color: '#ddd', fontSize: 13, margin: '0 0 8px', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      {r.text}
                    </p>
                    <p style={{ color: '#666', fontSize: 11, margin: 0, fontStyle: 'italic' }}>
                      {r.why_better}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {result.upgrade_hook && (
              <div style={{
                background: '#0a1e2e', border: '1px solid #1a3a5a', borderRadius: 14,
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
  const [threadA, setThreadA] = useState('');
  const [threadB, setThreadB] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function compare() {
    if (!threadA.trim() || !threadB.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API}/demos/thread-grader/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadA: threadA.trim(), threadB: threadB.trim() }),
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

  const canCompare = threadA.trim().length >= 20 && threadB.trim().length >= 20;
  const pw = result?.comparison.pillar_winners;

  return (
    <>
      {/* Side-by-side inputs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {(['A', 'B'] as const).map(side => {
          const val = side === 'A' ? threadA : threadB;
          const setter = side === 'A' ? setThreadA : setThreadB;
          return (
            <div key={side} style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>
                Thread {side} · {countTweets(val)} tweet{countTweets(val) !== 1 ? 's' : ''}
              </div>
              <textarea
                style={{
                  width: '100%', background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 10,
                  padding: '10px 12px', fontSize: 13, color: '#e0e0e0', resize: 'none',
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5,
                }}
                rows={8}
                placeholder={`Thread ${side} — separate tweets with ---`}
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
                  Thread {result.comparison.winner} wins
                </div>
                <div style={{ color: '#2e7d32', fontSize: 11, marginTop: 2 }}>
                  +{result.comparison.margin} pts
                </div>
              </div>
              <ShareButton
                shareText={`Thread ${result.comparison.winner} won my A/B test on ThreadGrader by ${result.comparison.margin} points. Grade yours → https://contentintelligence.ai`}
                accentColor="#4caf50"
              />
            </div>
          ) : (
            <div style={{
              background: '#1a1a2e', border: '1px solid #2a2a4e', borderRadius: 10,
              padding: '10px 16px', marginBottom: 16, textAlign: 'center',
              color: '#ffd54f', fontWeight: 700, fontSize: 13,
            }}>
              It's a tie — both threads score equally
            </div>
          )}

          {/* Score cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <CompareScoreCard
              label="Thread A"
              result={result.threadA}
              isWinner={result.comparison.winner === 'A'}
              isDimmed={result.comparison.winner === 'B'}
            />
            <CompareScoreCard
              label="Thread B"
              result={result.threadB}
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
                    const aScore = result.threadA.pillar_scores[key as keyof GraderResult['pillar_scores']].score;
                    const bScore = result.threadB.pillar_scores[key as keyof GraderResult['pillar_scores']].score;
                    return (
                      <tr key={key} style={{ borderBottom: '1px solid #0d0d1a' }}>
                        <td style={{ padding: '8px', color: '#aaa' }}>{PILLAR_LABELS[key]}</td>
                        <td style={{ padding: '8px', color: winner === 'A' ? '#4caf50' : '#666', fontWeight: winner === 'A' ? 700 : 400 }}>{aScore}</td>
                        <td style={{ padding: '8px', color: winner === 'B' ? '#4caf50' : '#666', fontWeight: winner === 'B' ? 700 : 400 }}>{bScore}</td>
                        <td style={{ padding: '8px', color: winner === 'tie' ? '#ffd54f' : '#4caf50', fontWeight: 700 }}>
                          {winner === 'tie' ? 'Tie' : `Thread ${winner}`}
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
                <span style={{ color: ACCENT, fontWeight: 600 }}>Next thread: </span>
                {result.comparison.strategic_analysis}
              </p>
            )}
          </div>

          {/* Suggested hybrid hook */}
          <div style={{
            background: '#0a1e2e', border: '1px solid #1a3a5a', borderRadius: 14,
            padding: 20,
          }}>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: ACCENT, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
              Suggested Hybrid Hook
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
              Try this hook →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Root Component ─────────────────────────────────────────────────────────────

export function ThreadGraderView() {
  const [tab, setTab] = useState<'grade' | 'compare'>('grade');
  const [threadText, setThreadText] = useState('');

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6, fontFamily: 'monospace' }}>
          ContentGrade Suite
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#e0e0e0', letterSpacing: -0.5 }}>
          Thread<span style={{ color: ACCENT }}>Grader</span>
        </h1>
        <p style={{ color: '#777', fontSize: 14, marginTop: 6 }}>
          Paste your thread. Get a <span style={{ color: '#ccc', fontWeight: 500 }}>viral potential score</span> before you post.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 }}>
          {['Hook Strength (30)', 'Tension Chain (25)', 'Payoff (25)', 'Share Trigger (20)'].map(f => (
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
          onClick={() => setTab('grade')}
          style={{
            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: tab === 'grade' ? ACCENT : 'transparent',
            color: tab === 'grade' ? '#fff' : '#666',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          Grade Thread
        </button>
        <button
          onClick={() => setTab('compare')}
          style={{
            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: tab === 'compare' ? '#0a1e2e' : 'transparent',
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

      {tab === 'grade' && (
        <ScoreMode threadText={threadText} setThreadText={setThreadText} />
      )}
      {tab === 'compare' && (
        <div>
          <ProGate accentColor={ACCENT} label="A/B Compare Mode">
            <CompareMode onTryHybrid={(text) => { setThreadText(text); setTab('grade'); }} />
          </ProGate>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 40, textAlign: 'center', fontSize: 10, color: '#333' }}>
        Viral thread scoring using Hook · Tension · Payoff · Share frameworks · Powered by local Claude session
      </div>
    </div>
  );
}
