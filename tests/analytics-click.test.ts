import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun, dbGet, dbAll } from '../server/db.js';
import { registerAnalyticsRoutes } from '../server/routes/analytics.js';
import { stableVisitorId } from '../server/page-hits.js';

const verifyMock = vi.hoisted(() => vi.fn());
vi.mock('../server/clerk.js', async (orig) => ({
  ...(await orig<typeof import('../server/clerk.js')>()),
  verifyClerkToken: verifyMock,
}));

const app = Fastify({ logger: false });
registerAnalyticsRoutes(app);

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM click_events');
  verifyMock.mockReset();
});

const postJson = (payload: unknown) =>
  app.inject({ method: 'POST', url: '/api/analytics/click', payload: payload as Record<string, unknown> });

describe('POST /api/analytics/click', () => {
  it('stores a valid JSON click with slug and visitor_hash', async () => {
    const res = await postJson({
      path: '/projects/sudoku/play', tag: 'A', id: 'cta', label: '  Start   the\n game ', href: 'https://example.com/x',
      extra: 'ignored',
    });
    expect(res.statusCode).toBe(204);
    const row = await dbGet<Record<string, any>>('SELECT * FROM click_events');
    expect(row?.path).toBe('/projects/sudoku/play');
    expect(row?.slug).toBe('sudoku');
    expect(row?.tag).toBe('a');
    expect(row?.el_id).toBe('cta');
    expect(row?.label).toBe('Start the game');
    expect(row?.href).toBe('https://example.com/x');
    expect(row?.visitor_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(row?.is_bot).toBe(0);
  });

  it('computes slug for static-path pages', async () => {
    await postJson({ path: '/projects/sudoku/', tag: 'button' });
    const row = await dbGet<{ slug: string }>('SELECT slug FROM click_events');
    expect(row?.slug).toBe('sudoku');
  });

  it('accepts a text/plain JSON body (sendBeacon)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analytics/click',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      payload: JSON.stringify({ path: '/blog', tag: 'a', href: '/blog/x' }),
    });
    expect(res.statusCode).toBe(204);
    const row = await dbGet<{ path: string; href: string }>('SELECT path, href FROM click_events');
    expect(row?.path).toBe('/blog');
    expect(row?.href).toBe('/blog/x');
  });

  it('nulls non-http(s) hrefs', async () => {
    await postJson({ path: '/a', tag: 'a', href: 'javascript:alert(1)' });
    await postJson({ path: '/a', tag: 'a', href: 'data:text/html,x' });
    const rows = await dbAll<{ href: string | null }>('SELECT href FROM click_events');
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.href === null)).toBe(true);
  });

  it('returns 400 when path is missing or not root-relative', async () => {
    expect((await postJson({ tag: 'a' })).statusCode).toBe(400);
    expect((await postJson({ path: 'nope', tag: 'a' })).statusCode).toBe(400);
    const row = await dbGet<{ n: number }>('SELECT COUNT(*) AS n FROM click_events');
    expect(row?.n).toBe(0);
  });

  it('stops inserting once the per-IP limit is exceeded', async () => {
    for (let i = 0; i < 650; i++) {
      const res = await postJson({ path: '/flood', tag: 'a' });
      expect(res.statusCode).toBe(204);
    }
    const row = await dbGet<{ n: number }>('SELECT COUNT(*) AS n FROM click_events');
    expect(row!.n).toBeGreaterThan(0);
    expect(row!.n).toBeLessThan(650);
  });

  it('stores ip and a stable visitor_id, anonymous by default', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/analytics/click', remoteAddress: '203.0.113.7',
      headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0 Safari/537.36' }, payload: { path: '/blog', tag: 'a' },
    });
    expect(res.statusCode).toBe(204);
    const row = await dbGet<Record<string, any>>('SELECT * FROM click_events');
    expect(row?.ip).toBe('203.0.113.7');
    expect(row?.visitor_id).toBe(stableVisitorId('203.0.113.7', 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0 Safari/537.36'));
    expect(row?.user_email).toBeNull();
    expect(row?.is_admin).toBe(0);
  });

  it('resolves the signed-in admin from the __session cookie', async () => {
    verifyMock.mockResolvedValue('admin@example.com');
    const { ADMIN_EMAILS } = await import('../server/clerk.js');
    ADMIN_EMAILS.push('admin@example.com');
    const res = await app.inject({
      method: 'POST', url: '/api/analytics/click', remoteAddress: '192.0.2.10',
      headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0 Safari/537.36', cookie: 'a=b; __session=tok123' },
      payload: { path: '/blog', tag: 'a' },
    });
    expect(res.statusCode).toBe(204);
    expect(verifyMock).toHaveBeenCalledWith('Bearer tok123');
    const row = await dbGet<Record<string, any>>('SELECT user_email, is_admin FROM click_events');
    expect(row?.user_email).toBe('admin@example.com');
    expect(row?.is_admin).toBe(1);
    ADMIN_EMAILS.pop();
  });

  it('stays anonymous and returns 204 when token verification fails', async () => {
    verifyMock.mockRejectedValue(new Error('bad'));
    const res = await app.inject({
      method: 'POST', url: '/api/analytics/click', remoteAddress: '192.0.2.11',
      headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0 Safari/537.36', cookie: '__session=bad' },
      payload: { path: '/blog', tag: 'a' },
    });
    expect(res.statusCode).toBe(204);
    const row = await dbGet<Record<string, any>>('SELECT user_email, is_admin FROM click_events');
    expect(row?.user_email).toBeNull();
    expect(row?.is_admin).toBe(0);
  });

  it('skips identity lookup for bots', async () => {
    await app.inject({
      method: 'POST', url: '/api/analytics/click', remoteAddress: '192.0.2.12',
      headers: { 'user-agent': 'Googlebot/2.1', cookie: '__session=tok' }, payload: { path: '/blog', tag: 'a' },
    });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('gives a click and a page hit from the same IP+UA the same visitor_id', async () => {
    const { recordPageHit, flushPageHits } = await import('../server/page-hits.js');
    await dbRun('DELETE FROM page_hits');
    const ua = 'Mozilla/5.0 SameUA';
    recordPageHit({ ts: Date.now(), path: '/blog', status: 200, ip: '198.51.100.9', ua });
    await flushPageHits();
    await app.inject({
      method: 'POST', url: '/api/analytics/click', remoteAddress: '198.51.100.9',
      headers: { 'user-agent': ua }, payload: { path: '/blog', tag: 'a' },
    });
    const hit = await dbGet<{ visitor_id: string }>('SELECT visitor_id FROM page_hits');
    const click = await dbGet<{ visitor_id: string }>('SELECT visitor_id FROM click_events');
    expect(click?.visitor_id).toBeTruthy();
    expect(click?.visitor_id).toBe(hit?.visitor_id);
  });

  const VID = '11111111-1111-4111-8111-111111111111';
  const SID = '22222222-2222-4222-8222-222222222222';
  const BVID = '33333333-3333-4333-8333-333333333333';
  const BSID = '44444444-4444-4444-8444-444444444444';
  // The flood test exhausts the default IP's limiter; use a fresh IP.
  const postFresh = (payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/api/analytics/click', remoteAddress: '192.0.2.30', payload });

  it('stores session ids from the bilko cookies over body ids', async () => {
    await app.inject({
      method: 'POST', url: '/api/analytics/click', remoteAddress: '192.0.2.20',
      headers: { cookie: `bilko_vid=${VID}; bilko_sid=${SID}` },
      payload: { path: '/blog', tag: 'a', visitor_id: BVID, session_id: BSID },
    });
    const row = await dbGet<Record<string, any>>('SELECT session_id, client_vid FROM click_events');
    expect(row?.session_id).toBe(SID);
    expect(row?.client_vid).toBe(VID);
  });

  it('falls back to valid body ids when there are no cookies', async () => {
    await postFresh({ path: '/blog', tag: 'a', visitor_id: BVID, session_id: BSID });
    const row = await dbGet<Record<string, any>>('SELECT session_id, client_vid FROM click_events');
    expect(row?.session_id).toBe(BSID);
    expect(row?.client_vid).toBe(BVID);
  });

  it('rejects malformed ids (stores NULL)', async () => {
    await postFresh({ path: '/blog', tag: 'a', visitor_id: 'not-a-uuid', session_id: "x'; DROP TABLE" });
    const row = await dbGet<Record<string, any>>('SELECT session_id, client_vid FROM click_events');
    expect(row?.session_id).toBeNull();
    expect(row?.client_vid).toBeNull();
  });

  it('stores track_name sliced to 60 chars, else NULL', async () => {
    await postFresh({ path: '/a', tag: 'a', track: 'x'.repeat(100) });
    await postFresh({ path: '/b', tag: 'a' });
    const rows = await dbAll<{ path: string; track_name: string | null }>('SELECT path, track_name FROM click_events ORDER BY id');
    expect(rows[0].track_name).toBe('x'.repeat(60));
    expect(rows[1].track_name).toBeNull();
  });
});
