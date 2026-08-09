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
 * The lock is conditional on BOTH axes: below `md`, and on any viewport shorter
 * than 880px, the page falls back to normal document flow. A hard 100dvh lock
 * on a 600px-tall phone — or on a 768px laptop, where the feature tile's own
 * content no longer fits — clips the buy button or strands a scrollbar inside
 * the tile, both worse than letting the page scroll.
 */
/**
 * One entry per surface that ACTUALLY SHIPS in the app today.
 *
 * This list drifted once into advertising two retired tabs (Browser, and the
 * desktop half of Web Remote, removed 2026-08-06) plus a "Subagents · Hive"
 * screen that never existed — so a visitor could click a pill and read about
 * something they'd never find after installing. Every entry here must map to a
 * row in the app's own `navGroups.ts`, and every `chapter` to a real slug in
 * the Field Manual's `manual.json`.
 *
 * Each feature carries three layers on purpose: what it IS (tagline/body),
 * what you DO with it in the free app (`inApp`), and what the paid chapter
 * teaches about running it well (`chapter.teaches`). That split is the
 * open-core pitch made concrete on every single card — and it's what gives the
 * detail panel enough real content to fill its own space.
 */
interface Feature {
  key: string;
  title: string;
  tagline: string;
  body: string;
  /** Concrete things the free app lets you do here. */
  inApp: readonly string[];
  /** The three-beat loop of actually using it, rendered as the tile's footer strip. */
  flow: readonly [string, string, string];
  /** Short factual descriptors — never invented metrics. */
  chips: readonly string[];
  chapter: { title: string; teaches: readonly string[] };
}

