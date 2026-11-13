import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun } from '../server/db.js';
import { registerObservabilityRoutes } from '../server/routes/admin-observability.js';

// A page_hits visitor is "confirmed" only when its browser provably ran the beacon
// (page_views session/visitor, click_events client_vid) or kept the bilko_vid cookie
// across 2+ page hits that all carry the same user agent. Browser-UA scrapers that never run JS stay unconfirmed.

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return { ...original, requireAdmin: vi.fn().mockImplementation(async () => 'bilkobibitkov2000@gmail.com') };
});

const app = Fastify({ logger: false });
registerObservabilityRoutes(app);

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM page_hits');
  await dbRun('DELETE FROM page_views');
  await dbRun('DELETE FROM click_events');
});

const day = (ts: number) => new Date(ts).toISOString().slice(0, 10);

async function hit(o: { vid: string; clientVid?: string | null; sessionId?: string | null; isAdmin?: number; ago?: number; ua?: string | null }) {
  const ts = Date.now() - (o.ago ?? 60_000);
  await dbRun(
    `INSERT INTO page_hits (ts_ms, date, path, slug, status, referrer_host, visitor_hash, country, device, browser, os, is_bot, visitor_id, client_vid, session_id, is_admin, ua)
     VALUES (?, ?, '/p', NULL, 200, NULL, ?, 'US', 'desktop', 'Chrome', 'Linux', 0, ?, ?, ?, ?, ?)`,
    ts, day(ts), `hash-${o.vid}`, o.vid, o.clientVid ?? null, o.sessionId ?? null, o.isAdmin ?? 0, o.ua ?? null,
  );
}

async function pageView(visitorId: string, sessionId: string, ago = 60_000) {
  const ts = Date.now() - ago;
  await dbRun(
    `INSERT INTO page_views (path, date, visitor_id, session_id) VALUES ('/p', ?, ?, ?)`,
    day(ts), visitorId, sessionId,
  );
}

async function click(clientVid: string) {
  const ts = Date.now() - 30_000;
  await dbRun(
    `INSERT INTO click_events (ts_ms, date, path, tag, label, href, visitor_hash, is_bot, visitor_id, client_vid, is_admin)
     VALUES (?, ?, '/p', 'a', 'Go', '/go', 'h', 0, 'iphash', ?, 0)`,
    ts, day(ts), clientVid,
  );
}

async function traffic(qs = '') {
  const res = await app.inject({ method: 'GET', url: `/api/admin/traffic${qs}` });
  expect(res.statusCode).toBe(200);
  return JSON.parse(res.body) as {
    totals: { visitors: number; confirmedVisitors: number; hits: number };
    visitors: { visitorId: string; confirmed: boolean }[];
  };
}

const confirmedMap = (body: Awaited<ReturnType<typeof traffic>>) =>
  Object.fromEntries(body.visitors.map(v => [v.visitorId, v.confirmed]));

async function seed() {
  // Beacon ran: page_views has the hit's session id (under another cookie id).
  await hit({ vid: 'sess-v', clientVid: 'c-sess', sessionId: 's-1' });
  await pageView('c-other', 's-1');
  // Click beacon fired with this cookie id.
  await hit({ vid: 'click-v', clientVid: 'c-click' });
  await click('c-click');
  // Cookie kept across two page hits.
  await hit({ vid: 'cookie-v', clientVid: 'c-kept', ago: 120_000 });
  await hit({ vid: 'cookie-v', clientVid: 'c-kept', ago: 60_000 });
  // Scraper: 3 hits, a fresh never-seen cookie each time, no beacon.
  await hit({ vid: 'scraper-v', clientVid: 'c-x1' });
  await hit({ vid: 'scraper-v', clientVid: 'c-x2' });
  await hit({ vid: 'scraper-v', clientVid: 'c-x3' });
  // No cookie at all.
  await hit({ vid: 'bare-v' });
}

describe('GET /api/admin/traffic confirmed visitors', () => {
  it('confirms visitors by page_views session, click client_vid or a repeated cookie, not scrapers', async () => {
    await seed();
    const body = await traffic();
    expect(body.totals.visitors).toBe(5);
    expect(confirmedMap(body)).toEqual({
      'sess-v': true,
      'click-v': true,
      'cookie-v': true,
      'scraper-v': false,
      'bare-v': false,
    });
    const confirmedKeys = body.visitors.filter(v => v.confirmed).length;
    expect(body.totals.confirmedVisitors).toBe(confirmedKeys);
    expect(body.totals.confirmedVisitors).toBe(3);
  });

  it('confirms a hit whose client_vid is a page_views visitor_id', async () => {
    await hit({ vid: 'pv-v', clientVid: 'c-pv' });
    await pageView('c-pv', 's-other');
    const body = await traffic();
    expect(confirmedMap(body)).toEqual({ 'pv-v': true });
    expect(body.totals.confirmedVisitors).toBe(1);
  });

  it('mine=exclude removes owner rows from both visitors and confirmedVisitors', async () => {
    await seed();
    // Owner: admin hit plus a page_views row for its cookie, so it is confirmed when included.
    await hit({ vid: 'own-h', clientVid: 'own-c', isAdmin: 1 });
    await pageView('own-c', 's-own');
    const all = await traffic();
    expect(all.totals.visitors).toBe(6);
    expect(all.totals.confirmedVisitors).toBe(4);
    expect(confirmedMap(all)['own-h']).toBe(true);

    const mine = await traffic('?mine=exclude');
    expect(mine.totals.visitors).toBe(5);
    expect(mine.totals.confirmedVisitors).toBe(3);
    expect(mine.visitors.map(v => v.visitorId)).not.toContain('own-h');
  });

  it('a cookie shared across several user agents confirms nobody', async () => {
    // Crawler with one shared cookie jar rotating 4 user agents (4 visitor keys), no beacon.
    for (let i = 1; i <= 4; i++) {
      await hit({ vid: `ua-v${i}`, clientVid: 'c-shared', ua: `Mozilla/5.0 crawler-${i}`, ago: 60_000 + i * 100 });
    }
    const body = await traffic();
    expect(body.totals.visitors).toBe(4);
    expect(body.totals.confirmedVisitors).toBe(0);
    expect(confirmedMap(body)).toEqual({ 'ua-v1': false, 'ua-v2': false, 'ua-v3': false, 'ua-v4': false });
  });

  it('a cookie repeated under one user agent confirms every visitor key carrying it', async () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130';
    await hit({ vid: 'same-v1', clientVid: 'c-same', ua, ago: 120_000 });
    await hit({ vid: 'same-v2', clientVid: 'c-same', ua, ago: 60_000 });
    const body = await traffic();
    expect(confirmedMap(body)).toEqual({ 'same-v1': true, 'same-v2': true });
    expect(body.totals.confirmedVisitors).toBe(2);
  });

  it('confirmedVisitors is 0 with no traffic', async () => {
    const body = await traffic();
    expect(body.totals.confirmedVisitors).toBe(0);
    expect(body.totals.visitors).toBe(0);
  });
});
