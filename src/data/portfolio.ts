import { PROJECTS, type Project, projectHref, isReactRoute } from './projectsRegistry.js';

export interface Section {
  id: string;
  label: string;
  path: string;
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
  status: 'running' | 'idle';
  lastRun: string;
  runs: number;
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

export const SECTIONS: readonly Section[] = [
  { id: 'home',      label: 'Home',        path: '/',          icon: '✦', desc: "Who Bilko is and what he's building right now.", tag: 'start here' },
  { id: 'projects',  label: 'Projects',    path: '/projects',  icon: '◐', desc: 'Shipped work — productivity tools, AI experiments, side quests.', tag: `${LIVE_COUNT} live` },
  { id: 'studio',    label: 'Game Studio', path: '/studio',    icon: '◆', desc: 'Small, weird, playable games. Browser-first.', tag: '1 playable' },
  { id: 'blog',      label: 'Blog',        path: '/blog',      icon: '❡', desc: 'Notes from the workshop. AI, craft, and rough thinking out loud.', tag: 'weekly' },
  { id: 'academy',   label: 'Academy',     path: '/academy',   icon: '▲', desc: 'Structured AI learning paths. Free, opinionated.', tag: '5 levels' },
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

export const WORKFLOWS: readonly Workflow[] = [
  { id: 'wf-news',   name: 'Daily news digest',     status: 'running', lastRun: '2h ago',  runs: 142 },
  { id: 'wf-blog',   name: 'Blog draft pipeline',   status: 'running', lastRun: '12h ago', runs: 38 },
  { id: 'wf-social', name: 'Social cross-post',     status: 'running', lastRun: '1h ago',  runs: 261 },
  { id: 'wf-audit',  name: 'Rules audit (nightly)', status: 'idle',    lastRun: '8h ago',  runs: 89 },
  { id: 'wf-image',  name: 'Brand image batch',     status: 'running', lastRun: '20m ago', runs: 51 },
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
