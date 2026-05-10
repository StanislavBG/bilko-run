import { PROJECTS, type Project, projectHref, isReactRoute } from './projectsRegistry.js';
import { PACKAGES } from './packages.js';

export interface Section {
  id: string;
  label: string;
  /** React-Router path used for active-state matching. */
  path: string;
  /**
   * When set, clicking this nav item navigates to this URL via a full-page
   * navigation (<a href>) rather than a React-Router push. Use for
   * static-path siblings that live outside the host SPA.
   */
  href?: string;
  icon: string;
  desc: string;
  tag: string;
}

export interface PortfolioProject {
  id: string;
  name: string;
  kind: string;
  year: number;
  status: 'Live' | 'Shipped' | 'Cooking';
  blurb: string;
  tags: readonly string[];
  color: 'tang' | 'ink' | 'blue';
  href: string;
  /** True for in-repo React routes, false for static paths / external URLs. */
  isInternal: boolean;
}

export interface PortfolioGame {
  id: string;
  name: string;
  genre: string;
  plays: string;
  blurb: string;
  color: 'tang' | 'ink' | 'blue';
  href?: string;
}

export interface AcademyLevel {
  n: number;
  name: string;
  desc: string;
}

export interface Workflow {
  id: string;
  name: string;
  cadence: string;
  desc: string;
  /** Public destination this workflow posts into, if any. */
  output?: { label: string; href: string };
}

export interface Channel {
  id: string;
  label: string;
  handle: string;
  href: string;
  kind: 'x' | 'facebook' | 'blog';
}

const COLORS: ReadonlyArray<'tang' | 'ink' | 'blue'> = ['tang', 'ink', 'blue'];

function statusLabel(p: Project): PortfolioProject['status'] {
  if (p.status === 'live')    return 'Live';
  if (p.status === 'cooking') return 'Cooking';
  return 'Shipped';
}

export const PORTFOLIO_PROJECTS: readonly PortfolioProject[] = PROJECTS.map((p, i) => ({
  id: p.slug,
  name: p.name,
  kind: p.category,
  year: p.year,
  status: statusLabel(p),
  blurb: p.tagline,
  tags: p.tags ?? [],
  color: COLORS[i % COLORS.length],
  href: projectHref(p),
  isInternal: isReactRoute(p),
}));

const PROJECT_COUNT = PORTFOLIO_PROJECTS.length;
const LIVE_COUNT = PORTFOLIO_PROJECTS.filter(p => p.status === 'Live').length;
const GAME_COUNT = PROJECTS.filter(p => p.category?.includes('Game') && p.status === 'live').length;

export const SECTIONS: readonly Section[] = [
  { id: 'home',      label: 'Home',        path: '/',          icon: '✦', desc: "Who Bilko is and what he's building right now.", tag: 'start here' },
  { id: 'projects',  label: 'Projects',    path: '/projects',  icon: '◐', desc: 'Shipped work — productivity tools, AI experiments, side quests.', tag: `${LIVE_COUNT} live` },
  { id: 'packages',  label: 'Packages',    path: '/packages',  icon: '⊟', desc: 'Open-source CLI tools and libraries — npm install and use locally.', tag: `${PACKAGES.length} live` },
  { id: 'games',     label: 'Games',       path: '/games',     icon: '◈', desc: 'A small arcade of free, ad-free browser games.', tag: `${GAME_COUNT} live` },
  { id: 'studio',    label: 'Game Studio', path: '/studio',    icon: '◆', desc: 'Small, weird, playable games. Browser-first.', tag: '1 playable' },
  { id: 'blog',      label: 'Blog',        path: '/blog',      icon: '❡', desc: 'Notes from the workshop. AI, craft, and rough thinking out loud.', tag: 'weekly' },
  { id: 'academy',   label: 'Academy',     path: '/academy',   href: '/projects/academy/', icon: '▲', desc: 'Three-module AI fundamentals. Free, ad-free, every claim cited.', tag: '3 modules' },
  { id: 'workflows', label: 'Workflows',   path: '/workflows', icon: '↯', desc: 'Background AI agents and automations running 24/7.', tag: 'running' },
  { id: 'contact',   label: 'Contact',     path: '/contact',   icon: '✎', desc: 'Say hi. Pitch a collab. Send a bug.', tag: 'open' },
];

export const GAMES: readonly PortfolioGame[] = [
  { id: 'game-academy',    name: 'Boat Shooter',    genre: 'Arcade', plays: 'live', blurb: 'Browser-first arcade shooter. First entry in the Game Academy series.', color: 'tang', href: '/projects/game-academy/' },
  { id: 'midnight-router', name: 'Midnight Router', genre: 'Puzzle', plays: 'soon', blurb: 'Route signals across a sleeping city before sunrise.',                  color: 'blue' },
  { id: 'echo-chamber',    name: 'Echo Chamber',    genre: 'Audio',  plays: 'soon', blurb: 'Match shapes by what they sound like.',                                color: 'ink'  },
];

export const ACADEMY_LEVELS: readonly AcademyLevel[] = [
  { n: 1, name: 'Beginner',    desc: 'What an LLM actually is. No mystique.' },
  { n: 2, name: 'Conversant',  desc: 'Prompting, context, and when to give up.' },
  { n: 3, name: 'Builder',     desc: 'Wiring models into real apps. Typed outputs, retries, cost.' },
  { n: 4, name: 'Operator',    desc: 'Background agents, n8n, observability.' },
  { n: 5, name: 'Architect',   desc: 'Rules-first systems that scale to many flows.' },
];

