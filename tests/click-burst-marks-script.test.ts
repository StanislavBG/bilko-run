import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

const verifyMock = vi.hoisted(() => vi.fn());
vi.mock('../server/clerk.js', async (orig) => ({
  ...(await orig<typeof import('../server/clerk.js')>()),
  verifyClerkToken: verifyMock,
}));

import Fastify from 'fastify';
import { initDb, dbRun, dbAll } from '../server/db.js';
import { registerAnalyticsRoutes } from '../server/routes/analytics.js';
import { recordPageHit, flushPageHits, resetProbeVisitorCache, CLICK_BURST_WINDOW_MS } from '../server/page-hits.js';

const app = Fastify({ logger: false });
registerAnalyticsRoutes(app);

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';
const SID = '11111111-2222-4333-8444-555555555555';
const T0 = Date.UTC(2026, 10, 20, 12);
let ipSeq = 0;
let ip = '';

const click = (at: number, payload: Record<string, unknown>) => {
  vi.spyOn(Date, 'now').mockReturnValue(at);
  return app.inject({
    method: 'POST', url: '/api/analytics/click', remoteAddress: ip,
    payload: { session_id: SID, ...payload },
    headers: { 'user-agent': UA },
  });
};

/** A page hit an hour before the clicks plus one after, flushed: the visitor's class. */
async function visitorClasses(): Promise<string[]> {
  vi.restoreAllMocks();
  recordPageHit({ ts: T0 + 60_000, path: '/after', status: 200, ip, ua: UA });
  await flushPageHits();
  const rows = await dbAll<{ visitor_class: string }>('SELECT visitor_class FROM page_hits WHERE ip = ? ORDER BY ts_ms', ip);
  return rows.map((r) => r.visitor_class);
}

const COFFEE = { path: '/', tag: 'a', label: 'Buy me a coffee', href: '/coffee' };
const KIT = { path: '/', tag: 'a', label: 'Launch Kit', href: '/products/launch-kit' };

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM click_events');
  await dbRun('DELETE FROM page_hits');
  resetProbeVisitorCache();
  verifyMock.mockReset();
  verifyMock.mockResolvedValue(null);
  ip = `198.51.100.${++ipSeq}`;
  recordPageHit({ ts: T0 - 3600_000, path: '/before', status: 200, ip, ua: UA });
  await flushPageHits();
});

afterEach(() => { vi.restoreAllMocks(); });

describe('click burst marks the visitor as a script', () => {
  it('uses a 300 ms window', () => {
    expect(CLICK_BURST_WINDOW_MS).toBe(300);
  });

  it('two different targets 100 ms apart on one path mark the visitor, before and after', async () => {
    expect((await click(T0, COFFEE)).statusCode).toBe(204);
    expect((await click(T0 + 100, KIT)).statusCode).toBe(204);
    const stored = await dbAll('SELECT id FROM click_events');
    expect(stored).toHaveLength(2);
    expect(await visitorClasses()).toEqual(['script', 'script']);
  });

  it('a double click on one target does not mark the visitor', async () => {
    await click(T0, COFFEE);
    await click(T0 + 100, COFFEE);
    expect(await dbAll('SELECT id FROM click_events')).toHaveLength(2);
    expect(await visitorClasses()).toEqual(['human', 'human']);
  });

  it('two targets 2 s apart do not mark the visitor', async () => {
    await click(T0, COFFEE);
    await click(T0 + 2000, KIT);
    expect(await visitorClasses()).toEqual(['human', 'human']);
  });

  it('different paths do not mark the visitor', async () => {
    await click(T0, COFFEE);
    await click(T0 + 100, { ...KIT, path: '/products' });
    expect(await visitorClasses()).toEqual(['human', 'human']);
  });

  it('another session does not count toward the burst', async () => {
    await click(T0, COFFEE);
    await click(T0 + 100, { ...KIT, session_id: '99999999-2222-4333-8444-555555555555' });
    expect(await visitorClasses()).toEqual(['human', 'human']);
  });
});
