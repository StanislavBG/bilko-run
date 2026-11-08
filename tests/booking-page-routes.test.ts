import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerBilkoProfileRoutes } from '../server/bilko-profile-routes';
import { resolveOg } from '../server/og-meta';
import { BOOKING_PAGE_TITLE } from '../shared/booking-page';
import { SITE_SECTIONS } from '../shared/site-chrome';

const shell = readFileSync(resolve(__dirname, '..', 'index.html'), 'utf-8');
let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify();
  registerBilkoProfileRoutes(app, shell);
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('booking page routes', () => {
  it('serves /book and /book/ with the copy in the HTML', async () => {
    for (const url of ['/book', '/book/']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(res.body).toContain('Bring your AI idea. Leave with a plan.');
      expect(res.body).toContain('Pick a time');
      expect(res.body).toContain('og:title');
      expect(res.body).toContain('<div class="booking-page"><div class="bk-inner"><div class="bk-left">');
      expect(res.body).toContain('class="bk-top"');
      expect(res.body).toMatch(/<div class="bk-top">\s*<p class="bk-eyebrow">/);
      expect(res.body).not.toContain('bk-avatar');
    }
  });

  it('wraps /book in the site header, Primary nav and bottom bar', async () => {
    const res = await app.inject({ method: 'GET', url: '/book' });
    const body = res.body;
    const order = [
      'class="portfolio-shell"',
      'class="bk-header"',
      '<main>',
      'class="booking-page"',
      'class="bk-bottombar"',
    ].map(s => body.indexOf(s));
    for (const i of order) expect(i).toBeGreaterThan(-1);
    for (let k = 1; k < order.length; k++) expect(order[k]).toBeGreaterThan(order[k - 1]);
    expect(body).toContain('aria-label="Primary"');
    for (const s of SITE_SECTIONS.filter(x => x.id !== 'home')) {
      expect(body).toMatch(new RegExp(`<a [^>]*href="${s.path}"[^>]*>(?:<span class="bk-num">\\d+</span>)?${s.label}</a>`));
    }
    const current = [...body.matchAll(/<a [^>]*aria-current="page"[^>]*>/g)];
    expect(current).toHaveLength(1);
    expect(current[0][0]).toContain('href="/book"');
  });

  it('redirects /bilko to /book', async () => {
    const res = await app.inject({ method: 'GET', url: '/bilko?src=nav' });
    expect(res.statusCode).toBe(301);
    expect(res.headers.location).toBe('/book?src=nav');
  });

  it('maps /book to its own og meta', () => {
    const og = resolveOg('/book', { projects: [], blogPosts: [] });
    expect(og?.title).toBe(BOOKING_PAGE_TITLE);
    expect(og?.url).toBe('https://bilko.run/book');
  });
});
