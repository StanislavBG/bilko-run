/**
 * Every project shown on bilko.run (/projects, homepage, ⌘K palette).
 *
 * Where to edit what:
 *   - Add / change / remove a project: use the bilko-host MCP, which edits
 *     src/data/standalone-projects.json. Don't hand-edit it from a sibling repo.
 *   - Public visibility (`public`) and hub display name (`displayName`) are
 *     optional fields on the entry in src/data/standalone-projects.json.
 *   - Adjust hub enrichment (metric, language, detail): src/data/projectsView.ts — ENRICH.
 *   - Host kinds (static-path / external-url / react-route): docs/host-contract.md.
 *
 * The only code-level exception is SPA_ROUTE_OVERRIDES below.
 */

import type {
  ProjectStatus,
  RegistryProject,
} from '../../mcp-host-server/src/contract/registry.js';

export type { ProjectStatus };

export type ProjectHost = RegistryProject['host'] | { kind: 'react-route'; path: string };

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
  /** Listed on the public /projects hub (others are admin-only). */
  public?: boolean;
  /** Hub-only name override; registry `name` stays stable elsewhere. */
  displayName?: string;
}

/* ── Standalone projects (static-path or external) ────────────────── */
// Sourced from a JSON sidecar so the bilko-host MCP server can edit it
// safely from sibling-repo Claude sessions without touching TS source.
// See mcp-host-server/ for the register/publish/unregister tools.
import standaloneJson from './standalone-projects.json' with { type: 'json' };
const STANDALONE_PROJECTS: readonly RegistryProject[] = standaloneJson as readonly RegistryProject[];

/**
 * Slugs whose card opens an in-repo React page instead of the JSON entry's
 * host. session-manager's app is a static-path sibling, but its landing page
 * is the react-route /products/session-manager.
 */
const SPA_ROUTE_OVERRIDES: Readonly<Record<string, string>> = {
  'session-manager': '/products/session-manager',
};

/** Every project on bilko.run, regardless of where it's hosted. */
export const PROJECTS: readonly Project[] = STANDALONE_PROJECTS.map(p => {
  const path = SPA_ROUTE_OVERRIDES[p.slug];
  return path ? { ...p, host: { kind: 'react-route' as const, path } } : p;
});


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
