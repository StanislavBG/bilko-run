import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { track } from '../hooks/usePageView.js';
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

// ── Tutorial content block ──────────────────────────────────────────────────

const AD_PROMPTS: Array<{ category: string; label: string; text: string }> = [
  { category: 'B2B SaaS', label: 'Describe a SaaS buyer', text: 'I sell a B2B observability platform to engineering directors at 100–1,000-person SaaS companies. They buy after an incident costs them a big customer. They use Datadog + PagerDuty today. They trust peers, dev conference talks, and case studies from similar-stage companies. Budget: $30k–$120k/yr.' },
  { category: 'B2B SaaS', label: 'Describe a buyer through content', text: '(paste 10–20 of your last tweets, newsletter intros, or LinkedIn posts. Add: Product = X. Audience hypothesis = Y.)' },
  { category: 'E-commerce', label: 'Describe a DTC shopper', text: 'I sell $48 premium pour-over coffee subscriptions. Customers are 28–42, urban, bought 1–2 specialty coffee items in the last 90 days, follow coffee creators on Instagram. Cancel rate is 18% in month 2. I want to know who stays vs. churns and why.' },
  { category: 'E-commerce', label: 'Brand tone audit', text: '(paste 10–15 of your recent product descriptions, email subject lines, and IG captions.) Product: minimalist leather goods, $80–$250. Audience hypothesis: design-conscious men 30–50.' },
  { category: 'Creator', label: 'Decode your own audience', text: '(paste 15–20 of your last tweets or LinkedIn posts.) Goal: tell me which archetype dominates, which engagement signal is strongest, and what content format I should double down on.' },
  { category: 'Creator', label: 'Compare yourself to a competitor', text: 'Creator A: me (paste 15 posts).\nCreator B: (paste 15 posts from competitor).\nGoal: audience overlap, tone difference, and who is winning the shared segment.' },
  { category: 'Course creator', label: 'Describe a student', text: 'I sell a $297 self-paced course on cold email copywriting. Students are freelance marketers 1–3 years into freelancing who want to add email as a service. They have 5–15 clients. They\'ve tried courses before and not finished them. They buy after a free tool converts them.' },
  { category: 'Local biz', label: 'Describe a local customer', text: 'I own a 4-chair barbershop in a town of 18,000. Customers are men 20–55, 60% repeat monthly. They find us on Google Maps and Instagram. I want to know which 20% of customers drive 80% of revenue and what I should say to the other 80% to convert them to regulars.' },
  { category: 'Local biz', label: 'Decode repeat buyers', text: '(paste 10–15 of the reviews you got this year + your Google Business description.) Product: residential cleaning service, $180 standard. Goal: describe the person who books us 3+ times.' },
  { category: 'Agency', label: 'Decode a client\'s audience', text: '(paste 20 posts or blog intros from your client\'s account.) Client: B2B payroll software for restaurants. Audience hypothesis: multi-location restaurant operators. Goal: confirm or redirect their content strategy.' },
];

const AD_MISTAKES: Array<{ mistake: string; fix: string }> = [
  { mistake: 'Pasting only 2–3 posts for decoding', fix: 'Paste 10–20. Three posts produce noise; ten posts produce signal. Your last month of content is the sweet spot.' },
  { mistake: 'Mixing voices (multiple authors in one decode)', fix: 'Only paste content from one author. If your account has two voices, decode them separately and compare results.' },
  { mistake: 'Describing audience by demographics only', fix: 'Demographics tell you who. Psychographics tell you why. Add motivation, trigger, objections, and where they hang out.' },
  { mistake: 'Ignoring the personality type result', fix: 'The 5 creator personality types (Provocateur, Amplifier, Educator, Slow Burn, Generalist) are content strategy gold. Read yours and weight your calendar accordingly.' },
  { mistake: 'Not re-decoding monthly', fix: 'Audiences shift as your content shifts. Save snapshots, re-decode monthly, and compare. It\'s the only way to see the audience drift before it hurts you.' },
  { mistake: 'Treating archetypes as fixed identities', fix: 'Archetypes describe current pull, not permanent audience. Change your content angle and the archetypes shift in 2–4 weeks.' },
  { mistake: 'Skipping Compare mode', fix: 'Comparing yourself to a competitor takes 30 seconds and produces the single most actionable output — the shared segment you should both be fighting over.' },
];

