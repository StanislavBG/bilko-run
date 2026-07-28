import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { usePageView } from '../hooks/usePageView.js';
import { startSessionManagerCheckout } from '../lib/sessionManagerCheckout.js';

const PRICE_LABEL = '$19.99';

interface Feature {
  title: string;
  tagline: string;
  body: string;
}

const FEATURES: readonly Feature[] = [
  {
    title: 'Scheduler',
    tagline: 'Author work once. Let it run around your token window.',
    body: "Write a PRD, drop it in the queue, and Session Manager runs it as a claude -p job — timed around your plan's 5-hour token window. Rate-limited? It auto-pauses and picks back up the moment your window resets. No babysitting a terminal, no manual re-triggering after every reset.",
  },
  {
    title: 'Subagents · Hive',
    tagline: 'Fan work out across a live hive of subagents.',
    body: 'Launch a whole crew of subagents against one problem, watch them work in real time, and race competing approaches against each other. Configured roles, live tool-use feed, and a results digest when they finish — orchestration you can actually see happening.',
  },
  {
    title: 'History',
    tagline: 'Every session, ever — fully resumable.',
    body: "Every conversation you've ever had with Claude Code in this project is indexed, searchable, and resumable. Pick up any past thread exactly where you left it, weeks later, without hunting through terminal scrollback or re-explaining context.",
  },
  {
    title: 'Usage',
    tagline: 'Know your burn rate before you hit the wall.',
    body: "Live token and cost burn-rate against your plan's rolling window, right inside the app — no separate dashboard, no guessing whether you're about to get rate-limited mid-task.",
  },
  {
    title: 'Voice',
    tagline: 'Push-to-talk, straight into any session.',
    body: 'Dictate instructions instead of typing them. Transcription runs locally via Whisper — nothing leaves your machine. Hold a key, talk, and it lands in the session exactly like typed input would.',
  },
  {
    title: 'Browser',
    tagline: 'An embedded dev browser Claude can actually drive.',
    body: 'Capture DOM state, record click-sequences, and let Claude interact with a real embedded browser without leaving the app. Useful for anything that needs visual verification, not just terminal output.',
  },
  {
    title: 'Web Remote',
    tagline: 'Pair your phone. Run commands from anywhere.',
    body: 'Pair a phone once, then issue scheduler and terminal commands remotely over a relay you self-host — end-to-end encrypted between your devices. Check on a long-running job from the couch, not just the desk.',
  },
  {
    title: 'Everything, one cockpit',
    tagline: '25+ surfaces. Zero context-switching.',
    body: 'Settings, Skills, Hooks, MCP Servers, Memory, Permissions, Plans, Tasks — every config and observability surface Claude Code has, in one left-nav, one app, one place you actually remember to check.',
  },
];

function StickyHeader({ onBuyClick }: { onBuyClick: () => void }) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-7 py-3.5 border-b border-warm-200 bg-[rgba(250,244,235,0.92)] backdrop-blur-md">

      <div className="flex items-center gap-2.5">
        <span className="w-[26px] h-[26px] rounded-[7px] bg-fire-500 text-white flex items-center justify-center font-semibold text-sm">
          S
        </span>
        <span className="text-base font-semibold text-warm-900">Session Manager</span>
      </div>
      <button
        onClick={onBuyClick}
        className="px-5 py-2.5 rounded-lg border-0 cursor-pointer bg-fire-500 hover:bg-fire-600 text-white text-sm font-bold transition-colors"
      >
        Buy Now — {PRICE_LABEL}
      </button>
    </header>
  );
}

function FeatureSection({ f, index }: { f: Feature; index: number }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <div className="text-[11px] font-bold tracking-wide uppercase text-fire-500 mb-2.5">
        {String(index + 1).padStart(2, '0')} · {f.title}
      </div>
      <h2 className="text-2xl md:text-display-md font-semibold text-warm-900 mb-2.5 leading-tight">
        {f.tagline}
      </h2>
      <p className="text-[15px] text-warm-500 leading-relaxed">{f.body}</p>
    </div>
  );
}

function BuySection({ buyRef }: { buyRef: React.RefObject<HTMLDivElement> }) {
  const { email: savedEmail, setEmail } = useAuth();
  const [emailInput, setEmailInput] = useState(savedEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = emailInput.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);
    setEmail(trimmed);
    const result = await startSessionManagerCheckout(trimmed);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong. Please try again.');
    }
  }

  return (
    <section ref={buyRef} id="buy" className="max-w-2xl mx-auto px-6 pb-20 md:pb-28 text-center">
      <h2 className="text-display-lg text-warm-900">Buy Session Manager — {PRICE_LABEL}</h2>
      <p className="mt-4 text-warm-500 leading-relaxed">
        One-time purchase, $19.99 USD. Enter your email, check out, then run one command to launch.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <input
          type="email"
          required
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email"
          className="flex-1 sm:max-w-xs px-4 py-3 rounded-xl border border-warm-200 text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 text-sm font-bold text-white bg-fire-500 hover:bg-fire-600 rounded-xl shadow-md shadow-fire-500/20 transition-all disabled:opacity-60"
        >
          {loading ? 'Redirecting…' : `Buy Now — ${PRICE_LABEL}`}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}

export default function SessionManagerPage() {
  usePageView();
  const buyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Session Manager — bilko.run';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  const scrollToBuy = () => buyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <div className="min-h-screen bg-white">
      <StickyHeader onBuyClick={scrollToBuy} />

      <div className="max-w-4xl mx-auto px-6 pt-6 text-right">
        <a
          href="/projects/session-manager/"
          className="text-xs text-warm-400 hover:text-warm-600 underline underline-offset-2"
        >
          Already own it? Open Web Remote →
        </a>
      </div>

      <section className="max-w-4xl mx-auto px-6 pt-4 pb-10 md:pt-8 md:pb-14 text-center">
        <div className="text-[11.5px] font-bold tracking-wide uppercase text-warm-400 mb-3.5">
          Claude Code Session Manager
        </div>
        <h1 className="text-display-xl text-warm-900">
          Your local cockpit for Claude Code
        </h1>
        <p className="mt-5 text-lg text-warm-500 leading-relaxed">
          Terminal, scheduler, subagent hive, memory, and 25+ config surfaces — one desktop app,
          nothing sent anywhere it doesn't need to go.
        </p>
        <div className="mt-8">
          <button
            onClick={scrollToBuy}
            className="inline-block px-8 py-3.5 rounded-xl bg-fire-500 hover:bg-fire-600 border-0 text-white text-[15px] font-bold cursor-pointer transition-colors"
          >
            Buy Now — {PRICE_LABEL} →
          </button>
        </div>
      </section>

      <div className="border-t border-b border-warm-200">
        {FEATURES.map((f, i) => (
          <FeatureSection key={f.title} f={f} index={i} />
        ))}
      </div>

      <div className="pt-8 pb-24">
        <BuySection buyRef={buyRef} />
      </div>
    </div>
  );
}
