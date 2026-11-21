import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return { ...original, verifyClerkToken: vi.fn().mockResolvedValue(null) };
});

import Fastify from 'fastify';
import { initDb, dbRun, dbAll } from '../server/db.js';
import { registerAnalyticsRoutes } from '../server/routes/analytics.js';
import { resetProbeVisitorCache, resetAutomationVisitorCache } from '../server/page-hits.js';

// The CTA-clicking fleet sends a stock desktop Chrome UA and no webdriver flag:
// only the two-targets-in-300-ms burst gives it away.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';
const VID = '77777777-7777-4777-8777-777777777777';
const OTHER = '88888888-8888-4888-8888-888888888888';
const SID = '99999999-9999-4999-8999-999999999999';
const HOUR_MS = 3_600_000;
const T0 = Date.now();
let ipSeq = 0;
let ip = '';

const app = Fastify({ logger: false });
registerAnalyticsRoutes(app);

const COFFEE = { path: '/', tag: 'a', label: 'Buy me a coffee', href: '/coffee' };
const KIT = { path: '/', tag: 'a', label: 'Launch Kit', href: '/products/launch-kit' };

function click(at: number, payload: Record<string, unknown>, vidCookie?: string) {
  vi.spyOn(Date, 'now').mockReturnValue(at);
  return app.inject({
    method: 'POST',
    url: '/api/analytics/click',
    remoteAddress: ip,
    headers: {
      'content-type': 'text/plain;charset=UTF-8',
      'user-agent': UA,
      ...(vidCookie ? { cookie: `bilko_vid=${vidCookie}; bilko_sid=${SID}` } : {}),
    },
    payload: JSON.stringify({ session_id: SID, ...payload }),
  });
}

// One human page hit, click and page view for `vid`, recorded `ageMs` before T0.
async function seed(vid: string, ageMs: number): Promise<void> {
  const ts = T0 - ageMs;
  const date = new Date(ts).toISOString().slice(0, 10);
  await dbRun(
    "INSERT INTO page_hits (ts_ms, date, path, status, is_bot, client_vid, visitor_class) VALUES (?, ?, '/', 200, 0, ?, 'human')",
    ts, date, vid,
  );
  await dbRun(
    "INSERT INTO click_events (ts_ms, date, path, tag, is_bot, client_vid) VALUES (?, ?, '/seed', 'button', 0, ?)",
    ts, date, vid,
  );
  await dbRun(
    "INSERT INTO page_views (path, date, visitor_id, is_bot, created_at_ms) VALUES ('/', ?, ?, 0, ?)",
    date, vid, ts,
  );
}

// Each table's bot flags for `vid`, oldest row first.
async function flags(vid: string) {
  const hits = await dbAll<{ is_bot: number; visitor_class: string }>(
    'SELECT is_bot, visitor_class FROM page_hits WHERE client_vid = ? ORDER BY ts_ms', vid);
  const clicks = await dbAll<{ is_bot: number }>(
    'SELECT is_bot FROM click_events WHERE client_vid = ? ORDER BY ts_ms, id', vid);
  const views = await dbAll<{ is_bot: number }>(
    'SELECT is_bot FROM page_views WHERE visitor_id = ? ORDER BY created_at_ms, id', vid);
  return {
    hits: hits.map((r) => `${r.is_bot}:${r.visitor_class}`),
    clicks: clicks.map((r) => r.is_bot),
    views: views.map((r) => r.is_bot),
  };
}

const automationVids = async () =>
  (await dbAll<{ visitor_id: string }>('SELECT visitor_id FROM automation_visitors ORDER BY visitor_id')).map((r) => r.visitor_id);

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM page_views');
  await dbRun('DELETE FROM page_hits');
  await dbRun('DELETE FROM click_events');
  await dbRun('DELETE FROM automation_visitors');
  resetProbeVisitorCache();
  resetAutomationVisitorCache();
  ip = `198.51.100.${200 + ++ipSeq}`;
});

afterEach(() => { vi.restoreAllMocks(); });

describe('POST /api/analytics/click — a click burst flags the cookie visitor as automation', () => {
  it("records the cookie vid and flips that visitor's last 24 h in page_views, click_events and page_hits", async () => {
    await seed(VID, 25 * HOUR_MS); // outside the 24 h window: left alone
    await seed(VID, 60_000);
    await seed(OTHER, 60_000); // a different visitor: left alone
    // Body names OTHER; only the request's own cookie (VID) is ever flagged.
    expect((await click(T0, { ...COFFEE, visitor_id: OTHER }, VID)).statusCode).toBe(204);
    expect((await click(T0 + 120, { ...KIT, visitor_id: OTHER }, VID)).statusCode).toBe(204);
    expect(await automationVids()).toEqual([VID]);
    // Clicks: old seed, recent seed, first CTA (backfilled), burst CTA (stored as a bot).
    expect(await flags(VID)).toEqual({ hits: ['0:human', '1:script'], clicks: [0, 1, 1, 1], views: [0, 1] });
    expect(await flags(OTHER)).toEqual({ hits: ['0:human'], clicks: [0], views: [0] });
  });

  it('the burst click row itself is stored with is_bot = 1', async () => {
    await click(T0, COFFEE, VID);
    await click(T0 + 50, KIT, VID);
    const rows = await dbAll<{ href: string; is_bot: number }>('SELECT href, is_bot FROM click_events WHERE href = ?', KIT.href);
    expect(rows).toEqual([{ href: KIT.href, is_bot: 1 }]);
  });

  it('a double click on one target flags nothing', async () => {
    await seed(VID, 60_000);
    await click(T0, COFFEE, VID);
    await click(T0 + 80, COFFEE, VID);
    expect(await automationVids()).toEqual([]);
    expect(await flags(VID)).toEqual({ hits: ['0:human'], clicks: [0, 0, 0], views: [0] });
  });

  it('a burst without a bilko_vid cookie adds no automation_visitors row', async () => {
    await seed(VID, 60_000);
    await click(T0, COFFEE);
    const res = await click(T0 + 100, KIT);
    expect(res.statusCode).toBe(204);
    expect(await automationVids()).toEqual([]);
    // Still the probe-marked burst row, but no visitor backfill.
    const kit = await dbAll<{ is_bot: number }>('SELECT is_bot FROM click_events WHERE href = ?', KIT.href);
    expect(kit.map((r) => r.is_bot)).toEqual([1]);
    expect(await flags(VID)).toEqual({ hits: ['0:human'], clicks: [0], views: [0] });
  });
});
