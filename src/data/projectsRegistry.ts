/**
 * Every project shown on bilko.run (/projects, homepage, ⌘K palette).
 *
 * Where to edit what:
 *   - Add / change / remove a project: use the bilko-host MCP, which edits
 *     src/data/standalone-projects.json. Don't hand-edit it from a sibling repo.
 *   - Public visibility (`public`) and hub display name (`displayName`) are
 *     optional fields on the entry in src/data/standalone-projects.json.
 *   - Adjust hub enrichment (metric, language, detail): the entry's `listing` block via the bilko-host MCP.
 *   - Host kinds (static-path / external-url / react-route): docs/host-contract.md.
 *
 * The only code-level exception is SPA_ROUTE_OVERRIDES below.
 */

import type {
  ProjectStatus,
  Listing,
  RegistryProject,
} from '../../mcp-host-server/src/contract/registry.js';

export type { ProjectStatus };

export type ProjectHost = RegistryProject['host'] | { kind: 'react-route'; path: string };

export interface Project {
  slug: string;
  /** Project-owned card content; edited by the owning sibling via the bilko-host MCP */
  listing?: Listing;
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
  /** Listed on the public /projects hub (others are admin-only). */
  public?: boolean;
  /** Hub-only name override; registry `name` stays stable elsewhere. */
  displayName?: string;
}

/* ── Standalone projects (static-path or external) ────────────────── */
// Read from the Bilko-DB snapshot the server injects into the SPA shell, so a
// registry edit shows without a rebuild. The bundled JSON sidecar (edited by the
// bilko-host MCP) is the fallback when the page carries no snapshot.
import standaloneJson from './standalone-projects.json' with { type: 'json' };
const BUNDLED_PROJECTS: readonly RegistryProject[] = standaloneJson as readonly RegistryProject[];

/** Id of the JSON element the server puts in every SPA shell (server/registry-inject.ts). */
export const REGISTRY_ELEMENT_ID = 'bilko-registry';

/**
 * The live Bilko-DB registry the server injected into this page, or null when the page has no
 * such element (dev server, tests, prerender) or it does not hold a JSON array.
 */
export function readInjectedRegistry(doc: Document | undefined = globalThis.document): RegistryProject[] | null {
  const text = doc?.getElementById(REGISTRY_ELEMENT_ID)?.textContent;
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as RegistryProject[]) : null;
  } catch {
    return null;
  }
}

// The injected snapshot wins; the bundled file is only a fallback while it still exists.
const STANDALONE_PROJECTS: readonly RegistryProject[] = readInjectedRegistry() ?? BUNDLED_PROJECTS;

/**
 * Slugs whose card opens an in-repo React page instead of the JSON entry's
 * host. session-manager's app is a static-path sibling, but its landing page
 * is the react-route /products/session-manager.
 */
const SPA_ROUTE_OVERRIDES: Readonly<Record<string, string>> = {
  'session-manager': '/products/session-manager',
};

/** Registry entries as hub projects, with SPA_ROUTE_OVERRIDES applied. */
export function toProjects(entries: readonly RegistryProject[]): Project[] {
  return entries.map(p => {
    const path = SPA_ROUTE_OVERRIDES[p.slug];
    return path ? { ...p, host: { kind: 'react-route' as const, path } } : p;
  });
}

/** Every project on bilko.run, regardless of where it's hosted. */
export const PROJECTS: readonly Project[] = toProjects(STANDALONE_PROJECTS);


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
