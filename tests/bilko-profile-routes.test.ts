import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerBilkoProfileRoutes, renderBilkoProfileShell } from '../server/bilko-profile-routes';
import { identityHits } from './identity-denylist';

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

describe('renderBilkoProfileShell', () => {
  it('replaces the loading placeholder with the copy', () => {
    const out = renderBilkoProfileShell(shell);
    expect(out).toContain('Human For Hire');
    expect(out).toContain('Start with a free hour');
    expect(out.split('$100 / hour')).toHaveLength(4);
    expect(out).not.toContain('Loading...');
  });
  it('logs and returns the shell unchanged when markers are missing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(renderBilkoProfileShell('<html>x</html>')).toBe('<html>x</html>');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('profile routes', () => {
  it('serves identical no-store HTML on /bilko, /hire, /human-for-hire', async () => {
    const bodies: string[] = [];
    for (const url of ['/bilko', '/hire', '/human-for-hire']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.headers['cache-control']).toBe('private, no-store');
      bodies.push(res.body);
    }
    expect(new Set(bodies).size).toBe(1);
    expect(identityHits(bodies[0])).toEqual([]);
  });

  it('301s old paths to /bilko keeping the query', async () => {
    for (const url of [
      '/projects/human-for-hire',
      '/projects/human-for-hire/',
      '/projects/human-for-hire/thanks',
      '/projects/human-for-hire/thanks/',
    ]) {
      const res = await app.inject({ method: 'GET', url: url + '?a=1&b=2' });
      expect(res.statusCode).toBe(301);
      expect(res.headers.location).toBe('/bilko?a=1&b=2');
    }
    const bare = await app.inject({ method: 'GET', url: '/projects/human-for-hire' });
    expect(bare.headers.location).toBe('/bilko');
  });

  it('a crafted query cannot change the target host', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/human-for-hire/?//evil.com' });
    expect(res.statusCode).toBe(301);
    expect(String(res.headers.location).startsWith('/bilko?')).toBe(true);
  });
});
