/**
 * View model for /workflows. The jobs come from src/data/workflows.json,
 * baked on the dev machine by scripts/refresh-workflows.ts (Render has no
 * crontab), so the page always renders from committed data.
 */
import workflowsData from './workflows.json' with { type: 'json' };
import { PUBLIC_SLUGS, PUBLIC_CARDS } from './projectsView.js';

export interface WorkflowJob {
  id: string;
  name: string;
  desc: string;
  cadence: string[];
  source: 'cron' | 'systemd' | 'github-actions';
  intervalMinutes: number | null;
  output?: { label: string; href: string };
}

export interface WorkflowGroup {
  slug: string;
  name: string;
  href?: string;
  mechanics: string;
  jobs: WorkflowJob[];
}

export interface WorkflowsData {
  generatedAt: string;
  groups: WorkflowGroup[];
}

/** Hub projects first, in PUBLIC_SLUGS (i.e. /projects) order; non-hub groups
 *  (blog, Burrow) keep their baked order after them. */
export function orderGroups(groups: readonly WorkflowGroup[], publicSlugs: ReadonlySet<string>): WorkflowGroup[] {
  const rank = [...publicSlugs];
  const hub = groups.filter(g => publicSlugs.has(g.slug)).sort((a, b) => rank.indexOf(a.slug) - rank.indexOf(b.slug));
  return [...hub, ...groups.filter(g => !publicSlugs.has(g.slug))];
}

export function formatInterval(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

export function workflowStats(groups: readonly WorkflowGroup[], publicSlugs: ReadonlySet<string>) {
  const jobs = groups.flatMap(g => g.jobs);
  const intervals = jobs.map(j => j.intervalMinutes).filter((n): n is number => n !== null);
  return {
    jobCount: jobs.length,
    projectCount: groups.filter(g => publicSlugs.has(g.slug)).length,
    fastest: intervals.length ? formatInterval(Math.min(...intervals)) : null,
  };
}

const DATA = workflowsData as WorkflowsData;

export const WORKFLOW_GROUPS: readonly WorkflowGroup[] = orderGroups(DATA.groups, PUBLIC_SLUGS);
export const WORKFLOW_STATS = workflowStats(WORKFLOW_GROUPS, PUBLIC_SLUGS);
export const WORKFLOWS_GENERATED_AT = DATA.generatedAt;

/** Public projects with no recurring job of their own. */
export const ON_DEMAND_PROJECTS: readonly { slug: string; name: string; href?: string }[] =
  PUBLIC_CARDS.filter(c => !DATA.groups.some(g => g.slug === c.slug))
    .map(c => ({ slug: c.slug, name: c.name, href: c.href }));
