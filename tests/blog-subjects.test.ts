import { describe, it, expect } from 'vitest';
import {
  checkPost,
  linkedProjectSlugs,
  parseDraftContext,
  planSubjects,
  registryPublicProjects,
  SubjectInputError,
  type CoveredPost,
} from '../scripts/blog-subjects';

const registry = [
  { slug: 'open-app', name: 'Open App', public: true },
  { slug: 'admin-app', name: 'Admin App' },
  { slug: 'hidden-app', name: 'Hidden App', public: false },
  { slug: 'stringy-app', name: 'Stringy', public: 'true' },
  { slug: 'cool-app', displayName: 'Cool App', public: true },
];
const policy = { cooldownPosts: 1, retired: [] as string[] };
const post = (slug: string, project: string, date: string): CoveredPost => ({ date, slug, project });

describe('blog-subjects', () => {
  it('registryPublicProjects keeps only public: true', () => {
    expect(registryPublicProjects(registry).map((p) => p.slug)).toEqual(['open-app', 'cool-app']);
  });

  it('a public project is a candidate; a non-public one is not', () => {
    const plan = planSubjects({ publicProjects: registryPublicProjects(registry), posts: [], policy });
    const slugs = plan.candidates.map((c) => c.slug);
    expect(slugs).toContain('open-app');
    for (const hidden of ['admin-app', 'hidden-app', 'stringy-app']) expect(slugs).not.toContain(hidden);
  });

  it('a project inside its cooldown is not a candidate', () => {
    const plan = planSubjects({
      publicProjects: registryPublicProjects(registry),
      posts: [post('p1', 'open-app', '2026-11-01')],
      policy,
    });
    expect(plan.cooling_off).toEqual(['open-app']);
    expect(plan.candidates.map((c) => c.slug)).toEqual(['cool-app']);
  });

  it('a retired project is not a candidate', () => {
    const plan = planSubjects({
      publicProjects: registryPublicProjects(registry),
      posts: [],
      policy: { cooldownPosts: 0, retired: ['cool-app'] },
    });
    expect(plan.candidates.map((c) => c.slug)).toEqual(['open-app']);
  });

  const plan = planSubjects({
    publicProjects: registryPublicProjects(registry),
    posts: [post('p1', 'open-app', '2026-11-01')],
    policy,
  });
  const md = (project: string, body = 'Body.') => `---\nslug: x\nproject: ${project}\n---\n${body}\n`;

  it('checkPost accepts a public off-cooldown subject', () => {
    expect(checkPost(md('cool-app'), plan)).toEqual({ project: 'cool-app' });
  });

  it('checkPost refuses non-public, cooling-off, and missing subjects', () => {
    expect(checkPost(md('admin-app'), plan)).toHaveProperty('problem', expect.stringContaining('not public'));
    expect(checkPost(md('open-app'), plan)).toHaveProperty('problem', expect.stringContaining('cooldown'));
    expect(checkPost('---\nslug: x\n---\nBody.\n', plan)).toHaveProperty('problem', expect.stringContaining('project'));
  });

  it('checkPost refuses a post linking a non-public project', () => {
    const r = checkPost(md('cool-app', 'Try https://bilko.run/projects/admin-app now.'), plan);
    expect(r).toHaveProperty('problem', 'links non-public project: admin-app');
    expect(linkedProjectSlugs('https://bilko.run/projects/Cool-App and bilko.run/products/x')).toEqual(['cool-app', 'x']);
  });

  // Burrow's owner-commissioned slots (BLOG_DRAFT_CONTEXT brief).
  const context = (brief?: unknown) => JSON.stringify({
    schema_version: 1,
    slot_at: '2026-11-16T17:00:00Z',
    public_projects: [{ slug: 'open-app', name: 'Open App' }, { slug: 'cool-app' }],
    blog_posts: [],
    ...(brief === undefined ? {} : { brief }),
  });

  it('parseDraftContext: an absent or null brief is no brief', () => {
    expect(parseDraftContext(context()).brief).toBeNull();
    expect(parseDraftContext(context(null)).brief).toBeNull();
  });

  it('parseDraftContext accepts a brief whose project is in public_projects', () => {
    const brief = {
      kind: 'commissioned',
      project: ' cool-app ',
      angle: 'The v2 release.',
      sources: [{ repo: 'owner/repo', from_ref: 'v1', to_ref: 'v2' }, { file: '/tmp/matrix.json' }],
      facts: ['v2 shipped on Nov 13.'],
      links: [{ url: 'https://bilko.run/products/cool-app' }, { call_to_action: 'Try it.' }],
      avoid_claims: ['It is a hosted service.'],
    };
    expect(parseDraftContext(context(brief)).brief).toEqual({ project: 'cool-app' });
  });

  it.each([
    ['is a string', 'cool-app', 'brief must be an object'],
    ['is an array', ['cool-app'], 'brief must be an object'],
    ['has no project', { angle: 'x' }, 'brief has no project'],
    ['names a project outside public_projects', { project: 'admin-app' }, 'brief project is not in public_projects: admin-app'],
    ['has a non-string angle', { project: 'cool-app', angle: 3 }, 'brief angle must be a string'],
    ['has sources that are not an array', { project: 'cool-app', sources: 'v1..v2' }, 'brief sources must be an array'],
    ['has facts that are not strings', { project: 'cool-app', facts: [1] }, 'brief facts must be an array of strings'],
    ['has avoid_claims that is not an array', { project: 'cool-app', avoid_claims: 'x' }, 'brief avoid_claims must be an array of strings'],
  ])('parseDraftContext rejects a brief that %s', (_n, brief, why) => {
    expect(() => parseDraftContext(context(brief))).toThrow(SubjectInputError);
    expect(() => parseDraftContext(context(brief))).toThrow(why);
  });

  it("a brief makes its project the only candidate and check refuses any other project", () => {
    const publicProjects = registryPublicProjects(registry);
    const briefPlan = planSubjects({ publicProjects, posts: [], policy, briefProject: 'cool-app' });
    expect(briefPlan.candidates.map((c) => c.slug)).toEqual(['cool-app']);
    expect(briefPlan.brief_project).toBe('cool-app');
    expect(checkPost(md('cool-app'), briefPlan)).toEqual({ project: 'cool-app' });
    expect(checkPost(md('open-app'), briefPlan)).toEqual({
      problem: "commissioned post is about open-app, not the brief's project cool-app",
    });
    expect('brief_project' in planSubjects({ publicProjects, posts: [], policy })).toBe(false);
  });

  it('a brief does not lift the cooldown: a cooling-off brief project leaves no candidate', () => {
    const briefPlan = planSubjects({
      publicProjects: registryPublicProjects(registry),
      posts: [post('p1', 'cool-app', '2026-11-01')],
      policy,
      briefProject: 'cool-app',
    });
    expect(briefPlan.candidates).toEqual([]);
    expect(checkPost(md('cool-app'), briefPlan)).toHaveProperty('problem', expect.stringContaining('cooldown'));
  });
});
