import React, { useState, useEffect } from 'react';
import { API } from '../data/api.js';
import { EmailCapture, PricingTiers, ProGate, ShareButton } from './ContentGradeShared.js';

interface FrameworkScore {
  score: number;
  max: number;
  feedback: string;
}

interface GradeResult {
  total_score: number;
  grade: string;
  framework_scores: {
    rule_of_one: FrameworkScore;
    value_equation: FrameworkScore;
    readability: FrameworkScore;
    proof_promise_plan: FrameworkScore;
  };
  diagnosis: string;
  rewrites?: Array<{ text: string; predicted_score: number; optimized_for: string }>;
  upgrade_hook?: string;
}

interface CompareResult {
  headlineA: GradeResult;
  headlineB: GradeResult;
  comparison: {
    winner: 'A' | 'B' | 'tie';
    margin: number;
    verdict: string;
    framework_winners: {
      rule_of_one: 'A' | 'B' | 'tie';
      value_equation: 'A' | 'B' | 'tie';
      readability: 'A' | 'B' | 'tie';
      proof_promise_plan: 'A' | 'B' | 'tie';
    };
    suggested_hybrid: string;
  };
}

const GRADE_COLORS: Record<string, string> = {
  'A+': '#4caf50', A: '#4caf50', 'A-': '#4caf50',
  'B+': '#4a90d9', B: '#4a90d9', 'B-': '#4a90d9',
  'C+': '#ffd54f', C: '#ffd54f', 'C-': '#ffd54f',
  D: '#ff9800', F: '#ef5350',
};

const FRAMEWORK_LABELS: Record<string, string> = {
  rule_of_one: 'Rule of One',
  value_equation: 'Value Equation',
  readability: 'Readability',
  proof_promise_plan: 'Proof+Promise+Plan',
};

function ScoreBar({ score, max, label, feedback }: { score: number; max: number; label: string; feedback: string }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 80 ? '#4caf50' : pct >= 60 ? '#4a90d9' : pct >= 40 ? '#ffd54f' : '#ef5350';

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#ccc' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#ddd' }}>{score}/{max}</span>
      </div>
      <div style={{ height: 6, background: '#1a1a2e', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', background: color, borderRadius: 3,
          width: `${pct}%`, transition: 'width 0.7s ease',
        }} />
      </div>
      <p style={{ marginTop: 6, fontSize: 11, color: '#777', lineHeight: 1.4 }}>{feedback}</p>
    </div>
  );
}

// ── Single Score Mode ─────────────────────────────────────────────────────────

