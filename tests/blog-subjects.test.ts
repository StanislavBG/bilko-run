import { describe, it, expect } from 'vitest';
import {
  checkPost,
  linkedProjectSlugs,
  planSubjects,
  registryPublicProjects,
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
});
