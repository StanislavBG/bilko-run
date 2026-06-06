import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun } from '../server/db.js';
import { registerProjectDataRoutes } from '../server/routes/project-data.js';

const TOKEN = 'test-snapshot-token';
process.env.PROJECT_SNAPSHOT_TOKEN = TOKEN;

const app = Fastify({ logger: false, bodyLimit: 8 * 1024 * 1024 });
registerProjectDataRoutes(app);

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM project_snapshots');
});

const SLUG = 'social-signals-trader';
const URL = `/api/projects/${SLUG}/snapshot`;

function post(body: unknown, token?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  return app.inject({ method: 'POST', url: URL, headers, body: JSON.stringify(body) });
}

describe('Project data snapshot — /api/projects/:slug/snapshot', () => {
  it('GET before any POST → 404', async () => {
    const res = await app.inject({ method: 'GET', url: URL });
    expect(res.statusCode).toBe(404);
  });

  it('POST without a token → 401', async () => {
    const res = await post({ globals: { X: 1 } });
    expect(res.statusCode).toBe(401);
  });

  it('POST with a wrong token → 401', async () => {
    const res = await post({ globals: { X: 1 } }, 'nope');
    expect(res.statusCode).toBe(401);
  });

  it('POST without a globals object → 400', async () => {
    const res = await post({ notGlobals: 1 }, TOKEN);
    expect(res.statusCode).toBe(400);
  });

  it('round-trip: authed POST then public GET returns the snapshot verbatim', async () => {
    const payload = { globals: { PERF: { day: 1.23 }, TRADES: [1, 2, 3] }, generatedAt: 'now' };
    const wrote = await post(payload, TOKEN);
    expect(wrote.statusCode).toBe(200);
    expect(wrote.json()).toMatchObject({ ok: true, slug: SLUG });

    const got = await app.inject({ method: 'GET', url: URL });
    expect(got.statusCode).toBe(200);
    expect(got.headers['content-type']).toContain('application/json');
    expect(got.json()).toEqual(payload);
  });

  it('POST replaces (does not append) — latest wins', async () => {
    await post({ globals: { v: 1 } }, TOKEN);
    await post({ globals: { v: 2 } }, TOKEN);
    const got = await app.inject({ method: 'GET', url: URL });
    expect(got.json()).toEqual({ globals: { v: 2 } });
  });

  it('bad slug → 400 on read', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/projects/BAD_SLUG!/snapshot' });
    expect(res.statusCode).toBe(400);
  });
});