function SingleMode({ headline, setHeadline }: { headline: string; setHeadline: (v: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gated, setGated] = useState(false);
  const [captureEmail, setCaptureEmail] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('hg_email');
    if (stored) setCaptureEmail(stored);
  }, []);

  async function unlockWithEmail() {
    if (!captureEmail.includes('@')) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await fetch(`${API}/demos/headline-grader/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: captureEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
      localStorage.setItem('hg_email', captureEmail.trim());
      setGated(false);
      setRemaining((data as { remaining?: number }).remaining ?? 5);
    } catch (e: unknown) {
      setUnlockError(e instanceof Error ? e.message : 'Unlock failed. Try again.');
    } finally {
      setUnlocking(false);
    }
  }

  async function grade() {
    if (!headline.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setGated(false);
    try {
      const res = await fetch(`${API}/demos/headline-grader`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline: headline.trim() }),
      });
      const data = await res.json();
      if ((data as { gated?: boolean }).gated) {
        setGated(true);
        return;
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if ((data as { usage?: { remaining: number } }).usage?.remaining !== undefined) {
        setRemaining((data as { usage: { remaining: number } }).usage.remaining);
      }
      setResult(data as GradeResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scoring failed.');
    } finally {
      setLoading(false);
    }
  }

  const gradeColor = result ? (GRADE_COLORS[result.grade] ?? '#777') : '#777';

  // Real-time stats
  const words = headline.trim() ? headline.trim().split(/\s+/).length : 0;
  const charsNoSpaces = headline.replace(/\s/g, '').length;
  const avgWordLen = words > 0 ? charsNoSpaces / words : 0;
  const wordColor = words >= 6 && words <= 12 ? '#4caf50' : words >= 3 && words <= 18 ? '#ffd54f' : '#ef5350';
  const readLevel = avgWordLen > 6 ? { label: 'College+', color: '#ef5350' } : avgWordLen > 5 ? { label: 'High School', color: '#ffd54f' } : { label: 'Easy Read', color: '#4caf50' };
  // SERP preview
  const serpTitle = headline.slice(0, 60);
  const serpOverflow = headline.length > 60 ? headline.slice(60) : '';
  const serpSlug = (headline.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 50).replace(/-$/, '')) || 'your-headline';
  const serpBudgetColor = headline.length <= 49 ? '#1e8e3e' : headline.length <= 58 ? '#f9ab00' : '#d93025';
  const serpMetaFirst = headline.split(' ').slice(0, 3).join(' ') || 'this topic';

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <textarea
          style={{
            width: '100%', background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 10,
            padding: '12px 14px', fontSize: 15, color: '#e0e0e0', resize: 'none',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
          rows={3}
          placeholder="Paste your headline, email subject, ad copy, or landing page title..."
          value={headline}
          onChange={e => setHeadline(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) grade(); }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {!headline ? (
              <span style={{ fontSize: 10, color: '#444' }}>Ctrl+Enter to grade</span>
            ) : (
              <>
                <span style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 7px', borderRadius: 4, background: '#0d0d1a', border: `1px solid ${wordColor}55`, color: wordColor }}>{words}w</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 7px', borderRadius: 4, background: '#0d0d1a', border: '1px solid #33333388', color: '#555' }}>{headline.length}c</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', padding: '2px 7px', borderRadius: 4, background: '#0d0d1a', border: `1px solid ${readLevel.color}55`, color: readLevel.color }}>{readLevel.label}</span>
              </>
            )}
          </div>
          <button
            onClick={grade}
            disabled={loading || !headline.trim()}
            style={{
              padding: '8px 20px', background: loading || !headline.trim() ? '#333' : '#7c4dff',
              color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', borderRadius: 8,
              cursor: loading || !headline.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !headline.trim() ? 0.5 : 1,
            }}
          >
            {loading ? 'Grading...' : 'Grade It'}
          </button>
        </div>
      </div>

      {headline.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8, fontFamily: 'monospace' }}>
            Google Search Preview
          </div>
          <div style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 18, height: 18, borderRadius: 9, background: '#e8e8e8', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#202124', lineHeight: 1.3 }}>Example Site</div>
                <div style={{ fontSize: 11, color: '#006621', lineHeight: 1.2 }}>https://example.com › blog › {serpSlug}</div>
              </div>
            </div>
            <div style={{ fontSize: 19, color: '#1a0dab', lineHeight: 1.3, marginBottom: 4, cursor: 'pointer', fontFamily: 'arial, sans-serif' }}>
              {serpTitle}{serpOverflow && <span style={{ color: '#d93025' }}>{serpOverflow}</span>}
            </div>
            <div style={{ fontSize: 13, color: '#545454', lineHeight: 1.5, fontFamily: 'arial, sans-serif' }}>
              Discover how {serpMetaFirst.toLowerCase()}... Click to read the full article and learn proven strategies that deliver measurable results fast.
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: serpBudgetColor, fontWeight: 700 }}>{headline.length}/60 chars</span>
              {headline.length > 60 && (
                <span style={{ fontSize: 10, color: '#d93025' }}>— {headline.length - 60} over Google's limit</span>
              )}
            </div>
          </div>
        </div>
      )}

      {remaining !== null && remaining > 0 && !gated && (
        <div style={{
          fontSize: 10, color: '#555', textAlign: 'right', marginBottom: 8,
        }}>
          {remaining} free {remaining === 1 ? 'analysis' : 'analyses'} remaining today
        </div>
      )}

      {error && (
        <div style={{
          background: '#2e1a1a', border: '1px solid #5a2a2a', borderRadius: 10,
          padding: 12, marginBottom: 16, color: '#ef5350', fontSize: 12,
        }}>{error}</div>
      )}

      {gated && (
        <div style={{
          background: '#12121f', border: '1px solid #7c4dff44', borderRadius: 14,
          padding: 28, textAlign: 'center', marginBottom: 16,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#e0e0e0', margin: '0 0 6px' }}>
            You've used all 5 free analyses today
          </h2>
          <p style={{ fontSize: 12, color: '#666', margin: '0 0 20px', lineHeight: 1.5 }}>
            Enter your email to unlock 5 more — plus get early access to Pro when it launches.
          </p>
          <div style={{ display: 'flex', gap: 8, maxWidth: 380, margin: '0 auto' }}>
            <input
              type="email"
              placeholder="you@example.com"
              value={captureEmail}
              onChange={e => setCaptureEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') unlockWithEmail(); }}
              style={{
                flex: 1, background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 8,
                padding: '10px 12px', fontSize: 13, color: '#e0e0e0',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button
              onClick={unlockWithEmail}
              disabled={unlocking || !captureEmail.includes('@')}
              style={{
                padding: '10px 20px',
                background: unlocking || !captureEmail.includes('@') ? '#333' : '#7c4dff',
                color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', borderRadius: 8,
                cursor: unlocking || !captureEmail.includes('@') ? 'not-allowed' : 'pointer',
                opacity: unlocking || !captureEmail.includes('@') ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {unlocking ? 'Unlocking...' : 'Unlock 5 More'}
            </button>
          </div>
          {unlockError && (
            <p style={{ color: '#ef5350', fontSize: 11, marginTop: 10 }}>{unlockError}</p>
          )}
          <PricingTiers accentColor="#7c4dff" />
        </div>
      )}

      {result && (
        <div>
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
            <p style={{ color: '#aaa', fontSize: 13, maxWidth: 400, margin: '0 auto 12px' }}>{result.diagnosis}</p>
            <ShareButton
              shareText={`My headline scored ${result.total_score}/100 on HeadlineGrader by Content Intelligence Stack. Try yours → https://contentintelligence.ai`}
              accentColor="#7c4dff"
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
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: 10, borderRadius: 8, background: '#0d0d1a', border: '1px solid #1a1a2e',
              }}>
                <div style={{
                  flexShrink: 0, width: 30, height: 30, borderRadius: 15,
                  background: '#1a1040', border: '1px solid #3a2a6a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#b39ddb',
                }}>{result.rewrites[0].predicted_score}</div>
                <div>
                  <p style={{ color: '#ddd', fontSize: 13, fontWeight: 500, margin: 0 }}>{result.rewrites[0].text}</p>
                  <p style={{ fontSize: 10, color: '#555', marginTop: 3 }}>
                    Optimized for: <span style={{ color: '#777' }}>{FRAMEWORK_LABELS[result.rewrites[0].optimized_for] ?? result.rewrites[0].optimized_for}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <EmailCapture tool="headline-grader" score={result.total_score} />

          {/* Pro gate: framework breakdown + remaining rewrites + upgrade hook */}
          <ProGate accentColor="#7c4dff" label="Full Framework Report">
            <div style={{
              background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
              padding: 20, marginBottom: 16,
            }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
                Framework Breakdown
              </h2>
              {Object.entries(result.framework_scores).map(([key, val]) => (
                <ScoreBar key={key} label={FRAMEWORK_LABELS[key] ?? key} score={val.score} max={val.max} feedback={val.feedback} />
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
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: 10, borderRadius: 8, background: '#0d0d1a', border: '1px solid #1a1a2e',
                    marginBottom: 8,
                  }}>
                    <div style={{
                      flexShrink: 0, width: 30, height: 30, borderRadius: 15,
                      background: '#1a1040', border: '1px solid #3a2a6a',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: '#b39ddb',
                    }}>{r.predicted_score}</div>
                    <div>
                      <p style={{ color: '#ddd', fontSize: 13, fontWeight: 500, margin: 0 }}>{r.text}</p>
                      <p style={{ fontSize: 10, color: '#555', marginTop: 3 }}>
                        Optimized for: <span style={{ color: '#777' }}>{FRAMEWORK_LABELS[r.optimized_for] ?? r.optimized_for}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {result.upgrade_hook && (
              <div style={{
                background: '#1a1040', border: '1px solid #3a2a6a', borderRadius: 14,
                padding: 16, textAlign: 'center', marginBottom: 0,
              }}>
                <p style={{ color: '#b39ddb', fontSize: 12, margin: 0 }}>{result.upgrade_hook}</p>
              </div>
            )}
          </ProGate>

          <PricingTiers accentColor="#7c4dff" />
        </div>
      )}
    </>
  );
}

