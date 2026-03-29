import React, { useState } from 'react';
import { API } from '../data/api.js';
import { EmailCapture, PricingTiers } from './ContentGradeShared.js';

const ACCENT = '#10b981'; // emerald green — "generate" not "evaluate"

const GRADE_COLORS: Record<string, string> = {
  'A+': '#4caf50', A: '#4caf50', 'A-': '#4caf50',
  'B+': '#4a90d9', B: '#4a90d9', 'B-': '#4a90d9',
  'C+': '#ffd54f', C: '#ffd54f', 'C-': '#ffd54f',
  D: '#ff9800', F: '#ef5350',
};

const FRAMEWORK_COLORS: Record<string, string> = {
  'AIDA': '#7c4dff',
  'PAS': '#ff6b35',
  'Hormozi Value Equation': '#10b981',
  'Cialdini Reciprocity': '#4a90d9',
  'Storytelling Arc': '#ffd54f',
};

interface EmailItem {
  position: number;
  subject_line: string;
  preview_text: string;
  body: string;
  cta: string;
  framework_used: string;
  framework_explanation: string;
  estimated_open_rate: string;
  estimated_click_rate: string;
}

interface SequenceResult {
  emails: EmailItem[];
  sequence_strategy: string;
  overall_score: number;
  grade: string;
}

interface CompareResult {
  sequence_a: SequenceResult;
  sequence_b: SequenceResult;
  comparison: {
    winner: 'A' | 'B';
    margin: number;
    reasoning: string;
    per_email_comparison: Array<{ position: number; winner: 'A' | 'B'; reason: string }>;
  };
}

function frameworkColor(name: string): string {
  for (const [key, color] of Object.entries(FRAMEWORK_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase().split(' ')[0].toLowerCase())) return color;
  }
  return ACCENT;
}

