import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { usePageView } from '../hooks/usePageView.js';
import { startSessionManagerCheckout } from '../lib/sessionManagerCheckout.js';

const PRICE_LABEL = '$19.99';
const INSTALL_COMMAND = 'npx claude-code-session-manager@latest';

/**
 * Open-core split, stated once here and echoed everywhere on the page:
 * the TOOL is free, the KNOWLEDGE of how to run it is the product.
 * Standard practice for open-source projects that sell a manual rather than
 * a license — the app is never crippled, gated, or trial-limited to sell it.
 */
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

/** What the paid manual actually contains — shown before anyone pays. */
const MANUAL_CONTENTS: readonly string[] = [
  'A chapter per tab — what the surface is for, and the one thing people get wrong about it',
  'Annotated screenshots with numbered callouts, captured from the real app',
  'The scheduler playbook: writing a PRD that finishes, and reading one that parked itself',
  'Two real post-mortems — the poll-hang and the post-AC overrun — and the rules they produced',
  'Where per-task behaviour belongs (a Tag or an Agent, never a Settings edit)',
  'Every future revision, free — buy once, keep getting updates',
];

function StickyHeader({ onBuyClick }: { onBuyClick: () => void }) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-7 py-3.5 border-b border-warm-200 bg-[rgba(250,244,235,0.92)] backdrop-blur-md">

      <div className="flex items-center gap-2.5">
        <span className="w-[26px] h-[26px] rounded-[7px] bg-fire-500 text-white flex items-center justify-center font-semibold text-sm">
          S
        </span>
        <span className="text-base font-semibold text-warm-900">Session Manager</span>
        <span className="hidden sm:inline text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
          Free
        </span>
      </div>
      <button
        onClick={onBuyClick}
        className="px-5 py-2.5 rounded-lg border-0 cursor-pointer bg-fire-500 hover:bg-fire-600 text-white text-sm font-bold transition-colors"
      >
        Field Manual — {PRICE_LABEL}
      </button>
    </header>
  );
}

/** One-line install, copyable. The primary CTA of the whole page. */
function InstallCommand() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is permission-gated and blocked outright in some browsers.
      // The command is visible either way, so failing silently costs nothing.
    }
  }

  return (
    <button
      onClick={copy}
      aria-label={`Copy install command: ${INSTALL_COMMAND}`}
      className="group inline-flex items-center gap-3 px-5 py-3.5 rounded-xl bg-warm-900 text-warm-100 font-mono text-[13px] md:text-[15px] cursor-pointer transition-colors hover:bg-black"
    >
      <span className="text-emerald-400 select-none">$</span>
      <span>{INSTALL_COMMAND}</span>
      <span className="text-[11px] font-sans font-semibold text-warm-400 group-hover:text-warm-200">
        {copied ? 'copied ✓' : 'copy'}
      </span>
    </button>
  );
}

/**
 * The open-core explainer. This section is the point of the page: it says
 * plainly what is free and what costs money, so nobody reaches checkout
 * wondering whether they just bought software they already had.
 */
