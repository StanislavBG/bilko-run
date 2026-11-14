/**
 * Which projects a blog post may be about (blog-from-git rotation; owner rule 2026-11-05).
 *
 * A post's subject must be public on https://bilko.run/projects: a src/data/standalone-projects.json
 * entry with `public: true`, the same set GET /api/projects serves. Admin-only and untiled
 * projects are never a subject, in any mode. When Burrow passes a draft context (the
 * BLOG_DRAFT_CONTEXT file), its public_projects list is the public set and its blog_posts rows
 * (queued or published) count toward the cooldown alongside the ledger. An optional `brief` object
 * makes the slot an owner-commissioned post: brief.project must name one of public_projects, it
 * becomes the only candidate, and check refuses a post about any other project. Its other keys
 * (angle, sources, facts, links, avoid_claims) are for the draft prompt (scripts/blog-pipeline-lib.sh).
 *
 *   pnpm tsx scripts/blog-subjects.ts candidates --root <repo> [--slot <ISO>] [--context <file>]
 *   pnpm tsx scripts/blog-subjects.ts check --root <repo> --post <post.md> [--slot <ISO>] [--context <file>]
 *
 * candidates prints one JSON line {public, retired, cooling_off, candidates}, plus brief_project
 * when the context has a brief; candidates are ordered never-covered first, then longest since
 * last covered. Exit 0, or 3 when empty.
 * check prints the post's project and exits 0 when it is a candidate (the brief's project, when
 * there is a brief) and the post links no non-public project; otherwise prints the reason and
 * exits 1. Exit 2 = bad arguments or inputs, including a malformed brief.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSON_SCHEMA, load as loadYaml } from 'js-yaml';

export const REGISTRY_REL = 'src/data/standalone-projects.json';
export const CONFIG_REL = '.claude/skills/blog-from-git/blog.config.yaml';
export const LEDGER_REL = '.claude/skills/blog-from-git/blog-ledger.md';

export interface PublicProject {
  slug: string;
  name: string;
  url?: string;
}

/** One published or queued post: when it runs, its slug, and its project (null = unknown). */
export interface CoveredPost {
  date: string;
  slug: string;
  project: string | null;
}

/** The owner-commission brief from the draft context. Only `project` is used here. */
export interface DraftBrief {
  project: string;
}

export interface DraftContext {
  slotAt: string;
  rule: string;
  publicProjects: PublicProject[];
  blogPosts: CoveredPost[];
  brief: DraftBrief | null;
}

export interface RotationPolicy {
  cooldownPosts: number;
  retired: string[];
}

export interface Candidate {
  slug: string;
  name: string;
  url?: string;
  last_covered: string | null;
}

export interface SubjectPlan {
  public: string[];
  retired: string[];
  cooling_off: string[];
  candidates: Candidate[];
  /** Only when the draft context has a brief: the one project the post may be about. */
  brief_project?: string;
}

export class SubjectInputError extends Error {}

/** Public registry entries, in registry order. `public` must be exactly true. */
export function registryPublicProjects(registry: unknown): PublicProject[] {
  if (!Array.isArray(registry)) throw new SubjectInputError(`${REGISTRY_REL} is not an array`);
  return registry
    .filter((p): p is { slug: string; name?: string; displayName?: string; public?: unknown } =>
      typeof p === 'object' && p !== null && typeof (p as { slug?: unknown }).slug === 'string')
    .filter((p) => p.public === true)
    .map((p) => ({ slug: p.slug, name: p.displayName ?? p.name ?? p.slug }));
}

export function loadRotationPolicy(configText: string): RotationPolicy {
  const config = loadYaml(configText, { schema: JSON_SCHEMA }) as { rotation?: Record<string, unknown> } | null;
  const rotation = config?.rotation;
  const n = rotation?.project_cooldown_posts;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
    throw new SubjectInputError(`${CONFIG_REL}: rotation.project_cooldown_posts must be a whole number`);
  }
  const retired = Array.isArray(rotation?.retired_subjects)
    ? rotation.retired_subjects.flatMap((r) => (typeof r?.slug === 'string' ? [r.slug] : []))
    : [];
  return { cooldownPosts: n, retired };
}

