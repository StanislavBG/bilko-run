import { useState, useRef, useEffect } from 'react';
import { useUser, SignInButton, useAuth } from '@clerk/clerk-react';

const API = import.meta.env.VITE_API_URL || '/api';

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

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

// ── Components ───────────────────────────────────────────────────────────────

function ScoreHero({ result, url }: { result: RoastResult; url: string }) {
  const shareText = `My landing page scored ${result.total_score}/100 (${result.grade}) on PageRoast\n\n"${result.roast}"\n\nGet your free audit: bilko.run/projects/page-roast`;
  const [copied, setCopied] = useState(false);

  return (
    <div className={`rounded-2xl border-2 p-8 text-center animate-slide-up ${gradeBg(result.grade)}`}>
      <div className="flex items-center justify-center gap-6 mb-4">
        <div className="animate-score">
          <span className="text-7xl md:text-8xl font-black text-warm-900">{result.total_score}</span>
          <span className="text-lg text-warm-500 font-medium">/100</span>
        </div>
        <div className={`text-5xl md:text-6xl font-black ${gradeColor(result.grade)} animate-score`} style={{ animationDelay: '200ms' }}>
          {result.grade}
        </div>
      </div>

      <p className="text-lg md:text-xl font-semibold text-fire-600 italic max-w-lg mx-auto leading-relaxed mb-2">
        &ldquo;{result.roast}&rdquo;
      </p>
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
          onClick={() => { copyToClipboard(shareText); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
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
          Buy 10 more roasts for $5 — support an indie maker and keep grading.
        </p>
        <button
          onClick={buyTokens}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-fire-500 hover:bg-fire-600 disabled:bg-warm-300 text-white font-bold text-lg rounded-xl shadow-lg shadow-fire-500/20 transition-all"
        >
          {loading ? 'Redirecting to checkout...' : 'Buy 10 Roasts — $5'}
        </button>
        <p className="mt-3 text-xs text-warm-400">One-time purchase. No subscription.</p>
      </div>
    </div>
  );
}

export function PageRoastPage() {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

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
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-fire-50 via-warm-50 to-warm-100/50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,107,26,0.08),transparent_60%)]" />
        <div className="relative max-w-3xl mx-auto px-6 pt-16 pb-12 md:pt-24 md:pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-fire-100 text-fire-700 text-xs font-semibold mb-6">
            3 free roasts &middot; then $5 for 10 more &middot; 60 seconds
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-warm-900 leading-[1.1]">
            Get your landing page
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fire-500 to-fire-700">
              brutally roasted.
            </span>
          </h1>

          <p className="mt-5 text-lg text-warm-600 max-w-xl mx-auto leading-relaxed">
            Paste a URL. AI scores your page across 4 CRO frameworks,
            tells you exactly what's broken, and gives you a savage one-liner you'll want to screenshot.
          </p>
        </div>
      </section>

      {/* Sign-in Gate */}
      {!isSignedIn && (
        <section className="max-w-md mx-auto px-6 mb-12">
          <div className="bg-white rounded-2xl border border-warm-200/60 shadow-lg shadow-warm-200/20 p-8 text-center">
            <h2 className="text-lg font-bold text-warm-900 mb-2">Sign in to start roasting</h2>
            <p className="text-sm text-warm-500 mb-6">You'll get 3 free roasts. Takes 10 seconds.</p>
            <SignInButton mode="modal">
              <button className="px-8 py-3.5 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl shadow-md shadow-fire-500/20 transition-all text-lg">
                Sign in to Roast
              </button>
            </SignInButton>
          </div>
        </section>
      )}

      {/* Input Section (only shown when signed in) */}
      {isSignedIn && (
      <section className="max-w-2xl mx-auto px-6 -mt-2 mb-12">
        {/* Token Balance */}
        <div className="flex items-center justify-end mb-4 px-1">
          {tokenBalance !== null && (
            <div className="text-sm font-semibold text-warm-700">
              {tokenBalance === 0 ? (
                <span className="text-fire-600">0 roasts left</span>
              ) : (
                <>{tokenBalance} roast{tokenBalance !== 1 ? 's' : ''} left</>
              )}
            </div>
          )}
        </div>

        {/* Tab Toggle */}
        <div className="flex gap-1 bg-warm-100 rounded-xl p-1 mb-6 w-fit mx-auto">
          <button
            onClick={() => { setTab('roast'); setCompareResult(null); }}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === 'roast'
                ? 'bg-white text-warm-900 shadow-sm'
                : 'text-warm-500 hover:text-warm-700'
            }`}
          >
            Roast
          </button>
          <button
            onClick={() => { setTab('compare'); setResult(null); }}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === 'compare'
                ? 'bg-white text-warm-900 shadow-sm'
                : 'text-warm-500 hover:text-warm-700'
            }`}
          >
            A/B Compare
          </button>
        </div>

        {/* Single Roast Input */}
        {tab === 'roast' && (
          <div className="bg-white rounded-2xl border border-warm-200/60 shadow-lg shadow-warm-200/20 p-6">
            <div className="flex gap-3">
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') roast(); }}
                placeholder="https://your-landing-page.com"
                className="flex-1 px-4 py-3.5 rounded-xl border border-warm-200 bg-warm-50 text-warm-900 placeholder:text-warm-400 text-base focus:outline-none focus:ring-2 focus:ring-fire-300 focus:border-fire-300 transition-all"
              />
              <button
                onClick={roast}
                disabled={loading || !url.trim()}
                className="px-6 py-3.5 bg-fire-500 hover:bg-fire-600 disabled:bg-warm-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md shadow-fire-500/20 hover:shadow-fire-500/30 transition-all whitespace-nowrap disabled:shadow-none"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Roasting...
                  </span>
                ) : 'Roast It'}
              </button>
            </div>
            <p className="mt-2 text-xs text-warm-400 text-center">
              Works with any public URL. Results in about 30 seconds.
            </p>
          </div>
        )}

        {/* Compare Input */}
        {tab === 'compare' && (
          <div className="bg-white rounded-2xl border border-warm-200/60 shadow-lg shadow-warm-200/20 p-6">
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-2 block">Page A</label>
                <input
                  type="url"
                  value={urlA}
                  onChange={e => setUrlA(e.target.value)}
                  placeholder="https://page-a.com"
                  className="w-full px-4 py-3 rounded-xl border border-warm-200 bg-warm-50 text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-300 focus:border-fire-300 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-2 block">Page B</label>
                <input
                  type="url"
                  value={urlB}
                  onChange={e => setUrlB(e.target.value)}
                  placeholder="https://page-b.com"
                  className="w-full px-4 py-3 rounded-xl border border-warm-200 bg-warm-50 text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-300 focus:border-fire-300 transition-all"
                />
              </div>
            </div>
            <button
              onClick={compare}
              disabled={loading || !urlA.trim() || !urlB.trim()}
              className="w-full py-3.5 bg-fire-500 hover:bg-fire-600 disabled:bg-warm-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md shadow-fire-500/20 transition-all disabled:shadow-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Comparing...
                </span>
              ) : 'Compare Pages'}
            </button>
          </div>
        )}
      </section>
      )}

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
            <h2 className="text-2xl font-extrabold text-warm-900 text-center mb-10">How it works</h2>
            <div className="grid md:grid-cols-3 gap-8 stagger-children">
              {[
                { step: '1', title: 'Paste your URL', desc: 'Any public landing page, homepage, or product page. We fetch it in real-time.' },
                { step: '2', title: 'AI audits 4 areas', desc: 'Hero section, social proof, clarity & persuasion, and conversion architecture. Each scored 0-25.' },
                { step: '3', title: 'Get your roast', desc: 'Overall score, letter grade, a savage one-liner, and the exact fixes to improve conversions.' },
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
                  { q: 'Is this really free?', a: 'Yes. You get free analyses per day, no sign-up required. The tool runs on AI and the cost per analysis is low enough that I can offer it free.' },
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
            <h2 className="text-3xl font-extrabold text-warm-900 mb-4">Stop guessing. Start converting.</h2>
            <p className="text-warm-500 mb-6">Your landing page has one job. Find out if it's doing it.</p>
            <button
              onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-fire-500 hover:bg-fire-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-fire-500/20 transition-all hover:-translate-y-0.5"
            >
              Roast My Page
            </button>
          </section>
        </>
      )}
    </>
  );
}