function OpenCoreSplit({ onBuyClick }: { onBuyClick: () => void }) {
  return (
    <section className="max-w-4xl mx-auto px-6 py-16 md:py-20">
      <div className="text-center">
        <div className="text-[11.5px] font-bold tracking-wide uppercase text-warm-400 mb-3">
          How this is licensed
        </div>
        <h2 className="text-2xl md:text-display-md font-semibold text-warm-900 leading-tight">
          The tool is free. The knowledge of how to run it isn't.
        </h2>
        <p className="mt-4 max-w-2xl mx-auto text-[15px] text-warm-500 leading-relaxed">
          Same arrangement plenty of open-source projects run on: ship the software to
          everyone, sell the manual to the people who want to get good at it fast. The app is
          never crippled, trial-limited, or feature-gated to push the book — there is no
          "pro tier" hiding behind the paywall, because there is no paywall in the app.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-warm-200 bg-white p-7">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
              Free
            </span>
            <h3 className="text-lg font-semibold text-warm-900">The app</h3>
          </div>
          <p className="mt-3 text-[15px] text-warm-500 leading-relaxed">
            All of it. Scheduler, subagent hive, history, usage, voice, and every one of the
            25+ config surfaces. No account, no license key, no telemetry gate. It runs on your
            machine against your own Claude Code install.
          </p>
          <div className="mt-5">
            <InstallCommand />
          </div>
        </div>

        <div className="rounded-2xl border-2 border-fire-500 bg-white p-7">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wide text-white bg-fire-500 rounded-full px-2.5 py-0.5">
              {PRICE_LABEL}
            </span>
            <h3 className="text-lg font-semibold text-warm-900">The Field Manual</h3>
          </div>
          <p className="mt-3 text-[15px] text-warm-500 leading-relaxed">
            A tab-by-tab operator's guide: what each surface is actually for, the workflows
            that pay for themselves, and the mistakes worth skipping. Written and maintained
            alongside the app, so it describes the version you're running.
          </p>
          <button
            onClick={onBuyClick}
            className="mt-5 px-5 py-3 rounded-xl bg-fire-500 hover:bg-fire-600 border-0 text-white text-[15px] font-bold cursor-pointer transition-colors"
          >
            Get the manual — {PRICE_LABEL}
          </button>
          <p className="mt-3 text-[13px] text-warm-400">
            <a href="/manual" className="underline underline-offset-2 hover:text-fire-600">
              Read the first chapter free →
            </a>
          </p>
        </div>
      </div>
    </section>
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
    <section ref={buyRef} id="buy" className="max-w-2xl mx-auto px-6 pb-20 md:pb-28">
      <div className="text-center">
        <div className="text-[11.5px] font-bold tracking-wide uppercase text-warm-400 mb-3">
          The paid part
        </div>
        <h2 className="text-display-lg text-warm-900">The Field Manual — {PRICE_LABEL}</h2>
        <p className="mt-4 text-warm-500 leading-relaxed">
          You already have the app for free. This is the guide to getting good at it —
          one purchase, no subscription, and every future revision included.
        </p>
      </div>

      <ul className="mt-8 space-y-2.5 text-left">
        {MANUAL_CONTENTS.map((item) => (
          <li key={item} className="flex gap-3 text-[15px] text-warm-600 leading-relaxed">
            <span aria-hidden="true" className="text-fire-500 font-bold shrink-0">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

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
          {loading ? 'Redirecting…' : `Get the manual — ${PRICE_LABEL}`}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 text-center">
          {error}
        </p>
      )}
      <p className="mt-5 text-center text-[13px] text-warm-400">
        <a href="/manual" className="underline underline-offset-2 hover:text-fire-600">Read the free sample chapter</a>
        {' · '}
        <a href="/my-manual" className="underline underline-offset-2 hover:text-fire-600">Already bought it?</a>
      </p>
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
        <p className="mt-4 text-[15px] font-semibold text-warm-900">
          The app is free. One command, no account.
        </p>
        <div className="mt-6 flex flex-col items-center gap-4">
          <InstallCommand />
          <button
            onClick={scrollToBuy}
            className="text-[14px] font-semibold text-fire-600 hover:text-fire-700 underline underline-offset-4 cursor-pointer bg-transparent border-0 p-0"
          >
            Want the manual that teaches it? {PRICE_LABEL} →
          </button>
        </div>
      </section>

      <OpenCoreSplit onBuyClick={scrollToBuy} />

      <div className="max-w-2xl mx-auto px-6 pt-4 text-center">
        <div className="text-[11.5px] font-bold tracking-wide uppercase text-warm-400">
          What the free app does
        </div>
      </div>

      <div className="mt-6 border-t border-b border-warm-200">
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
