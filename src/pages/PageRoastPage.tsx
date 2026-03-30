import { useState, useRef, useEffect } from 'react';
import { useUser, SignInButton, useAuth, useClerk } from '@clerk/clerk-react';

const API = import.meta.env.VITE_API_URL || '/api';

// ── Fire Particles ───────────────────────────────────────────────────────────

const ROAST_PHRASES = [
  'Fetching your page...',
  'Reading every pixel...',
  'Judging your hero section...',
  'Looking for social proof...',
  'Checking your CTAs...',
  'Finding the weakest spots...',
  'Writing the roast...',
  'This is going to hurt...',
  'Almost done burning...',
  'Preparing the verdict...',
];

function FireParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-flame-rise"
          style={{
            left: `${10 + Math.random() * 80}%`,
            bottom: '-10px',
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${1 + Math.random() * 1.5}s`,
            animationIterationCount: 'infinite',
            fontSize: `${14 + Math.random() * 20}px`,
            opacity: 0.7 + Math.random() * 0.3,
          }}
        >
          {['🔥', '🔥', '🔥', '💀', '🔥', '😤', '🔥', '🔥'][i % 8]}
        </div>
      ))}
    </div>
  );
}

function RoastingOverlay({ onCancel }: { onCancel: () => void }) {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIdx(i => (i + 1) % ROAST_PHRASES.length);
    }, 3000);
    // Show cancel after 10s in case it's hanging
    const cancelTimer = setTimeout(() => setShowCancel(true), 10000);
    return () => { clearInterval(interval); clearTimeout(cancelTimer); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-warm-900/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Roasting in progress">
      <div className="relative text-center max-w-sm mx-4">
        <FireParticles />
        <div className="relative z-10">
          <div className="text-6xl md:text-8xl mb-6 animate-flame-flicker">🔥</div>
          <p className="text-2xl md:text-3xl font-black text-white mb-3 animate-roast-shake">
            ROASTING...
          </p>
          <p className="text-base md:text-lg text-fire-300 animate-fade-in" key={phraseIdx}>
            {ROAST_PHRASES[phraseIdx]}
          </p>
          {showCancel && (
            <button
              onClick={onCancel}
              className="mt-6 px-4 py-2 text-sm text-warm-400 hover:text-white border border-warm-600 hover:border-warm-400 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
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

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ── Components ───────────────────────────────────────────────────────────────

function gradeVerdict(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'Your page is fire. Respect.';
  if (grade === 'A-' || grade === 'B+') return 'Solid. But there\'s still meat on the bone.';
  if (grade === 'B' || grade === 'B-') return 'Decent, but your competitors are eating your lunch.';
  if (grade === 'C+' || grade === 'C') return 'Mediocre. Your visitors are bouncing and you know it.';
  if (grade === 'C-' || grade === 'D') return 'Rough. This page needs CPR.';
  return 'This page is on fire. And not in a good way.';
}

function ScoreHero({ result, url }: { result: RoastResult; url: string }) {
  const shareText = `My landing page scored ${result.total_score}/100 (${result.grade}) on PageRoast 🔥\n\n"${result.roast}"\n\nGet roasted free: bilko.run/projects/page-roast`;
  const [copied, setCopied] = useState(false);

  return (
    <div className={`relative rounded-2xl border-2 p-8 text-center animate-result-slam overflow-hidden ${gradeBg(result.grade)}`}>
      {/* Mini fire at top for low scores */}
      {result.total_score < 50 && (
        <div className="absolute top-0 left-0 right-0 flex justify-center gap-1 -mt-1">
          {['🔥','🔥','🔥'].map((f, i) => (
            <span key={i} className="text-2xl animate-flame-flicker" style={{ animationDelay: `${i * 0.1}s` }}>{f}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-6 mb-2">
        <div className="animate-score">
          <span className="text-7xl md:text-8xl font-black text-warm-900">{result.total_score}</span>
          <span className="text-lg text-warm-500 font-medium">/100</span>
        </div>
        <div className={`text-5xl md:text-6xl font-black ${gradeColor(result.grade)} animate-score`} style={{ animationDelay: '200ms' }}>
          {result.grade}
        </div>
      </div>

      <p className="text-sm font-semibold text-warm-500 mb-4">{gradeVerdict(result.grade)}</p>

      <div className="bg-white/60 rounded-xl p-4 mb-4 border border-fire-200/50">
        <p className="text-lg md:text-xl font-bold text-fire-700 italic max-w-lg mx-auto leading-relaxed">
          &ldquo;{result.roast}&rdquo;
        </p>
      </div>
      <p className="text-xs text-warm-400 mb-6 truncate max-w-md mx-auto">{url}</p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => shareToX(shareText)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-warm-900 hover:bg-warm-800 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          Share on X
        </button>
        <button
          onClick={async () => { const ok = await copyToClipboard(shareText); setCopied(ok); if (ok) setTimeout(() => setCopied(false), 2000); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-warm-300 hover:border-warm-400 text-warm-700 text-sm font-semibold rounded-lg transition-colors"
        >
          {copied ? 'Copied!' : 'Copy Result'}
        </button>
      </div>
    </div>
  );
}

function SectionBreakdown({ result }: { result: RoastResult }) {
  return (
    <div className="bg-white rounded-2xl border border-warm-200/60 p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
      <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-6">Section Breakdown</h3>
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
      <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">Top Fixes (Highest Impact First)</h3>
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
  const [loading, setLoading] = useState(false);

  async function buyTokens() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, priceType: 'pageroast_tokens' }),
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
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 mb-8">
      <div className="bg-gradient-to-r from-fire-50 to-warm-50 border-2 border-fire-200 rounded-2xl p-8 text-center">
        <p className="text-2xl font-bold text-warm-900 mb-2">You're out of tokens</p>
        <p className="text-sm text-warm-600 mb-6">
          Get 5 credits for $5 — each roast costs 1, A/B compare costs 2.
        </p>
        <button
          onClick={buyTokens}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-fire-500 hover:bg-fire-600 disabled:bg-warm-300 text-white font-bold text-lg rounded-xl shadow-lg shadow-fire-500/20 transition-all"
        >
          {loading ? 'Redirecting to checkout...' : 'Buy 5 Credits — $5'}
        </button>
        <p className="mt-3 text-xs text-warm-400">One-time purchase. No subscription.</p>
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
    document.title = 'PageRoast — Free Landing Page Audit | bilko.run';
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
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/demos/page-roast`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: url.trim(), email }),
      });
      const data = await res.json();
      if (data.requiresTokens) { setNeedsTokens(true); setTokenBalance(data.balance ?? 0); return; }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data as RoastResult);
      if (data.usage?.balance !== undefined) setTokenBalance(data.usage.balance);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Roast failed.');
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
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/demos/page-roast/compare`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url_a: urlA.trim(), url_b: urlB.trim(), email }),
      });
      const data = await res.json();
      if (data.requiresTokens) { setNeedsTokens(true); setTokenBalance(data.balance ?? 0); return; }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCompareResult(data as CompareResult);
      if (data.usage?.balance !== undefined) setTokenBalance(data.usage.balance);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Comparison failed.');
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
      <SignInButton mode="modal">
        <button ref={signInRef} className="hidden" aria-hidden="true" />
      </SignInButton>

      {/* Hero Banner — everything in one dramatic section */}
      <section className="relative overflow-hidden min-h-[70vh] flex items-center justify-center">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,107,26,0.15),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,140,60,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(232,90,10,0.06),transparent_50%)]" />

        {/* Ambient fire particles in background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-flame-rise opacity-20"
              style={{
                left: `${5 + Math.random() * 90}%`,
                bottom: '-20px',
                animationDelay: `${Math.random() * 4}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
                animationIterationCount: 'infinite',
                fontSize: `${20 + Math.random() * 24}px`,
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
            AI scores your page across 4 CRO frameworks and delivers a savage one-liner you'll want to screenshot.
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
                  Any public URL &middot; ~30 seconds &middot; feelings not guaranteed to survive
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

      {/* Single Roast Results */}
      {result && (
        <div ref={resultRef} className="max-w-2xl mx-auto px-6 space-y-6 pb-16">
          <ScoreHero result={result} url={url} />
          <TopFixes fixes={result.top_fixes} />
          <SectionBreakdown result={result} />
          <CompetitorEdge text={result.competitor_edge} />
        </div>
      )}

      {/* Compare Results */}
      {compareResult && (
        <div ref={resultRef} className="max-w-4xl mx-auto px-6 space-y-6 pb-16">
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
                  `Page ${compareResult.comparison.winner} won my A/B landing page test by ${compareResult.comparison.margin} points on PageRoast.\n\nCompare your pages free: bilko.run/projects/page-roast`
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
        </div>
      )}

      {/* How It Works (shown when no results) */}
      {!result && !compareResult && !loading && (
        <>
          <section className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-extrabold text-warm-900 text-center mb-10">How the roast works</h2>
            <div className="grid md:grid-cols-3 gap-8 stagger-children">
              {[
                { step: '🔗', title: 'Drop your URL', desc: 'Any public page. We fetch it live, strip the fluff, and read every word like a judgmental copywriter.' },
                { step: '🔥', title: 'AI roasts 4 areas', desc: 'Hero, social proof, clarity, and conversion architecture. Each scored 0-25. No mercy.' },
                { step: '💀', title: 'Get destroyed', desc: 'A score, a letter grade, a savage one-liner, and the exact fixes. Share the pain on X.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-fire-100 text-fire-600 text-xl font-black flex items-center justify-center mx-auto mb-4">
                    {step}
                  </div>
                  <h3 className="font-bold text-warm-900 mb-2">{title}</h3>
                  <p className="text-sm text-warm-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* What's scored */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-4xl mx-auto px-6 py-16">
              <h2 className="text-2xl font-extrabold text-warm-900 text-center mb-3">4 CRO Frameworks. 100 Points.</h2>
              <p className="text-center text-warm-500 mb-10">Each section is scored by a conversion expert AI. No fluff, no vanity metrics.</p>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { title: 'Hero Section', pts: '25 pts', items: ['Headline clarity (0-8)', 'Subheadline specifics (0-7)', 'CTA visibility (0-5)', 'Visual hierarchy (0-5)'] },
                  { title: 'Social Proof', pts: '25 pts', items: ['Testimonials with identity (0-8)', 'Trust logos & press (0-7)', 'Quantified proof (0-5)', 'Risk reversal signals (0-5)'] },
                  { title: 'Clarity & Persuasion', pts: '25 pts', items: ['5-second test pass (0-8)', 'Benefits over features (0-7)', 'Readability & scanning (0-5)', 'Objection handling (0-5)'] },
                  { title: 'Conversion Architecture', pts: '25 pts', items: ['CTA frequency (0-7)', 'Friction reduction (0-7)', 'Urgency/scarcity (0-5)', 'Page speed signals (0-6)'] },
                ].map(({ title, pts, items }) => (
                  <div key={title} className="bg-warm-50 rounded-xl p-5 border border-warm-200/60">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-warm-900">{title}</h3>
                      <span className="text-xs font-semibold text-fire-500 bg-fire-50 px-2.5 py-0.5 rounded-full">{pts}</span>
                    </div>
                    <ul className="space-y-1.5">
                      {items.map(item => (
                        <li key={item} className="text-sm text-warm-600 flex items-start gap-2">
                          <span className="text-fire-400 mt-0.5">&#x2022;</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Grading scale */}
          <section className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-extrabold text-warm-900 text-center mb-8">Grading Scale</h2>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { grade: 'A+', range: '90-100', color: 'bg-green-100 text-green-700 border-green-200' },
                { grade: 'A', range: '85-89', color: 'bg-green-50 text-green-600 border-green-200' },
                { grade: 'B+', range: '75-79', color: 'bg-blue-100 text-blue-700 border-blue-200' },
                { grade: 'B', range: '70-74', color: 'bg-blue-50 text-blue-600 border-blue-200' },
                { grade: 'C+', range: '60-64', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
                { grade: 'C', range: '55-59', color: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
                { grade: 'D', range: '40-49', color: 'bg-orange-100 text-orange-700 border-orange-200' },
                { grade: 'F', range: '0-39', color: 'bg-red-100 text-red-700 border-red-200' },
              ].map(({ grade, range, color }) => (
                <div key={grade} className={`px-4 py-2 rounded-xl border text-sm font-bold ${color}`}>
                  {grade} <span className="font-normal opacity-70">{range}</span>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="bg-warm-100/50 border-t border-warm-200/40">
            <div className="max-w-3xl mx-auto px-6 py-16">
              <h2 className="text-2xl font-extrabold text-warm-900 text-center mb-10">Questions</h2>
              <div className="space-y-6">
                {[
                  { q: 'What does it cost?', a: 'You get 1 free roast when you sign up. After that, $5 gets you 5 credits. A single roast costs 1 credit, an A/B compare costs 2.' },
                  { q: 'How does the scoring work?', a: 'Your page is scored across 4 CRO frameworks (Hero, Social Proof, Clarity, Conversion) with 25 points each. The AI evaluates real conversion principles used by top landing page experts.' },
                  { q: 'What about my data/privacy?', a: 'We fetch your page\'s public HTML to analyze it. We don\'t store your page content after analysis. The URL and score are kept for rate limiting only.' },
                  { q: 'What\'s the A/B Compare mode?', a: 'Paste two URLs and we\'ll score both, then tell you which one wins and why. Perfect for testing your page against a competitor or comparing redesigns.' },
                  { q: 'Who built this?', a: 'Bilko — a solopreneur building AI-powered tools for makers and marketers. This is one of several free tools at bilko.run.' },
                ].map(({ q, a }) => (
                  <div key={q}>
                    <h3 className="font-bold text-warm-900 mb-1">{q}</h3>
                    <p className="text-sm text-warm-600 leading-relaxed">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Bottom CTA */}
          <section className="max-w-4xl mx-auto px-6 py-16 text-center">
            <h2 className="text-3xl font-extrabold text-warm-900 mb-4">Think your page converts? Prove it. 🔥</h2>
            <p className="text-warm-500 mb-6">Free. 60 seconds. Your ego may not survive.</p>
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