const AD_FAQ: Array<{ q: string; a: string }> = [
  { q: 'How is this different from X/Twitter analytics?', a: 'Analytics gives demographics — age, location, gender. AudienceDecoder gives psychographics — what they care about, why they follow you, what hooks they respond to, and which content format to double down on.' },
  { q: 'How much content should I paste?', a: '10–20 posts minimum. More data = sharper archetypes. Your last month of content is the sweet spot. Fewer than 5 posts produces noise.' },
  { q: 'How much does one decode cost?', a: '$1 per decode (1 credit). $5 buys 7 credits. 2 credits for Compare mode. Credits never expire and work across all 10 bilko.run tools. First decode is free.' },
  { q: 'Is my content private?', a: 'Your pasted content is sent to Gemini for analysis, then discarded. We don\'t store the text or train on it. Only anonymous snapshots of scores are kept.' },
  { q: 'How is this different from ChatGPT?', a: 'ChatGPT describes audience generically. AudienceDecoder returns structured archetypes with percentages, evidence quotes from your actual content, a personality type, and a weekly content calendar — not vibes, receipts.' },
  { q: 'Can I decode a competitor?', a: 'Yes. Paste their public posts. In Compare mode you can paste two creators and see audience overlap, tone differences, and who is winning the shared segment.' },
  { q: 'Does this work for B2B / niche industries?', a: 'Yes. The archetype engine is domain-agnostic — it reads the language patterns and engagement signals in your content, not the industry. Niche B2B accounts often get the sharpest decodes.' },
  { q: 'What are the 5 personality types?', a: 'Provocateur, Amplifier, Educator, Slow Burn, and Generalist. Each one has a content strategy that fits naturally. You get your type plus a calendar weighted to your strengths.' },
  { q: 'How often should I re-decode?', a: 'Monthly. Save snapshots to track audience drift. If you change topics, formats, or tone, re-decode immediately to see the audience impact.' },
  { q: 'Can I decode podcast or YouTube content?', a: 'Yes — paste transcripts or episode descriptions. Text-first analysis works on any long-form content, not just social posts.' },
];

const AD_TIPS: Array<{ tip: string; why: string }> = [
  { tip: 'Paste 15–20 posts for the sharpest decode', why: 'Signal rises with volume. Ten posts beats five by a wide margin. Twenty posts beats ten by less, but still worth it.' },
  { tip: 'Describe your audience hypothesis first', why: 'Giving the model your hypothesis lets it confirm or redirect. A blank decode is useful; a directed decode is actionable.' },
  { tip: 'Pay attention to the evidence quotes', why: 'Every archetype is backed by quotes pulled from your content. Read them — they tell you exactly which lines attract that segment.' },
  { tip: 'Use Compare mode on competitors', why: 'The shared segment is where the competitive battle lives. It\'s the single highest-leverage output the tool produces.' },
  { tip: 'Re-decode after any strategy shift', why: 'Changing topics or formats moves the archetype mix in 2–4 weeks. Monthly snapshots let you see the shift before it hurts.' },
  { tip: 'Use the weekly calendar as a default', why: 'The generated calendar is a format + theme rotation. Use it as a floor — fill 80% with it, leave 20% for experiments.' },
  { tip: 'Focus content on one archetype at a time', why: 'Writing to "everyone" dilutes all archetypes. Writing to the top archetype grows it fast, which usually pulls adjacent ones with it.' },
  { tip: 'Save snapshots before experiments', why: 'You need a baseline to measure against. Snapshot, experiment, re-decode, compare. That\'s the loop.' },
];

