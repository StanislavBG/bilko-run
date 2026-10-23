import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun } from '../server/db.js';

const adminOk = vi.hoisted(() => ({ value: true }));
const draftMock = vi.hoisted(() => vi.fn());
const mailMock = vi.hoisted(() => vi.fn());

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
vi.mock('../server/services/menu-drafts.js', () => ({ draftMenuOrder: draftMock }));
vi.mock('../server/services/mailer.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/services/mailer.js')>();
  return { ...original, sendMail: mailMock };
});

import { registerAdminMenuOrderRoutes } from '../server/routes/admin-menu-orders.js';
import { getOrder } from '../server/services/menu-orders.js';
import { getWalletCents } from '../server/services/wallet.js';
import { MENU_DAILY_ASYNC_CAP } from '../shared/bilko-menu.js';

const app = Fastify({ logger: false });
registerAdminMenuOrderRoutes(app);
const H = { authorization: 'Bearer x' };
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());

async function insert(ref: string, status: string, email = 'buyer@t.dev'): Promise<number> {
  await dbRun(
    `INSERT INTO menu_orders (ref, item_id, email, price_cents, kind, intake_json, status, via, created_day, created_at, updated_at)
     VALUES (?, 'ask-bilko', ?, 500, 'async', '{"question":"q"}', ?, 'web', ?, 1, 1)`,
    ref, email, status, day,
  );
  const row = (await app.inject({ method: 'GET', url: '/api/admin/menu-orders', headers: H })).json().orders
    .find((o: any) => o.ref === ref);
  return row.id;
}

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  adminOk.value = true;
  draftMock.mockReset();
  mailMock.mockReset();
  await dbRun('DELETE FROM menu_orders');
});

describe('admin menu orders', () => {
  it('401 without auth, 403 for non-admin', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/admin/menu-orders' })).statusCode).toBe(401);
    adminOk.value = false;
    expect((await app.inject({ method: 'GET', url: '/api/admin/menu-orders', headers: H })).statusCode).toBe(403);
  });

  it('lists newest first with async count and cap, filterable by status', async () => {
    const a = await insert('r-a', 'queued');
    const b = await insert('r-b', 'drafted');
    const res = (await app.inject({ method: 'GET', url: '/api/admin/menu-orders', headers: H })).json();
    expect(res.orders.map((o: any) => o.id)).toEqual([b, a]);
    expect(res.orders[0].intake).toEqual({ question: 'q' });
    expect(res.asyncToday).toBe(2);
    expect(res.asyncCap).toBe(MENU_DAILY_ASYNC_CAP);
    const f = (await app.inject({ method: 'GET', url: '/api/admin/menu-orders?status=queued', headers: H })).json();
    expect(f.orders.map((o: any) => o.id)).toEqual([a]);
  });

  it('draft returns the draft; Gemini failure -> 502, order unchanged', async () => {
    const id = await insert('r-d', 'queued');
    draftMock.mockResolvedValueOnce('hello draft');
    const ok = await app.inject({ method: 'POST', url: `/api/admin/menu-orders/${id}/draft`, headers: H });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().draft).toBe('hello draft');
    draftMock.mockRejectedValueOnce(new Error('gemini down'));
    const bad = await app.inject({ method: 'POST', url: `/api/admin/menu-orders/${id}/draft`, headers: H });
    expect(bad.statusCode).toBe(502);
    expect((await getOrder(id))?.status).toBe('queued');
  });

  it('approve emails escaped body and delivers on sent', async () => {
    const id = await insert('r-s', 'drafted');
    mailMock.mockResolvedValueOnce({ sent: true, id: 'm1' });
    const res = await app.inject({
      method: 'POST', url: `/api/admin/menu-orders/${id}/approve`, headers: H, payload: { body: 'a <b>\nline2' },
    });
    expect(res.statusCode).toBe(200);
    expect(mailMock).toHaveBeenCalledWith({
      to: 'buyer@t.dev', subject: 'Your Ask Bilko from Bilko', text: 'a <b>\nline2', html: 'a &lt;b&gt;<br>line2',
    });
    const o = await getOrder(id);
    expect(o?.status).toBe('delivered');
    expect(o?.delivered_body).toBe('a <b>\nline2');
  });

  it('approve not sent -> 502, order stays drafted; bad body -> 400', async () => {
    const id = await insert('r-n', 'drafted');
    mailMock.mockResolvedValueOnce({ sent: false, reason: 'unconfigured' });
    const res = await app.inject({
      method: 'POST', url: `/api/admin/menu-orders/${id}/approve`, headers: H, payload: { body: 'x' },
    });
    expect(res.statusCode).toBe(502);
    expect((await getOrder(id))?.status).toBe('drafted');
    const empty = await app.inject({
      method: 'POST', url: `/api/admin/menu-orders/${id}/approve`, headers: H, payload: { body: '' },
    });
    expect(empty.statusCode).toBe(400);
    expect(mailMock).toHaveBeenCalledTimes(1);
  });

  it('refund once, second refund -> 409 and wallet credited once', async () => {
    const id = await insert('r-r', 'queued', 'refund@t.dev');
    const before = await getWalletCents('refund@t.dev');
    const first = await app.inject({ method: 'POST', url: `/api/admin/menu-orders/${id}/refund`, headers: H });
    expect(first.statusCode).toBe(200);
    expect(first.json().order.status).toBe('refunded');
    const second = await app.inject({ method: 'POST', url: `/api/admin/menu-orders/${id}/refund`, headers: H });
    expect(second.statusCode).toBe(409);
    expect(await getWalletCents('refund@t.dev')).toBe(before + 500);
  });
});
