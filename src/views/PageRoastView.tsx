import React, { useState } from 'react';
import { API } from '../data/api.js';
import { EmailCapture, PricingTiers, RateLimitGate, ShareButton } from './ContentGradeShared.js';

interface SectionScore {
  score: number;
  max: number;
  feedback: string;
  fixes: string[];
}

interface RoastResult {
  total_score: number;
  grade: string;
  section_scores: {
    hero: SectionScore;
    social_proof: SectionScore;
    clarity: SectionScore;
    conversion: SectionScore;
  };
  roast: string;
  top_fixes: string[];
  competitor_edge: string;
}

interface CompareResult {
  score_a: RoastResult;
  score_b: RoastResult;
  comparison: {
    winner: 'A' | 'B' | 'tie';
    margin: number;
    section_winners: {
      hero: 'A' | 'B' | 'tie';
      social_proof: 'A' | 'B' | 'tie';
      clarity: 'A' | 'B' | 'tie';
      conversion: 'A' | 'B' | 'tie';
    };
    analysis: string;
    verdict: string;
  };
}

const GRADE_COLORS: Record<string, string> = {
  'A+': '#4caf50', A: '#4caf50', 'A-': '#4caf50',
  'B+': '#4a90d9', B: '#4a90d9', 'B-': '#4a90d9',
  'C+': '#ffd54f', C: '#ffd54f', 'C-': '#ffd54f',
  D: '#ff9800', F: '#ef5350',
};

const SECTION_LABELS: Record<string, { label: string; icon: string }> = {
  hero: { label: 'Hero Section', icon: '🎯' },
  social_proof: { label: 'Social Proof', icon: '⭐' },
  clarity: { label: 'Clarity & Persuasion', icon: '💡' },
  conversion: { label: 'Conversion Architecture', icon: '🔥' },
};

function SectionBar({ sectionKey, section }: { sectionKey: string; section: SectionScore }) {
  const meta = SECTION_LABELS[sectionKey] ?? { label: sectionKey, icon: '•' };
  const pct = Math.round((section.score / section.max) * 100);
  const color = pct >= 80 ? '#4caf50' : pct >= 60 ? '#4a90d9' : pct >= 40 ? '#ffd54f' : '#ef5350';

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#ccc' }}>
          {meta.icon} {meta.label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#ddd' }}>{section.score}/{section.max}</span>
      </div>
      <div style={{ height: 6, background: '#1a1a2e', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', background: color, borderRadius: 3,
          width: `${pct}%`, transition: 'width 0.7s ease',
        }} />
      </div>
      <p style={{ marginTop: 6, fontSize: 11, color: '#777', lineHeight: 1.4 }}>{section.feedback}</p>
      {section.fixes.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {section.fixes.map((fix, i) => (
            <div key={i} style={{
              fontSize: 11, color: '#999', padding: '4px 8px', marginTop: 3,
              background: '#0d0d1a', borderRadius: 4, border: '1px solid #1a1a2e',
            }}>
              → {fix}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single Roast Mode ─────────────────────────────────────────────────────────

function SingleMode() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RoastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gated, setGated] = useState(false);
  const [proEmail, setProEmail] = useState(() => localStorage.getItem('bilko_pro_email') ?? '');

  async function roast() {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setGated(false);

    try {
      const res = await fetch(`${API}/demos/page-roast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), email: proEmail || undefined }),
      });
      const data = await res.json();
      if ((data as { gated?: boolean }).gated) { setGated(true); return; }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data as RoastResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Roast failed.');
    } finally {
      setLoading(false);
    }
  }

  const gradeColor = result ? (GRADE_COLORS[result.grade] ?? '#777') : '#777';

  return (
    <>
      {/* Input */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="url"
          style={{
            width: '100%', background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 10,
            padding: '12px 14px', fontSize: 15, color: '#e0e0e0',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
          placeholder="https://your-landing-page.com"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') roast(); }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 10, color: '#444' }}>Enter to roast</span>
          <button
            onClick={roast}
            disabled={loading || !url.trim()}
            style={{
              padding: '8px 20px', background: loading || !url.trim() ? '#333' : '#ff6b35',
              color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', borderRadius: 8,
              cursor: loading || !url.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !url.trim() ? 0.5 : 1,
            }}
          >
            {loading ? 'Roasting...' : 'Roast It'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#2e1a1a', border: '1px solid #5a2a2a', borderRadius: 10,
          padding: 12, marginBottom: 16, color: '#ef5350', fontSize: 12,
        }}>{error}</div>
      )}

      {/* Rate limit gate */}
      {gated && <RateLimitGate accentColor="#ff6b35" onEmailChange={e => { setProEmail(e); localStorage.setItem('bilko_pro_email', e); }} />}

      {/* Result */}
      {result && (
        <div>
          {/* FREE: Score hero + roast */}
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
            <p style={{ color: '#ff6b35', fontSize: 14, fontWeight: 600, fontStyle: 'italic', maxWidth: 480, margin: '0 auto 12px' }}>
              "{result.roast}"
            </p>
            <ShareButton
              shareText={`My landing page scored ${result.total_score}/100 on PageRoast by ContentGrade Suite. Get your free audit → https://contentintelligence.ai`}
              accentColor="#ff6b35"
            />
          </div>

          {/* FREE: Top fix #1 */}
          {result.top_fixes.length > 0 && (
            <div style={{
              background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
              padding: 20, marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, margin: 0 }}>
                  #1 Highest-Impact Fix
                </h2>
                <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: '#ff6b3520', color: '#ff6b35', border: '1px solid #ff6b3533', fontFamily: 'monospace', fontWeight: 600, letterSpacing: 1 }}>FREE</span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: 12, borderRadius: 8, background: '#0d0d1a', border: '1px solid #1a1a2e',
              }}>
                <div style={{
                  flexShrink: 0, width: 28, height: 28, borderRadius: 14,
                  background: '#2a1a10', border: '1px solid #5a3a1a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#ff6b35',
                }}>1</div>
                <p style={{ color: '#ddd', fontSize: 13, margin: 0, lineHeight: 1.5 }}>{result.top_fixes[0]}</p>
              </div>
            </div>
          )}

          {/* PROMINENT: Email capture */}
          <EmailCapture tool="page-roast" score={result.total_score} accentColor="#ff6b35" />

          {/* Section breakdown + remaining fixes + competitor edge */}
          <div style={{
            background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
            padding: 20, marginBottom: 16,
          }}>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
              Section Breakdown
            </h2>
            {Object.entries(result.section_scores).map(([key, val]) => (
              <SectionBar key={key} sectionKey={key} section={val} />
            ))}
          </div>

          {result.top_fixes.length > 1 && (
            <div style={{
              background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
              padding: 20, marginBottom: 16,
            }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>
                All High-Impact Fixes
              </h2>
              {result.top_fixes.slice(1).map((fix, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: 10, borderRadius: 8, background: '#0d0d1a', border: '1px solid #1a1a2e',
                  marginBottom: 8,
                }}>
                  <div style={{
                    flexShrink: 0, width: 28, height: 28, borderRadius: 14,
                    background: '#2a1a10', border: '1px solid #5a3a1a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#ff6b35',
                  }}>{i + 2}</div>
                  <p style={{ color: '#ddd', fontSize: 13, margin: 0, lineHeight: 1.5 }}>{fix}</p>
                </div>
              ))}
            </div>
          )}

          <div style={{
            background: '#1a1a10', border: '1px solid #3a3a1a', borderRadius: 14,
            padding: 16, textAlign: 'center', marginBottom: 16,
          }}>
            <p style={{ color: '#ffd54f', fontSize: 12, fontWeight: 500, margin: 0 }}>{result.competitor_edge}</p>
          </div>

          <PricingTiers accentColor="#ff6b35" />
        </div>
      )}
    </>
  );
}

