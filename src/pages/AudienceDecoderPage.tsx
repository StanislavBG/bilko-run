import { useState, useEffect, useRef } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { ToolHero, ScoreCard, CrossPromo } from '../components/tool-page/index.js';

// ── Types ───────────────────────────────────────────────────────────────────

interface Archetype {
  name: string;
  percentage: number;
  description: string;
  evidence: string[];
}

interface SnapshotEntry { headline: string; score: number; grade: string; archetypes: string[]; date: string; }
const SNAPSHOTS_KEY = 'bilko_audience_snapshots';
function loadSnapshots(): SnapshotEntry[] { try { return JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]'); } catch { return []; } }

interface AnalysisResult {
  audience_archetypes: Archetype[];
  content_patterns: {
    top_performing_themes: Array<{ theme: string; frequency: number; avg_engagement_signal: string }>;
    underperforming_themes: Array<{ theme: string; frequency: number; avg_engagement_signal: string }>;
    optimal_format: string;
    optimal_length: string;
    voice_analysis: { tone: string; unique_phrases: string[]; brand_words: string[] };
  };
  engagement_model: {
    hook_effectiveness: { score: number; best_hooks: string[]; worst_hooks: string[] };
    cta_effectiveness: { score: number; recommendation: string };
    controversy_index: { score: number; note: string };
    shareability_score: number;
  };
  growth_opportunities: Array<{ opportunity: string; impact: string; effort: string; explanation: string }>;
  content_calendar: {
    weekly_mix: { threads: number; single_posts: number; questions: number };
    theme_rotation: string[];
    gaps_to_fill: string[];
  };
  overall_score: number;
  grade: string;
  headline: string;
}

interface CompareResponse {
  result_a: AnalysisResult;
  result_b: AnalysisResult;
  comparison: { winner: 'A' | 'B' | 'tie'; margin: number; verdict: string };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function inferPersonality(engagement: AnalysisResult['engagement_model']): { type: string; emoji: string; desc: string } {
  const hook = engagement.hook_effectiveness.score;
  const controversy = engagement.controversy_index.score;
  const share = engagement.shareability_score;

  if (hook > 70 && controversy > 50) return { type: 'The Provocateur', emoji: '\u{1F3AD}', desc: 'High hook + high controversy. You start debates and people can\'t look away.' };
  if (hook > 70 && share > 70) return { type: 'The Amplifier', emoji: '\u{1F4E2}', desc: 'Your content spreads. People share you because you make them look smart.' };
  if (share > 70 && controversy < 30) return { type: 'The Educator', emoji: '\u{1F4DA}', desc: 'Trusted voice. You teach and people save your posts for later.' };
  if (hook < 40) return { type: 'The Slow Burn', emoji: '\u{1F56F}\uFE0F', desc: 'Your hooks need work, but people who find you stay. Build the top of funnel.' };
  return { type: 'The Generalist', emoji: '\u{1F3AF}', desc: 'Solid across the board. Pick a lane to 10x one dimension.' };
}

function scorePillColor(score: number) {
  if (score >= 70) return 'bg-green-100 text-green-700 border-green-200';
  if (score >= 40) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function impactBadge(level: string) {
  const l = level.toLowerCase();
  if (l === 'high') return 'bg-green-100 text-green-700';
  if (l === 'medium') return 'bg-yellow-100 text-yellow-700';
  return 'bg-orange-100 text-orange-700';
}

function effortBadge(level: string) {
  const l = level.toLowerCase();
  if (l === 'low') return 'bg-green-100 text-green-700';
  if (l === 'medium') return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ArchetypeCard({ a, delay }: { a: Archetype; delay: number }) {
  return (
    <div className="bg-white rounded-xl border border-warm-200/60 p-5 animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold text-warm-900">{a.name}</h4>
        <span className="text-sm font-semibold text-fire-500">{a.percentage}%</span>
      </div>
      <div className="h-2 bg-warm-100 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-gradient-to-r from-fire-400 to-fire-500 rounded-full transition-all duration-700" style={{ width: `${a.percentage}%` }} />
      </div>
      <p className="text-sm text-warm-600 mb-3">{a.description}</p>
      {a.evidence.length > 0 && (
        <div className="space-y-1">
          {a.evidence.map((e, i) => (
            <p key={i} className="text-xs text-warm-400 italic">&ldquo;{e}&rdquo;</p>
          ))}
        </div>
      )}
    </div>
  );
}

function EngagementGrid({ model }: { model: AnalysisResult['engagement_model'] }) {
  const pills = [
    { label: 'Hook Effectiveness', score: model.hook_effectiveness.score },
    { label: 'CTA Effectiveness', score: model.cta_effectiveness.score },
    { label: 'Controversy Index', score: model.controversy_index.score },
    { label: 'Shareability', score: model.shareability_score },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {pills.map((p) => (
        <div key={p.label} className={`rounded-xl border p-4 text-center ${scorePillColor(p.score)}`}>
          <div className="text-2xl font-black">{p.score}</div>
          <div className="text-xs font-semibold mt-1">{p.label}</div>
        </div>
      ))}
    </div>
  );
}

function ContentPatterns({ patterns }: { patterns: AnalysisResult['content_patterns'] }) {
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-green-600 mb-2">Working Well</h4>
          <div className="flex flex-wrap gap-2">
            {patterns.top_performing_themes.map((t) => (
              <span key={t.theme} className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-semibold">
                {t.theme}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-2">Underperforming</h4>
          <div className="flex flex-wrap gap-2">
            {patterns.underperforming_themes.map((t) => (
              <span key={t.theme} className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-semibold">
                {t.theme}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-warm-50 rounded-lg p-3">
          <div className="text-xs text-warm-400 font-semibold uppercase">Format</div>
          <div className="text-sm font-bold text-warm-800 mt-1">{patterns.optimal_format}</div>
        </div>
        <div className="bg-warm-50 rounded-lg p-3">
          <div className="text-xs text-warm-400 font-semibold uppercase">Length</div>
          <div className="text-sm font-bold text-warm-800 mt-1">{patterns.optimal_length}</div>
        </div>
        <div className="bg-warm-50 rounded-lg p-3">
          <div className="text-xs text-warm-400 font-semibold uppercase">Tone</div>
          <div className="text-sm font-bold text-warm-800 mt-1">{patterns.voice_analysis.tone}</div>
        </div>
      </div>
    </div>
  );
}

function GrowthOpportunities({ items }: { items: AnalysisResult['growth_opportunities'] }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="bg-white rounded-xl border border-warm-200/60 p-4 animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-fire-100 text-fire-600 flex items-center justify-center text-sm font-black">{i + 1}</span>
            <div className="flex-1">
              <p className="font-bold text-warm-900 text-sm">{item.opportunity}</p>
              <div className="flex gap-2 mt-1 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${impactBadge(item.impact)}`}>Impact: {item.impact}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${effortBadge(item.effort)}`}>Effort: {item.effort}</span>
              </div>
              <p className="text-xs text-warm-500 leading-relaxed">{item.explanation}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarSection({ calendar }: { calendar: AnalysisResult['content_calendar'] }) {
  const { weekly_mix: mix, theme_rotation, gaps_to_fill } = calendar;
  return (
    <div className="space-y-4">
      <div className="bg-fire-50 border border-fire-200 rounded-xl p-4 text-center">
        <div className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Weekly Mix</div>
        <p className="text-sm font-semibold text-warm-800">
          {mix.threads} threads &middot; {mix.single_posts} posts &middot; {mix.questions} questions
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-2">Theme Rotation</h4>
          <ul className="space-y-1">
            {theme_rotation.map((t, i) => (
              <li key={i} className="text-sm text-warm-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-fire-400 flex-shrink-0" />{t}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-2">Gaps to Fill</h4>
          <ul className="space-y-1">
            {gaps_to_fill.map((g, i) => (
              <li key={i} className="text-sm text-warm-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />{g}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Section Wrapper ─────────────────────────────────────────────────────────

function Section({ title, delay, children }: { title: string; delay: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
      <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">{title}</h3>
      {children}
    </div>
  );
}

// ── Compare Result ──────────────────────────────────────────────────────────

function CompareResult({ data }: { data: CompareResponse }) {
  const { result_a, result_b, comparison } = data;
  const aWins = comparison.winner === 'A';
  const bWins = comparison.winner === 'B';

  return (
    <div className="space-y-6">
      {comparison.winner !== 'tie' ? (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center animate-slide-up">
          <p className="text-2xl font-black text-green-700">Creator {comparison.winner} wins</p>
          <p className="text-sm text-green-600 mt-1">+{comparison.margin} points ahead</p>
        </div>
      ) : (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 text-center animate-slide-up">
          <p className="text-2xl font-black text-yellow-700">It&rsquo;s a tie!</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
        {[{ label: 'Creator A', r: result_a, isWinner: aWins, isDimmed: bWins },
          { label: 'Creator B', r: result_b, isWinner: bWins, isDimmed: aWins }].map(({ label, r, isWinner, isDimmed }) => (
          <div key={label} className={`relative bg-white rounded-2xl border-2 p-5 transition-opacity ${
            isWinner ? 'border-green-300 shadow-lg shadow-green-100/50' : isDimmed ? 'border-warm-200 opacity-60' : 'border-warm-200'
          }`}>
            {isWinner && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-0.5 rounded-full">WINNER</div>
            )}
            <div className="text-center mb-3">
              <div className="text-xs uppercase tracking-wider text-warm-400 font-bold mb-2">{label}</div>
              <div className="flex items-center justify-center gap-3">
                <span className="text-4xl font-black text-warm-900">{r.overall_score}</span>
                <span className="text-2xl font-black text-fire-500">{r.grade}</span>
              </div>
              <p className="text-sm text-warm-600 italic mt-2 line-clamp-2">&ldquo;{r.headline}&rdquo;</p>
            </div>
            <EngagementGrid model={r.engagement_model} />
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-r from-fire-50 to-warm-50 rounded-2xl border border-fire-200 p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
        <h3 className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-3">Verdict</h3>
        <p className="text-sm text-warm-700 leading-relaxed">{comparison.verdict}</p>
      </div>

      {[{ label: 'Creator A', r: result_a }, { label: 'Creator B', r: result_b }].map(({ label, r }) => (
        <div key={label} className="space-y-4 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <h3 className="text-lg font-black text-warm-900">{label} — Full Analysis</h3>
          <Section title="Audience Archetypes" delay={0}>
            <div className="space-y-3">
              {r.audience_archetypes.map((a, i) => <ArchetypeCard key={a.name} a={a} delay={0} />)}
            </div>
          </Section>
          <Section title="Content Patterns" delay={0}>
            <ContentPatterns patterns={r.content_patterns} />
          </Section>
          <Section title="Growth Opportunities" delay={0}>
            <GrowthOpportunities items={r.growth_opportunities} />
          </Section>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export function AudienceDecoderPage() {
  const { result, compareResult, loading, error, needsTokens, isSignedIn, submit, submitCompare, reset, signInRef } = useToolApi<AnalysisResult>('audience-decoder');
  const [tab, setTab] = useState<'score' | 'compare'>('score');
  const [content, setContent] = useState('');
  const [contentA, setContentA] = useState('');
  const [contentB, setContentB] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>(loadSnapshots);

  function saveSnapshot() {
    if (!r) return;
    const entry: SnapshotEntry = {
      headline: r.headline, score: r.overall_score, grade: r.grade,
      archetypes: r.audience_archetypes.map(a => a.name), date: new Date().toISOString(),
    };
    const updated = [entry, ...snapshots.filter(s => s.headline !== entry.headline)].slice(0, 10);
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(updated));
    setSnapshots(updated);
  }

  const r = result as AnalysisResult | null;
  const cr = compareResult as CompareResponse | null;

  useEffect(() => {
    if ((r || cr) && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [r, cr]);

  function handleSubmit() {
    if (tab === 'compare') {
      if (!contentA.trim() || !contentB.trim()) return;
      submitCompare({ content_a: contentA, content_b: contentB });
    } else {
      if (!content.trim()) return;
      submit({ content });
    }
  }

  function handleReset() {
    reset();
    setContent('');
    setContentA('');
    setContentB('');
  }

  const canSubmit = tab === 'compare' ? contentA.trim() && contentB.trim() : content.trim();

  return (
    <div className="min-h-screen bg-warm-50">
      <ToolHero
        title="Audience Decoder"
        tagline="Decode who actually follows you, what content lands, and how to grow."
        tab={tab}
        onTabChange={(t) => { setTab(t); reset(); }}
        hasCompare
      >
        {tab === 'score' ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste 10-20 of your social posts, threads, or bio content..."
            rows={6}
            className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-white placeholder-warm-500 text-sm focus:outline-none focus:ring-2 focus:ring-fire-400/50 resize-y"
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <textarea
              value={contentA}
              onChange={(e) => setContentA(e.target.value)}
              placeholder="Creator A — paste posts..."
              rows={5}
              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-white placeholder-warm-500 text-sm focus:outline-none focus:ring-2 focus:ring-fire-400/50 resize-y"
            />
            <textarea
              value={contentB}
              onChange={(e) => setContentB(e.target.value)}
              placeholder="Creator B — paste posts..."
              rows={5}
              className="w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-white placeholder-warm-500 text-sm focus:outline-none focus:ring-2 focus:ring-fire-400/50 resize-y"
            />
          </div>
        )}

        <div className="flex justify-center gap-3 mt-4">
          <button
            onClick={handleSubmit}
            disabled={loading || !canSubmit}
            className="px-8 py-3 bg-gradient-to-r from-fire-500 to-fire-600 hover:from-fire-600 hover:to-fire-700 text-white font-bold rounded-xl shadow-lg shadow-fire-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
          >
            {loading ? 'Decoding...' : tab === 'compare' ? 'Compare Creators' : 'Decode My Audience'}
          </button>
          {(r || cr) && (
            <button onClick={handleReset} className="px-5 py-3 border border-white/20 text-warm-400 hover:text-white rounded-xl text-sm font-semibold transition-colors">
              Start Over
            </button>
          )}
        </div>

        {/* Hidden sign-in trigger */}
        <div className="hidden">
          <SignInButton mode="modal">
            <button ref={signInRef}>Sign in</button>
          </SignInButton>
        </div>
      </ToolHero>

      {/* Error / Needs Tokens */}
      {error && (
        <div className="max-w-3xl mx-auto px-6 mt-6">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
        </div>
      )}
      {needsTokens && (
        <div className="max-w-3xl mx-auto px-6 mt-6">
          <div className="bg-fire-50 border border-fire-200 rounded-xl p-5 text-center">
            <p className="text-sm font-semibold text-warm-800 mb-2">You need tokens to run this analysis.</p>
            <a href="/pricing" className="text-fire-600 hover:text-fire-700 text-sm font-bold underline">Get tokens</a>
          </div>
        </div>
      )}

      {/* Results */}
      <div ref={resultRef} className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Compare result */}
        {cr && <CompareResult data={cr} />}

        {/* Single result */}
        {r && (
          <>
            <ScoreCard score={r.overall_score} grade={r.grade} verdict={r.headline} toolName="Audience Decoder" />
            <div className="text-center">
              <button onClick={saveSnapshot} className="text-xs px-4 py-2 border border-fire-200 text-fire-600 hover:bg-fire-50 rounded-lg transition-colors">
                Save Audience Snapshot
              </button>
            </div>

            {(() => {
              const p = inferPersonality(r.engagement_model);
              return (
                <div className="bg-warm-50 rounded-2xl border border-warm-200/60 p-6 text-center animate-slide-up">
                  <span className="text-3xl">{p.emoji}</span>
                  <p className="text-lg font-black text-warm-900 mt-2">{p.type}</p>
                  <p className="text-sm text-warm-600 mt-1">{p.desc}</p>
                </div>
              );
            })()}

            <Section title="Audience Archetypes" delay={100}>
              <div className="space-y-3">
                {r.audience_archetypes.map((a, i) => (
                  <ArchetypeCard key={a.name} a={a} delay={150 + i * 80} />
                ))}
              </div>
            </Section>

            <Section title="Engagement Model" delay={200}>
              <EngagementGrid model={r.engagement_model} />
            </Section>

            <Section title="Content Patterns" delay={300}>
              <ContentPatterns patterns={r.content_patterns} />
            </Section>

            <Section title="Growth Opportunities" delay={400}>
              <GrowthOpportunities items={r.growth_opportunities} />
            </Section>

            <Section title="Content Calendar" delay={500}>
              <CalendarSection calendar={r.content_calendar} />
            </Section>
          </>
        )}
      </div>

      {r && <CrossPromo currentTool="audience-decoder" />}

      {/* Below-fold engagement content — only when idle */}
      {!r && !cr && !loading && (
        <div className="max-w-3xl mx-auto px-6 pb-8 space-y-10">
          {/* What you'll learn */}
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-1">What You'll Learn</h3>
            <p className="text-sm text-warm-500 mb-5">Five areas of insight. Zero hand-waving.</p>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-fire-100 text-fire-700 flex items-center justify-center text-xs font-black">1</span>
                <div>
                  <p className="text-sm font-bold text-warm-900">Audience Archetypes</p>
                  <p className="text-sm text-warm-600">Who actually follows you — not who you think follows you. Names, percentages, evidence.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center text-xs font-black">2</span>
                <div>
                  <p className="text-sm font-bold text-warm-900">Content Patterns</p>
                  <p className="text-sm text-warm-600">What's working, what's flopping, and what you should stop posting entirely.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black">3</span>
                <div>
                  <p className="text-sm font-bold text-warm-900">Engagement Model</p>
                  <p className="text-sm text-warm-600">Hook effectiveness, CTA quality, controversy risk, shareability. Four numbers that explain your reach.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-black">4</span>
                <div>
                  <p className="text-sm font-bold text-warm-900">Growth Opportunities</p>
                  <p className="text-sm text-warm-600">Impact x effort matrix. Because "post more" isn't a strategy.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-black">5</span>
                <div>
                  <p className="text-sm font-bold text-warm-900">Content Calendar</p>
                  <p className="text-sm text-warm-600">Weekly mix, theme rotation, gaps to fill. An actual plan, not vibes.</p>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-5">Frequently Asked Questions</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold text-warm-900">How much content should I paste?</p>
                <p className="text-sm text-warm-600">10-20 posts minimum. More data = better archetypes. Paste your last month of content.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-warm-900">Can I decode a competitor?</p>
                <p className="text-sm text-warm-600">Paste their public content instead of yours. Use Compare mode to see how your audiences differ.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-warm-900">Is this the same as audience analytics?</p>
                <p className="text-sm text-warm-600">No. Analytics tells you demographics. This tells you psychographics — who they are, what they care about, why they follow you.</p>
              </div>
              <div>
                <p className="text-sm font-bold text-warm-900">How often should I re-decode?</p>
                <p className="text-sm text-warm-600">Monthly. Save snapshots to track how your audience evolves as your content strategy shifts.</p>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="text-center">
            <p className="text-lg font-bold text-warm-800 mb-3">Your audience is already telling you what they want. Decode it.</p>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="px-6 py-3 bg-gradient-to-r from-fire-500 to-fire-600 hover:from-fire-600 hover:to-fire-700 text-white font-bold rounded-xl shadow-lg transition-all text-sm">
              Back to top
            </button>
          </div>
        </div>
      )}

      {/* Audience Snapshots */}
      {snapshots.length > 0 && (
        <div className="max-w-2xl mx-auto px-6 pb-12">
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">My Snapshots ({snapshots.length})</h3>
            <div className="space-y-2">
              {snapshots.map((s, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-warm-50 last:border-0">
                  <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                    s.grade.startsWith('A') ? 'bg-green-100 text-green-700' :
                    s.grade.startsWith('B') ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{s.grade}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-warm-800 font-medium truncate">{s.headline}</p>
                    <p className="text-xs text-warm-400">{s.score}/100 &middot; {s.archetypes.join(', ')} &middot; {new Date(s.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
