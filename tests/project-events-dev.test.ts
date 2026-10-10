import { describe, it, expect, beforeAll } from 'vitest';
import Fastify from 'fastify';
import { initDb } from '../server/db.js';
import { registerProjectEventsRoutes } from '../server/routes/project-events.js';

// Mirrors `pnpm dev`: no dist/, so @fastify/static is never registered and
// reply.sendFile does not exist. The events routes must still be mounted.
const app = Fastify({ logger: false });
registerProjectEventsRoutes(app);

beforeAll(async () => {
  await initDb();
  await app.ready();
});

describe('project events routes without the static plugin (dev)', () => {
  it('GET for a cold slug returns the handler JSON 404, not an unknown-route 404 or a throw', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/dev-cold-slug/data-events.ndjson' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'no events yet' });
  });

  it('POST route is registered (401/503, not an unknown-route 404)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/projects/dev-cold-slug/events', payload: {} });
    expect([401, 503]).toContain(res.statusCode);
  });
});