// Real pipelines orchestrated by Burrow (local-first agent at ~/Projects/burrow).
// Cron tick every 5min picks the highest-priority overdue pipeline; cadences below
// are target intervals enforced by the scheduler, not fixed clocks.
export const WORKFLOWS: readonly Workflow[] = [
  { id: 'wf-orch',        name: 'Orchestrator tick',     cadence: 'every 5 min',  desc: 'Cron-driven scheduler. Picks the highest-priority overdue pipeline, claims the browser lock, runs it.' },
  { id: 'wf-keepalive',   name: 'Browser keepalive',     cadence: 'every 12 min', desc: 'Keeps the headed Chromium session warm so social pipelines never cold-start a login.' },
  { id: 'wf-reddit',      name: 'Reddit session',        cadence: 'every ~3h',    desc: 'Human-paced scroll across 78 subreddits. Captures, classifies, drafts replies via Claude.' },
  { id: 'wf-x',           name: 'X session',             cadence: 'every ~3h',    desc: 'Scroll, draft post, high-opportunity replies. Daily caps: 1 reply, 1 post.', output: { label: 'Follow @BilkoBibitkov', href: 'https://x.com/BilkoBibitkov' } },
  { id: 'wf-linkedin',    name: 'LinkedIn session',      cadence: 'every ~12h',   desc: 'Gather-only mode while the algorithm penalty cools off. Captures feed into the brain.' },
  { id: 'wf-fb-football', name: 'FB Football news',      cadence: 'every ~6h',    desc: 'Posts as European Football Daily. Web-search sourcing + image-gen via Gemini.', output: { label: 'Follow European Football Daily', href: 'https://www.facebook.com/profile.php?id=61587170666602' } },
  { id: 'wf-fb-bilko',    name: 'FB Bilko post',         cadence: 'every ~24h',   desc: 'Posts as Bilko Bibitkov page. AI-education micro-essays with generated imagery.', output: { label: 'Follow Bilko Bibitkov', href: 'https://www.facebook.com/profile.php?id=61586788196871' } },
  { id: 'wf-index',       name: 'Knowledge indexer',     cadence: 'every ~4h',    desc: 'Inbox → chunk → embed (nomic-embed-text-v1.5) → ChromaDB. Distills insights with Claude.' },
  { id: 'wf-sentiment',   name: 'Sentiment scoring',     cadence: 'every ~4h',    desc: 'Scores post sentiment across captured platforms into analytics.db.' },
  { id: 'wf-themes',      name: 'Themes extraction',     cadence: 'every ~4h',    desc: 'LLM-clusters daily themes from indexed chunks. Surfaces what the brain is talking about.' },
  { id: 'wf-stats',       name: 'Stats snapshot',        cadence: 'every ~6h',    desc: 'Daily metrics rolled into stats.db — posts, replies, follows, captures, brain growth.' },
  { id: 'wf-retention',   name: 'Capture retention',     cadence: 'weekly · Sun 5am', desc: 'Sweeps archived captures older than 30 days. Keeps the brain fresh.' },
];

export const WORKFLOWS_SUMMARY = {
  pipelinesCount: 12,
  channelsCount: 5,
  postingCadenceLine: '4 posts/day cap across X + Facebook · replies on human-paced scrolls',
  blurb:
    "Burrow is a local-first agent running on Bilko's machine. It drives a single headed Chromium session through Reddit, X, LinkedIn, and Facebook at human speed, drafts replies and posts via Claude, and keeps a 5,500+ chunk knowledge brain (ChromaDB + nomic embeddings). All output goes to the public channels below — that's where you'll see it.",
} as const;

export const CHANNELS: readonly Channel[] = [
  { id: 'x-bilko',     kind: 'x',        label: 'X · CEO / builder',         handle: '@BilkoBibitkov',         href: 'https://x.com/BilkoBibitkov' },
  { id: 'x-bglabs',    kind: 'x',        label: 'X · BG Labs',               handle: '@Bilko_BGLabs',          href: 'https://x.com/Bilko_BGLabs' },
  { id: 'fb-bilko',    kind: 'facebook', label: 'Facebook · Bilko Bibitkov', handle: 'Vibe Coding CEO',        href: 'https://www.facebook.com/profile.php?id=61586788196871' },
  { id: 'fb-football', kind: 'facebook', label: 'Facebook · Football',       handle: 'European Football Daily', href: 'https://www.facebook.com/profile.php?id=61587170666602' },
  { id: 'blog',        kind: 'blog',     label: 'Blog',                      handle: 'bilko.run/blog',         href: '/blog' },
];

export const NOW_ITEMS: readonly string[] = [
  `Shipping the ${PROJECT_COUNT}-project Bilko platform`,
  'Cooking AgentTrace (local agent observability)',
  'Game Academy: Boat Shooter live, more on the way',
  'Building in public — see Blog',
];

export const TICKER_ITEMS: readonly string[] = [
  `${LIVE_COUNT} projects live · ${PROJECT_COUNT} total`,
  'PageRoast — live',
  'OutdoorHours — KOUT-7 weather report',
  'LocalScore — runs in your browser, never sees data',
  'Game Academy: Boat Shooter playable',
  'Open to collaborations',
  'Listening to: Aphex Twin',
];
