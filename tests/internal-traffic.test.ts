// The bilko_internal marker: a page load with ?bilko_internal=1 sets the cookie, every analytics write that carries it
// stores is_internal = 1, and the admin flows/sessions reports count those rows as the owner's (MINE).
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun, dbGet, dbAll } from '../server/db.js';

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return {
    ...original,
    verifyClerkToken: vi.fn().mockResolvedValue(null),
    requireAdmin: vi.fn().mockImplementation(async () => 'admin@example.com'),
  };
});

import { registerSessionIdentity } from '../server/session-identity.js';
import { registerPageHitRecorder, flushPageHits } from '../server/page-hits.js';
import { registerAnalyticsRoutes } from '../server/routes/analytics.js';
import { registerAdminSessionRoutes } from '../server/routes/admin-sessions.js';
import { isInternalRequest } from '../server/internal-traffic.js';

const CHROME_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const INT_VID = '41414141-4141-4141-8141-414141414141';
const INT_SID = '42424242-4242-4242-8242-424242424242';
const REAL_VID = '43434343-4343-4343-8343-434343434343';
const REAL_SID = '44444444-4444-4444-8444-444444444444';

const app = Fastify({ logger: false });
registerSessionIdentity(app);
registerPageHitRecorder(app, { flush: false });
registerAnalyticsRoutes(app);
registerAdminSessionRoutes(app);
app.get('/projects/sudoku/', async (_req, reply) => reply.type('text/html').send('<html></html>'));
app.get('/api/ping', async () => ({ ok: true }));

const settle = () => new Promise((r) => setTimeout(r, 20));
const setCookies = (h: string | string[] | number | undefined): string[] =>
  h === undefined ? [] : Array.isArray(h) ? h.map(String) : [String(h)];
const internalCookie = (h: string | string[] | number | undefined) =>
  setCookies(h).find((c) => c.startsWith('bilko_internal='));

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  for (const t of ['page_hits', 'sessions', 'page_views', 'click_events', 'funnel_events', 'app_errors', 'internal_devices']) {
    await dbRun(`DELETE FROM ${t}`);
  }
});

describe('isInternalRequest', () => {
  const req = (url: string, cookie?: string) => ({ url, headers: cookie === undefined ? {} : { cookie } });
  it('is true for the cookie or the query param set to 1', () => {
    expect(isInternalRequest(req('/x', 'a=b; bilko_internal=1'))).toBe(true);
    expect(isInternalRequest(req('/x?bilko_internal=1'))).toBe(true);
    expect(isInternalRequest(req('/x?a=1&bilko_internal=1'))).toBe(true);
  });
  it('is false for 0, other values and when the marker is absent', () => {
    expect(isInternalRequest(req('/x', 'bilko_internal=0'))).toBe(false);
    expect(isInternalRequest(req('/x?bilko_internal=0'))).toBe(false);
    expect(isInternalRequest(req('/x?bilko_internal=yes', 'bilko_internal=true'))).toBe(false);
    expect(isInternalRequest(req('/x', 'xbilko_internal=1'))).toBe(false);
    expect(isInternalRequest(req('/x'))).toBe(false);
    // ?bilko_internal=0 clears the marker, so that request is not marked either.
    expect(isInternalRequest(req('/x?bilko_internal=0', 'bilko_internal=1'))).toBe(false);
  });
});

describe('bilko_internal cookie', () => {
  it('a page load with ?bilko_internal=1 sets it for a day, and its page hit is internal', async () => {
    const res = await app.inject({
      method: 'GET', url: '/projects/sudoku/?bilko_internal=1',
      headers: { 'user-agent': CHROME_UA, cookie: `bilko_vid=${INT_VID}; bilko_sid=${INT_SID}` },
    });
    expect(res.statusCode).toBe(200);
    const all = setCookies(res.headers['set-cookie']);
    // Appended to bilko_vid/bilko_sid, not in place of them.
    expect(all.some((c) => c.startsWith('bilko_vid='))).toBe(true);
    expect(all.some((c) => c.startsWith('bilko_sid='))).toBe(true);
    const c = internalCookie(res.headers['set-cookie']);
    expect(c).toBe('bilko_internal=1; Max-Age=86400; Path=/; SameSite=Lax');

    await settle();
    await flushPageHits();
    const hit = await dbGet<{ is_internal: number }>('SELECT is_internal FROM page_hits WHERE client_vid = ?', INT_VID);
    expect(hit?.is_internal).toBe(1);
  });

  it('is Secure on https', async () => {
    const res = await app.inject({
      method: 'GET', url: '/projects/sudoku/?bilko_internal=1', headers: { 'x-forwarded-proto': 'https' },
    });
    expect(internalCookie(res.headers['set-cookie'])).toBe('bilko_internal=1; Max-Age=86400; Path=/; SameSite=Lax; Secure');
  });

  it('?bilko_internal=0 clears it with Max-Age=0', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/sudoku/?bilko_internal=0', headers: { cookie: 'bilko_internal=1' } });
    expect(internalCookie(res.headers['set-cookie'])).toBe('bilko_internal=; Max-Age=0; Path=/; SameSite=Lax');
  });

  it('no other request sets or clears it', async () => {
    const plain = await app.inject({ method: 'GET', url: '/projects/sudoku/', headers: { cookie: 'bilko_internal=1' } });
    expect(internalCookie(plain.headers['set-cookie'])).toBeUndefined();
    const api = await app.inject({ method: 'GET', url: '/api/ping?bilko_internal=1' });
    expect(internalCookie(api.headers['set-cookie'])).toBeUndefined();
    const post = await app.inject({
      method: 'POST', url: '/api/analytics/pageview?bilko_internal=1', payload: { path: '/x' },
    });
    expect(internalCookie(post.headers['set-cookie'])).toBeUndefined();
  });
});

