import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser, SignInButton, useAuth, useClerk } from '@clerk/clerk-react';
import { CrossPromo } from '../components/tool-page/index.js';
import { track } from '../hooks/usePageView.js';

const API = import.meta.env.VITE_API_URL || '/api';

// ── Fire Particles ───────────────────────────────────────────────────────────

const ROAST_PHRASES = [
  'Fetching your page...',
  'Reading every word you wrote at 2am...',
  'Counting your exclamation marks...',
  'Looking for social proof... still looking...',
  'Your hero section is... interesting...',
  'Found 3 CTAs that all say different things...',
  'Trying to figure out what you actually sell...',
  'Checking if "synergy" counts as a value prop...',
  'This is going to hurt...',
  'Writing something you\'ll screenshot anyway...',
  'Calibrating the savagery...',
  'Almost done. Deep breaths.',
];

function RoastingOverlay({ onCancel }: { onCancel: () => void }) {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIdx(i => (i + 1) % ROAST_PHRASES.length);
    }, 3000);
    const cancelTimer = setTimeout(() => setShowCancel(true), 10000);
    return () => { clearInterval(interval); clearTimeout(cancelTimer); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-warm-900/90 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Roasting in progress">
      {/* Sparse fire particles — edges only, no overlap with text */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="absolute animate-flame-rise"
            style={{
              left: i < 5 ? `${2 + Math.random() * 15}%` : `${83 + Math.random() * 15}%`,
              bottom: '-20px',
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
              animationIterationCount: 'infinite',
              fontSize: `${18 + Math.random() * 14}px`,
              opacity: 0.4 + Math.random() * 0.3,
            }}
          >
            🔥
          </div>
        ))}
      </div>

      <div className="relative z-10 text-center px-6">
        <div className="text-6xl md:text-7xl mb-8 animate-flame-flicker">🔥</div>
        <p className="text-2xl md:text-3xl font-black text-white mb-4 animate-roast-shake">
          ROASTING...
        </p>
        <p className="text-base text-fire-300/80 animate-fade-in min-h-[28px]" key={phraseIdx}>
          {ROAST_PHRASES[phraseIdx]}
        </p>
        {showCancel && (
          <button
            onClick={onCancel}
            className="mt-8 px-4 py-2 text-sm text-warm-500 hover:text-white border border-warm-700 hover:border-warm-400 rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ── Tutorial sub-components ──────────────────────────────────────────────────

function CopyUrlPrompt({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={onCopy} className="group w-full text-left bg-white hover:bg-fire-50 border border-warm-200/60 hover:border-fire-300 rounded-xl px-4 py-3 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {label && <p className="text-[10px] font-bold uppercase tracking-widest text-fire-500 mb-1">{label}</p>}
          <p className="font-mono text-sm text-warm-800 leading-snug truncate">{text}</p>
        </div>
        <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded ${copied ? 'bg-green-100 text-green-700' : 'bg-warm-100 text-warm-600 group-hover:bg-fire-100 group-hover:text-fire-700'}`}>
          {copied ? 'Copied!' : 'Copy'}
        </span>
      </div>
    </button>
  );
}

function RoastDetails({ q, a }: { q: string; a: string }) {
  return (
    <details className="group bg-white rounded-xl border border-warm-200/60 hover:border-fire-300 transition-colors">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-5 py-4">
        <span className="font-bold text-warm-900 text-sm md:text-base">{q}</span>
        <svg className="w-4 h-4 flex-shrink-0 text-warm-400 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </summary>
      <p className="px-5 pb-4 text-sm text-warm-600 leading-relaxed">{a}</p>
    </details>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

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
  usage?: { remaining: number; limit: number; isPro: boolean; gated: boolean };
}

interface CompareResult {
  score_a: RoastResult;
  score_b: RoastResult;
  comparison: {
    winner: 'A' | 'B' | 'tie';
    margin: number;
    section_winners: Record<string, 'A' | 'B' | 'tie'>;
    analysis: string;
    verdict: string;
  };
}

// ── Constants ────────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: 'hero', label: 'Hero Section', icon: 'H' },
  { key: 'social_proof', label: 'Social Proof', icon: 'S' },
  { key: 'clarity', label: 'Clarity & Persuasion', icon: 'C' },
  { key: 'conversion', label: 'Conversion Architecture', icon: 'X' },
] as const;

function gradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-grade-a';
  if (grade.startsWith('B')) return 'text-grade-b';
  if (grade.startsWith('C')) return 'text-grade-c';
  if (grade === 'D') return 'text-grade-d';
  return 'text-grade-f';
}

function gradeBg(grade: string): string {
  if (grade.startsWith('A')) return 'bg-green-50 border-green-200';
  if (grade.startsWith('B')) return 'bg-blue-50 border-blue-200';
  if (grade.startsWith('C')) return 'bg-yellow-50 border-yellow-200';
  if (grade === 'D') return 'bg-orange-50 border-orange-200';
  return 'bg-red-50 border-red-200';
}

function barColor(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 60) return 'bg-blue-500';
  if (pct >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

// ── Share functionality ──────────────────────────────────────────────────────

function shareToX(text: string) {
  window.open(
    `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`,
    '_blank',
    'width=550,height=420'
  );
}

function shareToFacebook(url: string) {
  window.open(
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent('My landing page just got roasted 🔥')}`,
    '_blank',
    'width=550,height=420'
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ── Components ───────────────────────────────────────────────────────────────

// ── Example roast (baked in, no API call) ────────────────────────────────────

const EXAMPLE_ROAST: RoastResult = {
  total_score: 62,
  grade: 'C+',
  section_scores: {
    hero: { score: 18, max: 25, feedback: 'Headline is clear but the subheadline reads like a legal disclaimer.', fixes: ['Shorten the subheadline to one benefit-driven sentence.'] },
    social_proof: { score: 12, max: 25, feedback: 'Two testimonials from people named "J." is not social proof, it\'s a mystery novel.', fixes: ['Add full names, photos, and company logos.'] },
    clarity: { score: 17, max: 25, feedback: 'Passes the 5-second test but only because there\'s barely anything on the page.', fixes: ['Add a "who this is for" line above the fold.'] },
    conversion: { score: 15, max: 25, feedback: 'One CTA buried below three paragraphs of features nobody asked for.', fixes: ['Move CTA above the fold. Add a second one after social proof.'] },
  },
  roast: "Your landing page has the conversion power of a 'Please take one' sign at a dentist's office.",
  top_fixes: [
    'Move the CTA above the fold — nobody scrolls to pay you.',
    'Replace "J." testimonials with real humans or delete them entirely.',
    'Your hero subheadline is 47 words. Make it 12.',
  ],
  competitor_edge: 'A full rewrite of your hero section alone could lift conversions 20-40%.',
};

// ── Shareable Score Card ─────────────────────────────────────────────────────

function ShareableCard({ result, url }: { result: RoastResult; url: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const shareText = `My landing page scored ${result.total_score}/100 (${result.grade}) on PageRoast 🔥\n\n"${result.roast}"\n\nGet roasted: https://bilko.run/projects/page-roast`;

  return (
    <div className="animate-slide-up" style={{ animationDelay: '50ms' }}>
      {/* The visual card — designed to be screenshotted */}
      <div ref={cardRef} className="bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900 rounded-2xl p-8 text-center relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,107,26,0.15),transparent_60%)]" />

        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-widest text-fire-400 mb-4">PageRoast by bilko.run</p>

          <div className="flex items-center justify-center gap-4 mb-3">
            <span className="text-6xl md:text-7xl font-black text-white">{result.total_score}</span>
            <div className="text-left">
              <div className={`text-4xl md:text-5xl font-black ${
                result.grade.startsWith('A') ? 'text-green-400' :
                result.grade.startsWith('B') ? 'text-blue-400' :
                result.grade.startsWith('C') ? 'text-yellow-400' :
                result.grade === 'D' ? 'text-orange-400' : 'text-red-400'
              }`}>{result.grade}</div>
              <div className="text-xs text-warm-500">/100</div>
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-warm-500 mb-2">{gradeVerdict(result.grade)}</p>

          <p className="text-fire-300 font-bold italic text-lg max-w-md mx-auto leading-relaxed mb-3">
            &ldquo;{result.roast}&rdquo;
          </p>

          <p className="text-xs text-warm-600 truncate max-w-xs mx-auto mb-4">{url}</p>

          <div className="flex justify-center gap-2">
            {Object.entries(result.section_scores).map(([key, s]) => {
              const pct = Math.round((s.score / s.max) * 100);
              return (
                <div key={key} className="text-center">
                  <div className={`text-lg font-black ${
                    pct >= 70 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'
                  }`}>{s.score}</div>
                  <div className="text-[9px] text-warm-500 uppercase">{
                    key === 'hero' ? 'Hero' : key === 'social_proof' ? 'Social' : key === 'clarity' ? 'Clarity' : 'CRO'
                  }</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Share actions below the card */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
        <button
          onClick={() => shareToX(shareText)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-warm-900 hover:bg-warm-800 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          Share on X
        </button>
        <button
          onClick={() => shareToFacebook('https://bilko.run/projects/page-roast')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1877F2] hover:bg-[#166FE5] text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          Facebook
        </button>
        <button
          onClick={async () => { const ok = await copyToClipboard(shareText); if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); } }}
          className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-warm-300 hover:border-warm-400 text-warm-700 text-sm font-semibold rounded-lg transition-colors"
        >
          {copied ? 'Copied!' : 'Copy Result'}
        </button>
        <button
          onClick={() => downloadJson(result, `pageroast-${url.replace(/[^a-z0-9]/gi, '-').slice(0, 30)}.json`)}
          className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-warm-300 hover:border-warm-400 text-warm-700 text-sm font-semibold rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          Download
        </button>
      </div>
    </div>
  );
}

// ── Recent Roasts Feed ───────────────────────────────────────────────────────

function RecentRoasts() {
  const [roasts, setRoasts] = useState<Array<{ url: string; score: number; grade: string; roast: string; created_at: string }>>([]);

  useEffect(() => {
    fetch(`${API}/roasts/recent`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRoasts(d); })
      .catch(() => {});
  }, []);

  if (roasts.length === 0) return null;

  return (
    <section className="max-w-3xl mx-auto px-6 py-16">
      <h2 className="text-2xl font-extrabold text-warm-900 text-center mb-2">Wall of Shame 💀</h2>
      <p className="text-center text-warm-500 mb-8 text-sm">Recent roasts. No names, just pain.</p>
      <div className="space-y-3 stagger-children">
        {roasts.slice(0, 8).map((r, i) => (
          <div key={i} className="flex items-center gap-4 bg-white rounded-xl border border-warm-200/60 p-4 hover:shadow-sm transition-shadow">
            <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
              r.grade.startsWith('A') ? 'bg-green-100 text-green-700' :
              r.grade.startsWith('B') ? 'bg-blue-100 text-blue-700' :
              r.grade.startsWith('C') ? 'bg-yellow-100 text-yellow-700' :
              r.grade === 'D' ? 'bg-orange-100 text-orange-700' :
              'bg-red-100 text-red-700'
            }`}>
              {r.grade}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-fire-700 font-semibold italic truncate">&ldquo;{r.roast}&rdquo;</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-warm-400">{r.url}</span>
                <span className="text-xs text-warm-300">&middot;</span>
                <span className="text-xs font-bold text-warm-600">{r.score}/100</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function downloadJson(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function MyRoasts({ email, onView }: { email: string; onView: (r: RoastResult, url: string) => void }) {
  const [roasts, setRoasts] = useState<Array<{ id: number; url: string; score: number; grade: string; roast: string; created_at: string }>>([]);
  const [expanded, setExpanded] = useState(false);
  const { getToken } = useAuth();

  useEffect(() => {
    if (!email) return;
    (async () => {
      const token = await getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      fetch(`${API}/roasts/mine?email=${encodeURIComponent(email)}`, { headers })
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setRoasts(d); })
        .catch(() => {});
    })();
  }, [email]);

  if (roasts.length === 0) return null;

  const visible = expanded ? roasts : roasts.slice(0, 3);

  return (
    <section className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-warm-900">Your Past Roasts</h3>
        <button
          onClick={async () => {
            const token = await getToken();
            const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
            const all = await Promise.all(roasts.map(r =>
              fetch(`${API}/roasts/mine/${r.id}?email=${encodeURIComponent(email)}`, { headers })
                .then(res => res.json())
                .then(d => ({ url: r.url, score: r.score, grade: r.grade, roast: r.roast, date: r.created_at, result: d.result }))
                .catch(() => null)
            ));
            downloadJson(all.filter(Boolean), `pageroast-export-${new Date().toISOString().slice(0, 10)}.json`);
          }}
          className="text-xs font-semibold text-warm-500 hover:text-fire-600 flex items-center gap-1 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          Download all
        </button>
      </div>
      <p className="text-xs text-warm-400 mb-4 bg-warm-100/50 rounded-lg px-3 py-2">
        Roast data is stored temporarily and may be cleared during maintenance. Download your results to keep them.
      </p>
      <div className="space-y-2">
        {visible.map((r) => (
          <button
            key={r.id}
            onClick={async () => {
              const token = await getToken();
              const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
              const res = await fetch(`${API}/roasts/mine/${r.id}?email=${encodeURIComponent(email)}`, { headers });
              const data = await res.json();
              if (data.result) onView(data.result, r.url);
            }}
            className="w-full flex items-center gap-3 bg-white rounded-xl border border-warm-200/60 p-3 hover:border-fire-300 hover:shadow-sm transition-all text-left"
          >
            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm ${
              r.grade.startsWith('A') ? 'bg-green-100 text-green-700' :
              r.grade.startsWith('B') ? 'bg-blue-100 text-blue-700' :
              r.grade.startsWith('C') ? 'bg-yellow-100 text-yellow-700' :
              r.grade === 'D' ? 'bg-orange-100 text-orange-700' :
              'bg-red-100 text-red-700'
            }`}>
              {r.grade}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-warm-800 truncate">{r.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                <span className="text-xs font-bold text-warm-500">{r.score}/100</span>
              </div>
              <p className="text-xs text-warm-400 truncate italic mt-0.5">{r.roast}</p>
            </div>
            <svg className="w-4 h-4 text-warm-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        ))}
      </div>
      {roasts.length > 3 && !expanded && (
        <button onClick={() => setExpanded(true)} className="mt-3 text-sm font-semibold text-fire-500 hover:text-fire-600">
          Show all {roasts.length} roasts
        </button>
      )}
    </section>
  );
}

function gradeVerdict(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'Ok fine. Your page is actually good.';
  if (grade === 'A-' || grade === 'B+') return 'Solid — but you left money on the table.';
  if (grade === 'B' || grade === 'B-') return 'Your competitors just smiled.';
  if (grade === 'C+' || grade === 'C') return 'Your bounce rate is not surprised.';
  if (grade === 'C-' || grade === 'D') return 'This page needs more than a redesign.';
  return 'This page is on fire. And not in a good way.';
}



function SectionBreakdown({ result }: { result: RoastResult }) {
  return (
    <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
      <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-6">Where it hurts</h3>
      <div className="space-y-6">
        {SECTIONS.map(({ key, label, icon }) => {
          const section = result.section_scores[key as keyof typeof result.section_scores];
          const pct = Math.round((section.score / section.max) * 100);
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-warm-100 text-warm-600 text-xs font-bold flex items-center justify-center">{icon}</span>
                  <span className="text-sm font-semibold text-warm-800">{label}</span>
                </div>
                <span className="text-sm font-bold text-warm-700">{section.score}/{section.max}</span>
              </div>
              <div className="h-2 bg-warm-100 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColor(pct)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-sm text-warm-500 leading-relaxed">{section.feedback}</p>
              {section.fixes.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {section.fixes.map((fix, i) => (
                    <div key={i} className="text-sm text-warm-600 pl-4 border-l-2 border-fire-200 py-0.5">
                      {fix}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopFixes({ fixes }: { fixes: string[] }) {
  if (fixes.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
      <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">Fix these first (or don't, we're not your mom)</h3>
      <div className="space-y-3">
        {fixes.map((fix, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              i === 0 ? 'bg-fire-100 text-fire-700 border-2 border-fire-200' : 'bg-warm-100 text-warm-600'
            }`}>
              {i + 1}
            </span>
            <p className="text-sm text-warm-700 leading-relaxed pt-1.5">{fix}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompetitorEdge({ text }: { text: string }) {
  return (
    <div className="bg-gradient-to-r from-fire-50 to-warm-50 rounded-2xl border border-fire-200 p-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
      <h3 className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Competitor Edge</h3>
      <p className="text-sm text-warm-700 leading-relaxed">{text}</p>
    </div>
  );
}

// ── Compare Score Card ───────────────────────────────────────────────────────

function CompareCard({ label, url, result, isWinner, isDimmed }: {
  label: string; url: string; result: RoastResult; isWinner: boolean; isDimmed: boolean;
}) {
  return (
    <div className={`relative bg-white rounded-2xl border-2 p-5 transition-opacity ${
      isWinner ? 'border-green-300 shadow-lg shadow-green-100/50' : isDimmed ? 'border-warm-200 opacity-60' : 'border-warm-200'
    }`}>
      {isWinner && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-0.5 rounded-full">
          WINNER
        </div>
      )}
      <div className="text-center mb-4">
        <div className="text-xs uppercase tracking-wider text-warm-400 font-bold mb-2">{label}</div>
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl font-black text-warm-900">{result.total_score}</span>
          <span className={`text-2xl font-black ${gradeColor(result.grade)}`}>{result.grade}</span>
        </div>
        <p className="text-sm text-fire-600 italic mt-2 line-clamp-2">&ldquo;{result.roast}&rdquo;</p>
        <p className="text-xs text-warm-400 mt-1 truncate">{url}</p>
      </div>
      <div className="space-y-2 border-t border-warm-100 pt-3">
        {SECTIONS.map(({ key, label: sLabel }) => {
          const s = result.section_scores[key as keyof typeof result.section_scores];
          const pct = Math.round((s.score / s.max) * 100);
          return (
            <div key={key}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-warm-500">{sLabel}</span>
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

// ── Main Page ────────────────────────────────────────────────────────────────

function BuyTokensCard({ email }: { email: string }) {
  const [loading, setLoading] = useState<'single' | 'bundle' | null>(null);

  async function buyTokens(priceType: 'pageroast_token_single' | 'pageroast_tokens') {
    setLoading(priceType === 'pageroast_token_single' ? 'single' : 'bundle');
    track('checkout_start', { tool: 'page-roast', metadata: { priceType } });
    try {
      const res = await fetch(`${API}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, priceType }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Could not start checkout.');
      }
    } catch {
      alert('Checkout unavailable. Try again later.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-6 mb-8">
      <div className="bg-white border border-warm-200/60 rounded-2xl p-8 text-center">
        <p className="text-xl font-bold text-warm-900 mb-1">The roast stops here. (For now.)</p>
        <p className="text-sm text-warm-500 mb-6">
          Feed the fire &middot; 1 credit per roast &middot; 2 for A/B compare
        </p>
        <div className="flex items-stretch justify-center gap-3">
          <button
            onClick={() => buyTokens('pageroast_token_single')}
            disabled={!!loading}
            className="flex-1 max-w-[160px] py-3 border border-warm-200 hover:border-fire-300 disabled:opacity-50 text-warm-700 hover:text-fire-600 font-bold text-sm rounded-xl transition-all"
          >
            {loading === 'single' ? 'Redirecting...' : '1 credit — $1'}
          </button>
          <button
            onClick={() => buyTokens('pageroast_tokens')}
            disabled={!!loading}
            className="flex-1 max-w-[200px] py-3 bg-fire-500 hover:bg-fire-600 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md shadow-fire-500/20 transition-all"
          >
            {loading === 'bundle' ? 'Redirecting...' : '7 credits — $5'}
            <span className="block text-[10px] font-semibold text-fire-200 mt-0.5">save 29%</span>
          </button>
        </div>
        <p className="mt-4 text-xs text-warm-400">One-time purchase &middot; No subscription &middot; Credits never expire</p>
      </div>
    </div>
  );
}

export function PageRoastPage() {
  const { isSignedIn, user, isLoaded: userLoaded } = useUser();
  const { getToken } = useAuth();
  const { loaded: clerkLoaded } = useClerk();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  // Set page title
  useEffect(() => {
    document.title = 'PageRoast — Get Your Landing Page Roasted by AI 🔥';
    track('view_tool', { tool: 'page-roast' });
    // Update OG tags for social sharing
    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
      if (el) el.setAttribute('content', content);
    };
    setMeta('og:title', 'PageRoast — Get Your Landing Page Roasted by AI 🔥');
    setMeta('og:description', 'Paste a URL. AI scores your page across 4 CRO frameworks and delivers a savage one-liner you\'ll want to screenshot.');
    setMeta('og:url', 'https://bilko.run/projects/page-roast');
    setMeta('twitter:title', 'PageRoast — Get Your Landing Page Roasted by AI 🔥');
    setMeta('twitter:description', 'Paste a URL. AI scores your page and delivers a savage one-liner. Free.');
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  const [tab, setTab] = useState<'roast' | 'compare'>('roast');
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [url, setUrl] = useState('');
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RoastResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsTokens, setNeedsTokens] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // Fetch token balance when signed in
  useEffect(() => {
    if (!isSignedIn || !email) return;
    fetch(`${API}/tokens/balance?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => setTokenBalance(d.balance ?? 0))
      .catch(() => {});
  }, [isSignedIn, email]);

  // Check for ?tokens=purchased in URL (returning from Stripe)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tokens') === 'purchased' && email) {
      setTimeout(() => {
        fetch(`${API}/tokens/balance?email=${encodeURIComponent(email)}`)
          .then(r => r.json())
          .then(d => { setTokenBalance(d.balance ?? 0); setNeedsTokens(false); })
          .catch(() => {});
      }, 2000);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [email]);

  // Scroll to results when they arrive
  useEffect(() => {
    if ((result || compareResult) && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [result, compareResult]);

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function roast() {
    if (!url.trim() || !email) return;
    setLoading(true);
    setResult(null);
    setCompareResult(null);
    setError(null);
    setNeedsTokens(false);
    track('submit_start', { tool: 'page-roast', metadata: { mode: 'submit' } });
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/demos/page-roast`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: url.trim(), email }),
      });
      const data = await res.json();
      if (data.requiresTokens) {
        setNeedsTokens(true); setTokenBalance(data.balance ?? 0);
        track('paywall_shown', { tool: 'page-roast' });
        return;
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data as RoastResult);
      if (data.usage?.balance !== undefined) setTokenBalance(data.usage.balance);
      track('submit_success', { tool: 'page-roast', metadata: { mode: 'submit' } });
      track('credit_spent', { tool: 'page-roast' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Roast failed.');
      track('submit_error', { tool: 'page-roast', metadata: { message: e instanceof Error ? e.message : 'error' } });
    } finally {
      setLoading(false);
    }
  }

  async function compare() {
    if (!urlA.trim() || !urlB.trim() || !email) return;
    setLoading(true);
    setResult(null);
    setCompareResult(null);
    setError(null);
    setNeedsTokens(false);
    track('submit_start', { tool: 'page-roast', metadata: { mode: 'compare' } });
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/demos/page-roast/compare`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url_a: urlA.trim(), url_b: urlB.trim(), email }),
      });
      const data = await res.json();
      if (data.requiresTokens) {
        setNeedsTokens(true); setTokenBalance(data.balance ?? 0);
        track('paywall_shown', { tool: 'page-roast' });
        return;
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCompareResult(data as CompareResult);
      if (data.usage?.balance !== undefined) setTokenBalance(data.usage.balance);
      track('submit_success', { tool: 'page-roast', metadata: { mode: 'compare' } });
      track('credit_spent', { tool: 'page-roast' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Comparison failed.');
      track('submit_error', { tool: 'page-roast', metadata: { mode: 'compare', message: e instanceof Error ? e.message : 'error' } });
    } finally {
      setLoading(false);
    }
  }

  // If user isn't signed in, clicking "Roast" opens Clerk modal
  const signInRef = useRef<HTMLButtonElement>(null);

  function handleRoastClick() {
    if (!isSignedIn) {
      // Trigger the hidden SignInButton
      signInRef.current?.click();
      return;
    }
    roast();
  }

  function handleCompareClick() {
    if (!isSignedIn) {
      signInRef.current?.click();
      return;
    }
    compare();
  }

  return (
    <>
      {/* Hidden Clerk sign-in trigger */}
      <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
        <button ref={signInRef} className="hidden" aria-hidden="true" />
      </SignInButton>

      {/* Hero Banner — everything in one dramatic section */}
      <section className="relative overflow-hidden min-h-[70vh] flex items-center justify-center">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,107,26,0.15),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,140,60,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(232,90,10,0.06),transparent_50%)]" />

        {/* Subtle ambient fire — edges only */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-flame-rise"
              style={{
                left: i < 3 ? `${2 + i * 5}%` : `${88 + (i - 3) * 5}%`,
                bottom: '-20px',
                animationDelay: `${i * 1.5}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
                animationIterationCount: 'infinite',
                fontSize: `${16 + Math.random() * 12}px`,
                opacity: 0.12,
              }}
            >
              🔥
            </div>
          ))}
        </div>

        <div className="relative max-w-3xl mx-auto px-6 py-20 md:py-28 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1] animate-slide-up">
            Drop your URL.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fire-400 to-fire-600">
              We'll roast it.
            </span>
          </h1>

          <p className="mt-4 text-base md:text-lg text-warm-400 max-w-lg mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '80ms' }}>
            4 CRO frameworks. 100 points. A one-liner so savage you'll screenshot it before you fix anything.
          </p>

          {/* ── THE URL INPUT — center of the universe ── */}
          <div className="mt-10 animate-slide-up" style={{ animationDelay: '160ms' }}>
            {/* Tab Toggle */}
            <div className="flex gap-1 bg-white/10 backdrop-blur-sm rounded-xl p-1 mb-5 w-fit mx-auto">
              <button
                onClick={() => { setTab('roast'); setCompareResult(null); }}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === 'roast'
                    ? 'bg-white text-warm-900 shadow-sm'
                    : 'text-warm-400 hover:text-white'
                }`}
              >
                🔥 Roast
              </button>
              <button
                onClick={() => { setTab('compare'); setResult(null); }}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === 'compare'
                    ? 'bg-white text-warm-900 shadow-sm'
                    : 'text-warm-400 hover:text-white'
                }`}
              >
                A/B Compare
                <span className="ml-1.5 text-[10px] font-bold text-fire-400">2cr</span>
              </button>
            </div>

            {/* Single Roast Input */}
            {tab === 'roast' && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 md:p-5 shadow-2xl shadow-fire-900/20 animate-pulse-glow">
                <div className="flex gap-3">
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRoastClick(); }}
                    placeholder="https://your-landing-page.com"
                    className="flex-1 px-5 py-4 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 text-base md:text-lg focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner transition-all"
                    autoFocus
                  />
                  <button
                    onClick={handleRoastClick}
                    disabled={loading || !url.trim()}
                    className="px-6 md:px-8 py-4 bg-gradient-to-r from-fire-500 to-fire-600 hover:from-fire-600 hover:to-fire-700 disabled:from-warm-500 disabled:to-warm-600 disabled:cursor-not-allowed text-white font-black text-base md:text-lg rounded-xl shadow-lg shadow-fire-600/30 hover:shadow-fire-500/50 transition-all whitespace-nowrap disabled:shadow-none hover:-translate-y-0.5"
                  >
                    🔥 Roast Me
                  </button>
                </div>
                <p className="mt-3 text-xs text-warm-500">
                  Any public URL &middot; ~30 seconds &middot; emotional damage not covered by insurance
                </p>
              </div>
            )}

            {/* Compare Input */}
            {tab === 'compare' && (
              <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 md:p-5 shadow-2xl shadow-fire-900/20">
                <div className="grid md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1.5 block text-left">Page A</label>
                    <input
                      type="url"
                      value={urlA}
                      onChange={e => setUrlA(e.target.value)}
                      placeholder="https://page-a.com"
                      className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1.5 block text-left">Page B</label>
                    <input
                      type="url"
                      value={urlB}
                      onChange={e => setUrlB(e.target.value)}
                      placeholder="https://page-b.com"
                      className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner transition-all"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCompareClick}
                  disabled={loading || !urlA.trim() || !urlB.trim()}
                  className="w-full py-3.5 bg-gradient-to-r from-fire-500 to-fire-600 hover:from-fire-600 hover:to-fire-700 disabled:from-warm-500 disabled:to-warm-600 disabled:cursor-not-allowed text-white font-black rounded-xl shadow-lg shadow-fire-600/30 transition-all disabled:shadow-none"
                >
                  🔥 Compare Pages
                </button>
                <p className="mt-3 text-xs text-warm-500">
                  Costs 2 credits &middot; scores both pages &middot; picks a winner
                </p>
              </div>
            )}
          </div>

          {/* Token balance pill */}
          {isSignedIn && tokenBalance !== null && (
            <div className="mt-5 animate-fade-in">
              <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-semibold ${
                tokenBalance === 0
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'bg-white/10 text-warm-300 border border-white/20'
              }`}>
                {tokenBalance === 0 ? '0 credits — buy more below' : `${tokenBalance} credit${tokenBalance !== 1 ? 's' : ''} remaining`}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Roasting overlay */}
      {loading && <RoastingOverlay onCancel={() => setLoading(false)} />}

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto px-6 mb-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Buy Tokens Gate */}
      {needsTokens && email && <BuyTokensCard email={email} />}

      {/* My Past Roasts — show between input and results, or on return visits */}
      {isSignedIn && email && !loading && !result && !compareResult && (
        <MyRoasts email={email} onView={(r, u) => { setResult(r); setUrl(u); }} />
      )}

      {/* Single Roast Results */}
      {result && (
        <div ref={resultRef} className="max-w-2xl mx-auto px-6 pt-12 space-y-6 pb-16">
          <ShareableCard result={result} url={url} />

          {/* Industry Benchmark */}
          <div className="bg-warm-50 rounded-xl border border-warm-200/60 p-4 text-center animate-slide-up">
            <p className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-1">Industry Benchmark</p>
            <p className="text-sm font-bold text-warm-800">
              {result.total_score >= 90
                ? 'Better than 95% of pages we\'ve scored'
                : result.total_score >= 75
                  ? 'Better than 70% of pages'
                  : result.total_score >= 60
                    ? 'Better than 40% of pages'
                    : result.total_score >= 40
                      ? 'Better than 15% of pages'
                      : 'In the bottom 10%'}
            </p>
            <p className="text-xs text-warm-500 mt-1">
              {result.total_score >= 75 ? 'Top SaaS pages average 72. You\'re competitive.' :
               result.total_score >= 60 ? 'Average SaaS pages score 55-70. You have room to grow.' :
               result.total_score >= 40 ? 'Most pages we score land here. The fixes above will move the needle.' :
               'Don\'t panic. The specific fixes above are where to start.'}
            </p>
          </div>

          <TopFixes fixes={result.top_fixes} />
          <SectionBreakdown result={result} />

          {/* CRO Checklist */}
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '250ms' }}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">Quick CRO Checklist</h3>
            <div className="space-y-2">
              {[
                { label: 'Clear headline above the fold', pass: result.section_scores.hero.score >= 15 },
                { label: 'Visible CTA without scrolling', pass: result.section_scores.conversion.score >= 15 },
                { label: 'Social proof present', pass: result.section_scores.social_proof.score >= 12 },
                { label: 'Benefit-driven copy (not features)', pass: result.section_scores.clarity.score >= 15 },
                { label: 'Single primary action', pass: result.section_scores.conversion.score >= 18 },
                { label: 'Trust signals (logos, testimonials)', pass: result.section_scores.social_proof.score >= 18 },
              ].map(({ label, pass }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${pass ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                    {pass ? '\u2713' : '\u2717'}
                  </span>
                  <span className={`text-sm ${pass ? 'text-warm-600' : 'text-warm-800 font-medium'}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Conversion propensity */}
          {(() => {
            const hero = result.section_scores.hero.score;
            const cro = result.section_scores.conversion.score;
            const proof = result.section_scores.social_proof.score;
            const propensity = Math.round(((hero / 25) * 0.35 + (cro / 25) * 0.4 + (proof / 25) * 0.25) * 100);
            const level = propensity >= 70 ? { label: 'High', color: 'text-green-700 bg-green-50 border-green-200' } :
              propensity >= 45 ? { label: 'Moderate', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' } :
              { label: 'Low', color: 'text-red-700 bg-red-50 border-red-200' };
            return (
              <div className={`rounded-2xl border-2 p-5 text-center animate-slide-up ${level.color}`} style={{ animationDelay: '275ms' }}>
                <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">Propensity to Convert</p>
                <p className="text-2xl font-black">{propensity}%</p>
                <p className="text-xs mt-1 opacity-80">{level.label} — based on hero clarity, CTA effectiveness, and social proof strength</p>
              </div>
            );
          })()}

          {/* AI Visibility Check */}
          <div className="bg-warm-50 rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-3">AI Visibility</h3>
            <p className="text-xs text-warm-500 mb-3">Would ChatGPT or Perplexity recommend this page? AI agents read differently than humans.</p>
            <div className="space-y-2">
              {[
                { label: 'Clear product description in first paragraph', pass: result.section_scores.clarity.score >= 15 },
                { label: 'Specific claims with numbers (not vague benefits)', pass: result.section_scores.hero.score >= 18 },
                { label: 'Structured headings (H1 → H2 → H3)', pass: result.section_scores.clarity.score >= 12 },
                { label: 'Trust signals AI can parse (logos, testimonials)', pass: result.section_scores.social_proof.score >= 15 },
              ].map(({ label, pass }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${pass ? 'bg-green-100 text-green-600' : 'bg-warm-200 text-warm-500'}`}>
                    {pass ? '✓' : '?'}
                  </span>
                  <span className="text-xs text-warm-600">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-warm-400 mt-3">In 2026, 40%+ of product discovery starts with AI. Your page needs to work for both humans and algorithms.</p>
          </div>

          <CompetitorEdge text={result.competitor_edge} />

          {/* Data-driven CRO insight */}
          <div className="bg-warm-50 rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '350ms' }}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-3">What top-converting pages do differently</h3>
            <div className="space-y-2 text-sm text-warm-600">
              {[
                result.section_scores.hero.score < 18 && 'Their headline communicates value in under 8 words. Yours needs tightening.',
                result.section_scores.social_proof.score < 15 && 'They show 3+ testimonials with full names and photos. Anonymous quotes don\'t convert.',
                result.section_scores.clarity.score < 15 && 'They lead with benefits, not features. "Save 10 hours/week" beats "AI-powered automation."',
                result.section_scores.conversion.score < 18 && 'They have ONE primary CTA above the fold. Multiple CTAs reduce conversions by up to 266%.',
              ].filter(Boolean).map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-fire-500 mt-0.5 flex-shrink-0">&#x2192;</span>
                  <span>{tip}</span>
                </div>
              ))}
              {result.total_score >= 75 && (
                <p className="text-green-600 font-medium">Your page is already in the top tier. The fixes above are fine-tuning, not emergencies.</p>
              )}
            </div>
          </div>

          {/* Post-result CTA */}
          <div className="text-center pt-4">
            {tokenBalance !== null && tokenBalance > 0 ? (
              <button
                onClick={() => { setResult(null); setUrl(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl shadow-md shadow-fire-500/20 transition-all"
              >
                🔥 Roast Another Page
              </button>
            ) : (
              <BuyTokensCard email={email} />
            )}
          </div>

          <CrossPromo currentTool="page-roast" />
        </div>
      )}

      {/* Compare Results */}
      {compareResult && (
        <div ref={resultRef} className="max-w-4xl mx-auto px-6 pt-12 space-y-6 pb-16">
          {/* Winner Banner */}
          {compareResult.comparison.winner !== 'tie' ? (
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center animate-slide-up">
              <p className="text-2xl font-black text-green-700">
                Page {compareResult.comparison.winner} wins
              </p>
              <p className="text-sm text-green-600 mt-1">
                +{compareResult.comparison.margin} points ahead
              </p>
              <button
                onClick={() => shareToX(
                  `Page ${compareResult.comparison.winner} won my A/B landing page test by ${compareResult.comparison.margin} points on PageRoast.\n\nCompare your pages free: https://bilko.run/projects/page-roast`
                )}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-warm-900 hover:bg-warm-800 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Share Result
              </button>
            </div>
          ) : (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 text-center animate-slide-up">
              <p className="text-2xl font-black text-yellow-700">It's a tie!</p>
              <p className="text-sm text-yellow-600 mt-1">Both pages scored equally</p>
            </div>
          )}

          {/* Side-by-side */}
          <div className="grid md:grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <CompareCard label="Page A" url={urlA} result={compareResult.score_a} isWinner={compareResult.comparison.winner === 'A'} isDimmed={compareResult.comparison.winner === 'B'} />
            <CompareCard label="Page B" url={urlB} result={compareResult.score_b} isWinner={compareResult.comparison.winner === 'B'} isDimmed={compareResult.comparison.winner === 'A'} />
          </div>

          {/* Verdict */}
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-3">Verdict</h3>
            <p className="text-sm text-warm-700 leading-relaxed">{compareResult.comparison.verdict}</p>
          </div>

          {/* Analysis */}
          <div className="bg-gradient-to-r from-fire-50 to-warm-50 rounded-2xl border border-fire-200 p-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-3">Strategic Analysis</h3>
            <p className="text-sm text-warm-700 leading-relaxed">{compareResult.comparison.analysis}</p>
          </div>

          {/* Post-compare CTA */}
          <div className="text-center pt-4">
            {tokenBalance !== null && tokenBalance > 0 ? (
              <button
                onClick={() => { setCompareResult(null); setUrlA(''); setUrlB(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl shadow-md shadow-fire-500/20 transition-all"
              >
                🔥 Compare More Pages
              </button>
            ) : (
              <BuyTokensCard email={email} />
            )}
          </div>
        </div>
      )}

      {/* Below-fold content (shown when no results) */}
      {!result && !compareResult && !loading && (
        <>
          {/* Example Roast — show the goods */}
          <section className="max-w-2xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-extrabold text-warm-900 text-center mb-2">Here's what a roast looks like</h2>
            <p className="text-center text-warm-500 mb-8 text-sm">Real output from a real page. Yours will probably score lower.</p>
            <ShareableCard result={EXAMPLE_ROAST} url="example-saas-landing.com" />
          </section>

          {/* How it works — punchy */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-4xl mx-auto px-6 py-16">
              <h2 className="text-2xl font-extrabold text-warm-900 text-center mb-10">Three steps to humiliation</h2>
              <div className="grid md:grid-cols-3 gap-8 stagger-children">
                {[
                  { step: '🔗', title: 'Drop your URL', desc: 'Any public page. We read every word like a copywriter who hasn\'t had coffee.' },
                  { step: '🔥', title: 'Get judged harshly', desc: 'Hero, social proof, clarity, conversion. Four areas. 100 points. Zero sympathy.' },
                  { step: '💀', title: 'Face the roast', desc: 'A score, a grade, and a one-liner so brutal you\'ll screenshot it and tag your co-founder.' },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="text-center">
                    <div className="text-3xl mb-3">{step}</div>
                    <h3 className="font-bold text-warm-900 mb-2">{title}</h3>
                    <p className="text-sm text-warm-500 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* What we actually judge */}
          <section className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-extrabold text-warm-900 text-center mb-3">We judge your page on 4 things. Harshly.</h2>
            <p className="text-center text-warm-500 mb-10">Each scored 0-25. Total out of 100. No participation trophies.</p>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { emoji: '🎯', title: 'Hero Section', desc: 'Can someone understand what you do in 5 seconds? Is your CTA visible? Or did you hide it below 3 paragraphs of fluff?', pts: '25 pts' },
                { emoji: '⭐', title: 'Social Proof', desc: 'Real testimonials with real names? Or "J." from "a company" saying "great product"? We see through it.', pts: '25 pts' },
                { emoji: '💡', title: 'Clarity & Persuasion', desc: 'Benefits or features? Short sentences or wall of text? Are you selling or lecturing?', pts: '25 pts' },
                { emoji: '🔥', title: 'Conversion Architecture', desc: 'How many CTAs? How much friction? Are you begging or commanding? The difference matters.', pts: '25 pts' },
              ].map(({ emoji, title, desc, pts }) => (
                <div key={title} className="bg-warm-50 rounded-xl p-5 border border-warm-200/60">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-warm-900">{emoji} {title}</h3>
                    <span className="text-xs font-semibold text-fire-500 bg-fire-50 px-2.5 py-0.5 rounded-full">{pts}</span>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Grading scale — compact */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-12">
              <h2 className="text-lg font-extrabold text-warm-900 text-center mb-6">The scale of devastation</h2>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  { grade: 'A+', label: 'You can stop reading', color: 'bg-green-100 text-green-700 border-green-200' },
                  { grade: 'A', label: 'Your competitors hate you', color: 'bg-green-50 text-green-600 border-green-200' },
                  { grade: 'B', label: 'Almost respectable', color: 'bg-blue-50 text-blue-600 border-blue-200' },
                  { grade: 'C', label: 'Your visitors are bouncing', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                  { grade: 'D', label: 'Did an intern build this?', color: 'bg-orange-100 text-orange-700 border-orange-200' },
                  { grade: 'F', label: 'Start over', color: 'bg-red-100 text-red-700 border-red-200' },
                ].map(({ grade, label, color }) => (
                  <div key={grade} className={`px-3 py-1.5 rounded-lg border text-sm font-bold ${color}`}>
                    {grade} <span className="font-normal text-xs opacity-70">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Wall of Shame — recent roasts */}
          <RecentRoasts />

          {/* FAQ — casual */}
          <section className="bg-warm-100/50 border-t border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <h2 className="text-2xl font-extrabold text-warm-900 text-center mb-10">You have questions. We have roasts.</h2>
              <div className="space-y-6">
                {[
                  { q: 'Is this free?', a: 'Your first roast is free. After that, credits start at $1 each — or grab 7 for $5. One roast = 1 credit. A/B compare = 2 credits. Cheaper than the therapist you\'ll need after seeing your score.' },
                  { q: 'Is this actually useful or just a joke?', a: 'Both. The roast line is for entertainment. The score, section breakdown, and fixes are real CRO analysis. Founders use it to improve their pages. Then they share the roast for clout.' },
                  { q: 'Will you store my results?', a: 'Your roast results are stored temporarily and may be cleared during server maintenance. Use the Download button to save your results permanently. We don\'t guarantee long-term data persistence — treat the download as your backup.' },
                  { q: 'What\'s A/B Compare?', a: 'Paste your page and a competitor\'s. We score both and pick a winner. It costs 2 credits because we\'re roasting twice as hard.' },
                  { q: 'Who made this?', a: 'Bilko. One person. No funding. Lots of opinions about your landing page. bilko.run' },
                ].map(({ q, a }) => (
                  <div key={q}>
                    <h3 className="font-bold text-warm-900 mb-1">{q}</h3>
                    <p className="text-sm text-warm-600 leading-relaxed">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Tutorial: Step-by-step ─── */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-5xl mx-auto px-6 py-14">
              <h2 className="text-2xl md:text-3xl font-black text-warm-900 text-center leading-tight mb-2">How to use PageRoast — step by step</h2>
              <p className="text-center text-warm-600 mb-8">Five steps. No fluff. Works on any public landing page.</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { n: 1, emoji: '🔗', title: 'Drop your URL', hint: 'Any public page. Homepage, pricing, product.', example: 'https://acme.com/pricing' },
                  { n: 2, emoji: '⏳', title: 'Wait ~30 seconds', hint: 'We fetch, read, roast. Watch the flames.', example: '"Counting your exclamation marks..."' },
                  { n: 3, emoji: '📊', title: 'Read your score', hint: 'Out of 100 across four pillars.', example: 'Score: 54/100 · C-' },
                  { n: 4, emoji: '💀', title: 'Screenshot the roast', hint: 'A one-liner savage enough to tweet.', example: '"Three CTAs, zero clarity."' },
                  { n: 5, emoji: '🛠️', title: 'Work the top fixes', hint: 'Three changes. Ship this week. Rescore Monday.', example: 'Move CTA above the fold' },
                ].map(step => (
                  <div key={step.n} className="bg-warm-50/60 rounded-xl border border-warm-200/60 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-fire-500 text-white flex items-center justify-center text-xs font-black">{step.n}</span>
                      <span className="text-xl" aria-hidden="true">{step.emoji}</span>
                    </div>
                    <h3 className="text-sm font-black text-warm-900 mb-1">{step.title}</h3>
                    <p className="text-xs text-warm-600 leading-relaxed mb-2">{step.hint}</p>
                    <p className="text-[10px] font-mono bg-white border border-warm-200/60 rounded px-2 py-1 text-warm-700 truncate">{step.example}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Worked examples ─── */}
          <section className="bg-warm-100/40 border-b border-warm-200/40">
            <div className="max-w-4xl mx-auto px-6 py-14">
              <h2 className="text-2xl md:text-3xl font-black text-warm-900 text-center leading-tight mb-2">Three pages. Three roasts.</h2>
              <p className="text-center text-warm-600 mb-8">Real-feeling landing pages, real-feeling scores, real takeaways.</p>
              <div className="space-y-6">
                {[
                  { icon: '💻', label: 'SaaS homepage', input: 'Hero: "The All-in-One Platform for Modern Teams." CTA: "Learn More." No testimonials above fold. 6 features listed. Pricing in footer.', output: { score: 41, grade: 'D+', hero: 9, social: 6, clarity: 12, conv: 14, roast: 'Your hero could be describing a Slack competitor, a Notion competitor, or a toaster. Pick a lane.' }, takeaway: '"All-in-one" means "for nobody." Name the person, name the pain, name the win.' },
                  { icon: '🛍️', label: 'E-com product page', input: 'Hero: "Merino Wool Crew — $89." 8 photos. Reviews (4.8, 1,247). Size guide inline. CTA: "Add to Cart" sticky.', output: { score: 83, grade: 'A-', hero: 21, social: 22, clarity: 20, conv: 20, roast: 'Respectable. You\'re selling a t-shirt like a serious person. Also: nice sticky CTA.' }, takeaway: 'Sticky CTA + inline proof + concrete price = top-quartile e-com page.' },
                  { icon: '🧑‍🎨', label: 'Coach landing page', input: 'Hero: "Unlock Your Inner Potential!" 3 paragraphs of backstory. CTA below the fold. No pricing.', output: { score: 28, grade: 'F', hero: 4, social: 8, clarity: 7, conv: 9, roast: 'Three paragraphs about you before one word about me. I came to buy, not to read your memoir.' }, takeaway: 'Lead with the reader\'s outcome, not your story. Move CTA above the fold.' },
                ].map(ex => (
                  <div key={ex.label} className="bg-white rounded-2xl border border-warm-200/60 p-6">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-3"><span className="text-2xl">{ex.icon}</span><span className="text-xs font-bold uppercase tracking-wider text-warm-500">{ex.label}</span></div>
                      <span className="font-mono text-xs bg-warm-900 text-white px-3 py-1 rounded-full font-bold">{ex.output.score}/100 · {ex.output.grade}</span>
                    </div>
                    <p className="text-xs bg-warm-50 border border-warm-200/60 rounded-lg px-3 py-2.5 text-warm-800 leading-relaxed mb-3"><span className="font-bold">Page: </span>{ex.input}</p>
                    <p className="font-mono text-[11px] text-warm-600 mb-3">Hero {ex.output.hero}/25 · Social {ex.output.social}/25 · Clarity {ex.output.clarity}/25 · Conv {ex.output.conv}/25</p>
                    <p className="text-sm text-fire-600 italic leading-relaxed mb-3">"{ex.output.roast}"</p>
                    <p className="text-sm text-warm-700 leading-relaxed pt-3 border-t border-warm-100"><span className="font-bold text-warm-900">Takeaway: </span>{ex.takeaway}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Try these URLs ─── */}
          <section className="bg-white border-b border-warm-200/40">
            <div className="max-w-4xl mx-auto px-6 py-14">
              <h2 className="text-2xl md:text-3xl font-black text-warm-900 text-center leading-tight mb-2">Try roasting these</h2>
              <p className="text-center text-warm-600 mb-8">Click to copy, paste at the top. No wrong answers.</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { group: 'SaaS', url: 'https://stripe.com' },
                  { group: 'SaaS', url: 'https://linear.app' },
                  { group: 'E-commerce', url: 'https://allbirds.com' },
                  { group: 'E-commerce', url: 'https://away.com' },
                  { group: 'Local', url: 'https://tartine.com' },
                  { group: 'Local', url: 'https://www.joespizzanyc.com' },
                  { group: 'Agency', url: 'https://basecamp.com' },
                  { group: 'Agency', url: 'https://bilko.run' },
                ].map(item => <CopyUrlPrompt key={item.url} text={item.url} label={item.group} />)}
              </div>
            </div>
          </section>

          {/* ─── Anatomy of a roast ─── */}
          <section className="bg-warm-100/40 border-b border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-14">
              <h2 className="text-2xl md:text-3xl font-black text-warm-900 text-center leading-tight mb-2">Every piece has a job</h2>
              <p className="text-center text-warm-600 mb-8">The roast card up top shows a full result. Here's how to read each part.</p>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Total score', note: 'Out of 100. Under 65 = don\'t buy ads yet.' },
                  { label: 'Letter grade', note: 'A-F with personality. A+ = ship. F = start over.' },
                  { label: 'Four pillar scores', note: 'Hero, social proof, clarity, conversion. 25 each. Weakest = this week\'s target.' },
                  { label: 'Roast one-liner', note: 'The savage line built for screenshots. Share for accountability.' },
                  { label: 'Top 3 fixes', note: 'Concrete, shippable this week. Actual words to change.' },
                  { label: 'Per-section feedback', note: 'Expand each pillar for the exact reason it dragged down the score.' },
                ].map(item => (
                  <div key={item.label} className="bg-white rounded-xl border border-warm-200/60 p-3">
                    <p className="font-bold text-warm-900 text-sm mb-0.5">{item.label}</p>
                    <p className="text-xs text-warm-600 leading-relaxed">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Common mistakes ─── */}
          <section className="bg-white border-b border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-14">
              <h2 className="text-2xl md:text-3xl font-black text-warm-900 text-center leading-tight mb-8">Common landing-page mistakes (and the fix)</h2>
              <div className="space-y-3">
                {[
                  { q: 'Your hero could describe 40 other companies', a: 'If "all-in-one platform for modern teams" could mean Notion, Monday, Asana, or ClickUp, it\'s meaningless. Name the person, name the pain, name the outcome. Specificity wins.' },
                  { q: 'Three competing CTAs in the hero', a: '"Book a demo / Start free trial / Watch video" = reader does nothing. Pick the easiest first step. Make it 2x bigger than anything else. Delete the rest.' },
                  { q: 'Testimonials with initials and no photos', a: '"J. from Company A" reads fake even when it isn\'t. Real names + real photos + a specific number = trustable quote.' },
                  { q: 'Pricing hidden in the footer', a: 'If you\'re afraid to show price, the page can\'t do its job. Put it on the page, let readers self-qualify.' },
                  { q: 'Features listed as features, not benefits', a: '"Real-time collaboration" = feature. "See edits as your team types them" = benefit. Lead with the outcome, then the mechanism. If your page were a billboard, could a driver still get the point?' },
                  { q: 'Social proof with zero numbers', a: '"Trusted by teams everywhere" = nothing. "Used by 4,800+ engineering teams across 47 countries" = credible. Count things.' },
                ].map(m => <RoastDetails key={m.q} q={m.q} a={m.a} />)}
              </div>
            </div>
          </section>

          {/* ─── FAQ ─── */}
          <section className="bg-warm-100/40 border-b border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-14">
              <h2 className="text-2xl md:text-3xl font-black text-warm-900 text-center leading-tight mb-8">FAQ — PageRoast</h2>
              <div className="space-y-3">
                {[
                  { q: 'How is this different from ChatGPT?', a: 'ChatGPT gives a different answer every time. PageRoast fetches real HTML, scores four named pillars against calibrated references, returns a consistent 100-point score you can track over time.' },
                  { q: 'What does one credit get me?', a: 'One full roast — score, grade, four breakdowns, roast line, top 3 fixes. A/B compare = 2 credits. First roast free. Credits never expire and work across all bilko.run tools.' },
                  { q: 'How accurate is the score, and is my data stored?', a: 'Calibrated against 200+ real landing pages — within ±6 points of expert CRO judgment 90% of the time. Results stored temporarily (download to save). Page content isn\'t persisted.' },
                  { q: 'Does it work for my industry?', a: 'Yes — SaaS, e-commerce, local services, agencies, coaches, DTC, info products. The four pillars are universal CRO principles.' },
                  { q: 'What\'s A/B Compare?', a: 'Paste your page and a competitor\'s. We score both, pick a winner, explain the margin. 2 credits. Faster than a CRO consultant.' },
                  { q: 'The roast was mean. Can you tone it down?', a: 'No. The roast line is built for screenshots — the score and fixes are the useful part. Share, fix, rescore. Most users rescore 2-3 times as they iterate (1 credit each).' },
                ].map(m => <RoastDetails key={m.q} q={m.q} a={m.a} />)}
              </div>
            </div>
          </section>

          {/* ─── Use cases by role ─── */}
          <section className="bg-white border-b border-warm-200/40">
            <div className="max-w-5xl mx-auto px-6 py-14">
              <h2 className="text-2xl md:text-3xl font-black text-warm-900 text-center leading-tight mb-8">Who roasts pages, and why</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { icon: '🚀', role: 'Founders', use: 'Roast before launch. Score under 65? Don\'t buy ads yet — fix the page first.' },
                  { icon: '📣', role: 'Marketers', use: 'Roast the competitor scoring 85+. Steal the structural patterns, not the words.' },
                  { icon: '✍️', role: 'Freelancers', use: 'Send prospects a before-score of their current page. Score + 3 fixes = sales pitch.' },
                  { icon: '🏢', role: 'Agencies', use: 'Roast every client page before kickoff. Walk in with a CRO baseline, not vibes.' },
                ].map(p => (
                  <div key={p.role} className="bg-warm-50/60 rounded-2xl border border-warm-200/60 p-4">
                    <div className="text-2xl mb-2">{p.icon}</div>
                    <h3 className="text-sm font-black text-warm-900 mb-1">{p.role}</h3>
                    <p className="text-xs text-warm-600 leading-relaxed">{p.use}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Tips ─── */}
          <section className="bg-warm-100/40 border-b border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-14">
              <h2 className="text-2xl md:text-3xl font-black text-warm-900 text-center leading-tight mb-8">Seven tips to score higher</h2>
              <ol className="space-y-3">
                {[
                  { tip: 'Roast before you spend ad budget', why: 'Every ad dollar lands on a better page. ROI compounds.' },
                  { tip: 'Fix one pillar per week', why: 'Hero → social → clarity → conversion. Sustainable beats frantic.' },
                  { tip: 'Rescore after every change', why: 'Watching the number move is the dopamine. Small wins build momentum.' },
                  { tip: 'Roast your competitors', why: 'Find what scores 85+. Steal the structure, not the words.' },
                  { tip: 'Use A/B Compare for real decisions', why: '2 credits ends a week of debate.' },
                  { tip: 'Share the roast before you fix', why: 'Screenshots create accountability. Accountability ships changes. (Download to save — server storage is temporary.)' },
                ].map((t, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-fire-100 text-fire-700 flex items-center justify-center font-black text-xs mt-0.5">{i + 1}</span>
                    <p className="text-sm text-warm-700 leading-relaxed"><span className="font-bold text-warm-900">{t.tip}.</span> {t.why}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* ─── Related tools ─── */}
          <section className="bg-white border-b border-warm-200/40">
            <div className="max-w-5xl mx-auto px-6 py-14">
              <h2 className="text-2xl md:text-3xl font-black text-warm-900 text-center leading-tight mb-8">Tools that pair with PageRoast</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { slug: 'headline-grader', icon: '✏️', title: 'HeadlineGrader', desc: 'Grade your hero headline — the biggest single lever on the page.' },
                  { slug: 'ad-scorer', icon: '🎯', title: 'AdScorer', desc: 'Score the ads driving traffic to the page you just roasted.' },
                  { slug: 'audience-decoder', icon: '🧩', title: 'AudienceDecoder', desc: 'Know who you\'re writing to before rewriting the page.' },
                  { slug: 'launch-grader', icon: '🚀', title: 'LaunchGrader', desc: 'Roast covers the page. LaunchGrader covers the GTM around it.' },
                ].map(t => (
                  <Link key={t.slug} to={`/projects/${t.slug}`} className="group bg-warm-50/60 hover:bg-white rounded-xl border border-warm-200/60 hover:border-fire-300 p-4 transition-all">
                    <div className="text-2xl mb-2">{t.icon}</div>
                    <h3 className="text-sm font-black text-warm-900 mb-1">{t.title}</h3>
                    <p className="text-xs text-warm-600 leading-relaxed">{t.desc}</p>
                    <p className="text-xs font-bold text-fire-500 mt-2">Open →</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* Bottom CTA */}
          <section className="max-w-4xl mx-auto px-6 py-16 text-center">
            <h2 className="text-3xl font-extrabold text-warm-900 mb-4">You've read this far instead of fixing your landing page. 🔥</h2>
            <p className="text-warm-500 mb-6">One URL. 30 seconds. The feedback your co-founder won't give you.</p>
            <button
              onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-fire-500 hover:bg-fire-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-fire-500/20 transition-all hover:-translate-y-0.5"
            >
              🔥 Roast My Page
            </button>
          </section>
        </>
      )}
    </>
  );
}