// ── Compare Score Card ────────────────────────────────────────────────────────

function CompareScoreCard({
  label, url, result, isWinner, isDimmed,
}: {
  label: string;
  url: string;
  result: RoastResult;
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
        <p style={{ color: '#ff6b35', fontSize: 11, fontStyle: 'italic', marginTop: 4 }}>"{result.roast}"</p>
        <p style={{ color: '#555', fontSize: 9, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</p>
      </div>
      <div style={{ borderTop: '1px solid #1a1a2e', paddingTop: 12 }}>
        {Object.entries(result.section_scores).map(([key, val]) => {
          const meta = SECTION_LABELS[key] ?? { label: key, icon: '•' };
          const pct = Math.round((val.score / val.max) * 100);
          const color = pct >= 80 ? '#4caf50' : pct >= 60 ? '#4a90d9' : pct >= 40 ? '#ffd54f' : '#ef5350';
          return (
            <div key={key} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: '#777' }}>{meta.icon} {meta.label}</span>
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

// ── Compare Mode ──────────────────────────────────────────────────────────────

function CompareMode() {
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function compare() {
    if (!urlA.trim() || !urlB.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API}/demos/page-roast/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url_a: urlA.trim(), url_b: urlB.trim() }),
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

  const canCompare = urlA.trim().length > 0 && urlB.trim().length > 0;
  const sw = result?.comparison.section_winners;

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {(['A', 'B'] as const).map(side => {
          const val = side === 'A' ? urlA : urlB;
          const setter = side === 'A' ? setUrlA : setUrlB;
          return (
            <div key={side} style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>
                Page {side}
              </div>
              <input
                type="url"
                style={{
                  width: '100%', background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 10,
                  padding: '10px 12px', fontSize: 13, color: '#e0e0e0',
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
                placeholder={`https://page-${side.toLowerCase()}.com`}
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
            padding: '8px 20px', background: loading || !canCompare ? '#333' : '#ff6b35',
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
                  Page {result.comparison.winner} wins
                </div>
                <div style={{ color: '#2e7d32', fontSize: 11, marginTop: 2 }}>
                  +{result.comparison.margin} pts · {Math.round((result.comparison.margin / Math.max(
                    result.comparison.winner === 'A' ? result.score_b.total_score : result.score_a.total_score, 1
                  )) * 100)}% stronger
                </div>
              </div>
              <ShareButton
                shareText={`Page ${result.comparison.winner} won my A/B landing page test on PageRoast by ${result.comparison.margin} points. Try ContentGrade Suite → https://contentintelligence.ai`}
                accentColor="#4caf50"
              />
            </div>
          ) : (
            <div style={{
              background: '#1a1a2e', border: '1px solid #2a2a4e', borderRadius: 10,
              padding: '10px 16px', marginBottom: 16, textAlign: 'center',
              color: '#ffd54f', fontWeight: 700, fontSize: 13,
            }}>
              It's a tie — both pages score equally
            </div>
          )}

          {/* Side-by-side score cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, paddingTop: 16 }}>
            <CompareScoreCard
              label="Page A"
              url={urlA}
              result={result.score_a}
              isWinner={result.comparison.winner === 'A'}
              isDimmed={result.comparison.winner === 'B'}
            />
            <CompareScoreCard
              label="Page B"
              url={urlB}
              result={result.score_b}
              isWinner={result.comparison.winner === 'B'}
              isDimmed={result.comparison.winner === 'A'}
            />
          </div>

          {/* Section Winners Table */}
          {sw && (
            <div style={{
              background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
              padding: 20, marginBottom: 16,
            }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>
                Section Winners
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
                    {['Section', 'A Score', 'B Score', 'Winner'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: '#555', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(SECTION_LABELS) as Array<keyof typeof SECTION_LABELS>).map(key => {
                    const winner = sw[key as keyof typeof sw];
                    const aScore = result.score_a.section_scores[key as keyof RoastResult['section_scores']].score;
                    const bScore = result.score_b.section_scores[key as keyof RoastResult['section_scores']].score;
                    const meta = SECTION_LABELS[key];
                    return (
                      <tr key={key} style={{ borderBottom: '1px solid #0d0d1a' }}>
                        <td style={{ padding: '8px', color: '#aaa' }}>{meta.icon} {meta.label}</td>
                        <td style={{ padding: '8px', color: winner === 'A' ? '#4caf50' : '#666', fontWeight: winner === 'A' ? 700 : 400 }}>{aScore}/25</td>
                        <td style={{ padding: '8px', color: winner === 'B' ? '#4caf50' : '#666', fontWeight: winner === 'B' ? 700 : 400 }}>{bScore}/25</td>
                        <td style={{ padding: '8px', color: winner === 'tie' ? '#ffd54f' : '#4caf50', fontWeight: 700 }}>
                          {winner === 'tie' ? 'Tie' : `Page ${winner}`}
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
              Verdict
            </h2>
            <p style={{ color: '#bbb', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{result.comparison.verdict}</p>
          </div>

          {/* Analysis */}
          <div style={{
            background: '#2a1a10', border: '1px solid #5a3a1a', borderRadius: 14,
            padding: 20,
          }}>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: '#ff6b35', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
              Strategic Analysis
            </h2>
            <p style={{ color: '#e0e0e0', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
              {result.comparison.analysis}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ── Root Component ────────────────────────────────────────────────────────────

export function PageRoastView() {
  const [tab, setTab] = useState<'roast' | 'compare'>('roast');

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6, fontFamily: 'monospace' }}>
          ContentGrade Suite
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#e0e0e0', letterSpacing: -0.5 }}>
          Page<span style={{ color: '#ff6b35' }}>Roast</span>
        </h1>
        <p style={{ color: '#777', fontSize: 14, marginTop: 6 }}>
          Paste a URL. Get a brutally honest landing page audit in <span style={{ color: '#ccc', fontWeight: 500 }}>60 seconds</span>.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 }}>
          {['Hero Section', 'Social Proof', 'Clarity', 'Conversion'].map(f => (
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
          onClick={() => setTab('roast')}
          style={{
            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: tab === 'roast' ? '#ff6b35' : 'transparent',
            color: tab === 'roast' ? '#fff' : '#666',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          Roast
        </button>
        <button
          onClick={() => setTab('compare')}
          style={{
            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: tab === 'compare' ? '#4a2a10' : 'transparent',
            color: tab === 'compare' ? '#ff9966' : '#444',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          A/B Compare
        </button>
      </div>

      {tab === 'roast' && <SingleMode />}
      {tab === 'compare' && <CompareMode />}

      {/* Footer */}
      <div style={{ marginTop: 40, textAlign: 'center', fontSize: 10, color: '#333' }}>
        Conversion-focused audit using proven CRO frameworks · Powered by local Claude session
      </div>
    </div>
  );
}
