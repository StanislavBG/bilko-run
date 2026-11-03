import { describe, it, expect } from 'vitest';
import { slugFromPath, HOST_PAGE_PATHS, HOST_PAGE_SLUG } from '../server/page-hits.js';
import { buildSitemapXml } from '../server/routes/sitemap.js';
import { signinSourceForPath } from '../shared/signin-capture.js';

describe('/book discoverability', () => {
  it('counts /book and /book/ as human-for-hire page hits', () => {
    expect(HOST_PAGE_PATHS).toContain('/book');
    expect(HOST_PAGE_PATHS).toContain('/book/');
    expect(slugFromPath('/book')).toBe(HOST_PAGE_SLUG);
    expect(slugFromPath('/book/')).toBe('human-for-hire');
    expect(slugFromPath('/bilko')).toBe('human-for-hire');
  });

  it('lists /book in the sitemap with monthly / 0.9', () => {
    const xml = buildSitemapXml({ projects: [], posts: [], isPublished: () => true, robotsTxt: '' });
    const m = /<url>(?:(?!<\/url>)[\s\S])*?<loc>https:\/\/bilko\.run\/book<\/loc>[\s\S]*?<\/url>/.exec(xml);
    expect(m).not.toBeNull();
    expect(m![0]).toContain('<changefreq>monthly</changefreq>');
    expect(m![0]).toContain('<priority>0.9</priority>');
  });

  it('attributes /book to the human-for-hire sign-in source', () => {
    expect(signinSourceForPath('/book')).toBe('human-for-hire');
    expect(signinSourceForPath('/book/')).toBe('human-for-hire');
  });
});
