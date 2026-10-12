/**
 * Public, machine-readable project catalog — the data behind
 * GET /api/projects and the public read-only MCP at /mcp.
 *
 * Built from PUBLIC_CARDS (projectsView.ts), so the API and the /projects page
 * can never disagree about which projects are public, their order, name, or
 * link. Contract (field names, schema_version bump rule): docs/host-contract.md
 * → "Public project catalog".
 *
 * Where to edit what:
 *   - Which projects are public: `public` in standalone-projects.json.
 *   - `detail` (drawer story): ENRICH in projectsView.ts.
 *   - `audience` / `talking_points` (how to talk about it): PROMO below.
 *     Talking points are read by social pipelines (Burrow) and may be stated
 *     publicly verbatim — keep each one a plain, checkable fact from the site.
 */
import { PUBLIC_CARDS, type HubCard } from './projectsView.js';

export const CATALOG_SCHEMA_VERSION = 1;
export const SITE_ORIGIN = 'https://bilko.run';

export interface CatalogProject {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  status: string;
  /** Absolute canonical link — the same destination as the /projects card. */
  url: string;
  tags: string[];
  /** Longer story (the /projects drawer); falls back to tagline. */
  detail: string;
  /** One line: who it is for. May be empty. */
  audience: string;
  /** Plain factual claims a promoter may state. May be empty. */
  talking_points: string[];
}

export interface Catalog {
  schema_version: number;
  generated_at: string;
  projects: CatalogProject[];
}

interface Promo { audience: string; talkingPoints: readonly string[]; }
const PROMO: Record<string, Promo> = {
  'git-viewer': {
    audience: 'Developers who want their GitHub activity to double as a portfolio.',
    talkingPoints: [
      'Turns your public GitHub repos into a public portfolio page.',
      'Ranks repos by recency and activity.',
      'Updates itself when you push code — no manual upkeep.',
    ],
  },
  'outdoor-hours': {
    audience: 'Anyone deciding where or when the weather is actually pleasant.',
    talkingPoints: [
      'Scores ten years of weather data into "comfortable hours" per place.',
      'Free to use in the browser.',
    ],
  },
  'session-manager': {
    audience: 'Developers who run Claude Code sessions every day.',
    talkingPoints: [
      'Free desktop app for managing Claude Code CLI sessions.',
      'Each session gets a persona and a mission.',
      'Has a scheduler that waits out your token limit and resumes work.',
      'Ships with a free Field Manual.',
    ],
  },
  academy: {
    audience: 'Non-technical people who want to understand AI from the ground up.',
    talkingPoints: [
      'Free, ad-free AI fundamentals course.',
      'Every claim in the course is cited.',
    ],
  },
  'social-signals-trader': {
    audience: 'People curious whether Reddit sentiment can drive real trades.',
    talkingPoints: [
      'Autonomous trading bots read sentiment across ten subreddits.',
      'Every position is published live — wins and losses.',
      'Results are compared against SPY on a public dashboard.',
    ],
  },
  'bilko-host': {
    audience: 'Developers running Claude Code who want to publish small apps to one host.',
    talkingPoints: [
      'An MCP server that lets Claude sessions register, publish, and inspect apps on bilko.run.',
      'Open source, in the bilko-run GitHub repo.',
    ],
  },
  'escape-velocity': {
    audience: 'Players who like short, keyboard-only arcade survivors runs.',
    talkingPoints: [
      'Keyboard-only space survivors game across all eight planets of the Solar System.',
      'Runs fully in the browser — no install.',
      'Progress saves locally.',
      'Free to play.',
    ],
  },
  'launch-kit': {
    audience: 'Solo builders using Claude Code who have a working product and need to launch it.',
    talkingPoints: [
      'Eight Claude skills that take a product from "it works" to launched.',
      '$9 one-time download.',
      'All eight skills share one context file; each writes one file and names the next skill to run.',
    ],
  },
};

function absoluteUrl(href: string): string {
  return href.startsWith('/') ? `${SITE_ORIGIN}${href}` : href;
}

function toCatalogProject(card: HubCard): CatalogProject {
  const promo = PROMO[card.slug];
  return {
    slug: card.slug,
    name: card.name,
    tagline: card.blurb,
    category: card.category,
    status: card.status,
    url: absoluteUrl(card.href ?? `/projects/${card.slug}/`),
    tags: [...card.tags],
    detail: card.detail ?? card.blurb,
    audience: promo?.audience ?? '',
    talking_points: [...(promo?.talkingPoints ?? [])],
  };
}

/** Public projects in /projects order. Static per deploy — computed once. */
export const CATALOG_PROJECTS: readonly CatalogProject[] = PUBLIC_CARDS.map(toCatalogProject);

export function buildCatalog(now: Date = new Date()): Catalog {
  return {
    schema_version: CATALOG_SCHEMA_VERSION,
    generated_at: now.toISOString(),
    projects: CATALOG_PROJECTS.map(p => ({ ...p, tags: [...p.tags], talking_points: [...p.talking_points] })),
  };
}

/** A public project by slug, or undefined (unknown and non-public alike). */
export function findCatalogProject(slug: string): CatalogProject | undefined {
  return CATALOG_PROJECTS.find(p => p.slug === slug);
}
