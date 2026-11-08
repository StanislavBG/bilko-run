import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun, dbAll, dbGet } from '../server/db.js';

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return { ...original, verifyClerkToken: vi.fn().mockResolvedValue(null) };
});

import { registerAnalyticsRoutes } from '../server/routes/analytics.js';
import { recordPageHit, flushPageHits, resetAutomationVisitorCache } from '../server/page-hits.js';

// Headed Playwright keeps the stock desktop Chrome UA; only navigator.webdriver
// (sent by the beacon as body.webdriver) gives it away. Headless announces itself.
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const HEADLESS_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36';
const VID = '44444444-4444-4444-8444-444444444444';
const OTHER = '55555555-5555-4555-8555-555555555555';
const SID = '66666666-6666-4666-8666-666666666666';
const HOUR_MS = 3_600_000;

const app = Fastify({ logger: false });
registerAnalyticsRoutes(app);

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM page_views');
  await dbRun('DELETE FROM sessions');
  await dbRun('DELETE FROM page_hits');
  await dbRun('DELETE FROM click_events');
  await dbRun('DELETE FROM funnel_events');
  await dbRun('DELETE FROM automation_visitors');
  resetAutomationVisitorCache();
});

function click(body: Record<string, unknown>, vidCookie?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/analytics/click',
    headers: {
      'content-type': 'text/plain;charset=UTF-8',
      'user-agent': CHROME_UA,
      ...(vidCookie ? { cookie: `bilko_vid=${vidCookie}; bilko_sid=${SID}` } : {}),
    },
    payload: JSON.stringify(body),
  });
}

// Posted the way the beacon posts it: navigator.sendBeacon sends a text/plain JSON string.
function pageview(body: Record<string, unknown>, ua: string, vidCookie?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/analytics/pageview',
    headers: {
      'content-type': 'text/plain;charset=UTF-8',
      'user-agent': ua,
      ...(vidCookie ? { cookie: `bilko_vid=${vidCookie}; bilko_sid=${SID}` } : {}),
    },
    payload: JSON.stringify(body),
  });
}

// One human page hit, click and page view for `vid`, recorded `ageMs` ago.
async function seed(vid: string, ageMs: number): Promise<void> {
  const ts = Date.now() - ageMs;
  const date = new Date(ts).toISOString().slice(0, 10);
  await dbRun(
    "INSERT INTO page_hits (ts_ms, date, path, status, is_bot, client_vid, visitor_class) VALUES (?, ?, '/projects/git-viewer/', 200, 0, ?, 'human')",
    ts, date, vid,
  );
  await dbRun(
    "INSERT INTO click_events (ts_ms, date, path, tag, is_bot, client_vid) VALUES (?, ?, '/projects/git-viewer/', 'button', 0, ?)",
    ts, date, vid,
  );
  await dbRun(
    "INSERT INTO page_views (path, date, visitor_id, is_bot, created_at_ms) VALUES ('/projects/git-viewer/', ?, ?, 0, ?)",
    date, vid, ts,
  );
}

// Each table's bot flags for `vid`, oldest row first.
async function flags(vid: string) {
  const hits = await dbAll<{ is_bot: number; visitor_class: string }>(
    'SELECT is_bot, visitor_class FROM page_hits WHERE client_vid = ? ORDER BY ts_ms', vid);
  const clicks = await dbAll<{ is_bot: number }>(
    'SELECT is_bot FROM click_events WHERE client_vid = ? ORDER BY ts_ms', vid);
  const views = await dbAll<{ is_bot: number }>(
    'SELECT is_bot FROM page_views WHERE visitor_id = ? ORDER BY created_at_ms, id', vid);
  return {
    hits: hits.map((r) => `${r.is_bot}:${r.visitor_class}`),
    clicks: clicks.map((r) => r.is_bot),
    views: views.map((r) => r.is_bot),
  };
}

async function viewBot(path: string): Promise<number | undefined> {
  return (await dbGet<{ is_bot: number }>('SELECT is_bot FROM page_views WHERE path = ?', path))?.is_bot;
}