/** The ledger's per-post rows, newest first. The project cell loses any " (…)" note. */
export function ledgerPosts(ledger: string): CoveredPost[] {
  const out: CoveredPost[] = [];
  let inTable = false;
  for (const line of ledger.split('\n')) {
    if (/^\|[-| ]+\|\s*$/.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line.startsWith('|')) break;
    const cells = line.split('|').map((c) => c.trim());
    const project = (cells[3] ?? '').replace(/\s*\(.*$/, '');
    out.push({ date: cells[1] ?? '', slug: cells[2] ?? '', project: project || null });
  }
  return out;
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * The context's optional brief. Absent or null means none. Otherwise it must be an object whose
 * project is one of public_projects; angle must be a string, sources and links arrays, and facts
 * and avoid_claims arrays of strings, when present. Other keys are ignored.
 */
function parseBrief(raw: unknown, publicProjects: PublicProject[]): DraftBrief | null {
  if (raw === undefined || raw === null) return null;
  const bad = (why: string) => new SubjectInputError(`draft context brief ${why}`);
  if (typeof raw !== 'object' || Array.isArray(raw)) throw bad('must be an object');
  const brief = raw as Record<string, unknown>;
  const project = str(brief.project);
  if (!project) throw bad('has no project');
  if (!publicProjects.some((p) => p.slug === project)) throw bad(`project is not in public_projects: ${project}`);
  if (brief.angle !== undefined && typeof brief.angle !== 'string') throw bad('angle must be a string');
  for (const key of ['sources', 'links']) {
    if (brief[key] !== undefined && !Array.isArray(brief[key])) throw bad(`${key} must be an array`);
  }
  for (const key of ['facts', 'avoid_claims']) {
    const v = brief[key];
    if (v !== undefined && !(Array.isArray(v) && v.every((s) => typeof s === 'string'))) {
      throw bad(`${key} must be an array of strings`);
    }
  }
  return { project };
}

export function parseDraftContext(raw: string): DraftContext {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    throw new SubjectInputError(`draft context is not JSON: ${(err as Error).message}`);
  }
  if (data?.schema_version !== 1) throw new SubjectInputError('draft context schema_version must be 1');
  if (!Array.isArray(data.public_projects) || !Array.isArray(data.blog_posts)) {
    throw new SubjectInputError('draft context needs public_projects and blog_posts arrays');
  }
  const publicProjects = data.public_projects.map((p: Record<string, unknown>) => {
    const slug = str(p?.slug);
    if (!slug) throw new SubjectInputError('draft context public_projects entry has no slug');
    return { slug, name: str(p.name) ?? slug, ...(str(p.url) ? { url: str(p.url)! } : {}) };
  });
  const blogPosts = data.blog_posts.map((p: Record<string, unknown>) => {
    const date = str(p?.slot_at);
    if (!date) throw new SubjectInputError('draft context blog_posts entry has no slot_at');
    return { date, slug: str(p.slug) ?? '', project: str(p.project) };
  });
  return {
    slotAt: str(data.slot_at) ?? '',
    rule: str(data.rule) ?? '',
    publicProjects,
    blogPosts,
    brief: parseBrief(data.brief, publicProjects),
  };
}

/**
 * Every known post, newest first: Burrow's queued/published posts plus the ledger rows, one per
 * post slug. A context row with no project falls back to the ledger's project for that slug.
 */
export function mergePosts(ledger: CoveredPost[], context: CoveredPost[] = []): CoveredPost[] {
  const bySlug = new Map<string, CoveredPost>();
  const keyless: CoveredPost[] = [];
  for (const p of [...ledger, ...context]) {
    if (!p.slug) { keyless.push(p); continue; }
    const prev = bySlug.get(p.slug);
    bySlug.set(p.slug, prev ? { date: p.date || prev.date, slug: p.slug, project: p.project ?? prev.project } : p);
  }
  return [...bySlug.values(), ...keyless].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Projects ineligible for a post at `slot`: those of the newest `n` posts before the slot, and of
 * every post already queued at or after it. Without a slot, the newest `n` posts.
 */
export function coolingOff(posts: CoveredPost[], n: number, slot?: string): string[] {
  const out: string[] = [];
  const add = (p: CoveredPost) => { if (p.project && !out.includes(p.project)) out.push(p.project); };
  const slotMs = slot ? Date.parse(slot) : NaN;
  const later = Number.isNaN(slotMs) ? [] : posts.filter((p) => Date.parse(p.date) >= slotMs);
  later.forEach(add);
  posts.filter((p) => !later.includes(p)).slice(0, n).forEach(add);
  return out;
}

/** With briefProject (an owner-commissioned slot) that project is the only possible candidate. */
export function planSubjects(input: {
  publicProjects: PublicProject[];
  posts: CoveredPost[];
  policy: RotationPolicy;
  slot?: string;
  briefProject?: string;
}): SubjectPlan {
  const { publicProjects, posts, policy, slot, briefProject } = input;
  const cooling = coolingOff(posts, policy.cooldownPosts, slot);
  const lastCovered = (slug: string) =>
    posts.filter((p) => p.project === slug).map((p) => p.date.slice(0, 10)).sort().pop() ?? null;
  const ranked = publicProjects
    .filter((p) => !policy.retired.includes(p.slug) && !cooling.includes(p.slug))
    .filter((p) => !briefProject || p.slug === briefProject)
    .map((p, i) => ({ ...p, last_covered: lastCovered(p.slug), i }))
    .sort((a, b) =>
      a.last_covered === b.last_covered ? a.i - b.i
        : a.last_covered === null ? -1
        : b.last_covered === null ? 1
        : a.last_covered.localeCompare(b.last_covered));
  return {
    public: publicProjects.map((p) => p.slug),
    retired: policy.retired,
    cooling_off: cooling,
    candidates: ranked.map(({ i: _i, ...c }) => c),
    ...(briefProject ? { brief_project: briefProject } : {}),
  };
}

const LINK = /(?:https?:\/\/)?(?:www\.)?bilko\.run\/(?:projects|products)\/([a-z0-9][a-z0-9-]*)/gi;

/** Lowercase project slugs of every bilko.run /projects/ or /products/ link, first-seen order. */
export function linkedProjectSlugs(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(LINK)) {
    const slug = m[1].toLowerCase();
    if (!out.includes(slug)) out.push(slug);
  }
  return out;
}

/** The post's subject when it is allowed, else why it is not. */
export function checkPost(post: string, plan: SubjectPlan): { project: string } | { problem: string } {
  const problem = (text: string) => ({ problem: text });
  const lines = post.replace(/^﻿/, '').split(/\r?\n/);
  const close = lines.findIndex((l, i) => i > 0 && /^---[ \t]*$/.test(l));
  if (!/^---[ \t]*$/.test(lines[0] ?? '') || close === -1) return problem('post.md has no frontmatter');
  let fm: Record<string, unknown>;
  try {
    fm = (loadYaml(lines.slice(1, close).join('\n'), { schema: JSON_SCHEMA }) ?? {}) as Record<string, unknown>;
  } catch (err) {
    return problem(`invalid YAML frontmatter: ${(err as Error).message}`);
  }
  const project = typeof fm.project === 'string' ? fm.project.trim() : '';
  if (!project) return problem("post.md frontmatter is missing 'project' (the registry slug of its one subject)");
  if (plan.brief_project && project !== plan.brief_project) {
    return problem(`commissioned post is about ${project}, not the brief's project ${plan.brief_project}`);
  }
  for (const slug of linkedProjectSlugs(post)) {
    if (!plan.public.includes(slug)) return problem(`links non-public project: ${slug}`);
  }
  if (plan.retired.includes(project)) return problem(`subject is retired: ${project}`);
  if (!plan.public.includes(project)) return problem(`subject not public on bilko.run/projects: ${project}`);
  if (plan.cooling_off.includes(project)) return problem(`subject on cooldown (covered in a recent post): ${project}`);
  return { project };
}

export function planFromRoot(root: string, opts: { slot?: string; contextFile?: string } = {}): SubjectPlan {
  const read = (rel: string) => {
    try {
      return readFileSync(path.join(root, rel), 'utf-8');
    } catch (err) {
      throw new SubjectInputError(`cannot read ${rel}: ${(err as Error).message}`);
    }
  };
  let registry: unknown;
  try {
    registry = JSON.parse(read(REGISTRY_REL));
  } catch (err) {
    if (err instanceof SubjectInputError) throw err;
    throw new SubjectInputError(`${REGISTRY_REL} is not JSON: ${(err as Error).message}`);
  }
  const policy = loadRotationPolicy(read(CONFIG_REL));
  const ledger = ledgerPosts(read(LEDGER_REL));
  let context: DraftContext | null = null;
  if (opts.contextFile) {
    let raw: string;
    try {
      raw = readFileSync(opts.contextFile, 'utf-8');
    } catch (err) {
      throw new SubjectInputError(`cannot read draft context ${opts.contextFile}: ${(err as Error).message}`);
    }
    context = parseDraftContext(raw);
  }
  return planSubjects({
    publicProjects: context ? context.publicProjects : registryPublicProjects(registry),
    posts: mergePosts(ledger, context?.blogPosts),
    policy,
    slot: opts.slot || context?.slotAt || undefined,
    briefProject: context?.brief?.project,
  });
}

function main(): void {
  const [cmd, ...args] = process.argv.slice(2);
  const get = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
  const root = get('--root');
  if ((cmd !== 'candidates' && cmd !== 'check') || !root || (cmd === 'check' && !get('--post'))) {
    console.error('usage: blog-subjects.ts candidates|check --root <repo> [--post <post.md>] [--slot <ISO>] [--context <file>]');
    process.exit(2);
  }
  try {
    const plan = planFromRoot(root, { slot: get('--slot'), contextFile: get('--context') });
    if (cmd === 'candidates') {
      console.log(JSON.stringify(plan));
      process.exit(plan.candidates.length > 0 ? 0 : 3);
    }
    const result = checkPost(readFileSync(get('--post')!, 'utf-8'), plan);
    console.log('project' in result ? result.project : result.problem);
    process.exit('project' in result ? 0 : 1);
  } catch (err) {
    console.error(`blog-subjects: ${(err as Error).message}`);
    process.exit(2);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
