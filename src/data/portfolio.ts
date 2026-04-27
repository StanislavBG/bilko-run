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
}

export interface PortfolioGame {
  id: string;
  name: string;
  genre: string;
  plays: string;
  blurb: string;
  color: 'tang' | 'ink' | 'blue';
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

export const SECTIONS: readonly Section[] = [
  { id: 'home',      label: 'Home',        path: '/',          icon: '✦', desc: "Who Bilko is and what he's building right now.", tag: 'start here' },
  { id: 'projects',  label: 'Projects',    path: '/projects',  icon: '◐', desc: 'Shipped work — productivity tools, AI experiments, side quests.', tag: '12 shipped' },
  { id: 'studio',    label: 'Game Studio', path: '/studio',    icon: '◆', desc: 'Small, weird, playable games. Browser-first.', tag: '3 playable' },
  { id: 'blog',      label: 'Blog',        path: '/blog',      icon: '❡', desc: 'Notes from the workshop. AI, craft, and rough thinking out loud.', tag: 'weekly' },
  { id: 'skills',    label: 'AI Skills',   path: '/skills',    icon: '◈', desc: 'What Bilko is fluent in — models, frameworks, patterns.', tag: 'the kit' },
  { id: 'academy',   label: 'Academy',     path: '/academy',   icon: '▲', desc: 'Structured AI learning paths. Free, opinionated.', tag: '5 levels' },
  { id: 'workflows', label: 'Workflows',   path: '/workflows', icon: '↯', desc: 'Background AI agents and automations running 24/7.', tag: 'running' },
  { id: 'contact',   label: 'Contact',     path: '/contact',   icon: '✎', desc: 'Say hi. Pitch a collab. Send a bug.', tag: 'open' },
];

export const PORTFOLIO_PROJECTS: readonly PortfolioProject[] = [
  { id: 'mental-gym',   name: 'Mental Gym',        kind: 'Conversational AI',   year: 2025, status: 'Live',    blurb: 'A conversational canvas where users learn AI by talking to Bilko.', tags: ['React','Gemini','Voice'], color: 'tang' },
  { id: 'flow-engine',  name: 'Flow Engine',       kind: 'Developer tool',      year: 2025, status: 'Live',    blurb: 'A typed flow runtime for LLM-powered apps. DAG-validated. ARCH-005 compliant.', tags: ['TypeScript','Zod','DAG'], color: 'ink' },
  { id: 'rules-os',     name: 'Rules OS',          kind: 'Methodology',         year: 2025, status: 'Live',    blurb: 'Governance-as-code. The rules ARE the product.', tags: ['Docs','CI','Audit'], color: 'blue' },
  { id: 'n8n-orch',     name: 'n8n Orchestrator',  kind: 'Infrastructure',      year: 2025, status: 'Live',    blurb: 'Single point-of-contact between platform and background agents.', tags: ['n8n','Express','PG'], color: 'tang' },
  { id: 'voice-ux',     name: 'Voice Turn-taking', kind: 'Research',            year: 2024, status: 'Shipped', blurb: 'A conversation-design context that handles barge-in and silence gracefully.', tags: ['WebSpeech','UX'], color: 'ink' },
  { id: 'topic-dedupe', name: 'Topic Dedupe',      kind: 'Content pipeline',    year: 2024, status: 'Shipped', blurb: 'Headline hashing across pipelines so the same idea never ships twice.', tags: ['Pipelines','Hash'], color: 'blue' },
  { id: 'smb-helper',   name: 'SMB Helper',        kind: 'Productivity',        year: 2026, status: 'Cooking', blurb: 'An AI ops sidekick for small businesses — invoices, replies, follow-ups.', tags: ['Soon'], color: 'tang' },
  { id: 'forum',        name: 'Builders Forum',    kind: 'Community',           year: 2026, status: 'Cooking', blurb: "Where users submit feedback, share builds, and roast each other's prompts.", tags: ['Soon'], color: 'ink' },
];

export const GAMES: readonly PortfolioGame[] = [
  { id: 'midnight-router', name: 'Midnight Router', genre: 'Puzzle',     plays: '1.2k', blurb: 'Route signals across a sleeping city before sunrise.', color: 'tang' },
  { id: 'tiny-empire',     name: 'Tiny Empire',     genre: 'Idle / sim', plays: '847',  blurb: 'Build a kingdom on a postage stamp.',                  color: 'blue' },
  { id: 'echo-chamber',    name: 'Echo Chamber',    genre: 'Audio',      plays: '412',  blurb: 'Match shapes by what they sound like.',                color: 'ink'  },
];

export const SKILLS: readonly SkillGroup[] = [
  { group: 'Models',      items: ['Gemini 2.5', 'Claude', 'GPT-4o', 'Llama', 'Local (Ollama)'] },
  { group: 'Frameworks',  items: ['React', 'TypeScript', 'Vite', 'Drizzle', 'Tailwind'] },
  { group: 'AI Patterns', items: ['Typed JSON outputs', 'Multi-agent flows', 'DAG validation', 'Conversational canvas', 'Voice turn-taking'] },
  { group: 'Infra',       items: ['n8n orchestration', 'PostgreSQL', 'Replit', 'Webhooks', 'Sharp'] },
  { group: 'Soft',        items: ['Writing rules first', 'Shipping weekly', 'Loud thinking', "Roasting my own prompts"] },
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
  'Building SMB Helper (productivity tool #2)',
  'Drafting forum architecture',
  'Reading: "Designing Data-Intensive Applications"',
  'Listening to a lot of Aphex Twin',
  'Slow week — recovering from a deploy',
];

export const TICKER_ITEMS: readonly string[] = [
  'Now building: SMB Helper',
  'Latest post: Why I write rules before code',
  '5 background workflows running',
  'Mental Gym → live',
  'Game Studio: 3 playable',
  'Open to collaborations',
  'Currently reading: DDIA',
  'Listening to: Aphex Twin',
];
