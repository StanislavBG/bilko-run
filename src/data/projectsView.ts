/**
 * View model for the combined Projects + Packages hub (`/projects`).
 *
 * Merges three sources into one sorted list of HubCards:
 *   - PROJECTS         (registry: static-path / react-route / external apps)
 *   - PACKAGES         (npm CLIs & libraries)
 *   - commit-order.json (slug → last-commit ISO, baked by
 *                        scripts/refresh-commit-order.ts; see that file for why)
 *
 * Public visitors see only projects with `public: true` in the registry. The admin (Clerk email in ADMIN_EMAILS)
 * gets a toggle that reveals every card. Cards are ordered by total commit count
 * descending (src/data/commit-counts.json, most-worked-on project first), ties
 * broken by last-commit date, so the list is a living "what's hot" leaderboard.
 * The commit count itself is a sort key only — it is never rendered.
 *
 * Dedup rule: a slug present in BOTH a project and a package renders as a single
 * project card that also carries the package's npm/github/install links
 * (e.g. session-manager, stepproof). Project wins; package metadata is merged in.
 */
import { PROJECTS, projectHref, isReactRoute, type Project } from './projectsRegistry.js';
import { PACKAGES, type Package } from './packages.js';
import commitOrder from './commit-order.json' with { type: 'json' };
import commitCounts from './commit-counts.json' with { type: 'json' };

const COMMIT_ORDER = commitOrder as Record<string, string>;
const COMMIT_COUNTS = commitCounts as Record<string, number>;

function commitCount(slug: string): number {
  return COMMIT_COUNTS[slug] ?? 0;
}

export interface HubCard {
  slug: string;
  name: string;
  blurb: string;
  category: string;
  /** 'live' | 'cooking' | 'postponed' | 'archived' | 'package' */
  status: Project['status'] | 'package';
  type: 'project' | 'package';
  /** Primary destination (project URL). Undefined for package-only cards. */
  href?: string;
  /** True if the primary href is an in-repo React route (SPA nav, no reload). */
  isInternal: boolean;
  tags: readonly string[];
  /** npm package extras, present when a package shares this slug. */
  npm?: string;
  github?: string;
  install?: string;
  /** Last-commit time as epoch ms; 0 when unknown (sorts last). */
  lastCommitAt: number;
  isPublic: boolean;
  /** Rich-row enrichment (from the registry entry's listing). Absent → row cell is omitted. */
  metric?: string;
  metricLabel?: string;
  lang?: string;
  /** Longer story shown in the expanded drawer; falls back to blurb. */
  detail?: string;
  /** One line: who it is for (from the registry listing). */
  audience?: string;
  /** Plain factual claims a promoter may state (from the registry listing). */
  talkingPoints?: readonly string[];
}

function commitMs(slug: string): number {
  const iso = COMMIT_ORDER[slug];
  return iso ? Date.parse(iso) : 0;
}

function fmtCommit(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function lastWorkedLabel(card: HubCard): string {
  return fmtCommit(card.lastCommitAt);
}

const pkgBySlug = new Map<string, Package>(PACKAGES.map(p => [p.slug, p]));

function projectCard(p: Project): HubCard {
  const pkg = pkgBySlug.get(p.slug);
  return {
    slug: p.slug,
    name: p.displayName ?? p.name,
    blurb: p.tagline,
    category: p.category,
    status: p.status,
    type: 'project',
    href: projectHref(p),
    isInternal: isReactRoute(p),
    tags: p.tags ?? [],
    npm: pkg?.npm,
    github: pkg?.github,
    install: pkg?.install,
    lastCommitAt: commitMs(p.slug),
    isPublic: p.public === true,
    metric: p.listing?.metric,
    metricLabel: p.listing?.metricLabel,
    lang: p.listing?.lang,
    detail: p.listing?.detail,
    audience: p.listing?.audience,
    talkingPoints: p.listing?.talkingPoints,
  };
}

function packageCard(pkg: Package): HubCard {
  return {
    slug: pkg.slug,
    name: pkg.name,
    blurb: pkg.description,
    category: pkg.category,
    status: 'package',
    type: 'package',
    href: pkg.github,
    isInternal: false,
    tags: [pkg.category, pkg.scope === 'paid' ? 'License' : 'MIT'],
    npm: pkg.npm,
    github: pkg.github,
    install: pkg.install,
    lastCommitAt: commitMs(pkg.slug),
    isPublic: false,
  };
}

/**
 * Every hub card, deduped (project wins) and sorted by total commit count
 * descending (missing slug counts as 0), ties broken by last-commit date.
 * Complexity: O(n log n) for the sort over n≈30 cards — n is small/constant.
 */
export const HUB_CARDS: readonly HubCard[] = (() => {
  const projectSlugs = new Set(PROJECTS.map(p => p.slug));
  const cards: HubCard[] = [
    ...PROJECTS.map(projectCard),
    // Internal-infra packages (e.g. host-kit) never appear in the hub.
    ...PACKAGES.filter(pkg => !pkg.internal && !projectSlugs.has(pkg.slug)).map(packageCard),
  ];
  return cards.sort((a, b) => commitCount(b.slug) - commitCount(a.slug) || b.lastCommitAt - a.lastCommitAt);
})();

export const PUBLIC_CARDS: readonly HubCard[] = HUB_CARDS.filter(c => c.isPublic);

/** Slugs of the public cards, in /projects order. Derived from the registry's
 *  `public` flag — edit standalone-projects.json, not this file. */
export const PUBLIC_SLUGS: ReadonlySet<string> = new Set(PUBLIC_CARDS.map(c => c.slug));
