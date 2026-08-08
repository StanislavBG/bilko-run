import { useEffect, useState } from 'react';
import { useAuth as useClerkAuth, useUser, SignInButton } from '@clerk/clerk-react';
import { usePageView } from '../hooks/usePageView.js';
import { startSessionManagerCheckout } from '../lib/sessionManagerCheckout.js';

const PRICE_LABEL = '$19.99';
const INSTALL_COMMAND = 'npx claude-code-session-manager@latest';

/**
 * Single-viewport product page: the whole pitch — what it is, that the app is
 * free, and what $19.99 buys — fits on one screen with no scrolling on a
 * desktop viewport. Depth is opt-in: picking a feature swaps the detail panel
 * IN PLACE rather than pushing the page taller.
 *
 * Below `md` the page falls back to normal document flow. A hard 100dvh lock on
 * a 600px-tall phone would clip the buy button, which is worse than a scroll.
 */
interface Feature {
  key: string;
  title: string;
  tagline: string;
  body: string;
}

const FEATURES: readonly Feature[] = [
  {
    key: 'scheduler',
    title: 'Scheduler',
    tagline: 'Author work once. Let it run around your token window.',
    body: "Write a PRD, drop it in the queue, and Session Manager runs it as a claude -p job — timed around your plan's 5-hour token window. Rate-limited? It auto-pauses and picks back up the moment your window resets. No babysitting a terminal, no manual re-triggering after every reset.",
  },
  {
    key: 'hive',
    title: 'Subagents · Hive',
    tagline: 'Fan work out across a live hive of subagents.',
    body: 'Launch a whole crew of subagents against one problem, watch them work in real time, and race competing approaches against each other. Configured roles, live tool-use feed, and a results digest when they finish — orchestration you can actually see happening.',
  },
  {
    key: 'history',
    title: 'History',
    tagline: 'Every session, ever — fully resumable.',
    body: "Every conversation you've ever had with Claude Code in this project is indexed, searchable, and resumable. Pick up any past thread exactly where you left it, weeks later, without hunting through terminal scrollback or re-explaining context.",
  },
  {
    key: 'usage',
    title: 'Usage',
    tagline: 'Know your burn rate before you hit the wall.',
    body: "Live token and cost burn-rate against your plan's rolling window, right inside the app — no separate dashboard, no guessing whether you're about to get rate-limited mid-task.",
  },
  {
    key: 'voice',
    title: 'Voice',
    tagline: 'Push-to-talk, straight into any session.',
    body: 'Dictate instructions instead of typing them. Transcription runs locally — nothing leaves your machine. Hold a key, talk, and it lands in the session exactly like typed input would.',
  },
  {
    key: 'browser',
    title: 'Browser',
    tagline: 'An embedded dev browser Claude can drive.',
    body: 'Capture DOM state, record click-sequences, and let Claude interact with a real embedded browser without leaving the app. Useful for anything that needs visual verification, not just terminal output.',
  },
  {
    key: 'remote',
    title: 'Web Remote',
    tagline: 'Pair your phone. Run commands from anywhere.',
    body: 'Pair a phone once, then issue scheduler and terminal commands remotely over a relay you self-host — end-to-end encrypted between your devices. Check on a long-running job from the couch, not just the desk.',
  },
  {
    key: 'cockpit',
    title: 'Everything, one cockpit',
    tagline: '25+ surfaces. Zero context-switching.',
    body: 'Settings, Skills, Hooks, MCP Servers, Memory, Permissions, Plans, Tasks — every config and observability surface Claude Code has, in one left-nav, one app, one place you actually remember to check.',
  },
];

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
      className="group inline-flex w-full items-center gap-2.5 rounded-lg bg-warm-900 px-4 py-3 font-mono text-[12.5px] text-warm-100 transition-colors hover:bg-black md:text-[13.5px]"
    >
      <span className="select-none text-emerald-400">$</span>
      <span className="truncate">{INSTALL_COMMAND}</span>
      <span className="ml-auto shrink-0 font-sans text-[10.5px] font-semibold text-warm-400 group-hover:text-warm-200">
        {copied ? 'copied ✓' : 'copy'}
      </span>
    </button>
  );
}

/**
 * Buy panel.
 *
 * Checkout is bound to the CLERK identity, never to a free-text email field.
 * The entitlement that unlocks /manual is looked up by the signed-in user's
 * email, so letting someone type a different address here meant they could pay
 * and then be told they own nothing. Sign-in first (Google is one click), then
 * buy — the address that pays is by construction the address that reads.
 */
