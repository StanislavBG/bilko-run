import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun, dbGet } from '../server/db.js';

const ADMIN_EMAIL = 'bilkobibitkov2000@gmail.com';

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return {
    ...original,
    verifyClerkToken: vi.fn().mockResolvedValue(null),
    requireAdmin: vi.fn().mockImplementation(async () => 'bilkobibitkov2000@gmail.com'),
  };
});

import { verifyClerkToken } from '../server/clerk.js';
import { registerAnalyticsRoutes } from '../server/routes/analytics.js';

const mockVerify = verifyClerkToken as ReturnType<typeof vi.fn>;
const app = Fastify({ logger: false });
registerAnalyticsRoutes(app);

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  mockVerify.mockResolvedValue(null);
  await dbRun('DELETE FROM page_views');
  await dbRun('DELETE FROM sessions');
});

const post = (payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/api/analytics/pageview', payload });

describe('POST /api/analytics/pageview', () => {
  it('ignores body.email for is_admin when there is no verified token', async () => {
    const res = await post({ path: '/x', email: ADMIN_EMAIL, visitor_id: 'v-admin-spoof', session_id: 's1' });
    expect(res.statusCode).toBe(200);
    const row = await dbGet<{ is_admin: number }>('SELECT is_admin FROM page_views WHERE visitor_id = ?', 'v-admin-spoof');
    expect(row?.is_admin).toBe(0);
  });

  it('marks is_admin=1 for a verified admin token and flags only the first view as new', async () => {
    mockVerify.mockResolvedValue(ADMIN_EMAIL);
    await post({ path: '/a', visitor_id: 'v-real', session_id: 's2' });
    await post({ path: '/b', visitor_id: 'v-real', session_id: 's2' });
    const rows = await dbAll('v-real');
    expect(rows.map(r => r.is_admin)).toEqual([1, 1]);
    expect(rows.map(r => r.is_new_visitor)).toEqual([1, 0]);
    const sess = await dbGet<{ page_count: number }>('SELECT page_count FROM sessions WHERE session_id = ?', 's2');
    expect(sess?.page_count).toBe(2);
  });

  it('returns 429 once the visitor limit is exceeded', async () => {
    let last = 200;
    for (let i = 0; i < 245; i++) {
      last = (await post({ path: '/r', visitor_id: 'v-flood' })).statusCode;
      if (last === 429) break;
    }
    expect(last).toBe(429);
  });
});

async function dbAll(visitor: string) {
  const { dbAll: all } = await import('../server/db.js');
  return all<{ is_admin: number; is_new_visitor: number }>(
    'SELECT is_admin, is_new_visitor FROM page_views WHERE visitor_id = ? ORDER BY id', visitor);
}

const V = '11111111-1111-4111-8111-111111111111';
const S = '22222222-2222-4222-8222-222222222222';
const BV = '33333333-3333-4333-8333-333333333333';
const BS = '44444444-4444-4444-8444-444444444444';

describe('POST /api/analytics/pageview session identity', () => {
  it('parses a text/plain JSON body (sendBeacon)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/analytics/pageview',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      payload: JSON.stringify({ path: '/beacon-path', visitor_id: BV, session_id: BS }),
    });
    expect(res.statusCode).toBe(200);
    const row = await dbGet<{ path: string; session_id: string }>('SELECT path, session_id FROM page_views');
    expect(row?.path).toBe('/beacon-path');
    expect(row?.session_id).toBe(BS);
  });

  it('prefers cookie ids over body ids in page_views and sessions', async () => {
    await app.inject({
      method: 'POST', url: '/api/analytics/pageview',
      headers: { cookie: `bilko_vid=${V}; bilko_sid=${S}` },
      payload: { path: '/c', visitor_id: BV, session_id: BS },
    });
    const row = await dbGet<{ visitor_id: string; session_id: string }>('SELECT visitor_id, session_id FROM page_views');
    expect(row).toMatchObject({ visitor_id: V, session_id: S });
    const sess = await dbGet<{ visitor_id: string }>('SELECT visitor_id FROM sessions WHERE session_id = ?', S);
    expect(sess?.visitor_id).toBe(V);
    const none = await dbGet('SELECT 1 FROM sessions WHERE session_id = ?', BS);
    expect(none).toBeFalsy();
  });

  it('derives email from the Clerk __session cookie when body has none', async () => {
    mockVerify.mockResolvedValueOnce(null).mockResolvedValueOnce('user@example.com');
    await app.inject({
      method: 'POST', url: '/api/analytics/pageview',
      headers: { cookie: '__session=tok9', 'user-agent': 'Mozilla/5.0 Chrome/120' },
      payload: { path: '/e', visitor_id: BV, session_id: BS },
    });
    expect(mockVerify).toHaveBeenCalledWith('Bearer tok9');
    const row = await dbGet<{ email: string; is_admin: number }>('SELECT email, is_admin FROM page_views');
    expect(row?.email).toBe('user@example.com');
    expect(row?.is_admin).toBe(0);
  });
});

describe('GET /api/analytics/stats', () => {
  it('returns 200 for days=abc instead of throwing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/analytics/stats?days=abc' });
    expect(res.statusCode).toBe(200);
  });
});
