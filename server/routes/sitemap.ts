import type { FastifyInstance } from 'fastify';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROJECTS, type Project } from '../../src/data/projectsRegistry.js';
import { dbAll } from '../db.js';

/**
 * /sitemap.xml: built per request (memoized) from the registry, the published
 * blog posts and robots.txt so it cannot drift from what the site serves.
 */

const SITE = 'https://bilko.run';
const CACHE_CONTROL = 'public, max-age=3600';
const MEMO_TTL_MS = 10 * 60 * 1000;
const SLUG_RE = /^[a-z0-9-]+$/;

export interface SitemapInput {
  projects: readonly Project[];
  posts: readonly { slug: string; publishedAt: string }[];
  /** True when <dist>/projects/<slug>/index.html exists. */
  isPublished: (slug: string) => boolean;
  robotsTxt: string;
}

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Returns a predicate: is this path disallowed for User-agent: * (longest match wins, Allow wins ties). */
export function robotsDisallows(robotsTxt: string): (path: string) => boolean {
  const rules: { allow: boolean; prefix: string }[] = [];
  let inStarGroup = false;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      inStarGroup = lastWasAgent ? inStarGroup || value === '*' : value === '*';
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!inStarGroup || !value) continue;
    if (key === 'allow') rules.push({ allow: true, prefix: value });
    else if (key === 'disallow') rules.push({ allow: false, prefix: value });
  }
  return (path: string): boolean => {
    let best: { allow: boolean; len: number } | null = null;
    for (const r of rules) {
      if (!path.startsWith(r.prefix)) continue;
      const len = r.prefix.length;
      if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
    }
    return best ? !best.allow : false;
  };
}

interface Entry { path: string; lastmod?: string; changefreq: string; priority: string }

export function buildSitemapXml(input: SitemapInput): string {
  const disallowed = robotsDisallows(input.robotsTxt);
  const entries: Entry[] = [
    { path: '/', changefreq: 'weekly', priority: '1.0' },
    { path: '/projects', changefreq: 'weekly', priority: '0.9' },
    { path: '/blog', changefreq: 'weekly', priority: '0.9' },
    { path: '/forum', changefreq: 'weekly', priority: '0.7' },
    { path: '/contact', changefreq: 'monthly', priority: '0.7' },
    { path: '/pricing', changefreq: 'monthly', priority: '0.7' },
  ];

  for (const p of input.projects) {
    if (p.public !== true || p.status !== 'live') continue;
    if (!SLUG_RE.test(p.slug)) continue;
    if (p.host.kind === 'static-path') {
      if (!input.isPublished(p.slug)) continue;
      const path = p.host.path.endsWith('/') ? p.host.path : `${p.host.path}/`;
      entries.push({ path, changefreq: 'monthly', priority: '0.8' });
    } else if (p.host.kind === 'react-route') {
      entries.push({ path: `/products/${p.slug}`, changefreq: 'monthly', priority: '0.8' });
    }
  }

  for (const post of input.posts) {
    if (!post.slug) continue;
    const lastmod = /^\d{4}-\d{2}-\d{2}/.exec(post.publishedAt)?.[0];
    entries.push({ path: `/blog/${post.slug}`, lastmod, changefreq: 'monthly', priority: '0.6' });
  }

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const e of entries) {
    if (seen.has(e.path) || disallowed(e.path)) continue;
    seen.add(e.path);
    urls.push(
      [
        '  <url>',
        `    <loc>${escapeXml(SITE + e.path)}</loc>`,
        ...(e.lastmod ? [`    <lastmod>${e.lastmod}</lastmod>`] : []),
        `    <changefreq>${e.changefreq}</changefreq>`,
        `    <priority>${e.priority}</priority>`,
        '  </url>',
      ].join('\n'),
    );
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

function readRobots(distPath: string): string {
  for (const p of [resolve(distPath, 'robots.txt'), resolve(process.cwd(), 'public', 'robots.txt')]) {
    try {
      if (existsSync(p)) return readFileSync(p, 'utf8');
    } catch { /* try next */ }
  }
  return '';
}

export function registerSitemapRoutes(app: FastifyInstance, opts: { distPath: string }): void {
  let memo: { expiresAt: number; body: string } | null = null;

  async function build(): Promise<string> {
    let posts: { slug: string; publishedAt: string }[] = [];
    try {
      const rows = await dbAll<{ slug: string; published_at: string }>(
        "SELECT slug, published_at FROM blog_posts WHERE published = 1 AND datetime(published_at) <= datetime('now') ORDER BY published_at DESC",
      );
      posts = rows.map(r => ({ slug: r.slug, publishedAt: String(r.published_at) }));
    } catch (err) {
      console.warn('[sitemap] could not read blog posts; serving without them:', err);
    }
    return buildSitemapXml({
      projects: PROJECTS,
      posts,
      isPublished: slug => SLUG_RE.test(slug) && existsSync(resolve(opts.distPath, 'projects', slug, 'index.html')),
      robotsTxt: readRobots(opts.distPath),
    });
  }

  app.get('/sitemap.xml', async (_req, reply) => {
    reply
      .header('Content-Type', 'application/xml; charset=utf-8')
      .header('Cache-Control', CACHE_CONTROL);
    if (memo && memo.expiresAt > Date.now()) return memo.body;
    const body = await build();
    memo = { expiresAt: Date.now() + MEMO_TTL_MS, body };
    return body;
  });
}