function BuyPanel() {
  const { isSignedIn } = useClerkAuth();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    if (!email) {
      setError('We could not read your account email. Try signing out and back in.');
      return;
    }
    setError(null);
    setLoading(true);
    const result = await startSessionManagerCheckout(email);
    setLoading(false);
    if (!result.ok) setError(result.error ?? 'Something went wrong. Please try again.');
  }

  return (
    <div id="buy" className="flex flex-col rounded-2xl border-2 border-fire-500 bg-white p-5">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-warm-900">{PRICE_LABEL}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-warm-400">one time</span>
      </div>
      <h2 className="mt-1 text-base font-semibold text-warm-900">The Field Manual</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-warm-500">
        17 chapters, one per surface — what it's for, the mistake people make, and the workflow that
        pays off. Every future revision included.
      </p>

      {isSignedIn ? (
        <>
          <button
            onClick={handleBuy}
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-fire-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-fire-600 disabled:opacity-60"
          >
            {loading ? 'Opening checkout…' : `Get the manual — ${PRICE_LABEL}`}
          </button>
          {email && (
            <p className="mt-2 text-center text-[11px] text-warm-400">
              Unlocks for <strong className="text-warm-600">{email}</strong>
            </p>
          )}
        </>
      ) : (
        <>
          <SignInButton mode="modal">
            <button className="mt-4 w-full rounded-xl bg-fire-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-fire-600">
              Sign in to buy
            </button>
          </SignInButton>
          <p className="mt-2 text-center text-[11px] text-warm-400">
            Google or email — your account is what unlocks the manual.
          </p>
        </>
      )}

      {error && (
        <p role="alert" className="mt-2 text-center text-[12px] text-red-600">
          {error}
        </p>
      )}

      <div className="mt-3 flex justify-center gap-3 text-[11px] text-warm-400">
        <a href="/manual" className="underline underline-offset-2 hover:text-fire-600">
          Free sample chapter
        </a>
        <span aria-hidden="true">·</span>
        <a href="/my-manual" className="underline underline-offset-2 hover:text-fire-600">
          Already bought it?
        </a>
      </div>
    </div>
  );
}

export default function SessionManagerPage() {
  usePageView();
  const [activeKey, setActiveKey] = useState<string>(FEATURES[0].key);
  const active = FEATURES.find((f) => f.key === activeKey) ?? FEATURES[0];

  useEffect(() => {
    document.title = 'Session Manager — bilko.run';
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white md:h-[100dvh] md:overflow-hidden">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-warm-200 px-6 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-fire-500 text-sm font-semibold text-white">
            S
          </span>
          <span className="text-[15px] font-semibold text-warm-900">Session Manager</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            Free app
          </span>
        </div>
        <a
          href="/manual"
          className="text-xs text-warm-400 underline underline-offset-2 hover:text-warm-600"
        >
          Read the manual →
        </a>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-6 md:min-h-0 md:py-8">
        {/* Row 1 — pitch + buy, side by side */}
        <section className="grid shrink-0 gap-6 md:grid-cols-[1fr_320px]">
          <div className="flex flex-col justify-center">
            <h1 className="text-3xl font-semibold leading-tight text-warm-900 md:text-[2.6rem]">
              Your local cockpit for Claude Code
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-warm-500">
              Terminal, scheduler, subagent hive, memory, and 25+ config surfaces — one desktop app,
              running on your machine.
            </p>
            <p className="mt-4 text-sm font-semibold text-warm-900">
              The tool is free. The knowledge of how to run it isn't.
            </p>
            <div className="mt-2 max-w-md">
              <InstallCommand />
            </div>
            <p className="mt-2 text-[11.5px] text-warm-400">
              No account, no licence key, no trial limit — the app is never gated to sell the book.
            </p>
          </div>

          <BuyPanel />
        </section>

        {/* Row 2 — depth without scroll: picking a feature swaps the panel in place */}
        <section className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {FEATURES.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveKey(f.key)}
                aria-pressed={activeKey === f.key}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                  activeKey === f.key
                    ? 'border-fire-500 bg-fire-500 text-white'
                    : 'border-warm-200 text-warm-600 hover:border-fire-300 hover:text-warm-900'
                }`}
              >
                {f.title}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-center rounded-2xl border border-warm-200 bg-warm-50/60 p-6">
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-fire-500">
              {active.title}
            </div>
            <h2 className="mt-1.5 text-xl font-semibold leading-snug text-warm-900 md:text-2xl">
              {active.tagline}
            </h2>
            <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-warm-500">{active.body}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
