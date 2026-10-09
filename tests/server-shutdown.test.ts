import { describe, it, expect, beforeAll } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun, dbGet } from '../server/db.js';
import { registerEgressMeter } from '../server/egress.js';

// Render stops the old instance with SIGTERM; server/index.ts turns that into
// app.close(). This proves close() runs the egress onClose hook and persists
// counts that the 60s timer has not flushed yet.
describe('app.close() flushes pending egress counts', () => {
  const app = Fastify({ logger: false });
  registerEgressMeter(app); // default: timer + onClose flush enabled
  app.get('/api/shutdown-probe', async () => ({ ok: true }));

  beforeAll(async () => {
    await initDb();
    await dbRun('DELETE FROM api_egress_daily');
    await app.ready();
  });

  it('writes in-memory counts to the DB on close', async () => {
    await app.inject({ method: 'GET', url: '/api/shutdown-probe' });
    const before = await dbGet('SELECT route FROM api_egress_daily WHERE route = ?', '/api/shutdown-probe');
    expect(before).toBeFalsy();

    await app.close();

    const row = await dbGet<{ requests: number }>(
      'SELECT requests FROM api_egress_daily WHERE route = ?', '/api/shutdown-probe',
    );
    expect(row?.requests).toBe(1);
  });
});