describe('marked writes and the MINE filter', () => {
  const visit = async (vid: string, sid: string, internal: boolean) => {
    const cookie = `bilko_vid=${vid}; bilko_sid=${sid}${internal ? '; bilko_internal=1' : ''}`;
    const headers = { cookie, 'user-agent': CHROME_UA };
    const pv = await app.inject({ method: 'POST', url: '/api/analytics/pageview', headers, payload: { path: '/projects/sudoku/' } });
    expect(pv.statusCode).toBe(200);
    // sendBeacon posts text/plain with the page's cookies.
    const click = await app.inject({
      method: 'POST', url: '/api/analytics/click',
      headers: { ...headers, 'content-type': 'text/plain' },
      payload: JSON.stringify({ path: '/projects/sudoku/', tag: 'a', label: 'Play' }),
    });
    expect(click.statusCode).toBe(204);
    const ev = await app.inject({
      method: 'POST', url: '/api/analytics/event', headers,
      payload: { event: 'view_tool', tool: 'sudoku', path: '/projects/sudoku/', metadata: { flow: 'play', step: 'start' } },
    });
    expect(ev.statusCode).toBe(200);
  };

  const flags = async (table: string, sidCol: string, sid: string) =>
    (await dbAll<{ is_internal: number }>(`SELECT is_internal FROM ${table} WHERE ${sidCol} = ?`, sid)).map((r) => r.is_internal);

  beforeEach(async () => {
    await visit(INT_VID, INT_SID, true);
    await visit(REAL_VID, REAL_SID, false);
  });

  it('stores is_internal = 1 on the marked pageview, click and event, and 0 without the marker', async () => {
    expect(await flags('page_views', 'session_id', INT_SID)).toEqual([1]);
    expect(await flags('click_events', 'session_id', INT_SID)).toEqual([1]);
    expect(await flags('funnel_events', 'session_id', INT_SID)).toEqual([1]);
    expect(await flags('page_views', 'session_id', REAL_SID)).toEqual([0]);
    expect(await flags('click_events', 'session_id', REAL_SID)).toEqual([0]);
    expect(await flags('funnel_events', 'session_id', REAL_SID)).toEqual([0]);
  });

  it('marks rows, not visitors: the internal visitor id is not added to the owner ids', async () => {
    const { loadOwnerIds } = await import('../server/traffic-filters.js');
    const ids = await loadOwnerIds();
    expect(ids.cookieIds).not.toContain(INT_VID);
  });

  type Flows = {
    apps: Array<{ app: string; sessions: number; views: number; clicks: number; events: number }>;
    flows: Array<{ app: string; flow: string; total_sessions: number; steps: Array<{ step: string; sessions: number }> }>;
  };
  const flowsReport = async (qs: string): Promise<Flows> => {
    const res = await app.inject({ method: 'GET', url: `/api/admin/flows${qs}` });
    expect(res.statusCode).toBe(200);
    return res.json();
  };
  const sessionsReport = async (qs: string) => {
    const res = await app.inject({ method: 'GET', url: `/api/admin/sessions${qs}` });
    expect(res.statusCode).toBe(200);
    return (res.json() as { sessions: Array<{ session_id: string; mine: boolean; internal: boolean; bot: boolean }> }).sessions;
  };

  it('mine=exclude&bots=exclude leaves the internal session, its views, clicks and flow steps out of flows', async () => {
    const out = await flowsReport('?mine=exclude&bots=exclude');
    expect(out.apps.find((a) => a.app === 'sudoku')).toMatchObject({ sessions: 1, views: 1, clicks: 1, events: 1 });
    expect(out.flows).toEqual([
      expect.objectContaining({ app: 'sudoku', flow: 'play', total_sessions: 1, steps: [expect.objectContaining({ step: 'start', sessions: 1 })] }),
    ]);

    const all = await flowsReport('?mine=include');
    expect(all.apps.find((a) => a.app === 'sudoku')).toMatchObject({ sessions: 2, views: 2, clicks: 2, events: 2 });
    expect(all.flows[0]).toMatchObject({ total_sessions: 2, steps: [expect.objectContaining({ sessions: 2 })] });
  });

  it('mine=exclude&bots=exclude leaves the internal session out of sessions; mine=include lists it as mine and internal', async () => {
    const out = await sessionsReport('?mine=exclude&bots=exclude');
    expect(out.map((s) => s.session_id)).toEqual([REAL_SID]);
    expect(out[0]).toMatchObject({ mine: false, internal: false, bot: false });

    const all = await sessionsReport('?mine=include');
    expect(all.find((s) => s.session_id === INT_SID)).toMatchObject({ mine: true, internal: true, bot: false });
    expect(all.find((s) => s.session_id === REAL_SID)).toMatchObject({ mine: false, internal: false });
  });
});
