import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { injectOgMeta, resolveOg, loadOgProjects, type OgContext } from '../server/og-meta.js';

const STALE = `<!DOCTYPE html><html><head>
<meta charset="UTF-8" />
<title>Bilko — AI Advisory for Small Business</title>
<meta name="description" content="1:1 AI advisory" />
<meta property="og:title" content="Bilko — AI Advisory for Small Business" />
<meta content="https://bilko.run/og-bilko.png" property="og:image">
<meta name="twitter:title" content="Bilko — AI Advisory for Small Business" />
<meta content="x" name="twitter:image" />
<link rel="icon" href="/favicon.svg" />
</head><body></body></html>`;

const ctx: OgContext = {
  projects: [
    { slug: 'page-roast', name: 'PageRoast', displayName: 'Page Roast', tagline: 'Roasts landing pages', category: 'AI' },
    { slug: 'session-manager', name: 'Session Manager', tagline: 'Schedules sessions', category: 'Dev' },
  ],
  blogPosts: [{ slug: 'hello-world', title: 'Hello World', excerpt: 'First post' }],
};

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe('injectOgMeta', () => {
  const out = injectOgMeta(STALE, {
    title: 'T', description: 'D', url: 'https://bilko.run/x', image: 'https://bilko.run/og/x.png',
  });
  it('replaces stale tags exactly once each', () => {
    expect(out).not.toContain('AI Advisory for Small Business');
    expect(out).not.toContain('og-bilko.png');
    expect(count(out, /<title>/g)).toBe(1);
    expect(count(out, /name="description"/g)).toBe(1);
    expect(count(out, /property="og:title"/g)).toBe(1);
    expect(count(out, /property="og:image"/g)).toBe(1);
    expect(count(out, /name="twitter:title"/g)).toBe(1);
    expect(count(out, /name="twitter:image"/g)).toBe(1);
    expect(out).toContain('<meta charset="UTF-8" />');
    expect(out).toContain('rel="icon"');
    expect(out).toContain('twitter:site" content="@BilkoBibitkov"');
    expect(out).toContain('og:image:width" content="1200"');
  });
  it('escapes attribute values', () => {
    const e = injectOgMeta(STALE, {
      title: 'a', description: `Say "hi" & <b> it's`, url: 'u', image: 'i',
    });
    expect(e).toContain('content="Say &quot;hi&quot; &amp; &lt;b&gt; it&#39;s"');
  });
  it('returns html unchanged without </head>', () => {
    expect(injectOgMeta('<p>x</p>', { title: 'a', description: 'b', url: 'c', image: 'd' })).toBe('<p>x</p>');
  });
});

describe('resolveOg', () => {
  it('maps the root to the site default', () => {
    const m = resolveOg('/', ctx)!;
    expect(m.title).toBe('bilko.run — Small AI tools, one at a time');
    expect(m.image).toBe('https://bilko.run/og/default.png');
  });
  it('maps section pages', () => {
    expect(resolveOg('/pricing', ctx)!.title).toBe('Pricing — bilko.run');
  });
  it('maps static-path projects, ignoring query', () => {
    for (const p of ['/projects/page-roast/', '/projects/page-roast/index.html?x=1']) {
      const m = resolveOg(p, ctx)!;
      expect(m.title).toBe('Page Roast — bilko.run');
      expect(m.description).toBe('Roasts landing pages');
      expect(m.url).toBe('https://bilko.run/projects/page-roast/');
      expect(m.image).toMatch(/^https:\/\/bilko\.run\/og\/page-roast\.png\?v=[0-9a-f]{8}$/);
    }
  });
  it('versions the project og:image by content', () => {
    const v = (tagline: string) =>
      resolveOg('/projects/vers-x/', {
        ...ctx,
        projects: [{ slug: 'vers-x', name: 'X', tagline, category: 'c' }],
      })!.image;
    expect(v('one')).toMatch(/\/og\/vers-x\.png\?v=[0-9a-f]{8}$/);
    expect(v('one')).toBe(v('one'));
    expect(v('one')).not.toBe(v('two'));
  });
  it('maps session-manager product paths with canonical url', () => {
    expect(resolveOg('/products/session-manager', ctx)!.url).toBe('https://bilko.run/products/session-manager');
    expect(resolveOg('/products/session-manager/manual', ctx)!.url).toBe(
      'https://bilko.run/products/session-manager/manual',
    );
    expect(resolveOg('/products/session-manager', ctx)!.title).toBe('Session Manager — bilko.run');
  });
  it('maps blog posts', () => {
    const m = resolveOg('/blog/hello-world', ctx)!;
    expect(m.title).toBe('Hello World');
    expect(m.description).toBe('First post');
  });
  it('returns null for unknown or malformed paths', () => {
    expect(resolveOg('/projects/nope/', ctx)).toBeNull();
    expect(resolveOg('/blog/nope', ctx)).toBeNull();
    expect(resolveOg('/projects/..%2f/', ctx)).toBeNull();
    expect(resolveOg('/projects/Page-Roast/', ctx)).toBeNull();
    expect(resolveOg('/random', ctx)).toBeNull();
  });
});

describe('loadOgProjects', () => {
  it('returns every registry slug with a non-empty tagline', () => {
    const raw = JSON.parse(readFileSync('src/data/standalone-projects.json', 'utf-8')) as { slug: string }[];
    const loaded = loadOgProjects();
    for (const r of raw) {
      const p = loaded.find(x => x.slug === r.slug);
      expect(p, r.slug).toBeDefined();
      expect(p!.tagline.length).toBeGreaterThan(0);
    }
  });
});