// ── Compare Mode ──────────────────────────────────────────────────────────────

function CompareScoreCard({
  label, result, isWinner, isDimmed,
}: {
  label: string;
  result: GradeResult;
  isWinner: boolean;
  isDimmed: boolean;
}) {
  const gradeColor = GRADE_COLORS[result.grade] ?? '#777';
  return (
    <div style={{
      flex: 1, background: '#12121f',
      border: `1px solid ${isWinner ? '#4caf50' : '#1a1a2e'}`,
      borderRadius: 14, padding: 16,
      opacity: isDimmed ? 0.55 : 1,
      transition: 'opacity 0.3s',
      position: 'relative',
    }}>
      {isWinner && (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          background: '#4caf50', color: '#000', fontSize: 10, fontWeight: 800,
          padding: '2px 10px', borderRadius: 10, letterSpacing: 1,
        }}>WINNER</div>
      )}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span style={{ fontSize: 44, fontWeight: 900, color: '#fff' }}>{result.total_score}</span>
          <span style={{ fontSize: 26, fontWeight: 900, color: gradeColor }}>{result.grade}</span>
        </div>
        <p style={{ color: '#888', fontSize: 11, marginTop: 4 }}>{result.diagnosis}</p>
      </div>
      <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: 12 }}>
        {Object.entries(result.framework_scores).map(([key, val]) => {
          const pct = Math.round((val.score / val.max) * 100);
          const color = pct >= 80 ? '#4caf50' : pct >= 60 ? '#4a90d9' : pct >= 40 ? '#ffd54f' : '#ef5350';
          return (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: '#777' }}>{FRAMEWORK_LABELS[key] ?? key}</span>
                <span style={{ fontSize: 10, color: '#999', fontWeight: 700 }}>{val.score}/{val.max}</span>
              </div>
              <div style={{ height: 4, background: '#1a1a2e', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: color, borderRadius: 2, width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompareMode({ onTryHybrid }: { onTryHybrid: (text: string) => void }) {
  const [headlineA, setHeadlineA] = useState('');
  const [headlineB, setHeadlineB] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function compare() {
    if (!headlineA.trim() || !headlineB.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API}/demos/headline-grader/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headlineA: headlineA.trim(), headlineB: headlineB.trim() }),
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

  const canCompare = headlineA.trim().length >= 3 && headlineB.trim().length >= 3;
  const fw = result?.comparison.framework_winners;

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {(['A', 'B'] as const).map(side => {
          const val = side === 'A' ? headlineA : headlineB;
          const setter = side === 'A' ? setHeadlineA : setHeadlineB;
          return (
            <div key={side} style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>
                Headline {side}
              </div>
              <textarea
                style={{
                  width: '100%', background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 10,
                  padding: '10px 12px', fontSize: 13, color: '#e0e0e0', resize: 'none',
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
                rows={3}
                placeholder={`Paste headline ${side}...`}
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
            padding: '8px 20px', background: loading || !canCompare ? '#333' : '#7c4dff',
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
          {result.comparison.winner !== 'tie' ? (
            <div style={{
              background: '#0d1f0d', border: '1px solid #1e4a1e', borderRadius: 10,
              padding: '12px 20px', marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#4caf50', fontWeight: 800, fontSize: 15 }}>
                  Headline {result.comparison.winner} wins
                </div>
                <div style={{ color: '#2e7d32', fontSize: 11, marginTop: 2 }}>
                  +{result.comparison.margin} pts · {Math.round((result.comparison.margin / Math.max(
                    result.comparison.winner === 'A' ? result.headlineB.total_score : result.headlineA.total_score, 1
                  )) * 100)}% stronger
                </div>
              </div>
              <ShareButton
                shareText={`Headline ${result.comparison.winner} won my A/B test on HeadlineGrader by ${result.comparison.margin} points. Try Content Intelligence Stack → https://contentintelligence.ai`}
                accentColor="#4caf50"
              />
            </div>
          ) : (
            <div style={{
              background: '#1a1a2e', border: '1px solid #2a2a4e', borderRadius: 10,
              padding: '10px 16px', marginBottom: 16, textAlign: 'center',
              color: '#ffd54f', fontWeight: 700, fontSize: 13,
            }}>
              It's a tie — both headlines score equally
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginBottom: 16, paddingTop: 16 }}>
            <CompareScoreCard
              label="Headline A"
              result={result.headlineA}
              isWinner={result.comparison.winner === 'A'}
              isDimmed={result.comparison.winner === 'B'}
            />
            <CompareScoreCard
              label="Headline B"
              result={result.headlineB}
              isWinner={result.comparison.winner === 'B'}
              isDimmed={result.comparison.winner === 'A'}
            />
          </div>

          {fw && (
            <div style={{
              background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
              padding: 20, marginBottom: 16,
            }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>
                Framework Winners
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
                    {['Framework', 'A Score', 'B Score', 'Winner'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: '#555', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(FRAMEWORK_LABELS) as Array<keyof typeof FRAMEWORK_LABELS>).map(key => {
                    const winner = fw[key as keyof typeof fw];
                    const aScore = result.headlineA.framework_scores[key as keyof GradeResult['framework_scores']].score;
                    const bScore = result.headlineB.framework_scores[key as keyof GradeResult['framework_scores']].score;
                    return (
                      <tr key={key} style={{ borderBottom: '1px solid #0d0d1a' }}>
                        <td style={{ padding: '8px', color: '#aaa' }}>{FRAMEWORK_LABELS[key]}</td>
                        <td style={{ padding: '8px', color: winner === 'A' ? '#4caf50' : '#666', fontWeight: winner === 'A' ? 700 : 400 }}>{aScore}</td>
                        <td style={{ padding: '8px', color: winner === 'B' ? '#4caf50' : '#666', fontWeight: winner === 'B' ? 700 : 400 }}>{bScore}</td>
                        <td style={{ padding: '8px', color: winner === 'tie' ? '#ffd54f' : '#4caf50', fontWeight: 700 }}>
                          {winner === 'tie' ? 'Tie' : `Headline ${winner}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{
            background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
            padding: 20, marginBottom: 16,
          }}>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
              Analysis
            </h2>
            <p style={{ color: '#bbb', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{result.comparison.verdict}</p>
          </div>

          <div style={{
            background: '#1a1040', border: '1px solid #3a2a6a', borderRadius: 14,
            padding: 20,
          }}>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: '#7c4dff', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
              Suggested Hybrid
            </h2>
            <p style={{ color: '#e0e0e0', fontSize: 14, fontWeight: 600, lineHeight: 1.5, marginBottom: 14 }}>
              {result.comparison.suggested_hybrid}
            </p>
            <button
              onClick={() => {
                // Extract just the headline (before the " | " explanation if present)
                const hybridText = result.comparison.suggested_hybrid.split(' | ')[0].trim();
                onTryHybrid(hybridText);
              }}
              style={{
                padding: '7px 16px', background: '#7c4dff', color: '#fff',
                fontWeight: 600, fontSize: 12, border: 'none', borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Try this headline →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Root Component ────────────────────────────────────────────────────────────

export function HeadlineGraderView() {
  const [tab, setTab] = useState<'score' | 'compare'>('score');
  const [singleHeadline, setSingleHeadline] = useState('');

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6, fontFamily: 'monospace' }}>
          Content Intelligence Stack
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#e0e0e0', letterSpacing: -0.5 }}>
          Grade Your Headline in Seconds
        </h1>
        <p style={{ color: '#777', fontSize: 14, marginTop: 8, lineHeight: 1.6, maxWidth: 540, margin: '8px auto 0' }}>
          Score any headline 1-100 against 4 proven frameworks — Masterson's Rule of One, Hormozi's Value Equation, 5th-grade Readability, and Proof+Promise+Plan — the same system behind <span style={{ color: '#ccc', fontWeight: 500 }}>$1B+</span> in direct-response revenue at Agora Publishing.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          {[
            '4 Proven Frameworks',
            'Used by 1000+ Marketers',
            'Free — No Signup Required',
            'Scores 1-100 with AI',
          ].map(badge => (
            <span key={badge} style={{
              fontSize: 10, padding: '4px 10px', borderRadius: 12,
              background: '#12121f', color: '#888', border: '1px solid #1a1a2e',
              fontWeight: 500,
            }}>{badge}</span>
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
            background: tab === 'score' ? '#7c4dff' : 'transparent',
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
            background: tab === 'compare' ? '#2a1a6a' : 'transparent',
            color: tab === 'compare' ? '#b39ddb' : '#444',
            transition: 'background 0.2s, color 0.2s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          A/B Compare
          <span style={{
            fontSize: 8, padding: '1px 6px', borderRadius: 4,
            background: '#7c4dff33', color: '#b39ddb', border: '1px solid #7c4dff44',
            fontFamily: 'monospace', fontWeight: 700, letterSpacing: 0.5,
          }}>PRO</span>
        </button>
      </div>

      {tab === 'score' && (
        <SingleMode headline={singleHeadline} setHeadline={setSingleHeadline} />
      )}
      {tab === 'compare' && (
        <div>
          <ProGate accentColor="#7c4dff" label="A/B Compare Mode">
            <CompareMode onTryHybrid={(text) => { setSingleHeadline(text); setTab('score'); }} />
          </ProGate>
        </div>
      )}

      {/* FAQ Section */}
      <section style={{ marginTop: 56 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#aaa', marginBottom: 16, textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase' }}>
          Frequently Asked Questions
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            {
              q: 'What is a headline score?',
              a: 'A headline score is a number from 1 to 100 that measures how persuasive your headline is across four proven direct-response frameworks. A score of 80+ is excellent; 60-79 is good; below 60 needs significant improvement. The score combines Rule of One clarity, Value Equation strength, readability, and the Proof+Promise+Plan hook structure.',
            },
            {
              q: 'How does HeadlineGrader work?',
              a: 'HeadlineGrader uses AI to analyze your headline against four frameworks proven across $1B+ in direct-response revenue: Masterson\'s Rule of One (does it focus on a single idea?), Hormozi\'s Value Equation (does it maximize dream outcome and reduce perceived effort?), 5th-grade readability (is it instantly scannable?), and Proof+Promise+Plan (does it open a curiosity loop with credibility?). Each framework contributes up to 25 points for a maximum score of 100.',
            },
            {
              q: 'Is HeadlineGrader free?',
              a: 'Yes — HeadlineGrader is completely free with no signup required. You get 5 free headline analyses per day. If you need more, enter your email to unlock 5 additional free analyses. Pro plans with unlimited analyses, A/B comparison, and bulk testing are coming soon.',
            },
            {
              q: 'How is HeadlineGrader different from CoSchedule\'s Headline Analyzer?',
              a: 'CoSchedule\'s Headline Analyzer scores headlines on word balance, length, and sentiment — generic metrics not tied to revenue outcomes. HeadlineGrader scores against frameworks proven in $1B+ of direct-response copywriting. The result is a grade that tells you exactly which persuasion lever is weak and gives you AI-generated rewrites to fix it.',
            },
            {
              q: 'What types of headlines can I test?',
              a: 'HeadlineGrader works on any short-form persuasive text: blog post titles, email subject lines, Facebook and Google ad headlines, landing page H1s, YouTube video titles, Twitter thread hooks, and sales page headlines. If it needs to grab attention and drive a click, it can be scored.',
            },
          ].map(({ q, a }) => (
            <details key={q} style={{
              background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 10,
              overflow: 'hidden',
            }}>
              <summary style={{
                padding: '14px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                color: '#ccc', listStyle: 'none', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', userSelect: 'none',
              }}>
                {q}
                <span style={{ fontSize: 16, color: '#555', marginLeft: 8, flexShrink: 0 }}>+</span>
              </summary>
              <p style={{
                padding: '0 18px 14px', fontSize: 12, color: '#777', lineHeight: 1.7, margin: 0,
                borderTop: '1px solid #1a1a2e',
              }}>{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid #111' }}>
        <p style={{ fontSize: 11, color: '#333', lineHeight: 1.7, textAlign: 'center' }}>
          HeadlineGrader is a free AI-powered headline analyzer that scores your headlines, email subject lines, and ad copy 1-100 using direct-response copywriting frameworks. Use it as your headline grader before publishing blog posts, running paid ads, or sending campaigns. Works as an email subject line tester, ad headline scorer, and landing page headline optimizer — all in one free tool.
        </p>
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 10, color: '#2a2a2a' }}>
          Built on frameworks from Masterson, Hormozi & Proof+Promise+Plan · Powered by local Claude session
        </div>
      </footer>
    </div>
  );
}