function AudienceDecoderTutorial() {
  const [copied, setCopied] = useState<number | null>(null);

  async function copyPrompt(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(idx);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* noop */
    }
  }

  return (
    <>
      {/* Step-by-step guide */}
      <section className="bg-warm-100/40 border-y border-warm-200/40">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Step by step</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">How to use AudienceDecoder — step by step</h2>
            <p className="mt-3 text-base text-warm-600">Five steps from raw content to a usable content calendar.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { n: 1, emoji: '📥', title: 'Gather content', desc: 'Collect 10–20 of your recent posts, threads, or bio.', example: 'Your last month of tweets + LinkedIn posts.' },
              { n: 2, emoji: '📝', title: 'Add a hypothesis', desc: 'State who you think your audience is. Model will confirm or redirect.', example: '"B2B growth PMs, Series A–C, building SaaS funnels."' },
              { n: 3, emoji: '🎯', title: 'Click Decode', desc: 'Get archetypes, personality type, and calendar in ~15 seconds.', example: 'Primary: The Builder 45% · Secondary: The Operator 28%' },
              { n: 4, emoji: '🔍', title: 'Read the evidence quotes', desc: 'Every archetype cites actual lines from your content. Read them.', example: '"This specific tweet pulled Builders: …"' },
              { n: 5, emoji: '📆', title: 'Run the calendar', desc: 'Weekly posting plan with theme rotation and format mix.', example: 'Mon: educational · Wed: story · Fri: take' },
            ].map(step => (
              <div key={step.n} className="bg-white rounded-2xl border border-warm-200/60 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 rounded-full bg-fire-500 text-white flex items-center justify-center text-sm font-black">{step.n}</span>
                  <span className="text-2xl" aria-hidden="true" aria-label={step.title}>{step.emoji}</span>
                </div>
                <h3 className="text-sm font-black text-warm-900 mb-1">{step.title}</h3>
                <p className="text-xs text-warm-600 leading-relaxed mb-3">{step.desc}</p>
                <div className="bg-warm-50 border border-warm-200/60 rounded-lg px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-warm-400 mb-1">Example</p>
                  <p className="text-xs text-warm-700 font-mono whitespace-pre-wrap leading-snug">{step.example}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Worked examples */}
      <section className="bg-white border-b border-warm-200/40">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Worked examples</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Three real decodes, input to output</h2>
            <p className="mt-3 text-base text-warm-600">What you paste, what AudienceDecoder returned, and the takeaway.</p>
          </div>
          <div className="space-y-8">
            {[
              {
                title: 'B2B SaaS buyer (described)',
                input: 'Product: B2B observability platform, $30k–$120k/yr ACV.\nAudience hypothesis: engineering directors at 100–1,000 person SaaS companies.\nTrigger: bought after an incident cost a key customer.\nTools today: Datadog, PagerDuty.\nTrust signals: peers, dev conference talks, case studies.',
                output: 'Score: 84/100 (A-)\nPersonality type: Educator\n\nArchetypes:\n  1. The Incident Survivor — 42% · "we lost $2M in MRR after one outage"\n  2. The Quiet Evaluator — 31% · reads case studies 3x before replying\n  3. The Peer-Led Buyer — 27% · buys after a peer mentions on Slack\n\nContent gaps:\n  - No post-incident retrospective content\n  - No peer quotes on "we tried X and moved to you" angle\n\nCalendar:\n  Mon: post-incident war story (Builder voice)\n  Wed: peer case study quote\n  Fri: tactical "detect X in Y minutes" how-to',
                takeaway: 'Strong decode. The Incident Survivor is the biggest archetype — lean into war-story content and peer quotes. The Educator type matches — keep the tactical how-tos.',
              },
              {
                title: 'E-commerce shopper (described)',
                input: 'Product: $48 premium pour-over coffee subscription, 3-month cadence.\nAudience: 28–42, urban, bought 1–2 specialty coffee items in 90 days, follow coffee creators.\nCancel rate: 18% in month 2.\nGoal: decode who stays vs. who churns.',
                output: 'Score: 76/100 (B+)\nPersonality type: Slow Burn\n\nArchetypes:\n  1. The Ritual Keeper — 38% · stays, buys 6+ months\n  2. The Experimenter — 34% · tries, churns month 2\n  3. The Gift Buyer — 28% · buys for others, high reorder on holidays\n\nRetention insight:\n  - Ritual Keepers respond to brew-method education\n  - Experimenters churn because variety saturates by month 2\n  - Gift Buyers need seasonal re-engagement emails\n\nCalendar:\n  Week 1: brewing ritual content (for Keepers)\n  Week 2: origin story of the week (for Experimenters)\n  Week 3: gift guide format (for Gift Buyers)\n  Week 4: customer ritual spotlight',
                takeaway: '18% churn is concentrated in the Experimenter segment. Introducing rotating origins in month 2 would likely cut churn meaningfully.',
              },
              {
                title: 'Course student (decoded from content)',
                input: '(15 LinkedIn posts pasted, example excerpts:)\n"I left agency life to freelance and made every mistake you can make in year 1."\n"Your cold email is boring because you\'re writing to yourself."\n"Templates got me my first 3 clients. Voice got me the next 20."\nProduct: $297 cold email copywriting course.',
                output: 'Score: 81/100 (A-)\nPersonality type: Amplifier\n\nArchetypes:\n  1. The Reluctant Freelancer — 48% · left a job, feels underqualified\n  2. The Template Graduate — 29% · past template stage, building voice\n  3. The Quiet Learner — 23% · reads everything, buys rarely\n\nEvidence quotes:\n  Reluctant Freelancer: "I left agency life… made every mistake"\n  Template Graduate: "Templates got me 3. Voice got me 20."\n\nCalendar:\n  Mon: year-1-mistake post (Reluctant Freelancer)\n  Wed: voice-vs-template breakdown (Template Graduate)\n  Fri: quiet-win case study (Quiet Learner)\n\nLaunch angle: lead with Reluctant Freelancer in week 1, Template Graduate in week 2.',
                takeaway: 'Decode matches creator\'s strongest content. The Reluctant Freelancer archetype is 48% — launch sequence should lead with that angle for highest conversion.',
              },
            ].map((ex) => (
              <div key={ex.title} className="bg-warm-50/60 rounded-2xl border border-warm-200/60 overflow-hidden">
                <div className="px-6 py-4 bg-white border-b border-warm-200/60">
                  <h3 className="text-base font-black text-warm-900">{ex.title}</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-0 border-b border-warm-200/60">
                  <div className="p-5 md:border-r border-warm-200/60">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-warm-400 mb-2">Input</p>
                    <pre className="text-xs text-warm-700 font-mono whitespace-pre-wrap leading-relaxed">{ex.input}</pre>
                  </div>
                  <div className="p-5 bg-white">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-fire-500 mb-2">AudienceDecoder output</p>
                    <pre className="text-xs text-warm-700 font-mono whitespace-pre-wrap leading-relaxed">{ex.output}</pre>
                  </div>
                </div>
                <div className="p-5 bg-green-50/60">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-green-600 mb-1">Takeaway</p>
                  <p className="text-sm text-warm-800 leading-relaxed">{ex.takeaway}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Try these prompts */}
      <section className="bg-warm-100/40 border-b border-warm-200/40">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Starter pack</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Try these prompts</h2>
            <p className="mt-3 text-base text-warm-600">Ten copy-ready inputs by use case. Click to copy.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {AD_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => copyPrompt(p.text, i)}
                className="group text-left bg-white rounded-2xl border border-warm-200/60 hover:border-fire-300 p-5 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-fire-600 bg-fire-50 px-2 py-0.5 rounded-full">{p.category}</span>
                  <span className={`text-xs font-bold transition-colors ${copied === i ? 'text-green-600' : 'text-warm-400 group-hover:text-fire-500'}`}>
                    {copied === i ? 'Copied!' : 'Copy'}
                  </span>
                </div>
                <p className="text-sm font-bold text-warm-900 mb-2">{p.label}</p>
                <p className="text-xs text-warm-600 font-mono whitespace-pre-wrap leading-relaxed line-clamp-4">{p.text}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* What great output looks like */}
      <section className="bg-white border-b border-warm-200/40">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Calibrate your expectations</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">What great output looks like</h2>
            <p className="mt-3 text-base text-warm-600">A sample decode result, annotated.</p>
          </div>
          <div className="bg-warm-50/60 rounded-2xl border border-warm-200/60 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-warm-200/60">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-warm-400">Decode Score</p>
                <p className="text-4xl font-black text-warm-900">84<span className="text-base text-warm-500">/100</span></p>
              </div>
              <span className="inline-flex items-center justify-center px-4 h-14 rounded-xl bg-green-100 text-green-700 text-sm font-black">Educator</span>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-fire-500 mb-1">Primary archetype — 42%</p>
                <p className="font-bold text-warm-900">The Incident Survivor</p>
                <p className="text-warm-600 text-xs mt-0.5">Backed by quotes like "we lost $2M in MRR after one outage." Responds to war-story content and post-incident retrospectives.</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-fire-500 mb-1">Secondary archetype — 31%</p>
                <p className="font-bold text-warm-900">The Quiet Evaluator</p>
                <p className="text-warm-600 text-xs mt-0.5">Reads 3+ case studies before replying. Responds to peer quotes and specific ROI numbers.</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-fire-500 mb-1">Tertiary archetype — 27%</p>
                <p className="font-bold text-warm-900">The Peer-Led Buyer</p>
                <p className="text-warm-600 text-xs mt-0.5">Buys after a peer mentions the product on Slack. Responds to peer-quote content.</p>
              </div>
              <div className="pt-2 border-t border-warm-200/60">
                <p className="text-[11px] font-bold uppercase tracking-wider text-warm-400 mb-1">Content gaps detected</p>
                <p className="text-warm-600 text-xs">No post-incident retrospectives. No "we moved from X to you" peer quotes. Both would pull the primary archetype harder.</p>
              </div>
              <div className="pt-2 border-t border-warm-200/60">
                <p className="text-[11px] font-bold uppercase tracking-wider text-warm-400 mb-1">Weekly calendar</p>
                <p className="text-warm-600 text-xs">Mon: post-incident war story · Wed: peer case study · Fri: tactical how-to</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-warm-500 mt-4 text-center italic">Read the archetype percentages + evidence quotes first. They tell you exactly which lines in your content attract which people.</p>
        </div>
      </section>

      {/* Common mistakes + fixes */}
      <section className="bg-warm-100/40 border-b border-warm-200/40">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Common mistakes</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Common mistakes + fixes</h2>
            <p className="mt-3 text-base text-warm-600">The seven errors that produce weak decodes.</p>
          </div>
          <div className="space-y-3">
            {AD_MISTAKES.map((m, i) => (
              <details key={i} className="group bg-white rounded-xl border border-warm-200/60 open:border-fire-200">
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none">
                  <span className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-50 text-red-600 text-xs font-black">{i + 1}</span>
                    <span className="text-sm font-bold text-warm-900">{m.mistake}</span>
                  </span>
                  <svg className="w-4 h-4 flex-shrink-0 text-warm-500 transition-transform group-open:rotate-180 group-open:text-fire-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </summary>
                <div className="px-5 pb-4 -mt-1">
                  <p className="text-sm text-warm-600 leading-relaxed"><span className="font-bold text-green-700">Fix: </span>{m.fix}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white border-b border-warm-200/40">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">FAQ</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">AudienceDecoder FAQ</h2>
            <p className="mt-3 text-base text-warm-600">Pricing, privacy, accuracy, and how it differs from ChatGPT.</p>
          </div>
          <div className="space-y-3">
            {AD_FAQ.map((f, i) => (
              <details key={i} className="group bg-warm-50/60 rounded-xl border border-warm-200/60 open:bg-white open:border-fire-200">
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none">
                  <span className="text-sm font-bold text-warm-900">{f.q}</span>
                  <svg className="w-4 h-4 flex-shrink-0 text-warm-500 transition-transform group-open:rotate-180 group-open:text-fire-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </summary>
                <div className="px-5 pb-4 -mt-1">
                  <p className="text-sm text-warm-600 leading-relaxed">{f.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases by role */}
      <section className="bg-warm-100/40 border-b border-warm-200/40">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Who uses it</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Use cases by role</h2>
            <p className="mt-3 text-base text-warm-600">Four roles, four workflows, same tool.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '🚀', role: 'Founder', use: 'Decode your own X/LinkedIn content monthly. See which archetype you are pulling and which product angle will convert them.' },
              { icon: '📣', role: 'Marketer', use: 'Decode your list before writing to it. Build email + content calendars around the dominant archetype instead of guessing.' },
              { icon: '✍️', role: 'Freelancer', use: 'Decode a client\'s audience in 15 seconds. Hand them a calendar. Bill more because you arrived with the strategy, not for it.' },
              { icon: '🏢', role: 'Agency', use: 'Run Compare mode on client vs. top competitor. The shared-segment output is the highest-leverage deliverable in the pitch deck.' },
            ].map(p => (
              <div key={p.role} className="bg-white rounded-2xl border border-warm-200/60 hover:border-fire-300 p-5 transition-all">
                <div className="text-3xl mb-3" aria-hidden="true">{p.icon}</div>
                <h3 className="text-base font-black text-warm-900 mb-2">{p.role}</h3>
                <p className="text-sm text-warm-600 leading-relaxed">{p.use}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="bg-white border-b border-warm-200/40">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Pro tips</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Tips to get better results</h2>
            <p className="mt-3 text-base text-warm-600">Eight practical moves for sharper decodes.</p>
          </div>
          <ol className="space-y-4">
            {AD_TIPS.map((t, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-fire-100 text-fire-700 flex items-center justify-center font-black text-sm">{i + 1}</span>
                <div>
                  <p className="text-sm font-bold text-warm-900">{t.tip}</p>
                  <p className="text-sm text-warm-600 leading-relaxed mt-0.5">{t.why}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Related tools */}
      <section className="bg-warm-100/40 border-b border-warm-200/40">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Related tools</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Pair AudienceDecoder with these</h2>
            <p className="mt-3 text-base text-warm-600">Four sibling bilko.run tools that stack naturally with audience research.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { slug: 'thread-grader', emoji: '🧵', name: 'ThreadGrader', desc: 'Decode your audience, then grade a thread written specifically to the primary archetype.' },
              { slug: 'email-forge', emoji: '📧', name: 'EmailForge', desc: 'Feed archetype insights into your email sequence. Better targeting, higher reply rates.' },
              { slug: 'headline-grader', emoji: '📰', name: 'HeadlineGrader', desc: 'Score headlines against the voice patterns your archetypes respond to.' },
              { slug: 'launch-grader', emoji: '🚀', name: 'LaunchGrader', desc: 'Use your decoded archetypes to audit go-to-market positioning across 5 dimensions.' },
            ].map(t => (
              <Link key={t.slug} to={`/projects/${t.slug}`} className="group bg-white rounded-2xl border border-warm-200/60 hover:border-fire-300 hover:shadow-md p-5 transition-all">
                <div className="text-3xl mb-3" aria-hidden="true">{t.emoji}</div>
                <h3 className="text-base font-black text-warm-900 mb-1 group-hover:text-fire-600 transition-colors">{t.name}</h3>
                <p className="text-sm text-warm-600 leading-relaxed">{t.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

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

  useEffect(() => { track('view_tool', { tool: 'audience-decoder' }); }, []);

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
        toolSlug="audience-decoder"
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
          {tab === 'compare' && (
            <p className="mt-2 text-xs text-warm-500 text-center">
              Pro tip: Paste a competitor's content as Creator B to see how your audiences differ.
            </p>
          )}
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
            <ScoreCard score={r.overall_score} grade={r.grade} verdict={r.headline} toolName="Audience Decoder" toolSlug="audience-decoder" />
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

            <div className="text-center pt-4">
              <button
                onClick={() => { reset(); setContent(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl shadow-md shadow-fire-500/20 transition-all"
              >
                Decode Another Audience
              </button>
            </div>
          </>
        )}
      </div>

      {r && <CrossPromo currentTool="audience-decoder" />}

      {/* ── Long-form below-fold content ──────────────────────────── */}
      {!r && !cr && !loading && (
        <>
          {/* 1. Example result — sample archetype cards */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 text-center mb-2">Here's what you'll get</h2>
              <p className="text-center text-warm-500 mb-8 text-sm">Real output from a real decode. Yours will be different.</p>
              <div className="space-y-3">
                <div className="bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,107,26,0.12),transparent_60%)]" />
                  <div className="relative space-y-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-fire-400 mb-4 text-center">Sample Archetypes</p>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-white">The Builder</span>
                          <span className="text-sm font-semibold text-fire-400">45%</span>
                        </div>
                        <div className="h-2 bg-warm-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-fire-400 to-fire-500 rounded-full" style={{ width: '45%' }} />
                        </div>
                        <p className="text-xs text-warm-500 mt-1">Ships fast, learns in public, follows for tactical advice and build logs.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-white">The Lurker</span>
                          <span className="text-sm font-semibold text-fire-400">30%</span>
                        </div>
                        <div className="h-2 bg-warm-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-fire-400 to-fire-500 rounded-full" style={{ width: '30%' }} />
                        </div>
                        <p className="text-xs text-warm-500 mt-1">Reads everything, shares nothing. Saves posts for later. Converts quietly.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold text-white">The Aspirant</span>
                          <span className="text-sm font-semibold text-fire-400">25%</span>
                        </div>
                        <div className="h-2 bg-warm-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-fire-400 to-fire-500 rounded-full" style={{ width: '25%' }} />
                        </div>
                        <p className="text-xs text-warm-500 mt-1">Wants to be where you are. Engages with transformation stories and roadmaps.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Five insights explained */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 mb-3">Five areas of insight. Zero hand-waving.</h2>
              <p className="text-warm-500 mb-8 text-sm">Each decode gives you a full picture of who follows you and why. Here's what each section reveals.</p>
              <div className="space-y-8">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-fire-100 text-fire-700 flex items-center justify-center font-black text-sm">1</span>
                    <h3 className="font-bold text-warm-900">Audience Archetypes</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed"><strong>What it reveals:</strong> Who actually follows you — not who you think follows you. Named archetypes with percentages, descriptions, and evidence pulled directly from your content patterns. You'll see "The Builder — 45%" not "males 25-34."</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-black text-sm">2</span>
                    <h3 className="font-bold text-warm-900">Content Patterns</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed"><strong>What it reveals:</strong> Which themes are working, which are flopping, and what you should stop posting entirely. Plus your optimal format (threads vs. singles), ideal length, and a voice analysis of your tone and brand words.</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm">3</span>
                    <h3 className="font-bold text-warm-900">Engagement Model</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed"><strong>What it reveals:</strong> Four scores that explain your reach — Hook Effectiveness, CTA Effectiveness, Controversy Index, and Shareability. If your hooks score 80 but CTAs score 30, you're entertaining people who never convert.</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-yellow-100 text-yellow-700 flex items-center justify-center font-black text-sm">4</span>
                    <h3 className="font-bold text-warm-900">Growth Opportunities</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed"><strong>What it reveals:</strong> Specific moves ranked by impact and effort. Not "post more" — actual opportunities like "Your audience responds to contrarian takes but you only post 1/month. Increase to weekly." Each one comes with an explanation.</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">5</span>
                    <h3 className="font-bold text-warm-900">Content Calendar</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed"><strong>What it reveals:</strong> A recommended weekly mix (threads, posts, questions), theme rotation schedule, and content gaps you're not filling. An actual plan you can execute, not vibes about "consistency."</p>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Personality types */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-3">Your creator personality type</h2>
            <p className="text-center text-warm-500 mb-8 text-sm">Based on your engagement scores, we assign one of five personality types. Here's what each means.</p>
            <div className="space-y-4">
              {[
                { type: 'The Provocateur', desc: 'High hook effectiveness + high controversy. You start debates and people can\'t look away. Your content polarizes — that\'s a feature, not a bug. Lean into it but watch the ratio.', color: 'bg-red-50 border-red-200' },
                { type: 'The Amplifier', desc: 'High hooks + high shareability. Your content spreads because people share you to look smart. You\'re the "have you seen this?" account. Double down on original insights.', color: 'bg-blue-50 border-blue-200' },
                { type: 'The Educator', desc: 'High shareability + low controversy. Trusted voice. People save your posts for later and send them to colleagues. You teach. Build courses, guides, and paid communities.', color: 'bg-green-50 border-green-200' },
                { type: 'The Slow Burn', desc: 'Low hook effectiveness but high retention. People who find you stay — but not enough people find you. Fix the top of funnel. Better hooks, punchier openers, more curiosity gaps.', color: 'bg-yellow-50 border-yellow-200' },
                { type: 'The Generalist', desc: 'Solid across the board but nothing stands out. Jack of all trades. Pick one dimension to 10x and the others will follow. Specialization beats consistency.', color: 'bg-purple-50 border-purple-200' },
              ].map(({ type, desc, color }) => (
                <div key={type} className={`rounded-xl border p-4 ${color}`}>
                  <h3 className="font-bold text-warm-900 text-sm">{type}</h3>
                  <p className="text-sm text-warm-600 mt-1 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Compare mode explained */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 mb-3">Compare mode: decode your competition</h2>
              <p className="text-warm-500 mb-6 text-sm">Paste a competitor's public content as Creator B. Here's what you get.</p>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-warm-50 rounded-xl border border-warm-100 p-4">
                    <h4 className="font-bold text-warm-900 text-sm mb-1">Audience overlap</h4>
                    <p className="text-sm text-warm-600">See which archetypes you share and which are unique to each creator. If their Builders are your Lurkers, you're attracting the same people differently.</p>
                  </div>
                  <div className="bg-warm-50 rounded-xl border border-warm-100 p-4">
                    <h4 className="font-bold text-warm-900 text-sm mb-1">Engagement comparison</h4>
                    <p className="text-sm text-warm-600">Side-by-side Hook, CTA, Controversy, and Shareability scores. See exactly where they beat you and where you beat them.</p>
                  </div>
                </div>
                <div className="bg-fire-50 rounded-xl border border-fire-200 p-4">
                  <h4 className="font-bold text-warm-900 text-sm mb-1">Winner + verdict</h4>
                  <p className="text-sm text-warm-600">We pick a winner with a point margin and a written verdict explaining why. No hand-waving — specific framework differences with actionable takeaways.</p>
                </div>
                <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                  <p className="text-sm text-warm-700"><strong>Pro tip:</strong> Decode 3-4 competitors over time. Save snapshots. You'll start to see which audience segments nobody in your niche is serving well.</p>
                </div>
              </div>
            </div>
          </section>

          {/* 5. Who uses this */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 text-center mb-8">Who uses AudienceDecoder</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { role: 'Creators', desc: 'You post consistently but don\'t know who\'s actually reading. AudienceDecoder turns "I think my audience likes X" into "45% of your audience are Builders who engage with tactical content."' },
                  { role: 'Founders building audience', desc: 'You\'re building in public and need to know if you\'re attracting buyers or spectators. The archetype breakdown tells you if your audience will convert or just clap.' },
                  { role: 'Marketing teams', desc: 'Decode your brand\'s social presence and your competitors\'. Compare mode shows audience overlap so you can find underserved segments.' },
                  { role: 'Ghostwriters', desc: 'Decode your client\'s audience before writing a single word. Show them the archetype breakdown in the pitch. Data beats "trust me, I\'m good at Twitter."' },
                ].map(({ role, desc }) => (
                  <div key={role} className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-fire-100 text-fire-700 flex items-center justify-center text-xs font-black flex-shrink-0">&#x2713;</span>
                    <div>
                      <h3 className="font-bold text-warm-900 text-sm">{role}</h3>
                      <p className="text-sm text-warm-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 6. vs Alternatives */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-xl font-black text-warm-900 text-center mb-8">Why not just use SparkToro or Audiense?</h2>
            <div className="space-y-4">
              {[
                { them: 'SparkToro ($38/mo) — shows where your audience hangs out', us: 'We decode who your audience actually is from your content. Psychographics, not demographics. Archetypes with evidence, not pie charts.' },
                { them: 'Audiense ($696/mo) — enterprise audience segmentation', us: '$1 per decode vs $696/month. We give you archetypes, engagement scores, growth opportunities, and a content calendar. No enterprise contract needed.' },
                { them: 'Brand24 ($79/mo) — brand monitoring + sentiment', us: 'We don\'t monitor mentions. We decode your content to tell you who\'s reading it and what they want. Different question, different tool.' },
                { them: 'Twitter Analytics — free demographic data', us: 'Analytics shows you age and location. We show you "The Builder — 45% — ships fast, follows for tactical advice." One is data. The other is insight.' },
              ].map(({ them, us }, i) => (
                <div key={i} className="grid grid-cols-2 gap-3">
                  <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                    <p className="text-[10px] font-bold uppercase text-warm-400 mb-1">Others</p>
                    <p className="text-sm text-warm-600">{them}</p>
                  </div>
                  <div className="bg-fire-50 rounded-xl p-4 border border-fire-200">
                    <p className="text-[10px] font-bold uppercase text-fire-500 mb-1">AudienceDecoder</p>
                    <p className="text-sm text-warm-700">{us}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 7. Stats bar */}
          <section className="bg-warm-900">
            <div className="max-w-3xl mx-auto px-6 py-14 text-center">
              <p className="text-warm-400 text-sm mb-6">Built for people who take their audience seriously</p>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-3xl font-black text-white">5</p>
                  <p className="text-xs text-warm-500 mt-1">Insight areas</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">5</p>
                  <p className="text-xs text-warm-500 mt-1">Personality types</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">$1</p>
                  <p className="text-xs text-warm-500 mt-1">Per decode</p>
                </div>
              </div>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="mt-8 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl transition-colors text-sm">
                Decode your audience
              </button>
            </div>
          </section>

          {/* 8. How it works — 4 steps */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-10">How it works</h2>
            <div className="space-y-8">
              {[
                { step: '1', title: 'Paste your content', desc: 'Grab 10-20 of your recent social posts, threads, or bio content. More data means sharper archetypes. Your last month of content is ideal.' },
                { step: '2', title: 'Get decoded in ~15 seconds', desc: 'AI analyzes your content patterns, voice, engagement signals, and implied audience. You get archetypes, scores, and a full breakdown.' },
                { step: '3', title: 'Review your audience archetypes', desc: 'Named segments with percentages and evidence. "The Builder — 45%" with specific quotes from your content that attract this group. Not vibes — receipts.' },
                { step: '4', title: 'Execute the content calendar', desc: 'Get a weekly posting plan with theme rotation, format mix, and content gaps to fill. Save a snapshot and re-decode monthly to track audience shifts.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-10 h-10 rounded-full bg-fire-100 text-fire-700 flex items-center justify-center font-black">{step}</span>
                  <div>
                    <h3 className="font-bold text-warm-900">{title}</h3>
                    <p className="text-sm text-warm-500 mt-1 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 9. Pricing */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14 text-center">
              <h2 className="text-2xl font-black text-warm-900 mb-2">Simple pricing</h2>
              <p className="text-warm-500 mb-6 text-sm">No subscription. No monthly fee. Pay for what you use.</p>
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                  <p className="text-2xl font-black text-warm-900">Free</p>
                  <p className="text-xs text-warm-500 mt-1">First decode</p>
                </div>
                <div className="bg-fire-50 rounded-xl p-4 border-2 border-fire-300">
                  <p className="text-2xl font-black text-warm-900">$1</p>
                  <p className="text-xs text-warm-500 mt-1">Per credit</p>
                </div>
                <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                  <p className="text-2xl font-black text-warm-900">$5</p>
                  <p className="text-xs text-warm-500 mt-1">7 credits</p>
                </div>
              </div>
              <p className="text-xs text-warm-400 mt-4">1 credit per decode, 2 for Compare mode. Same credits work across all 10 bilko.run tools. Credits never expire.</p>
            </div>
          </section>

          {/* 10. FAQ — 8 questions */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-8">Frequently asked questions</h2>
            <div className="space-y-5">
              {[
                { q: 'How much content should I paste?', a: '10-20 posts minimum. More data = better archetypes. Paste your last month of content — threads, single posts, replies, bio. The more signals, the sharper the decode.' },
                { q: 'Can I decode a competitor?', a: 'Absolutely. Paste their public content instead of yours. Use Compare mode to see how your audiences differ. It\'s the fastest competitive research you\'ll ever do.' },
                { q: 'Is this the same as audience analytics?', a: 'No. Analytics tells you demographics — age, location, gender. AudienceDecoder tells you psychographics — who they are, what they care about, why they follow you, and what content makes them engage.' },
                { q: 'How often should I re-decode?', a: 'Monthly. Save snapshots to track how your audience evolves as your content strategy shifts. If you pivot topics or formats, re-decode immediately to see the audience impact.' },
                { q: 'What\'s the personality type?', a: 'Based on your engagement scores (hooks, controversy, shareability), we assign one of five creator personality types — Provocateur, Amplifier, Educator, Slow Burn, or Generalist. It tells you your natural content superpower.' },
                { q: 'Can I decode a competitor?', a: 'Yes. Paste their public posts as Creator B in Compare mode. You\'ll see audience overlap, engagement differences, and a written verdict on who\'s winning and why.' },
                { q: 'Do credits work across tools?', a: '1 credit = 1 decode. Same credits work on PageRoast, HeadlineGrader, AdScorer, ThreadGrader, EmailForge, LaunchGrader, StackAudit, and Stepproof. LocalScore is free.' },
                { q: 'What if my content is mixed-platform?', a: 'That\'s fine. Paste tweets, LinkedIn posts, newsletter intros — the AI adapts. Mixed-platform content actually produces richer archetypes because it sees your audience from multiple angles.' },
              ].map(({ q, a }) => (
                <div key={q}>
                  <h3 className="font-bold text-warm-900 text-sm">{q}</h3>
                  <p className="text-sm text-warm-600 mt-1 leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </section>

          <AudienceDecoderTutorial />

          {/* 11. Final CTA */}
          <section className="bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900">
            <div className="max-w-2xl mx-auto px-6 py-16 text-center">
              <h2 className="text-2xl font-black text-white mb-3">Your audience is already telling you what they want. Decode it.</h2>
              <p className="text-warm-400 mb-6 text-sm">Five insight areas. Personality typing. Actionable calendar. First one's free.</p>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-8 py-4 bg-fire-500 hover:bg-fire-600 text-white font-black rounded-xl shadow-lg shadow-fire-600/30 transition-all text-base">
                Decode Your Audience
              </button>
              <p className="text-xs text-warm-600 mt-4">No signup required. Results in ~15 seconds.</p>
            </div>
          </section>
        </>
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
