import React, { useState } from 'react';
import { API } from '../data/api.js';
import { EmailCapture, PricingTiers, ProGate, ShareButton } from './ContentGradeShared.js';

const ACCENT = '#00c853';

interface Archetype {
  name: string;
  percentage: number;
  description: string;
  evidence: string[];
}

interface ContentPatterns {
  top_performing_themes: Array<{ theme: string; frequency: number; avg_engagement_signal: string }>;
  underperforming_themes: Array<{ theme: string; frequency: number; avg_engagement_signal: string }>;
  optimal_format: string;
  optimal_length: string;
  voice_analysis: { tone: string; unique_phrases: string[]; brand_words: string[] };
}

interface EngagementModel {
  hook_effectiveness: { score: number; best_hooks: string[]; worst_hooks: string[] };
  cta_effectiveness: { score: number; recommendation: string };
  controversy_index: { score: number; note: string };
  shareability_score: number;
}

interface GrowthOpportunity {
  opportunity: string;
  impact: string;
  effort: string;
  explanation: string;
}

interface ContentCalendar {
  weekly_mix: { threads: number; single_posts: number; questions: number };
  theme_rotation: string[];
  gaps_to_fill: string[];
}

interface AnalysisResult {
  audience_archetypes: Archetype[];
  content_patterns: ContentPatterns;
  engagement_model: EngagementModel;
  growth_opportunities: GrowthOpportunity[];
  content_calendar: ContentCalendar;
  overall_score: number;
  grade: string;
  headline: string;
}

interface CompareResult {
  analysis_a: AnalysisResult;
  analysis_b: AnalysisResult;
  comparison: {
    audience_overlap: number;
    differentiation_score: number;
    collaboration_potential: string;
    winner_by_category: Record<string, string>;
    strategic_advice: string;
  };
}

const GRADE_COLORS: Record<string, string> = {
  A: '#4caf50', B: '#4a90d9', C: '#ffd54f', D: '#ff9800', F: '#ef5350',
};

const IMPACT_COLORS: Record<string, string> = {
  high: '#4caf50', medium: '#ffd54f', low: '#ef5350',
};

const EFFORT_COLORS: Record<string, string> = {
  low: '#4caf50', medium: '#ffd54f', high: '#ef5350',
};

