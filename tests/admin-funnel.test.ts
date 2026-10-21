import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';

const { verifyTokenMock, getUserMock, createClerkClientMock } = vi.hoisted(() => ({
  verifyTokenMock: vi.fn(),
  getUserMock: vi.fn(),
  createClerkClientMock: vi.fn(),
}));

vi.mock('@clerk/backend', () => ({
  verifyToken: verifyTokenMock,
  createClerkClient: createClerkClientMock,
}));

import { initDb, dbRun } from '../server/db.js';
import { registerAdminFunnelRoutes } from '../server/routes/admin-funnel.js';
import { mintAdminApiKey } from '../server/services/admin-api-keys.js';

const ADMIN_EMAIL = 'bilkobibitkov2000@gmail.com';
const app = Fastify({ logger: false });
registerAdminFunnelRoutes(app);

const DAY = 86400000;
const now = Date.now();
const since = new Date(now - 7 * DAY).toISOString().slice(0, 10);
const sqlTs = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
let key = '';

async function session(sid: string, vid: string, utm: string | null, opts: { email?: string; purchased?: number; ago?: number; bot?: number; admin?: number } = {}) {
  const started = now - (opts.ago ?? 1) * DAY;
  await dbRun(
    'INSERT INTO sessions (session_id, visitor_id, started_at, ended_at, utm_source, email, purchased) VALUES (?, ?, ?, ?, ?, ?, ?)',
    sid, vid, started, started, utm, opts.email ?? null, opts.purchased ?? 0,
  );
  await dbRun(
    'INSERT INTO page_views (path, date, session_id, visitor_id, utm_source, is_bot, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)',
    '/', new Date(started).toISOString().slice(0, 10), sid, vid, utm, opts.bot ?? 0, opts.admin ?? 0,
  );
}

async function checkoutStart(vid: string, csId: string, isAdmin = 0) {
  await dbRun(
    'INSERT INTO funnel_events (event, tool, metadata, session_id, visitor_id, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    'checkout_start', 'human-for-hire', JSON.stringify({ checkout_session_id: csId }), null, vid, isAdmin, sqlTs(now - DAY),
  );
}

beforeAll(async () => {
  process.env.CLERK_SECRET_KEY = 'test-secret';
  createClerkClientMock.mockReturnValue({ users: { getUser: getUserMock } });
  verifyTokenMock.mockRejectedValue(new Error('invalid token'));
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  for (const t of ['sessions', 'page_views', 'funnel_events', 'web_product_orders', 'service_bookings', 'admin_api_keys']) {
    await dbRun(`DELETE FROM ${t}`);
  }
  key = (await mintAdminApiKey(ADMIN_EMAIL, 'test')).key;

  // v1: burrow visit, later signs in, checks out, pays (matched by Stripe session id), books.
  await session('s1', 'v1', 'burrow');
  await session('s1b', 'v1', null, { email: 'buyer@t.dev', ago: 0 });
  await checkoutStart('v1', 'cs_1');
  await dbRun('INSERT INTO web_product_orders (checkout_session_id, slug, email, payment_status, created_at) VALUES (?, ?, ?, ?, ?)',
    'cs_1', 'human-for-hire', 'buyer@t.dev', 'paid', now - DAY);
  await dbRun(`INSERT INTO service_bookings (page_slug, slug, checkout_session_id, slot_start_ms, slot_end_ms, email, intake_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 'human-for-hire', 'human-for-hire', 'cs_1', now + DAY, now + DAY + 3600000, 'buyer@t.dev', '{}', now);
  // v2: burrow visit (upper-case tag), checkout started but never paid.
  await session('s2', 'v2', 'Burrow');
  await checkoutStart('v2', 'cs_2');
  // v3: burrow visit, one-time purchase flagged on the session itself.
  await session('s3', 'v3', 'burrow', { email: 'p@t.dev', purchased: 1 });
  // Excluded: other source, bot, admin, too old.
  await session('s4', 'v4', 'google', { email: 'g@t.dev', purchased: 1 });
  await checkoutStart('v4', 'cs_4');
  await session('s5', 'v5', 'burrow', { bot: 1 });
  await session('s6', 'v6', 'burrow', { email: ADMIN_EMAIL, admin: 1 });
  await checkoutStart('v6', 'cs_6', 1);
  await session('s7', 'v7', 'burrow', { ago: 30 });
});

const get = (qs: string, headers: Record<string, string> = { authorization: `Bearer ${key}` }) =>
  app.inject({ method: 'GET', url: `/api/admin/funnel${qs}`, headers });

describe('GET /api/admin/funnel', () => {
  it('returns the per-UTM funnel for a bka_ admin key, excluding other sources, bots, admins and old sessions', async () => {
    const res = await get(`?since=${since}&utm_source=burrow`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      since, utm_source: 'burrow',
      visits: 3, sign_ins: 2, checkout_start: 2, paid: 2, booked: 1,
    });
  });

  it('defaults since to 7 days ago', async () => {
    const res = await get('?utm_source=burrow');
    expect(res.statusCode).toBe(200);
    expect(res.json().since).toBe(since);
    expect(res.json().visits).toBe(3);
  });

  it('returns zeros for a source with no traffic', async () => {
    const body = (await get(`?since=${since}&utm_source=nobody`)).json();
    expect(body).toMatchObject({ visits: 0, sign_ins: 0, checkout_start: 0, paid: 0, booked: 0 });
  });

  it('include_bots=1 and exclude_self=0 widen the set', async () => {
    const body = (await get(`?since=${since}&utm_source=burrow&include_bots=1&exclude_self=0`)).json();
    expect(body.visits).toBe(5);
    expect(body.checkout_start).toBe(3);
  });

  it('a wider since window picks up older sessions', async () => {
    const old = new Date(now - 60 * DAY).toISOString().slice(0, 10);
    expect((await get(`?since=${old}&utm_source=burrow`)).json().visits).toBe(4);
  });

  it('403 without admin auth', async () => {
    expect((await get(`?utm_source=burrow`, {})).statusCode).toBe(403);
    expect((await get(`?utm_source=burrow`, { authorization: 'Bearer bka_nope' })).statusCode).toBe(403);
  });

  it('400 on missing utm_source or malformed since', async () => {
    expect((await get('')).statusCode).toBe(400);
    expect((await get('?utm_source=burrow&since=last-week')).statusCode).toBe(400);
  });
});
