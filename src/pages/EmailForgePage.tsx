import { useState, useEffect, useRef } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from '../hooks/useToolApi.js';
import { ToolHero } from '../components/tool-page/index.js';

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

const GOALS = ['cold_outreach', 'nurture', 'launch', 're-engagement'] as const;
const GOAL_LABELS: Record<string, string> = { cold_outreach: 'Cold Outreach', nurture: 'Nurture', launch: 'Launch', 're-engagement': 'Re-engagement' };
const TONES = ['professional', 'casual', 'urgent', 'storytelling'] as const;
const TONE_LABELS: Record<string, string> = { professional: 'Professional', casual: 'Casual', urgent: 'Urgent', storytelling: 'Storytelling' };

const FRAMEWORK_COLORS: Record<string, string> = {
  AIDA: 'bg-blue-100 text-blue-700',
  PAS: 'bg-orange-100 text-orange-700',
  Hormozi: 'bg-fire-100 text-fire-700',
  'Hormozi Value': 'bg-fire-100 text-fire-700',
  Cialdini: 'bg-green-100 text-green-700',
  'Cialdini Reciprocity': 'bg-green-100 text-green-700',
  'Storytelling Arc': 'bg-purple-100 text-purple-700',
  Storytelling: 'bg-purple-100 text-purple-700',
};

function frameworkBadge(fw: string) {
  const key = Object.keys(FRAMEWORK_COLORS).find(k => fw.toLowerCase().includes(k.toLowerCase()));
  const color = key ? FRAMEWORK_COLORS[key] : 'bg-warm-100 text-warm-600';
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>{fw}</span>;
}

function gradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-green-600';
  if (grade.startsWith('B')) return 'text-blue-600';
  if (grade.startsWith('C')) return 'text-yellow-600';
  if (grade === 'D') return 'text-orange-600';
  return 'text-red-600';
}