function ScorePill({ label, score }: { label: string; score: number }) {
  const color = score >= 75 ? '#4caf50' : score >= 50 ? '#ffd54f' : '#ef5350';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{score}</div>
      <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function ArchetypeCard({ archetype }: { archetype: Archetype }) {
  return (
    <div style={{
      background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 10, padding: 16, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{archetype.name}</span>
        </div>
        <span style={{
          fontSize: 18, fontWeight: 900, color: '#e0e0e0',
        }}>{archetype.percentage}%</span>
      </div>
      <div style={{ height: 4, background: '#1a1a2e', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: ACCENT, borderRadius: 2, width: `${archetype.percentage}%` }} />
      </div>
      <p style={{ fontSize: 12, color: '#aaa', lineHeight: 1.5, margin: '0 0 8px' }}>{archetype.description}</p>
      {archetype.evidence?.length > 0 && (
        <div style={{ fontSize: 10, color: '#555', fontStyle: 'italic', borderLeft: `2px solid ${ACCENT}44`, paddingLeft: 8 }}>
          "{archetype.evidence[0]}"
        </div>
      )}
    </div>
  );
}

function SingleMode() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    if (content.trim().length < 50) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API}/demos/audience-decoder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data as AnalysisResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  }

  const gradeColor = result ? (GRADE_COLORS[result.grade?.[0] ?? ''] ?? '#777') : '#777';
  const canAnalyze = content.trim().length >= 50;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <textarea
          style={{
            width: '100%', background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 10,
            padding: '12px 14px', fontSize: 14, color: '#e0e0e0', resize: 'vertical',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: 180,
          }}
          rows={8}
          placeholder="Paste your last 10-20 tweets, threads, or posts — one per line or separated by ---"
          value={content}
          onChange={e => setContent(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 10, color: '#444' }}>
            {content.length} chars · minimum 50 chars
          </span>
          <button
            onClick={analyze}
            disabled={loading || !canAnalyze}
            style={{
              padding: '9px 22px',
              background: loading || !canAnalyze ? '#333' : ACCENT,
              color: '#000', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 8,
              cursor: loading || !canAnalyze ? 'not-allowed' : 'pointer',
              opacity: loading || !canAnalyze ? 0.5 : 1,
            }}
          >
            {loading ? 'Decoding...' : 'Decode My Audience'}
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
          {/* Hero card */}
          <div style={{
            background: '#12121f', border: `1px solid ${ACCENT}44`, borderRadius: 14,
            padding: 24, textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
              <span style={{ fontSize: 56, fontWeight: 900, color: '#fff' }}>{result.overall_score}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: gradeColor }}>{result.grade}</div>
                <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 2 }}>/ 100</div>
              </div>
            </div>
            <p style={{ color: ACCENT, fontSize: 15, fontWeight: 600, maxWidth: 480, margin: '0 auto 14px', lineHeight: 1.4 }}>
              {result.headline}
            </p>
            <ShareButton
              shareText={`My audience decoded: ${result.headline} — Analyzed free on AudienceDecoder`}
              accentColor={ACCENT}
            />
          </div>

          {/* Audience Archetypes — FREE */}
          <div style={{
            background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
            padding: 20, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, margin: 0 }}>
                Audience Archetypes
              </h2>
              <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: '#4caf5020', color: '#4caf50', border: '1px solid #4caf5033', fontFamily: 'monospace', fontWeight: 600, letterSpacing: 1 }}>FREE</span>
            </div>
            {result.audience_archetypes?.map((a, i) => (
              <ArchetypeCard key={i} archetype={a} />
            ))}
          </div>

          <EmailCapture tool="audience-decoder" score={result.overall_score} accentColor={ACCENT} />

          {/* Engagement Model — PRO GATED */}
          <ProGate accentColor={ACCENT} label="Full Audience Intelligence Report" priceLabel="Unlock Deep Report — $49">
            <div style={{
              background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
              padding: 20, marginBottom: 16,
            }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
                Engagement Model
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                <ScorePill label="Hook Effectiveness" score={result.engagement_model?.hook_effectiveness?.score ?? 0} />
                <ScorePill label="CTA Effectiveness" score={result.engagement_model?.cta_effectiveness?.score ?? 0} />
                <ScorePill label="Controversy Index" score={result.engagement_model?.controversy_index?.score ?? 0} />
                <ScorePill label="Shareability" score={result.engagement_model?.shareability_score ?? 0} />
              </div>
              {result.engagement_model?.cta_effectiveness?.recommendation && (
                <div style={{ background: '#0d0d1a', borderRadius: 8, padding: 12 }}>
                  <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>CTA Recommendation: </span>
                  <span style={{ fontSize: 12, color: '#aaa' }}>{result.engagement_model.cta_effectiveness.recommendation}</span>
                </div>
              )}
            </div>

            {/* Content Patterns */}
            <div style={{
              background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
              padding: 20, marginBottom: 16,
            }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>
                Content Patterns
              </h2>
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, background: '#0d1f0d', border: '1px solid #1e4a1e', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 10, color: '#2e7d32', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Working Well</div>
                  {result.content_patterns?.top_performing_themes?.map((t, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>
                      <span style={{ color: '#4caf50', fontWeight: 600 }}>{t.theme}</span>
                      <span style={{ color: '#555' }}> · {t.frequency}x · {t.avg_engagement_signal}</span>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, background: '#2e1a1a', border: '1px solid #5a2a2a', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 10, color: '#c62828', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Underperforming</div>
                  {result.content_patterns?.underperforming_themes?.map((t, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>
                      <span style={{ color: '#ef5350', fontWeight: 600 }}>{t.theme}</span>
                      <span style={{ color: '#555' }}> · {t.frequency}x · {t.avg_engagement_signal}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ background: '#0d0d1a', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#aaa' }}>
                  <span style={{ color: '#555' }}>Best format: </span>
                  <span style={{ color: ACCENT, fontWeight: 600 }}>{result.content_patterns?.optimal_format}</span>
                </div>
                <div style={{ background: '#0d0d1a', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#aaa' }}>
                  <span style={{ color: '#555' }}>Best length: </span>
                  <span style={{ color: ACCENT, fontWeight: 600 }}>{result.content_patterns?.optimal_length}</span>
                </div>
                <div style={{ background: '#0d0d1a', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#aaa' }}>
                  <span style={{ color: '#555' }}>Tone: </span>
                  <span style={{ color: '#ccc' }}>{result.content_patterns?.voice_analysis?.tone}</span>
                </div>
              </div>
            </div>

            {/* Growth Opportunities */}
            <div style={{
              background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
              padding: 20, marginBottom: 16,
            }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>
                Growth Opportunities
              </h2>
              {result.growth_opportunities?.map((opp, i) => (
                <div key={i} style={{
                  background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 8,
                  padding: 14, marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: '#555', fontFamily: 'monospace', flexShrink: 0, marginTop: 2 }}>#{i + 1}</span>
                    <div style={{ flex: 1, fontSize: 13, color: '#e0e0e0', fontWeight: 600 }}>{opp.opportunity}</div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: IMPACT_COLORS[opp.impact] + '20', color: IMPACT_COLORS[opp.impact], border: `1px solid ${IMPACT_COLORS[opp.impact]}44`, fontWeight: 700 }}>
                        {opp.impact} impact
                      </span>
                      <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: EFFORT_COLORS[opp.effort] + '20', color: EFFORT_COLORS[opp.effort], border: `1px solid ${EFFORT_COLORS[opp.effort]}44`, fontWeight: 700 }}>
                        {opp.effort} effort
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: '#666', margin: 0, lineHeight: 1.5 }}>{opp.explanation}</p>
                </div>
              ))}
            </div>

            {/* Content Calendar */}
            <div style={{
              background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
              padding: 20, marginBottom: 0,
            }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>
                Content Calendar
              </h2>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Threads/week', val: result.content_calendar?.weekly_mix?.threads },
                  { label: 'Posts/week', val: result.content_calendar?.weekly_mix?.single_posts },
                  { label: 'Questions/week', val: result.content_calendar?.weekly_mix?.questions },
                ].map(({ label, val }) => (
                  <div key={label} style={{ flex: 1, background: '#0d0d1a', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: ACCENT }}>{val ?? 0}</div>
                    <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
              {result.content_calendar?.theme_rotation?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Theme Rotation</div>
                  {result.content_calendar.theme_rotation.map((t, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#aaa', marginBottom: 4, paddingLeft: 8, borderLeft: `2px solid ${ACCENT}44` }}>
                      {t}
                    </div>
                  ))}
                </div>
              )}
              {result.content_calendar?.gaps_to_fill?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Content Gaps to Fill</div>
                  {result.content_calendar.gaps_to_fill.map((g, i) => (
                    <div key={i} style={{
                      fontSize: 11, color: '#888', marginBottom: 4,
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                    }}>
                      <span style={{ color: '#ffd54f', flexShrink: 0 }}>→</span> {g}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ProGate>

          <PricingTiers accentColor={ACCENT} product="audiencedecoder" />
        </div>
      )}
    </>
  );
}

function CompareMode() {
  const [contentA, setContentA] = useState('');
  const [contentB, setContentB] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function compare() {
    if (contentA.trim().length < 50 || contentB.trim().length < 50) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API}/demos/audience-decoder/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_a: contentA.trim(), content_b: contentB.trim() }),
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

  const canCompare = contentA.trim().length >= 50 && contentB.trim().length >= 50;

  return (
    <ProGate accentColor={ACCENT} label="Profile Compare Mode" priceLabel="Unlock Deep Report — $49">
      <div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {(['A', 'B'] as const).map(side => {
            const val = side === 'A' ? contentA : contentB;
            const setter = side === 'A' ? setContentA : setContentB;
            return (
              <div key={side} style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>
                  Creator {side}
                </div>
                <textarea
                  style={{
                    width: '100%', background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 10,
                    padding: '10px 12px', fontSize: 12, color: '#e0e0e0', resize: 'vertical',
                    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                  rows={8}
                  placeholder={`Paste Creator ${side}'s content...`}
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
              padding: '9px 22px', background: loading || !canCompare ? '#333' : ACCENT,
              color: '#000', fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 8,
              cursor: loading || !canCompare ? 'not-allowed' : 'pointer',
              opacity: loading || !canCompare ? 0.5 : 1,
            }}
          >
            {loading ? 'Comparing...' : 'Compare Profiles'}
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
            {/* Overview comparison */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              {(['A', 'B'] as const).map(side => {
                const analysis = side === 'A' ? result.analysis_a : result.analysis_b;
                const gradeColor = GRADE_COLORS[analysis?.grade?.[0] ?? ''] ?? '#777';
                return (
                  <div key={side} style={{
                    flex: 1, background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14, padding: 16, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Creator {side}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 40, fontWeight: 900, color: '#fff' }}>{analysis?.overall_score}</span>
                      <span style={{ fontSize: 22, fontWeight: 900, color: gradeColor }}>{analysis?.grade}</span>
                    </div>
                    <p style={{ fontSize: 11, color: ACCENT, margin: 0, lineHeight: 1.4 }}>{analysis?.headline}</p>
                  </div>
                );
              })}
            </div>

            {/* Comparison stats */}
            <div style={{
              background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14, padding: 20, marginBottom: 16,
            }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>
                Comparative Analysis
              </h2>
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, background: '#0d0d1a', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#ffd54f' }}>{result.comparison?.audience_overlap}%</div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>Audience Overlap</div>
                </div>
                <div style={{ flex: 1, background: '#0d0d1a', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: ACCENT }}>{result.comparison?.differentiation_score}</div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>Differentiation Score</div>
                </div>
                <div style={{ flex: 1, background: '#0d0d1a', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#4a90d9', textTransform: 'capitalize' }}>
                    {result.comparison?.collaboration_potential}
                  </div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>Collab Potential</div>
                </div>
              </div>

              {result.comparison?.winner_by_category && (
                <div>
                  <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Category Winners</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {Object.entries(result.comparison.winner_by_category).map(([cat, winner]) => (
                      <div key={cat} style={{
                        background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 6,
                        padding: '5px 10px', fontSize: 11,
                      }}>
                        <span style={{ color: '#666' }}>{cat}: </span>
                        <span style={{ color: winner === 'tie' ? '#ffd54f' : ACCENT, fontWeight: 700 }}>
                          {winner === 'tie' ? 'Tie' : `Creator ${winner}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.comparison?.strategic_advice && (
                <div style={{ marginTop: 14, background: '#0d0d1a', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Strategic Advice</div>
                  <p style={{ fontSize: 12, color: '#aaa', margin: 0, lineHeight: 1.6 }}>{result.comparison.strategic_advice}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ProGate>
  );
}

export default function AudienceDecoderView() {
  const [tab, setTab] = useState<'score' | 'compare'>('score');

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6, fontFamily: 'monospace' }}>
          Content Intelligence Stack
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#e0e0e0', letterSpacing: -0.5 }}>
          Audience<span style={{ color: ACCENT }}>Decoder</span>
        </h1>
        <p style={{ color: '#777', fontSize: 14, marginTop: 6 }}>
          Paste your content. Discover who reads you, what resonates, and{' '}
          <span style={{ color: '#ccc', fontWeight: 500 }}>exactly what to post next.</span>
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 }}>
          {['Audience Archetypes', 'Content Patterns', 'Engagement Model', 'Growth Opportunities', 'Content Calendar'].map(f => (
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
            color: tab === 'score' ? '#000' : '#666',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          Decode
        </button>
        <button
          onClick={() => setTab('compare')}
          style={{
            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: tab === 'compare' ? '#0a2e1a' : 'transparent',
            color: tab === 'compare' ? '#00c853' : '#444',
            transition: 'background 0.2s, color 0.2s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          Compare Creators
          <span style={{
            fontSize: 8, padding: '1px 6px', borderRadius: 4,
            background: ACCENT + '33', color: ACCENT, border: `1px solid ${ACCENT}44`,
            fontFamily: 'monospace', fontWeight: 700, letterSpacing: 0.5,
          }}>PRO</span>
        </button>
      </div>

      {tab === 'score' && <SingleMode />}
      {tab === 'compare' && <CompareMode />}

      <div style={{ marginTop: 40, textAlign: 'center', fontSize: 10, color: '#333' }}>
        Audience intelligence for creators · Powered by local Claude session
      </div>
    </div>
  );
}
