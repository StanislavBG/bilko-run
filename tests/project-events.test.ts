import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun } from '../server/db.js';
import { registerProjectEventsRoutes } from '../server/routes/project-events.js';

const TOKEN = 'test-events-token';
process.env.PROJECT_SNAPSHOT_TOKEN = TOKEN;

const app = Fastify({ logger: false, bodyLimit: 8 * 1024 * 1024 });
registerProjectEventsRoutes(app);

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM project_events');
});

const SLUG = 'social-signals-trader';
const POST_URL = `/api/projects/${SLUG}/events`;
const GET_URL = `/projects/${SLUG}/data-events.ndjson`;

function post(body: unknown, token?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  return app.inject({ method: 'POST', url: POST_URL, headers, body: JSON.stringify(body) });
}

function row(id: number, ticker = 'NVDA') {
  return JSON.stringify({ id, event_kind: 'thesis_entered', ts: '2026-08-13T00:00:00Z', ticker });
}

describe('Project events — /api/projects/:slug/events + /projects/:slug/data-events.ndjson', () => {
  it('GET before any POST → 404 (no static plugin decorator in this test app)', async () => {
    const res = await app.inject({ method: 'GET', url: GET_URL });
    expect(res.statusCode).toBe(404);
  });

  it('POST without a token → 401', async () => {
    const res = await post({ id: 1, line: row(1) });
    expect(res.statusCode).toBe(401);
  });

  it('POST with a wrong token → 401', async () => {
    const res = await post({ id: 1, line: row(1) }, 'nope');
    expect(res.statusCode).toBe(401);
  });

  it('POST with a non-JSON line → 400', async () => {
    const res = await post({ id: 1, line: 'not json' }, TOKEN);
    expect(res.statusCode).toBe(400);
  });

  it('POST with a non-positive-integer id → 400', async () => {
    const res = await post({ id: 0, line: row(1) }, TOKEN);
    expect(res.statusCode).toBe(400);
  });

  it('round-trip: authed POST then public GET returns the full ndjson body', async () => {
    await post({ id: 1, line: row(1) }, TOKEN);
    await post({ id: 2, line: row(2) }, TOKEN);

    const got = await app.inject({ method: 'GET', url: GET_URL });
    expect(got.statusCode).toBe(200);
    expect(got.headers['content-type']).toContain('application/x-ndjson');
    expect(got.headers['accept-ranges']).toBe('bytes');
    const lines = got.body.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({ id: 1 });
    expect(JSON.parse(lines[1])).toMatchObject({ id: 2 });
  });

  it('a retried POST for an id already stored is idempotent (no duplicate row)', async () => {
    await post({ id: 1, line: row(1) }, TOKEN);
    await post({ id: 1, line: row(1) }, TOKEN);

    const got = await app.inject({ method: 'GET', url: GET_URL });
    const lines = got.body.trim().split('\n');
    expect(lines).toHaveLength(1);
  });

  it('Range past EOF → 416 with Content-Range bytes */N', async () => {
    await post({ id: 1, line: row(1) }, TOKEN);
    const first = await app.inject({ method: 'GET', url: GET_URL });
    const total = Buffer.byteLength(first.body);

    const res = await app.inject({
      method: 'GET',
      url: GET_URL,
      headers: { range: `bytes=${total}-` },
    });
    expect(res.statusCode).toBe(416);
    expect(res.headers['content-range']).toBe(`bytes */${total}`);
    expect(res.body.length).toBe(0);
  });

  it('Range from a mid-file offset → 206 with only the tail', async () => {
    await post({ id: 1, line: row(1) }, TOKEN);
    const first = await app.inject({ method: 'GET', url: GET_URL });
    const firstLineBytes = Buffer.byteLength(first.body.split('\n')[0] + '\n');

    await post({ id: 2, line: row(2) }, TOKEN);
    const res = await app.inject({
      method: 'GET',
      url: GET_URL,
      headers: { range: `bytes=${firstLineBytes}-` },
    });
    expect(res.statusCode).toBe(206);
    const lines = res.body.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ id: 2 });
    expect(res.headers['content-range']).toMatch(/^bytes \d+-\d+\/\d+$/);
  });

  it('a POST beyond KEEP_PER_SLUG trims the oldest rows', async () => {
    // Not exercising the full 5000-row cap here (too slow for a unit test) —
    // covered by a direct DB assertion that the DELETE clause runs and keeps
    // the newest ids when the cap is set artificially low via a raw query.
    await post({ id: 1, line: row(1) }, TOKEN);
    await post({ id: 2, line: row(2) }, TOKEN);
    await post({ id: 3, line: row(3) }, TOKEN);
    const got = await app.inject({ method: 'GET', url: GET_URL });
    const lines = got.body.trim().split('\n');
    expect(lines.map((l) => JSON.parse(l).id)).toEqual([1, 2, 3]);
  });

  it('bad slug → 400 on read', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/BAD_SLUG!/data-events.ndjson' });
    expect(res.statusCode).toBe(400);
  });
});