function EmailCard({ email, locked }: { email: EmailItem; locked: boolean }) {
  const [expanded, setExpanded] = useState(!locked && email.position === 1);
  const fwColor = frameworkColor(email.framework_used);

  const card = (
    <div style={{
      background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 12,
      marginBottom: 10, overflow: 'hidden',
    }}>
      {/* Header row */}
      <div
        onClick={() => !locked && setExpanded(e => !e)}
        style={{
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10,
          cursor: locked ? 'default' : 'pointer',
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: ACCENT + '22',
          border: `1px solid ${ACCENT}44`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
          fontSize: 11, fontWeight: 800, color: ACCENT, fontFamily: 'monospace',
        }}>
          {email.position}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {email.subject_line}
          </div>
          <div style={{ fontSize: 10, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {email.preview_text}
          </div>
        </div>
        <span style={{
          fontSize: 9, padding: '2px 8px', borderRadius: 4,
          background: fwColor + '20', color: fwColor, border: `1px solid ${fwColor}44`,
          fontFamily: 'monospace', fontWeight: 700, letterSpacing: 0.5, flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          {email.framework_used.split(' ')[0].toUpperCase()}
        </span>
        {!locked && (
          <div style={{ color: '#444', fontSize: 14, flexShrink: 0 }}>
            {expanded ? '▲' : '▼'}
          </div>
        )}
      </div>

      {/* Expanded body */}
      {expanded && !locked && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #1a1a2e' }}>
          <div style={{ paddingTop: 14 }}>
            {/* Framework explanation */}
            <div style={{
              background: fwColor + '0d', border: `1px solid ${fwColor}22`, borderRadius: 8,
              padding: '8px 12px', marginBottom: 14,
              fontSize: 11, color: fwColor, lineHeight: 1.5,
            }}>
              <span style={{ fontWeight: 700 }}>{email.framework_used}:</span> {email.framework_explanation}
            </div>

            {/* Email body */}
            <div style={{
              fontSize: 13, color: '#ccc', lineHeight: 1.7, marginBottom: 14,
              whiteSpace: 'pre-line', padding: '12px 14px',
              background: '#0d0d1a', borderRadius: 8, border: '1px solid #1a1a2e',
            }}>
              {email.body}
            </div>

            {/* CTA */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>CTA Button</div>
              <div style={{
                display: 'inline-block', padding: '8px 20px', borderRadius: 8,
                background: ACCENT, color: '#000', fontWeight: 700, fontSize: 12,
              }}>
                {email.cta}
              </div>
            </div>

            {/* Metrics */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{
                flex: 1, padding: '10px 14px', borderRadius: 8,
                background: '#0d0d1a', border: '1px solid #1a1a2e', textAlign: 'center',
              }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#4caf50' }}>{email.estimated_open_rate}</div>
                <div style={{ fontSize: 9, color: '#555', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Est. Open Rate</div>
              </div>
              <div style={{
                flex: 1, padding: '10px 14px', borderRadius: 8,
                background: '#0d0d1a', border: '1px solid #1a1a2e', textAlign: 'center',
              }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{email.estimated_click_rate}</div>
                <div style={{ fontSize: 9, color: '#555', marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 }}>Est. Click Rate</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return card;
}

function SequenceDisplay({ result }: { result: SequenceResult }) {
  const gradeColor = GRADE_COLORS[result.grade] ?? '#777';
  return (
    <div>
      {/* Score hero */}
      <div style={{
        background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
        padding: 24, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <span style={{ fontSize: 52, fontWeight: 900, color: '#fff' }}>{result.overall_score}</span>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: gradeColor }}>{result.grade}</div>
            <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 2 }}>Sequence Score</div>
          </div>
        </div>
        <p style={{ color: ACCENT, fontSize: 13, fontWeight: 500, fontStyle: 'italic', margin: 0 }}>
          "{result.sequence_strategy}"
        </p>
      </div>

      {/* Email 1 — free */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 2 }}>Email 1 — Hook</span>
          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: '#4caf5020', color: '#4caf50', border: '1px solid #4caf5033', fontFamily: 'monospace', fontWeight: 600, letterSpacing: 1 }}>FREE</span>
        </div>
        <EmailCard email={result.emails[0]} locked={false} />
      </div>

      <EmailCapture tool="email-forge" score={result.overall_score} accentColor={ACCENT} />

      {/* Emails 2-5 — free */}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 2 }}>Emails 2–5 — Build · Value · Urgency · Close</span>
        </div>
        {result.emails.slice(1).map(email => (
          <EmailCard key={email.position} email={email} locked={false} />
        ))}
      </div>

      <PricingTiers accentColor={ACCENT} />
    </div>
  );
}

// ── Generate Mode ───────────────────────────────────────────────────────────────

function GenerateMode() {
  const [product, setProduct] = useState('');
  const [audience, setAudience] = useState('');
  const [goal, setGoal] = useState<string>('cold_outreach');
  const [tone, setTone] = useState<string>('professional');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SequenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = product.trim().length >= 10 && audience.trim().length >= 5;

  async function generate() {
    if (!canGenerate) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API}/demos/email-forge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: product.trim(), audience: audience.trim(), goal, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data as SequenceResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setLoading(false);
    }
  }

  const selectStyle: React.CSSProperties = {
    background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 8,
    padding: '10px 12px', fontSize: 13, color: '#e0e0e0',
    outline: 'none', fontFamily: 'inherit', width: '100%',
    appearance: 'none' as const, cursor: 'pointer',
  };

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        {/* Product */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 6 }}>
            Product / Service
          </label>
          <textarea
            style={{
              width: '100%', background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 8,
              padding: '10px 12px', fontSize: 13, color: '#e0e0e0', resize: 'vertical',
              outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.6,
            }}
            rows={3}
            placeholder="e.g. A SaaS tool that automates customer onboarding emails, cutting setup time from 2 hours to 5 minutes"
            value={product}
            onChange={e => setProduct(e.target.value)}
          />
        </div>

        {/* Audience */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 6 }}>
            Target Audience
          </label>
          <input
            type="text"
            style={{
              width: '100%', background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 8,
              padding: '10px 12px', fontSize: 13, color: '#e0e0e0',
              outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
            placeholder="e.g. B2B SaaS founders with 10-50 person teams"
            value={audience}
            onChange={e => setAudience(e.target.value)}
          />
        </div>

        {/* Goal + Tone */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 6 }}>
              Goal
            </label>
            <select style={selectStyle} value={goal} onChange={e => setGoal(e.target.value)}>
              <option value="cold_outreach">Cold Outreach</option>
              <option value="nurture">Nurture Sequence</option>
              <option value="launch">Product Launch</option>
              <option value="re-engagement">Re-engagement</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1.5, display: 'block', marginBottom: 6 }}>
              Tone
            </label>
            <select style={selectStyle} value={tone} onChange={e => setTone(e.target.value)}>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="urgent">Urgent</option>
              <option value="storytelling">Storytelling</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={generate}
            disabled={loading || !canGenerate}
            style={{
              padding: '10px 24px',
              background: loading || !canGenerate ? '#333' : ACCENT,
              color: loading || !canGenerate ? '#666' : '#000',
              fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 8,
              cursor: loading || !canGenerate ? 'not-allowed' : 'pointer',
              opacity: loading || !canGenerate ? 0.6 : 1,
            }}
          >
            {loading ? 'Generating...' : 'Generate Sequence →'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#2e1a1a', border: '1px solid #5a2a2a', borderRadius: 10,
          padding: 12, marginBottom: 16, color: '#ef5350', fontSize: 12,
        }}>{error}</div>
      )}

      {result && <SequenceDisplay result={result} />}
    </>
  );
}