const FEATURES: readonly Feature[] = [
  {
    key: 'sessions',
    title: 'Sessions',
    tagline: 'One project, many sessions — Terminal and Chat, same thread.',
    body: "Each session is a goal-scoped Claude session with its own agent persona and mission. Switch between the interactive terminal and the headless chat view and you're still in the same conversation — the context follows you rather than being rebuilt.",
    inApp: [
      'Open a session with a chosen persona and mission, pre-framed from both',
      'Terminal and Chat hand the one session back and forth — never fork it',
      'A verbosity dial from raw tool-calls down to just the answer',
    ],
    flow: ['Pick a persona + mission', 'Work in Terminal or Chat', 'Resume it later, intact'],
    chips: ['Persona + mission', 'Resumable', 'Live tool feed'],
    chapter: {
      title: 'Epics & Sessions — Terminal and Chat are one session',
      teaches: [
        'Why the two views must never mint a second session id',
        'How an opening prompt is composed from Actor, Input and Mission',
        'When to start a fresh session instead of stretching an old one',
      ],
    },
  },
  {
    key: 'scheduler',
    title: 'Scheduler',
    tagline: 'Author work once. Let it run around your token window.',
    body: "Write a PRD, drop it in the queue, and Session Manager runs it as a claude -p job timed around your plan's 5-hour window. Rate-limited? It auto-pauses and picks back up the moment the window resets — no babysitting a terminal, no manual re-trigger after every reset.",
    inApp: [
      'Queue PRDs per project and watch them run headless',
      'Auto-pause on a rate limit, auto-resume at the next reset',
      'A definition-of-done pass re-verifies finished work when the queue drains',
    ],
    flow: ['Write a PRD', 'Queue it', 'It runs when tokens free up'],
    chips: ['5h-window aware', 'Auto-resume', 'Per-project queue'],
    chapter: {
      title: 'Scheduler — author once, run around your token window',
      teaches: [
        'Acceptance criteria a headless run can actually check itself against',
        'The two real stuck-job incidents that shaped the PRD rules',
        'Choosing between manual, on-reset and when-available modes',
      ],
    },
  },
  {
    key: 'agents',
    title: 'Agent Library',
    tagline: "Author the 'who' behind every session.",
    body: 'Agent personas are plain markdown files on your disk. Edit them in place — description, model, the missions they belong to — and turn the ones you run constantly into their own button that opens a pre-framed session in a single click.',
    inApp: [
      'Create, duplicate and edit personas, written straight back to disk',
      'Per-persona model, so a session launches on the tier that fits it',
      'Scope a persona to a project and it becomes its own toolbar Action',
    ],
    flow: ['Write the persona', 'Give it a model', 'Launch sessions from it'],
    chips: ['Markdown on disk', 'Per-persona model', 'Project overlays'],
    chapter: {
      title: 'Agent Library — authoring the "who" of an Epic',
      teaches: [
        'What belongs in a persona versus what belongs in Settings',
        "How a persona's model overrides the global default",
        "Writing an Action that's worth a permanent button",
      ],
    },
  },
  {
    key: 'tags',
    title: 'Tag Library',
    tagline: 'The mission that ships with every session.',
    body: "A tag is the session's mission — feature, bug, discussion — and it carries the grounding template that becomes that session's first prompt. It also sets how eagerly the session should decompose work into scheduled PRDs rather than doing it inline.",
    inApp: [
      "Edit each mission's opening template in place",
      'See which agents carry which mission, and edit it from either side',
      'The mission decides whether decomposition is the assumed next step',
    ],
    flow: ['Pick the mission', 'It writes the first prompt', 'Work decomposes accordingly'],
    chips: ['Editable templates', 'Two-way membership', 'Drives /develop'],
    chapter: {
      title: 'Tag Library — the mission that ships with every Epic',
      teaches: [
        'How a template changes what the agent does first',
        'Pairing a mission with the right persona',
        'Why the taxonomy is deliberately small',
      ],
    },
  },
  {
    key: 'memory',
    title: 'Memory',
    tagline: 'See what your agents have actually been remembering.',
    body: 'The workspace memory store is a folder of markdown facts that quietly accumulates while you work. Memory Clusters reads it and groups those facts into named semantic clusters with the links between them, so you can see what is shaping every answer you get.',
    inApp: [
      'Browse and edit every stored memory for the project',
      'Clusters are computed on request, never on a background timer',
      'Wikilinks between memories become real, visible connections',
    ],
    flow: ['Agents write facts', 'Clusters group them', 'You prune what\'s stale'],
    chips: ['Per-project store', 'On-demand refresh', 'Plain markdown'],
    chapter: {
      title: 'Memory Clusters — what an agent has actually been remembering',
      teaches: [
        'What deserves to be a memory and what is just noise',
        'Spotting a stale memory before it misleads a session',
        'Folding a memory back into your instructions instead',
      ],
    },
  },
  {
    key: 'history',
    title: 'History',
    tagline: 'Where your Claude time and money went.',
    body: 'Every session on the machine, folded by working directory rather than by transcript folder, with token and cost breakdowns per project, model and tool. Anything that cannot be resolved to a real directory is excluded and said so on screen — never quietly dropped into a total.',
    inApp: [
      'Cost and token drill-downs by project, model and tool',
      'Resume any past thread instead of re-explaining context',
      'Excluded rows are counted and stated, not hidden',
    ],
    flow: ['Every session indexed', 'Folded by directory', 'Cost and tokens explained'],
    chips: ['Machine-wide', 'Cost + tokens', 'Resumable'],
    chapter: {
      title: 'History — where your Claude time and money went',
      teaches: [
        'Reading a burn-rate before it turns into a rate limit',
        'Which work is quietly costing the most',
        'Why a project is a directory, not a transcript folder',
      ],
    },
  },
  {
    key: 'config',
    title: 'Skills · Hooks · MCP',
    tagline: 'Every config file Claude Code reads, edited where you can see it.',
    body: 'Skills, hooks, MCP servers, permissions and settings — at the three scopes the CLI itself reads from: your home directory, the project, and the project-local override. The same files you already have, just no longer edited blind.',
    inApp: [
      'One editor per surface, with the active scope always visible',
      'Register an MCP server and confirm it actually connected',
      'Tighten permissions instead of switching the guardrail off',
    ],
    flow: ['Choose the scope', 'Edit the real file', 'Every session picks it up'],
    chips: ['Three scopes', 'Schema-validated', 'Your own files'],
    chapter: {
      title: 'Settings & Scopes — editing the substrate, not the conversation',
      teaches: [
        'Which scope a change really belongs at',
        'Why per-task behaviour is a persona or a mission, not a setting',
        'The permission rules that stop the interruptions safely',
      ],
    },
  },
  {
    key: 'voice',
    title: 'Voice',
    tagline: 'Push-to-talk, straight into any session.',
    body: 'Dictate instructions instead of typing them. Transcription runs locally — nothing leaves your machine. Hold a key, talk, and it lands in the session exactly like typed input would.',
    inApp: [
      'Push-to-talk into whichever session is focused',
      'Local transcription, no audio uploaded anywhere',
      'A recording indicator that nothing in the app can paint over',
    ],
    flow: ['Hold the key', 'Speak', 'It lands as typed input'],
    chips: ['Offline', 'Push-to-talk', 'Always-visible indicator'],
    chapter: {
      title: 'Voice Input — dictate into any session, offline',
      teaches: [
        'Getting the model and the mic set up once',
        'Dictation habits that survive a long instruction',
        'What the privacy indicator guarantees',
      ],
    },
  },
  {
    key: 'cockpit',
    title: 'Everything, one cockpit',
    tagline: 'One left-nav instead of a folder of dotfiles.',
    body: 'Dashboard, project brief, sessions, scheduler, file explorer, history, memory, agent and tag libraries, skills, plugins, MCP servers, hooks, permissions, settings and voice — every surface in one app you actually remember to open.',
    inApp: [
      'A Home face for the machine, a Project face for the work',
      'Simple mode boots one chrome-free terminal and nothing else',
      'Install with one npx command, no account and no licence key',
    ],
    flow: ['One npx command', 'One left-nav', 'Nothing gated, ever'],
    chips: ['Free forever', 'Local-only', 'macOS + Linux'],
    chapter: {
      title: 'Getting Started — the 10-minute setup',
      teaches: [
        'The order to set things up in so nothing fights you later',
        'The first week of habits that make the rest pay off',
        'What to reach for when something looks stuck',
      ],
    },
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

/**
 * The feature detail tile.
 *
 * The previous version was a centred three-line block inside a full-height
 * card, which left most of the tile empty — the panel is sized by the viewport
 * lock above it, so short copy reads as a layout bug rather than as brevity.
 * It now carries the two halves of the pitch side by side: what the free app
 * does (left, the wide column) and what the paid chapter teaches about doing it
 * well (right, the narrower card). Same height, real content.
 *
 * `overflow-y-auto` on the left column is the escape valve for the height
 * lock — a long feature scrolls inside its own tile instead of pushing the
 * single-viewport page taller.
 */
function FeaturePanel({ feature }: { feature: Feature }) {
  return (
    <div className="grid min-h-0 flex-1 gap-5 rounded-2xl border border-warm-200 bg-warm-50/60 p-6 md:grid-cols-[minmax(0,1fr)_290px]">
      <div className="flex min-h-0 flex-col justify-between gap-4 overflow-y-auto">
        <div className="text-[10.5px] font-bold uppercase tracking-wide text-fire-500">
          {feature.title}
        </div>
        <h2 className="mt-1.5 text-xl font-semibold leading-snug text-warm-900 md:text-2xl">
          {feature.tagline}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-warm-500">{feature.body}</p>

        <ul className="space-y-2">
          {feature.inApp.map((line) => (
            <li key={line} className="flex gap-2.5 text-[13.5px] leading-snug text-warm-700">
              <span
                aria-hidden="true"
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-fire-500"
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-1.5">
          {feature.chips.map((chip) => (
            <span
              key={chip}
              className="rounded-md border border-warm-200 bg-white px-2 py-1 text-[11px] font-medium text-warm-500"
            >
              {chip}
            </span>
          ))}
        </div>

        {/*
          The tile is sized by the viewport lock, not by its copy, so the
          bottom third was dead space on every feature. This three-beat strip
          fills it with the one thing a feature list never says out loud: the
          shape of actually using the thing, start to finish.
        */}
        <ol className="grid grid-cols-1 gap-2 rounded-xl border border-warm-200 bg-white p-3 pt-3 sm:grid-cols-3">
          {feature.flow.map((step, i) => (
            <li key={step} className="flex items-start gap-2.5">
              <span
                aria-hidden="true"
                className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fire-50 text-[10.5px] font-bold text-fire-600"
              >
                {i + 1}
              </span>
              <span className="text-[12px] font-medium leading-snug text-warm-700">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <aside className="flex min-h-0 flex-col justify-between gap-3 overflow-y-auto rounded-xl border border-warm-200 bg-white p-4">
        <div className="text-[10px] font-bold uppercase tracking-wide text-warm-400">
          In the field manual
        </div>
        <h3 className="mt-1.5 text-[13.5px] font-semibold leading-snug text-warm-900">
          {feature.chapter.title}
        </h3>
        <ul className="space-y-2 border-t border-warm-100 pt-3">
          {feature.chapter.teaches.map((line) => (
            <li key={line} className="flex gap-2 text-[12.5px] leading-snug text-warm-500">
              <span aria-hidden="true" className="text-fire-400">
                ✦
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <a
          href="/manual"
          className="text-[12px] font-semibold text-fire-600 underline underline-offset-2 hover:text-fire-700"
        >
          Read a chapter free →
        </a>
      </aside>
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
    <div className="flex min-h-[100dvh] flex-col bg-white md:[@media(min-height:880px)]:h-[100dvh] md:[@media(min-height:880px)]:overflow-hidden">
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
              Sessions, a scheduler that works around your token window, memory, history and every
              Claude Code config surface — one desktop app, running on your machine.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-warm-900">
              <strong className="font-semibold">The app is free, and stays free.</strong> The Field
              Manual is the strategy guide that goes with it — the routes we already walked, so you
              don't have to find them the slow way.
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

          <FeaturePanel feature={active} />
        </section>
      </main>
    </div>
  );
}