describe('POST /api/analytics/pageview — automation flags', () => {
  it('stores a HeadlessChrome-UA pageview as a bot', async () => {
    const res = await pageview({ path: '/headless', visitor_id: VID, session_id: SID }, HEADLESS_UA, VID);
    expect(res.statusCode).toBe(200);
    expect(await viewBot('/headless')).toBe(1);
  });

  it("a desktop-Chrome pageview with webdriver: true is a bot and flags that visitor's last 24 h", async () => {
    await seed(VID, 25 * HOUR_MS); // outside the 24 h window: left alone
    await seed(VID, 60_000);
    await seed(OTHER, 60_000); // a different visitor: left alone
    const res = await pageview({ path: '/driven', visitor_id: VID, session_id: SID, webdriver: true }, CHROME_UA, VID);
    expect(res.statusCode).toBe(200);
    expect(await viewBot('/driven')).toBe(1);
    expect(await flags(VID)).toEqual({ hits: ['0:human', '1:script'], clicks: [0, 1], views: [0, 1, 1] });
    expect(await flags(OTHER)).toEqual({ hits: ['0:human'], clicks: [0], views: [0] });
  });

  it('the same desktop-Chrome pageview without webdriver flags nothing', async () => {
    await seed(VID, 60_000);
    await pageview({ path: '/plain', visitor_id: VID, session_id: SID }, CHROME_UA, VID);
    expect(await viewBot('/plain')).toBe(0);
    expect(await flags(VID)).toEqual({ hits: ['0:human'], clicks: [0], views: [0, 0] });
  });

  it('only the boolean true counts as webdriver', async () => {
    await seed(VID, 60_000);
    for (const webdriver of ['true', 1, {}]) {
      await pageview({ path: '/not-bool', visitor_id: VID, session_id: SID, webdriver }, CHROME_UA, VID);
    }
    expect(await flags(VID)).toEqual({ hits: ['0:human'], clicks: [0], views: [0, 0, 0, 0] });
  });

  it("flags only the visitor in the request's own bilko_vid cookie, never a body-named one", async () => {
    await seed(VID, 60_000);
    await seed(OTHER, 60_000);
    // Body names VID, cookie is OTHER: OTHER's rows flip, VID's do not.
    await pageview({ path: '/cookie-other', visitor_id: VID, session_id: SID, webdriver: true }, CHROME_UA, OTHER);
    // No cookie: the row itself is a bot, but the body id never drives the UPDATEs.
    await pageview({ path: '/no-cookie', visitor_id: VID, session_id: SID, webdriver: true }, CHROME_UA);
    expect(await viewBot('/no-cookie')).toBe(1);
    expect(await flags(VID)).toEqual({ hits: ['0:human'], clicks: [0], views: [0, 1] });
    expect(await flags(OTHER)).toEqual({ hits: ['1:script'], clicks: [1], views: [1, 1] });
  });

  it('a hit buffered before the webdriver pageview is written as is_bot 1 at flush', async () => {
    // The document request that loaded the beacon is buffered, not yet in page_hits.
    recordPageHit({ ts: Date.now() - 1_000, path: '/projects/git-viewer/', status: 200, ip: '203.0.113.9', ua: CHROME_UA, clientVid: VID });
    recordPageHit({ ts: Date.now() - 1_000, path: '/projects/git-viewer/', status: 200, ip: '203.0.113.9', ua: CHROME_UA, clientVid: OTHER });
    await pageview({ path: '/projects/git-viewer/', visitor_id: VID, session_id: SID, webdriver: true }, CHROME_UA, VID);
    // The request path no longer flushes the buffer itself.
    expect((await flags(VID)).hits).toEqual([]);
    await flushPageHits();
    expect((await flags(VID)).hits).toEqual(['1:script']);
    expect((await flags(OTHER)).hits).toEqual(['0:human']);
  });

  it('a known automation visitor stays flagged after the in-memory cache is reloaded from the table', async () => {
    await pageview({ path: '/a', visitor_id: VID, session_id: SID, webdriver: true }, CHROME_UA, VID);
    resetAutomationVisitorCache();
    recordPageHit({ ts: Date.now(), path: '/b', status: 200, ip: '203.0.113.9', ua: CHROME_UA, clientVid: VID });
    await flushPageHits();
    expect((await flags(VID)).hits).toEqual(['1:script']);
  });

  it('records the visitor once and backfills only on first detection', async () => {
    await pageview({ path: '/first', visitor_id: VID, session_id: SID, webdriver: true }, CHROME_UA, VID);
    const row = await dbGet<{ visitor_id: string; first_seen_ms: number }>('SELECT visitor_id, first_seen_ms FROM automation_visitors');
    expect(row?.visitor_id).toBe(VID);
    // Rows written directly after the first detection: a backfill would flip them.
    await seed(VID, 0);
    await pageview({ path: '/second', visitor_id: VID, session_id: SID, webdriver: true }, CHROME_UA, VID);
    expect(await viewBot('/second')).toBe(1);
    expect(await flags(VID)).toEqual({ hits: ['0:human'], clicks: [0], views: [1, 0, 1] });
    expect((await dbAll('SELECT visitor_id FROM automation_visitors')).length).toBe(1);
  });
});

