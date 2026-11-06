import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerBilkoProfileRoutes } from '../server/bilko-profile-routes';

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

const REDIRECTED = [
  '/bilko',
  '/bilko/',
  '/hire',
  '/hire/',
  '/human-for-hire',
  '/human-for-hire/',
  '/projects/human-for-hire',
  '/projects/human-for-hire/',
  '/projects/human-for-hire/thanks',
  '/projects/human-for-hire/thanks/',
];

describe('retired hire paths redirect to /book', () => {
  it('301s to /book keeping the query', async () => {
    for (const url of REDIRECTED) {
      const res = await app.inject({ method: 'GET', url: url + '?a=1&b=2' });
      expect(res.statusCode).toBe(301);
      expect(res.headers.location).toBe('/book?a=1&b=2');
    }
  });

  it('301s to bare /book without a query', async () => {
    for (const url of REDIRECTED) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(301);
      expect(res.headers.location).toBe('/book');
    }
  });

  it('a hostile query cannot change the target host', async () => {
    for (const url of REDIRECTED) {
      const res = await app.inject({ method: 'GET', url: url + '?next=//evil.example' });
      expect(res.statusCode).toBe(301);
      expect(String(res.headers.location).startsWith('/book?')).toBe(true);
    }
  });

  it('still serves /book and /book/ as 200', async () => {
    for (const url of ['/book', '/book/']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
    }
  });
});
