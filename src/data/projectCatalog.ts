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
 *   - Card content (`detail`, `audience`, `talking_points`): the entry's
 *     `listing` block in standalone-projects.json, edited by the owning
 *     sibling through the bilko-host MCP.
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

function absoluteUrl(href: string): string {
  return href.startsWith('/') ? `${SITE_ORIGIN}${href}` : href;
}

function toCatalogProject(card: HubCard): CatalogProject {
  return {
    slug: card.slug,
    name: card.name,
    tagline: card.blurb,
    category: card.category,
    status: card.status,
    url: absoluteUrl(card.href ?? `/projects/${card.slug}/`),
    tags: [...card.tags],
    detail: card.detail ?? card.blurb,
    audience: card.audience ?? '',
    talking_points: [...(card.talkingPoints ?? [])],
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
