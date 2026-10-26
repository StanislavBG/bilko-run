import { describe, it, expect } from 'vitest';
import { buildSitemapXml, type SitemapInput } from '../server/routes/sitemap.js';
import type { Project } from '../src/data/projectsRegistry.js';

const base = { year: 2026, category: 'x', tagline: 't' };
const stat = (slug: string, extra: Partial<Project> = {}): Project =>
  ({ ...base, slug, name: slug, status: 'live', public: true, host: { kind: 'static-path', path: `/projects/${slug}/` }, ...extra }) as Project;

function build(over: Partial<SitemapInput> = {}): string {
  return buildSitemapXml({ projects: [], posts: [], isPublished: () => true, robotsTxt: '', ...over });
}

describe('buildSitemapXml', () => {
  it('lists static pages and a static-path project with trailing slash when index.html exists', () => {
    const xml = build({ projects: [stat('academy')] });
    for (const p of ['/', '/projects', '/blog', '/forum', '/contact', '/pricing']) {
      expect(xml).toContain(`<loc>https://bilko.run${p}</loc>`);
    }
    expect(xml).toContain('<loc>https://bilko.run/projects/academy/</loc>');
  });

  it('omits a static-path project whose index.html is missing', () => {
    expect(build({ projects: [stat('academy')], isPublished: () => false })).not.toContain('/projects/academy/');
  });

  it('omits non-public, non-live and external entries; includes react-route', () => {
    const xml = build({
      projects: [
        stat('hidden', { public: false }),
        stat('draft', { status: 'draft' as Project['status'] }),
        stat('ext', { host: { kind: 'external-url', url: 'https://example.com/' } as Project['host'] }),
        stat('session-manager', { host: { kind: 'react-route', path: '/products/session-manager' } }),
      ],
    });
    expect(xml).not.toContain('hidden');
    expect(xml).not.toContain('draft');
    expect(xml).not.toContain('example.com');
    expect(xml).toContain('<loc>https://bilko.run/products/session-manager</loc>');
  });

  it('excludes robots-disallowed paths, honoring longest Allow', () => {
    const robotsTxt = 'User-agent: *\nDisallow: /projects/game-academy/\nDisallow: /blog\nAllow: /blog/ok\n';
    const xml = build({
      projects: [stat('game-academy'), stat('academy')],
      posts: [{ slug: 'ok', publishedAt: '2026-01-01 00:00:00' }, { slug: 'nope', publishedAt: '2026-01-01' }],
      robotsTxt,
    });
    expect(xml).not.toContain('game-academy');
    expect(xml).toContain('/projects/academy/');
    expect(xml).toContain('/blog/ok<');
    expect(xml).not.toContain('/blog/nope');
  });

  it('ignores rules for other user agents', () => {
    const xml = build({ projects: [stat('academy')], robotsTxt: 'User-agent: Bot\nDisallow: /\n' });
    expect(xml).toContain('/projects/academy/');
  });

  it('formats lastmod as YYYY-MM-DD and escapes & in locs', () => {
    const xml = build({ posts: [{ slug: 'a&b', publishedAt: '2026-03-04T10:20:30.000Z' }] });
    expect(xml).toContain('<loc>https://bilko.run/blog/a&amp;b</loc>');
    expect(xml).not.toContain('a&b');
    const ok = build({ posts: [{ slug: 'a-b', publishedAt: '2026-03-04T10:20:30.000Z' }] });
    expect(ok).toContain('<lastmod>2026-03-04</lastmod>');
  });
});
