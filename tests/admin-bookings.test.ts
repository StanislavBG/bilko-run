import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbAll, dbRun } from '../server/db.js';

const adminOk = vi.hoisted(() => ({ value: true }));

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return {
    ...original,
    requireAdmin: vi.fn().mockImplementation(async (_req: unknown, reply: any) => {
      if (adminOk.value) return 'admin@t.dev';
      reply.status(403).send({ error: 'Forbidden' });
      return null;
    }),
  };
});

import { registerAdminBookingRoutes } from '../server/routes/admin-bookings.js';

const app = Fastify({ logger: false });
registerAdminBookingRoutes(app);

const DAY = 86400000;
const get = async (q = '') => (await app.inject({ method: 'GET', url: `/api/admin/bookings${q}` }));

async function booking(o: { slug?: string; token: string; start: number; email: string; created: number; topic?: string }) {
  await dbRun(
    `INSERT INTO service_bookings (page_slug, slug, checkout_session_id, slot_start_ms, slot_end_ms, email, intake_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    'human-for-hire', o.slug ?? 'free-hour', o.token, o.start, o.start + 3600000, o.email,
    JSON.stringify({ topic: o.topic ?? 'hello' }), o.created,
  );
}
async function order(id: string, email: string, amount: number, created: number, slug = 'bilko-hour') {
  await dbRun(
    `INSERT INTO web_product_orders (checkout_session_id, slug, email, amount_total, currency, payment_status, created_at)
     VALUES (?, ?, ?, ?, 'usd', 'paid', ?)`, id, slug, email, amount, created);
}

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  adminOk.value = true;
  delete process.env.BILKO_INBOX;
  for (const t of ['funnel_events', 'web_product_orders', 'service_bookings']) await dbRun(`DELETE FROM ${t}`);
});

describe('GET /api/admin/bookings', () => {
  it('403s non-admins and clamps days', async () => {
    adminOk.value = false;
    expect((await get()).statusCode).toBe(403);
    adminOk.value = true;
    expect((await get()).json().days).toBe(7);
    expect((await get('?days=0')).json().days).toBe(1);
    expect((await get('?days=9999')).json().days).toBe(365);
    expect((await get('?days=30')).json().days).toBe(30);
    expect(Object.keys((await get()).json()).sort()).toEqual(
      ['days', 'free_hours_booked', 'mailer_configured', 'paid_hours', 'paid_orders', 'upcoming'],
    );
  });

  it('counts free hours in window and excludes owner addresses', async () => {
    process.env.BILKO_INBOX = 'Inbox@Example.com';
    const now = Date.now();
    await booking({ token: 't1', start: now + DAY, email: 'a@x.com', created: now - DAY });
    await booking({ token: 't2', start: now + 2 * DAY, email: 'old@x.com', created: now - 20 * DAY });
    await booking({ token: 't3', start: now + 3 * DAY, email: 'bilkobibitkov2000@gmail.com', created: now - DAY });
    await booking({ token: 't4', start: now + 4 * DAY, email: 'bilko@bilko.run', created: now - DAY });
    await booking({ token: 't5', start: now + 5 * DAY, email: 'inbox@example.com', created: now - DAY });
    expect((await get('?days=7')).json().free_hours_booked).toBe(1);
    expect((await get('?days=30')).json().free_hours_booked).toBe(2);
  });

  it('sums and lists paid hours excluding tests, owners and owner checkouts', async () => {
    const now = Date.now();
    await order('cs_live_1', 'a@x.com', 10000, now - 2 * DAY);
    await order('cs_live_2', 'b@x.com', 20000, now - DAY);
    await order('cs_test_3', 'c@x.com', 10000, now - DAY);
    await order('cs_live_4', 'bilko@bilko.run', 10000, now - DAY);
    await order('cs_live_5', 'd@x.com', 10000, now - DAY);
    await order('cs_live_6', 'e@x.com', 10000, now - 20 * DAY);
    await order('cs_live_7', 'f@x.com', 10000, now - DAY, 'other');
    await dbRun(
      `INSERT INTO funnel_events (event, tool, is_admin, metadata) VALUES ('checkout_start', 'bilko-hour', 1, ?)`,
      JSON.stringify({ checkout_session_id: 'cs_live_5' }));
    const res = await get('?days=7');
    expect(res.json().paid_hours).toBe(3);
    expect(res.json().paid_orders).toEqual([
      { email: 'a@x.com', hours: 1, createdAt: now - 2 * DAY },
      { email: 'b@x.com', hours: 2, createdAt: now - DAY },
    ]);
    expect(res.body).not.toContain('cs_live');
  });

  it('lists upcoming bookings soonest first without the cancel token', async () => {
    const now = Date.now();
    await booking({ token: 'secret-b', start: now + 2 * DAY, email: 'b@x.com', created: now, topic: 'second' });
    await booking({ token: 'secret-a', start: now + DAY, email: 'a@x.com', created: now, topic: 'first' });
    await booking({ token: 'secret-p', start: now - DAY, email: 'p@x.com', created: now - 2 * DAY });
    const res = await get();
    const body = res.json();
    expect(body.upcoming.map((u: any) => u.topic)).toEqual(['first', 'second']);
    expect(Object.keys(body.upcoming[0]).sort()).toEqual(
      ['createdAt', 'email', 'endMs', 'icsSequence', 'id', 'slug', 'startMs', 'tags', 'topic'],
    );
    expect(res.body).not.toContain('secret-');
  });

  it('carries each booking id and .ics SEQUENCE, the parts of its UID booking-<id>@bilko.run', async () => {
    const now = Date.now();
    await booking({ token: 'tok-a', start: now + DAY, email: 'a@x.com', created: now });
    await booking({ token: 'tok-b', start: now + 2 * DAY, email: 'b@x.com', created: now });
    await dbRun('UPDATE service_bookings SET ics_sequence = 2 WHERE checkout_session_id = ?', 'tok-b');
    const rows = await dbAll<{ id: number; checkout_session_id: string }>(
      'SELECT id, checkout_session_id FROM service_bookings ORDER BY slot_start_ms');
    const upcoming = (await get()).json().upcoming;
    expect(upcoming.map((u: any) => [u.id, u.icsSequence])).toEqual([[rows[0].id, 0], [rows[1].id, 2]]);
    expect(rows.map((r) => r.checkout_session_id)).toEqual(['tok-a', 'tok-b']);
  });
});
