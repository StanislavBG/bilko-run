import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Fastify, { type FastifyInstance } from 'fastify';
import staticPlugin from '@fastify/static';
import { registerProjectsHubRoutes } from '../server/projects-hub';

let dist: string;
let app: FastifyInstance;

beforeAll(async () => {
  dist = mkdtempSync(join(tmpdir(), 'hub-'));
  mkdirSync(join(dist, 'projects', 'academy'), { recursive: true });
  writeFileSync(join(dist, 'projects', 'academy', 'index.html'), '<html>academy</html>');
  app = Fastify();
  await app.register(staticPlugin, { root: dist, prefix: '/', redirect: true });
  registerProjectsHubRoutes(app, '<html>shell</html>');
  await app.ready();
});

afterAll(async () => {
  await app.close();
  rmSync(dist, { recursive: true, force: true });
});

describe('projects hub routes', () => {
  it('GET /projects serves the SPA shell', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.body).toBe('<html>shell</html>');
  });

  it('GET /projects?p=academy serves 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects?p=academy' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /projects/ 301s to /projects', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/' });
    expect(res.statusCode).toBe(301);
    expect(res.headers.location).toBe('/projects');
  });

  it('GET /projects/?p=academy preserves the query', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/?p=academy' });
    expect(res.statusCode).toBe(301);
    expect(res.headers.location).toBe('/projects?p=academy');
  });

  it('GET /projects/academy/ is still served by static', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/academy/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('academy');
  });
});