describe('POST /api/analytics/click — automation flags', () => {
  it('a click sent after the last pageview of a webdriver visit is is_bot 1', async () => {
    await pageview({ path: '/driven', visitor_id: VID, session_id: SID, webdriver: true }, CHROME_UA, VID);
    // No webdriver flag on the click itself: the known visitor is enough.
    await click({ path: '/driven', tag: 'button', visitor_id: VID, session_id: SID }, VID);
    expect((await flags(VID)).clicks).toEqual([1]);
  });

  it('a click carrying webdriver: true is is_bot 1 with no prior pageview', async () => {
    await click({ path: '/x', tag: 'a', visitor_id: OTHER, session_id: SID, webdriver: true }, OTHER);
    await click({ path: '/x', tag: 'a', visitor_id: VID, session_id: SID, webdriver: 'true' }, VID);
    expect((await flags(OTHER)).clicks).toEqual([1]);
    expect((await flags(VID)).clicks).toEqual([0]);
  });
});

describe('empty User-Agent: the same class on every ingest path', () => {
  it('an empty-UA pageview, click and event all store is_bot = 0', async () => {
    const pv = await pageview({ path: '/no-ua', visitor_id: VID, session_id: SID }, '', VID);
    expect(pv.statusCode).toBe(200);
    expect(await viewBot('/no-ua')).toBe(0);
    const ev = await app.inject({
      method: 'POST', url: '/api/analytics/event', headers: { 'user-agent': '' },
      payload: { event: 'view_tool', tool: 'git-viewer', visitor_id: 'ev-empty' },
    });
    expect(ev.statusCode).toBe(200);
    expect((await dbGet<{ is_bot: number }>("SELECT is_bot FROM funnel_events WHERE visitor_id = 'ev-empty'"))?.is_bot).toBe(0);
    const click = await app.inject({
      method: 'POST', url: '/api/analytics/click', headers: { 'content-type': 'text/plain;charset=UTF-8', 'user-agent': '' },
      payload: JSON.stringify({ path: '/no-ua', tag: 'button' }),
    });
    expect(click.statusCode).toBeLessThan(300);
    expect((await dbGet<{ is_bot: number }>("SELECT is_bot FROM click_events WHERE path = '/no-ua'"))?.is_bot).toBe(0);
  });
});

describe('POST /api/analytics/event — is_bot from the request UA', () => {
  it('stores is_bot = 1 for a HeadlessChrome UA and 0 for desktop Chrome', async () => {
    for (const [ua, vid] of [[HEADLESS_UA, 'ev-headless'], [CHROME_UA, 'ev-chrome']]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/analytics/event',
        headers: { 'user-agent': ua },
        payload: { event: 'view_tool', tool: 'git-viewer', visitor_id: vid },
      });
      expect(res.statusCode).toBe(200);
    }
    const rows = await dbAll<{ visitor_id: string; is_bot: number }>(
      'SELECT visitor_id, is_bot FROM funnel_events ORDER BY visitor_id');
    expect(rows.map((r) => [r.visitor_id, r.is_bot])).toEqual([['ev-chrome', 0], ['ev-headless', 1]]);
  });
});
