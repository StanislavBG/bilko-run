import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerBilkoProfileRoutes } from '../server/bilko-profile-routes';
import { resolveOg } from '../server/og-meta';
import { BOOKING_PAGE_TITLE } from '../shared/booking-page';

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
    }
  });

  it('leaves /bilko unchanged', async () => {
    const res = await app.inject({ method: 'GET', url: '/bilko' });
    expect(res.body).toContain("Hi, I'm Bilko. Let's build your AI project together.");
    expect(res.body).not.toContain('booking-page');
  });

  it('maps /book to its own og meta', () => {
    const og = resolveOg('/book', { projects: [], blogPosts: [] });
    expect(og?.title).toBe(BOOKING_PAGE_TITLE);
    expect(og?.url).toBe('https://bilko.run/book');
  });
});
