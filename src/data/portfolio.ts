import { PROJECTS, type Project, projectHref, isReactRoute } from './projectsRegistry.js';

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
  status: 'Live' | 'Shipped' | 'Cooking' | 'Postponed';
  blurb: string;
  tags: readonly string[];
  color: 'tang' | 'ink' | 'blue';
  href: string;
  /** True for in-repo React routes, false for static paths / external URLs. */
  isInternal: boolean;
}


interface Channel {
  id: string;
  label: string;
  handle: string;
  href: string;
  kind: 'x' | 'facebook' | 'blog';
}

const COLORS: ReadonlyArray<'tang' | 'ink' | 'blue'> = ['tang', 'ink', 'blue'];

function statusLabel(p: Project): PortfolioProject['status'] {
  if (p.status === 'live')      return 'Live';
  if (p.status === 'cooking')   return 'Cooking';
  if (p.status === 'postponed') return 'Postponed';
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
  { id: 'projects',  label: 'Projects',    path: '/projects',  icon: '◐', desc: 'Live tools, games, and open-source packages — newest work on top.', tag: `${LIVE_COUNT} live` },
  { id: 'blog',      label: 'Blog',        path: '/blog',      icon: '❡', desc: 'Notes from the workshop. AI, craft, and rough thinking out loud.', tag: 'weekly' },
  { id: 'contact',   label: 'Contact',     path: '/contact',   icon: '✎', desc: 'Say hi. Pitch a collab. Send a bug.', tag: 'open' },
];

export const CHANNELS: readonly Channel[] = [
  { id: 'x-bilko',     kind: 'x',        label: 'X · CEO / builder',         handle: '@BilkoBibitkov',         href: 'https://x.com/BilkoBibitkov' },
  { id: 'x-bglabs',    kind: 'x',        label: 'X · BG Labs',               handle: '@Bilko_BGLabs',          href: 'https://x.com/Bilko_BGLabs' },
  { id: 'fb-bilko',    kind: 'facebook', label: 'Facebook · Bilko Bibitkov', handle: 'Vibe Coding CEO',        href: 'https://www.facebook.com/profile.php?id=61586788196871' },
  { id: 'fb-football', kind: 'facebook', label: 'Facebook · Football',       handle: 'European Football Daily', href: 'https://www.facebook.com/profile.php?id=61587170666602' },
  { id: 'blog',        kind: 'blog',     label: 'Blog',                      handle: 'bilko.run/blog',         href: '/blog' },
];

export const NOW_ITEMS: readonly string[] = [
  'Social Signals Trader running live, in public',
  'signal-builder split out into its own hosted MCP service',
  'Academy module 1s live; lesson backfill cooking',
  'New build log up on the blog',
];

export const TICKER_ITEMS: readonly string[] = [
  `${LIVE_COUNT} projects live · ${PROJECT_COUNT} total`,
  'OutdoorHours — KOUT-7 weather report',
  'Social Signals Trader — reading Reddit, trading in public',
  'Git Viewer — live dashboard of everything on GitHub',
  'Session Manager — schedules the whole studio',
  'Bilko Host MCP — the plumbing under bilko.run',
  'Open to collaborations',
  'Listening to: Aphex Twin',
];
