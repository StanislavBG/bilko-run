/**
 * View model for the combined Projects + Packages hub (`/projects`).
 *
 * Merges three sources into one sorted list of HubCards:
 *   - PROJECTS         (registry: static-path / react-route / external apps)
 *   - PACKAGES         (npm CLIs & libraries)
 *   - commit-order.json (slug → last-commit ISO, baked by
 *                        scripts/refresh-commit-order.ts; see that file for why)
 *
 * Public visitors see only PUBLIC_SLUGS. The admin (Clerk email in ADMIN_EMAILS)
 * gets a toggle that reveals every card. Cards are ordered most-recently-worked
 * first, so the list is a living "what's hot" leaderboard.
 *
 * Dedup rule: a slug present in BOTH a project and a package renders as a single
 * project card that also carries the package's npm/github/install links
 * (e.g. session-manager, stepproof). Project wins; package metadata is merged in.
 */
import { PROJECTS, projectHref, isReactRoute, type Project } from './projectsRegistry.js';
import { PACKAGES, type Package } from './packages.js';
import commitOrder from './commit-order.json' with { type: 'json' };

const COMMIT_ORDER = commitOrder as Record<string, string>;

/** Cards everyone sees. Everything else is admin-only behind the toggle. */
export const PUBLIC_SLUGS: ReadonlySet<string> = new Set([
  // 5 named projects
  'session-manager',
  'social-signals-trader',
  'mcp-host',
  'outdoor-hours',
  'git-viewer',
  // flagship public packages
  'bilko-flow',
]);

/** Display-name overrides for the hub only (keeps registry names stable for
 *  HomePage / ⌘K / sanity-qa targets). */
const DISPLAY_NAME: Record<string, string> = {
  'git-viewer': 'Git Viewer',
  'outdoor-hours': 'Weather',
};

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
  /** Rich-row enrichment (from ENRICH below). Absent → row cell is omitted. */
  metric?: string;
  metricLabel?: string;
  lang?: string;
  /** Longer story shown in the expanded drawer; falls back to blurb. */
  detail?: string;
}

/**
 * Per-project enrichment for the rich hub rows (headline metric, primary
 * language, expanded-drawer story). Keyed by slug; any project absent here
 * still renders — the metric/lang cells just collapse. Display-only; the
 * canonical project facts stay in standalone-projects.json / packages.ts.
 */
interface Enrich { metric: string; metricLabel: string; lang: string; detail: string; }
const ENRICH: Record<string, Enrich> = {
  'git-viewer': {
    metric: '12 repos', metricLabel: 'indexed', lang: 'TypeScript',
    detail: 'Pulls every public repo, scores it by recency and activity, and renders a living portfolio. No manual upkeep — push code, the dashboard updates itself.',
  },
  'session-manager': {
    metric: '240+', metricLabel: 'sessions tracked', lang: 'TypeScript',
    detail: 'A terminal cockpit that lists, resumes, and diffs Claude Code sessions. Bookmarks, search, and a timeline so you never lose a thread mid-build.',
  },
  'social-signals-trader': {
    metric: '10', metricLabel: 'subreddits', lang: 'Python',
    detail: 'Agents read sentiment across ten subreddits, place trades, and publish every position live. Wins and losses both — radical transparency as a feature.',
  },
  'mcp-host': {
    metric: 'live', metricLabel: 'registry', lang: 'TypeScript',
    detail: 'A Model Context Protocol host so Claude sessions across sibling repos can discover and call one another. Shared tools, shared memory, no copy-paste.',
  },
  'outdoor-hours': {
    metric: '10 yrs', metricLabel: 'of data', lang: 'Python',
    detail: 'A comfort index that scores a decade of weather data into "comfortable hours" per place. Find where the year is actually pleasant, not just warm.',
  },
  'bilko-flow': {
    metric: 'I1–I7', metricLabel: 'steel frame', lang: 'TypeScript',
    detail: 'Describe a goal in plain language; bilko-flow compiles it into a typed, DAG-validated workflow that runs the same way every time. The engine behind the studio.',
  },
};

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
    name: DISPLAY_NAME[p.slug] ?? p.name,
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
    isPublic: PUBLIC_SLUGS.has(p.slug),
    ...ENRICH[p.slug],
  };
}

function packageCard(pkg: Package): HubCard {
  return {
    slug: pkg.slug,
    name: DISPLAY_NAME[pkg.slug] ?? pkg.name,
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
    isPublic: PUBLIC_SLUGS.has(pkg.slug),
    ...ENRICH[pkg.slug],
  };
}

/**
 * Every hub card, deduped (project wins) and sorted most-recent-commit first.
 * Complexity: O(n log n) for the sort over n≈30 cards — n is small/constant.
 */
export const HUB_CARDS: readonly HubCard[] = (() => {
  const projectSlugs = new Set(PROJECTS.map(p => p.slug));
  const cards: HubCard[] = [
    ...PROJECTS.map(projectCard),
    // Internal-infra packages (e.g. host-kit) never appear in the hub.
    ...PACKAGES.filter(pkg => !pkg.internal && !projectSlugs.has(pkg.slug)).map(packageCard),
  ];
  return cards.sort((a, b) => b.lastCommitAt - a.lastCommitAt);
})();

export const PUBLIC_CARDS: readonly HubCard[] = HUB_CARDS.filter(c => c.isPublic);