function OptionPills<T extends string>({ options, labels, value, onChange }: {
  options: readonly T[]; labels: Record<string, string>; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            value === o ? 'bg-white text-warm-900 shadow-sm' : 'bg-white/10 text-warm-400 hover:text-white'
          }`}>{labels[o]}</button>
      ))}
    </div>
  );
}

function EmailCard({ email, defaultOpen }: { email: EmailItem; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const fullText = `Subject: ${email.subject_line}\n\n${email.body}\n\n${email.cta}`;

  return (
    <div className="bg-white rounded-2xl border border-warm-200/60 overflow-hidden animate-slide-up">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-5 text-left hover:bg-warm-50 transition-colors">
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-fire-100 text-fire-700 flex items-center justify-center text-sm font-black">{email.position}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-warm-900 truncate">{email.subject_line}</span>
            {frameworkBadge(email.framework_used)}
          </div>
          <p className="text-xs text-warm-500 italic truncate mt-0.5">{email.preview_text}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{email.estimated_open_rate} open</span>
          <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{email.estimated_click_rate} click</span>
          <svg className={`w-4 h-4 text-warm-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-warm-100">
          <div className="bg-warm-50 rounded-xl p-4 mt-4 mb-3">
            <p className="text-xs font-bold text-warm-400 uppercase tracking-wider mb-1">Framework</p>
            <p className="text-sm text-warm-600">{email.framework_explanation}</p>
          </div>
          <div className="bg-white border border-warm-100 rounded-xl p-4 mb-3">
            <p className="text-sm text-warm-800 leading-relaxed whitespace-pre-line">{email.body}</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="bg-fire-500 text-white text-sm font-bold px-4 py-2 rounded-lg inline-block">{email.cta}</div>
            <button onClick={() => { navigator.clipboard.writeText(fullText); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="text-xs text-warm-400 hover:text-fire-500 font-semibold transition-colors">
              {copied ? 'Copied!' : 'Copy email'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function EmailForgePage() {
  const { result, compareResult, loading, error, submit, submitCompare, reset, signInRef } = useToolApi<SequenceResult>('email-forge');

  const [tab, setTab] = useState<'score' | 'compare'>('score');
  const [product, setProduct] = useState('');
  const [audience, setAudience] = useState('');
  const [goal, setGoal] = useState<typeof GOALS[number]>('cold_outreach');
  const [tone, setTone] = useState<typeof TONES[number]>('professional');
  // Compare fields
  const [productB, setProductB] = useState('');
  const [audienceB, setAudienceB] = useState('');
  const [goalB, setGoalB] = useState<typeof GOALS[number]>('cold_outreach');
  const [toneB, setToneB] = useState<typeof TONES[number]>('professional');
  const [allCopied, setAllCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'EmailForge — AI Email Sequence Generator';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  useEffect(() => {
    if ((result || compareResult) && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [result, compareResult]);

  function copyAll() {
    if (!result?.emails) return;
    const text = result.emails.map(e => `Email ${e.position} — ${e.framework_used}\nSubject: ${e.subject_line}\n\n${e.body}\n\nCTA: ${e.cta}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(text);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  }

  return (
    <>
      <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
        <button ref={signInRef} className="hidden" aria-hidden="true" />
      </SignInButton>

      <ToolHero
        title="Forge your email sequence"
        tagline="AI generates a 5-email sequence using proven persuasion frameworks"
        tab={tab}
        onTabChange={t => { setTab(t); reset(); }}
        hasCompare
      >
        {tab === 'score' ? (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 md:p-5 shadow-2xl max-w-2xl mx-auto">
            <textarea value={product} onChange={e => setProduct(e.target.value)} placeholder="Describe your product or service..."
              rows={3} className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner resize-none mb-3" />
            <input value={audience} onChange={e => setAudience(e.target.value)} placeholder="Who are you targeting?"
              className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner mb-3" />
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <div className="flex-1">
                <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1.5 block text-left">Goal</label>
                <OptionPills options={GOALS} labels={GOAL_LABELS} value={goal} onChange={setGoal} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1.5 block text-left">Tone</label>
                <OptionPills options={TONES} labels={TONE_LABELS} value={tone} onChange={setTone} />
              </div>
            </div>
            <button onClick={() => submit({ product, audience, goal, tone })}
              disabled={loading || product.trim().length < 10 || audience.trim().length < 5}
              className="w-full py-3.5 bg-gradient-to-r from-fire-500 to-fire-600 hover:from-fire-600 hover:to-fire-700 disabled:from-warm-500 disabled:to-warm-600 text-white font-black rounded-xl shadow-lg transition-all disabled:shadow-none">
              {loading ? 'Forging...' : 'Generate Sequence'}
            </button>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 md:p-5 shadow-2xl max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-4 mb-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1.5 block text-left">Sequence A</label>
                <textarea value={product} onChange={e => setProduct(e.target.value)} placeholder="Product A..." rows={2} className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner resize-none mb-2" />
                <input value={audience} onChange={e => setAudience(e.target.value)} placeholder="Audience A..." className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner mb-2" />
                <OptionPills options={GOALS} labels={GOAL_LABELS} value={goal} onChange={setGoal} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1.5 block text-left">Sequence B</label>
                <textarea value={productB} onChange={e => setProductB(e.target.value)} placeholder="Product B..." rows={2} className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner resize-none mb-2" />
                <input value={audienceB} onChange={e => setAudienceB(e.target.value)} placeholder="Audience B..." className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner mb-2" />
                <OptionPills options={GOALS} labels={GOAL_LABELS} value={goalB} onChange={setGoalB} />
              </div>
            </div>
            <button onClick={() => submitCompare({ product_a: product, audience_a: audience, goal_a: goal, tone_a: tone, product_b: productB, audience_b: audienceB, goal_b: goalB, tone_b: toneB })}
              disabled={loading || product.trim().length < 10 || productB.trim().length < 10}
              className="w-full py-3.5 bg-gradient-to-r from-fire-500 to-fire-600 hover:from-fire-600 hover:to-fire-700 disabled:from-warm-500 disabled:to-warm-600 text-white font-black rounded-xl shadow-lg transition-all disabled:shadow-none">
              {loading ? 'Comparing...' : 'Compare Sequences'}
            </button>
          </div>
        )}
      </ToolHero>

      {error && (
        <div className="max-w-2xl mx-auto px-6 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
        </div>
      )}

      {result && (
        <div ref={resultRef} className="max-w-2xl mx-auto px-6 pt-10 space-y-4 pb-16">
          {/* Strategy banner */}
          <div className="bg-gradient-to-r from-fire-50 to-warm-50 rounded-2xl border border-fire-200 p-6 text-center animate-slide-up">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-3xl font-black text-warm-900">{result.overall_score}</span>
              <span className={`text-2xl font-black ${gradeColor(result.grade)}`}>{result.grade}</span>
            </div>
            <p className="text-sm text-warm-600">{result.sequence_strategy}</p>
          </div>

          {/* Email cards */}
          {result.emails.map((email, i) => (
            <EmailCard key={email.position} email={email} defaultOpen={i === 0} />
          ))}

          {/* Copy all */}
          <div className="text-center pt-2">
            <button onClick={copyAll}
              className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-warm-300 hover:border-fire-300 text-warm-700 text-sm font-semibold rounded-lg transition-colors">
              {allCopied ? 'All emails copied!' : 'Copy full sequence'}
            </button>
          </div>
        </div>
      )}

      {compareResult && (
        <div ref={resultRef} className="max-w-4xl mx-auto px-6 pt-10 space-y-6 pb-16">
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center animate-slide-up">
            <p className="text-2xl font-black text-green-700">Sequence {compareResult.comparison.winner} wins</p>
            <p className="text-sm text-green-600 mt-1">+{compareResult.comparison.margin} points ahead</p>
            <p className="text-sm text-warm-600 mt-3">{compareResult.comparison.reasoning}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {['sequence_a', 'sequence_b'].map((key, idx) => {
              const seq = compareResult[key] as SequenceResult;
              if (!seq) return null;
              const label = idx === 0 ? 'A' : 'B';
              const isWinner = compareResult.comparison.winner === label;
              return (
                <div key={key} className={`rounded-2xl border-2 p-5 ${isWinner ? 'border-green-300 shadow-lg' : 'border-warm-200 opacity-70'}`}>
                  <div className="text-center mb-3">
                    <span className="text-xs uppercase tracking-wider font-bold text-warm-400">Sequence {label}</span>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="text-2xl font-black text-warm-900">{seq.overall_score}</span>
                      <span className={`text-lg font-black ${gradeColor(seq.grade)}`}>{seq.grade}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {seq.emails.map(e => (
                      <div key={e.position} className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-warm-500">#{e.position}</span>
                        {frameworkBadge(e.framework_used)}
                        <span className="text-warm-600 truncate">{e.subject_line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