// ── Compare Mode ─────────────────────────────────────────────────────────────────

function CompareMode() {
  const [productA, setProductA] = useState('');
  const [audienceA, setAudienceA] = useState('');
  const [goalA, setGoalA] = useState('cold_outreach');
  const [toneA, setToneA] = useState('professional');
  const [productB, setProductB] = useState('');
  const [audienceB, setAudienceB] = useState('');
  const [goalB, setGoalB] = useState('cold_outreach');
  const [toneB, setToneB] = useState('professional');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedA, setExpandedA] = useState<number | null>(null);
  const [expandedB, setExpandedB] = useState<number | null>(null);

  const canCompare =
    productA.trim().length >= 10 && audienceA.trim().length >= 5 &&
    productB.trim().length >= 10 && audienceB.trim().length >= 5;

  async function compare() {
    if (!canCompare) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${API}/demos/email-forge/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_a: productA.trim(), audience_a: audienceA.trim(), goal_a: goalA, tone_a: toneA,
          product_b: productB.trim(), audience_b: audienceB.trim(), goal_b: goalB, tone_b: toneB,
        }),
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

  const selectStyle: React.CSSProperties = {
    background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 6,
    padding: '6px 8px', fontSize: 11, color: '#ccc',
    outline: 'none', fontFamily: 'inherit', width: '100%', appearance: 'none' as const,
  };

  function InputPanel({ label, product, setProduct, audience, setAudience, goal, setGoal, tone, setTone }: {
    label: string;
    product: string; setProduct: (v: string) => void;
    audience: string; setAudience: (v: string) => void;
    goal: string; setGoal: (v: string) => void;
    tone: string; setTone: (v: string) => void;
  }) {
    return (
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
          Sequence {label}
        </div>
        <textarea
          style={{
            width: '100%', background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 8,
            padding: '8px 10px', fontSize: 12, color: '#e0e0e0', resize: 'none',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5,
          }}
          rows={4}
          placeholder={`Product/service description`}
          value={product}
          onChange={e => setProduct(e.target.value)}
        />
        <input
          type="text"
          style={{
            width: '100%', background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 8,
            padding: '7px 10px', fontSize: 12, color: '#e0e0e0', marginTop: 6,
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
          placeholder="Target audience"
          value={audience}
          onChange={e => setAudience(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <select style={selectStyle} value={goal} onChange={e => setGoal(e.target.value)}>
            <option value="cold_outreach">Cold Outreach</option>
            <option value="nurture">Nurture</option>
            <option value="launch">Launch</option>
            <option value="re-engagement">Re-engage</option>
          </select>
          <select style={selectStyle} value={tone} onChange={e => setTone(e.target.value)}>
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="urgent">Urgent</option>
            <option value="storytelling">Story</option>
          </select>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <InputPanel label="A" product={productA} setProduct={setProductA} audience={audienceA} setAudience={setAudienceA} goal={goalA} setGoal={setGoalA} tone={toneA} setTone={setToneA} />
        <InputPanel label="B" product={productB} setProduct={setProductB} audience={audienceB} setAudience={setAudienceB} goal={goalB} setGoal={setGoalB} tone={toneB} setTone={setToneB} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button
          onClick={compare}
          disabled={loading || !canCompare}
          style={{
            padding: '8px 20px',
            background: loading || !canCompare ? '#333' : ACCENT,
            color: loading || !canCompare ? '#666' : '#000',
            fontWeight: 700, fontSize: 13, border: 'none', borderRadius: 8,
            cursor: loading || !canCompare ? 'not-allowed' : 'pointer',
            opacity: loading || !canCompare ? 0.6 : 1,
          }}
        >
          {loading ? 'Comparing...' : 'Compare Sequences'}
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
          <div style={{
            background: '#0d1f0d', border: '1px solid #1e4a1e', borderRadius: 10,
            padding: '14px 20px', marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ color: '#4caf50', fontWeight: 800, fontSize: 15 }}>
                Sequence {result.comparison.winner} wins
              </div>
              <div style={{ color: '#2e7d32', fontSize: 11, marginTop: 2 }}>
                +{result.comparison.margin} pts · {result.comparison.reasoning}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>
                {result.comparison.winner === 'A' ? result.sequence_a.overall_score : result.sequence_b.overall_score}
                <span style={{ fontSize: 12, color: '#555', marginLeft: 4 }}>vs</span>
                {result.comparison.winner === 'A' ? result.sequence_b.overall_score : result.sequence_a.overall_score}
              </div>
            </div>
          </div>

          {/* Per-email comparison */}
          <div style={{
            background: '#12121f', border: '1px solid #1a1a2e', borderRadius: 14,
            padding: 20, marginBottom: 16,
          }}>
            <h2 style={{ fontSize: 11, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14 }}>
              Email-by-Email Breakdown
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
                  {['Email', 'Subject A', 'Subject B', 'Winner', 'Reason'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', color: '#555', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.comparison.per_email_comparison.map((row) => {
                  const emailA = result.sequence_a.emails.find(e => e.position === row.position);
                  const emailB = result.sequence_b.emails.find(e => e.position === row.position);
                  return (
                    <tr key={row.position} style={{ borderBottom: '1px solid #0d0d1a' }}>
                      <td style={{ padding: '8px', color: '#555', fontFamily: 'monospace', fontWeight: 700 }}>{row.position}</td>
                      <td style={{ padding: '8px', color: row.winner === 'A' ? '#4caf50' : '#555', fontSize: 11, maxWidth: 150 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emailA?.subject_line ?? '—'}
                        </span>
                      </td>
                      <td style={{ padding: '8px', color: row.winner === 'B' ? '#4caf50' : '#555', fontSize: 11, maxWidth: 150 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emailB?.subject_line ?? '—'}
                        </span>
                      </td>
                      <td style={{ padding: '8px', color: '#4caf50', fontWeight: 700 }}>Seq {row.winner}</td>
                      <td style={{ padding: '8px', color: '#777', fontSize: 11 }}>{row.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sequence A full display */}
          <div style={{
            background: result.comparison.winner === 'A' ? '#0a1e0a' : '#12121f',
            border: `1px solid ${result.comparison.winner === 'A' ? '#1e4a1e' : '#1a1a2e'}`,
            borderRadius: 14, padding: 16, marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 2 }}>Sequence A</span>
              {result.comparison.winner === 'A' && (
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: '#4caf5020', color: '#4caf50', border: '1px solid #4caf5033', fontFamily: 'monospace', fontWeight: 700 }}>WINNER</span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 900, color: '#fff' }}>{result.sequence_a.overall_score}</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: GRADE_COLORS[result.sequence_a.grade] ?? '#777' }}>{result.sequence_a.grade}</span>
            </div>
            {result.sequence_a.emails.map(email => {
              const fwColor = frameworkColor(email.framework_used);
              return (
                <div
                  key={email.position}
                  onClick={() => setExpandedA(expandedA === email.position ? null : email.position)}
                  style={{
                    padding: '8px 12px', marginBottom: 6,
                    background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 8,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <span style={{ fontSize: 10, color: ACCENT, fontFamily: 'monospace', fontWeight: 700, width: 16 }}>{email.position}</span>
                  <span style={{ flex: 1, fontSize: 12, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.subject_line}</span>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: fwColor + '20', color: fwColor, border: `1px solid ${fwColor}33`, fontFamily: 'monospace', flexShrink: 0 }}>
                    {email.framework_used.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Sequence B full display */}
          <div style={{
            background: result.comparison.winner === 'B' ? '#0a1e0a' : '#12121f',
            border: `1px solid ${result.comparison.winner === 'B' ? '#1e4a1e' : '#1a1a2e'}`,
            borderRadius: 14, padding: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 2 }}>Sequence B</span>
              {result.comparison.winner === 'B' && (
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: '#4caf5020', color: '#4caf50', border: '1px solid #4caf5033', fontFamily: 'monospace', fontWeight: 700 }}>WINNER</span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 900, color: '#fff' }}>{result.sequence_b.overall_score}</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: GRADE_COLORS[result.sequence_b.grade] ?? '#777' }}>{result.sequence_b.grade}</span>
            </div>
            {result.sequence_b.emails.map(email => {
              const fwColor = frameworkColor(email.framework_used);
              return (
                <div
                  key={email.position}
                  onClick={() => setExpandedB(expandedB === email.position ? null : email.position)}
                  style={{
                    padding: '8px 12px', marginBottom: 6,
                    background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 8,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <span style={{ fontSize: 10, color: ACCENT, fontFamily: 'monospace', fontWeight: 700, width: 16 }}>{email.position}</span>
                  <span style={{ flex: 1, fontSize: 12, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.subject_line}</span>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: fwColor + '20', color: fwColor, border: `1px solid ${fwColor}33`, fontFamily: 'monospace', flexShrink: 0 }}>
                    {email.framework_used.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ── Root Component ─────────────────────────────────────────────────────────────

export function EmailForgeView() {
  const [tab, setTab] = useState<'generate' | 'compare'>('generate');

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6, fontFamily: 'monospace' }}>
          ContentGrade Suite — Generate
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#e0e0e0', letterSpacing: -0.5 }}>
          Email<span style={{ color: ACCENT }}>Forge</span>
        </h1>
        <p style={{ color: '#777', fontSize: 14, marginTop: 6 }}>
          Input your product and audience. Get a <span style={{ color: '#ccc', fontWeight: 500 }}>5-email conversion sequence</span> using proven frameworks.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 }}>
          {['AIDA', 'PAS', 'Hormozi', 'Cialdini', 'Storytelling Arc'].map(f => (
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
          onClick={() => setTab('generate')}
          style={{
            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: tab === 'generate' ? ACCENT : 'transparent',
            color: tab === 'generate' ? '#000' : '#666',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          Generate
        </button>
        <button
          onClick={() => setTab('compare')}
          style={{
            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: tab === 'compare' ? '#0a1e2e' : 'transparent',
            color: tab === 'compare' ? ACCENT : '#444',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          A/B Compare
        </button>
      </div>

      {tab === 'generate' && <GenerateMode />}
      {tab === 'compare' && <CompareMode />}

      {/* Footer */}
      <div style={{ marginTop: 40, textAlign: 'center', fontSize: 10, color: '#333' }}>
        Email sequence generation using AIDA · PAS · Hormozi · Cialdini · Storytelling frameworks · Powered by local Claude session
      </div>
    </div>
  );
}
