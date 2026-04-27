import { LISTING_TOOLS, type ToolDefinition } from '../config/tools.js';

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

export interface SkillGroup {
  group: string;
  items: readonly string[];
}

const KIND_LABELS: Record<string, string> = {
  business: 'Productivity',
  content: 'Content & Copy',
  devtools: 'Developer Tool',
};

const COLORS: ReadonlyArray<'tang' | 'ink' | 'blue'> = ['tang', 'ink', 'blue'];

function statusOf(t: ToolDefinition): PortfolioProject['status'] {
  if (t.status === 'live') return 'Live';
  if (t.status === 'beta') return 'Shipped';
  return 'Cooking';
}

function tagsOf(t: ToolDefinition): readonly string[] {
  if (t.features?.length) return t.features.slice(0, 2);
  return [];
}

const PROJECT_COUNT = LISTING_TOOLS.length;

export const PORTFOLIO_PROJECTS: readonly PortfolioProject[] = LISTING_TOOLS.map((t, i) => ({
  id: t.slug,
  name: t.name,
  kind: KIND_LABELS[t.category] ?? t.category,
  year: t.status === 'coming-soon' ? 2026 : 2025,
  status: statusOf(t),
  blurb: t.tagline,
  tags: tagsOf(t),
  color: COLORS[i % COLORS.length],
  href: `/products/${t.slug}`,
}));

export const SECTIONS: readonly Section[] = [
  { id: 'home',      label: 'Home',        path: '/',          icon: '✦', desc: "Who Bilko is and what he's building right now.", tag: 'start here' },
  { id: 'projects',  label: 'Projects',    path: '/projects',  icon: '◐', desc: 'Shipped work — productivity tools, AI experiments, side quests.', tag: `${PROJECT_COUNT} shipped` },
  { id: 'studio',    label: 'Game Studio', path: '/studio',    icon: '◆', desc: 'Small, weird, playable games. Browser-first.', tag: '1 playable' },
  { id: 'blog',      label: 'Blog',        path: '/blog',      icon: '❡', desc: 'Notes from the workshop. AI, craft, and rough thinking out loud.', tag: 'weekly' },
  { id: 'skills',    label: 'AI Skills',   path: '/skills',    icon: '◈', desc: 'What Bilko is fluent in — models, frameworks, patterns.', tag: 'the kit' },
  { id: 'academy',   label: 'Academy',     path: '/academy',   icon: '▲', desc: 'Structured AI learning paths. Free, opinionated.', tag: '5 levels' },
  { id: 'workflows', label: 'Workflows',   path: '/workflows', icon: '↯', desc: 'Background AI agents and automations running 24/7.', tag: 'running' },
  { id: 'contact',   label: 'Contact',     path: '/contact',   icon: '✎', desc: 'Say hi. Pitch a collab. Send a bug.', tag: 'open' },
];

export const GAMES: readonly PortfolioGame[] = [
  { id: 'game-academy', name: 'Boat Shooter', genre: 'Arcade',     plays: 'live', blurb: 'Browser-first arcade shooter. First entry in the Game Academy series.', color: 'tang', href: '/projects/game-academy/' },
  { id: 'midnight-router', name: 'Midnight Router', genre: 'Puzzle',     plays: 'soon', blurb: 'Route signals across a sleeping city before sunrise.', color: 'blue' },
  { id: 'echo-chamber',    name: 'Echo Chamber',    genre: 'Audio',      plays: 'soon', blurb: 'Match shapes by what they sound like.',                color: 'ink'  },
];

export const SKILLS: readonly SkillGroup[] = [
  { group: 'Models',      items: ['Gemini 2.0 Flash', 'Claude', 'GPT-4o', 'Llama', 'Gemma 2B (WebGPU)'] },
  { group: 'Frameworks',  items: ['React 18', 'TypeScript', 'Vite', 'Tailwind v4', 'Fastify'] },
  { group: 'AI Patterns', items: ['Typed JSON outputs', 'Local-first inference', 'Token credit metering', 'Cross-tool promotion', 'Roast comedy as UX'] },
  { group: 'Infra',       items: ['Turso / libSQL', 'Stripe (one-off credits)', 'Clerk auth', 'Render auto-deploy', 'WebGPU + WebLLM'] },
  { group: 'Soft',        items: ['Shipping weekly', 'Building in public', 'Loud thinking', 'Roasting my own prompts'] },
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
  `Shipping the ${PROJECT_COUNT}-tool Bilko platform`,
  'Cooking AgentTrace (local agent observability)',
  'Reading: "Designing Data-Intensive Applications"',
  'Building in public — see Blog',
];

export const TICKER_ITEMS: readonly string[] = [
  `${PROJECT_COUNT} AI tools shipped`,
  'PageRoast — live',
  'OutdoorHours — KOUT-7 weather report',
  'LocalScore — runs in your browser, never sees data',
  'Game Academy: Boat Shooter playable',
  'Open to collaborations',
  'Listening to: Aphex Twin',
];
