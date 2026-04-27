/**
 * Single source of truth for ALL projects shown on bilko.run
 * (portfolio listing, homepage "Recent builds", ⌘K command palette).
 *
 * A "project" can live in three places:
 *
 *   1. In-repo React route — the project is a React page in this monorepo,
 *      sharing auth/DB/Stripe. Used for the AI tools.
 *      host: { kind: 'react-route', path: '/products/<slug>' }
 *
 *   2. Static path — the project is built in its OWN git repo (often via a
 *      separate Claude session) and dropped into `public/projects/<slug>/`
 *      of this repo. The static files are served directly; no React route.
 *      host: { kind: 'static-path', path: '/projects/<slug>/' }
 *
 *   3. External URL — the project is hosted on a different domain or
 *      subdomain. Used for things like docs sites or marketing pages.
 *      host: { kind: 'external-url', url: 'https://...' }
 *
 * Adding a new standalone project:
 *   - Build it in its own repo (its own Claude session, its own git).
 *   - Output static assets and copy/sync them into `public/projects/<slug>/`.
 *   - Add one entry to PROJECTS below with kind: 'static-path'.
 */

import { LISTING_TOOLS, type ToolDefinition } from '../config/tools.js';

export type ProjectStatus = 'live' | 'cooking' | 'archived';

export type ProjectHost =
  | { kind: 'react-route'; path: string }
  | { kind: 'static-path'; path: string; sourceRepo?: string; localPath?: string }
  | { kind: 'external-url'; url: string };

export interface Project {
  slug: string;
  name: string;
  tagline: string;
  /** Display category — "AI Tool", "Game", "Data", "Productivity", etc. */
  category: string;
  status: ProjectStatus;
  year: number;
  host: ProjectHost;
  tags?: readonly string[];
  /** Optional cover image URL/path. */
  thumbnail?: string;
}

const TOOL_CATEGORY_LABEL: Record<ToolDefinition['category'], string> = {
  business: 'AI Tool · Productivity',
  content: 'AI Tool · Content',
  devtools: 'AI Tool · Dev',
};

function statusOf(t: ToolDefinition): ProjectStatus {
  if (t.status === 'live') return 'live';
  if (t.status === 'beta') return 'live';
  return 'cooking';
}

/* ── Tools registered in this monorepo (React routes) ─────────────── */
const TOOL_PROJECTS: readonly Project[] = LISTING_TOOLS.map(t => ({
  slug: t.slug,
  name: t.name,
  tagline: t.tagline,
  category: TOOL_CATEGORY_LABEL[t.category] ?? 'AI Tool',
  status: statusOf(t),
  year: t.status === 'coming-soon' ? 2026 : 2025,
  host: { kind: 'react-route' as const, path: `/products/${t.slug}` },
  tags: t.features?.slice(0, 2) ?? [],
}));

/* ── Standalone projects (static-path or external) ────────────────── */
const STANDALONE_PROJECTS: readonly Project[] = [
  {
    slug: 'game-academy',
    name: 'Boat Shooter',
    tagline: 'Browser arcade shooter — first entry in the Bilko Game Academy.',
    category: 'Game',
    status: 'live',
    year: 2026,
    host: {
      kind: 'static-path',
      path: '/projects/game-academy/',
      sourceRepo: 'github.com/StanislavBG/Bilko-Game-Academy',
      localPath: '~/Projects/Bilko-Game-Academy',
    },
    tags: ['Canvas', 'Arcade'],
  },
];

/** Every project on bilko.run, regardless of where it's hosted. */
export const PROJECTS: readonly Project[] = [
  ...STANDALONE_PROJECTS,
  ...TOOL_PROJECTS,
];

export const LIVE_PROJECTS: readonly Project[] = PROJECTS.filter(p => p.status === 'live');
export const COOKING_PROJECTS: readonly Project[] = PROJECTS.filter(p => p.status === 'cooking');

/** Resolve a project's primary URL/path for navigation. */
export function projectHref(p: Project): string {
  switch (p.host.kind) {
    case 'react-route':  return p.host.path;
    case 'static-path':  return p.host.path;
    case 'external-url': return p.host.url;
  }
}

/** True if navigating to this project keeps the SPA mounted (no full reload). */
export function isReactRoute(p: Project): boolean {
  return p.host.kind === 'react-route';
}
