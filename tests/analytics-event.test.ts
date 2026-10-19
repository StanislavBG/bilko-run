import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun, dbAll } from '../server/db.js';
import { registerAnalyticsRoutes } from '../server/routes/analytics.js';

const app = Fastify({ logger: false });
registerAnalyticsRoutes(app);

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM funnel_events');
});

const post = (payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/api/analytics/event', payload });

describe('POST /api/analytics/event', () => {
  it('stores a page_view event from the Projects page', async () => {
    const res = await post({ event: 'page_view', tool: 'projects', visitor_id: 'v-pv-test' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    const rows = await dbAll<{ event: string; tool: string }>(
      'SELECT event, tool FROM funnel_events WHERE event = ?', 'page_view');
    expect(rows).toEqual([{ event: 'page_view', tool: 'projects' }]);
  });

  it('still rejects unknown events with 400', async () => {
    const res = await post({ event: 'not_a_real_event' });
    expect(res.statusCode).toBe(400);
  });
});
