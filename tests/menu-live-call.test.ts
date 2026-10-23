import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { dbAll, dbRun, initDb } from '../server/db.js';
import { creditWallet, getWalletCents } from '../server/services/wallet.js';
import { claimSlot } from '../server/services/service-bookings.js';
import { SERVICE_SLOT_CONFIG, generateSlots } from '../shared/service-slots.js';

vi.mock('../server/clerk.js', () => ({
  requireAuth: async (req: any, reply: any) => {
    if (req.headers.authorization === 'Bearer clerk-ok') return 'Buyer@Example.com';
    reply.status(401).send({ error: 'Authentication required' });
    return null;
  },
}));
vi.mock('../server/services/agent-api-keys.js', () => ({ verifyAgentApiKey: async () => null }));
vi.mock('../server/services/mailer.js', async (orig) => ({
  ...(await orig<typeof import('../server/services/mailer.js')>()),
  sendMail: vi.fn(async () => ({ sent: true, id: 'x' })),
}));

let n = 0;
const nextIp = () => `10.9.${Math.floor(n / 250)}.${(n++ % 250) + 1}`;
const slots = () => generateSlots(SERVICE_SLOT_CONFIG['human-for-hire'], Date.now());

async function buildApp() {
  const { registerMenuOrderRoutes } = await import('../server/routes/menu-orders.js');
  const { registerServiceBookingRoutes } = await import('../server/routes/service-bookings.js');
  const app = Fastify();
  registerMenuOrderRoutes(app);
  registerServiceBookingRoutes(app);
  return app;
}
const book = (app: any, body: unknown) =>
  app.inject({
    method: 'POST', url: '/api/menu/live-call/order', payload: body as any,
    headers: { authorization: 'Bearer clerk-ok' }, remoteAddress: nextIp(),
  });

beforeAll(async () => { await initDb(); });
beforeEach(async () => {
  await dbRun('DELETE FROM menu_orders');
  await dbRun('DELETE FROM service_bookings');
  await dbRun('DELETE FROM wallet_transactions');
  await dbRun('DELETE FROM wallet_balances');
});

describe('live call booking', () => {
  it('books a slot: 201, debits 900, slot leaves the list, order is booked', async () => {
    const app = await buildApp();
    await creditWallet('buyer@example.com', 1000, 'topup', 't1');
    const slot = slots()[0];
    const res = await book(app, { startMs: slot.startMs, intake: { topic: 'agents' } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ booking: { startMs: slot.startMs, endMs: slot.endMs }, balanceCents: 100, emailed: true });
    expect(await getWalletCents('buyer@example.com')).toBe(100);
    const rows = await dbAll<any>('SELECT status FROM menu_orders');
    expect(rows.map((r) => r.status)).toEqual(['booked']);
    const list = await app.inject({ method: 'GET', url: '/api/services/human-for-hire/slots' });
    expect(list.json().slots.map((s: any) => s.startMs)).not.toContain(slot.startMs);
    await app.close();
  });

  it('slot taken at claim time: 409 and refunded', async () => {
    const app = await buildApp();
    await creditWallet('buyer@example.com', 1000, 'topup', 't1');
    const slot = slots()[1];
    // Race: slot looks open, but gets claimed between the open check and claimSlot.
    const svc = await import('../server/services/service-bookings.js');
    const spy = vi.spyOn(svc, 'claimSlot').mockResolvedValueOnce({ status: 'taken' });
    const res = await book(app, { startMs: slot.startMs, intake: { topic: 'x' } });
    spy.mockRestore();
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'slot_unavailable' });
    expect(await getWalletCents('buyer@example.com')).toBe(1000);
    await app.close();
  });

  it('already-claimed slot: 409, no charge', async () => {
    const app = await buildApp();
    await creditWallet('buyer@example.com', 1000, 'topup', 't1');
    const slot = slots()[0];
    await claimSlot({ pageSlug: 'human-for-hire', slug: 'live-call', checkoutSessionId: 'other', startMs: slot.startMs, endMs: slot.endMs, email: 'o@x.com', intake: {}, sessionsPerMonth: 1 });
    const res = await book(app, { startMs: slot.startMs, intake: { topic: 'x' } });
    expect(res.statusCode).toBe(409);
    expect(await getWalletCents('buyer@example.com')).toBe(1000);
    await app.close();
  });

  it('unknown slot: 409, no charge', async () => {
    const app = await buildApp();
    await creditWallet('buyer@example.com', 1000, 'topup', 't1');
    const res = await book(app, { startMs: 12345, intake: { topic: 'x' } });
    expect(res.statusCode).toBe(409);
    expect(await getWalletCents('buyer@example.com')).toBe(1000);
    await app.close();
  });

  it('insufficient credits: 402, slot stays open', async () => {
    const app = await buildApp();
    await creditWallet('buyer@example.com', 100, 'topup', 't1');
    const slot = slots()[0];
    const res = await book(app, { startMs: slot.startMs, intake: { topic: 'x' } });
    expect(res.statusCode).toBe(402);
    expect(res.json()).toMatchObject({ error: 'insufficient_credits', balanceCents: 100 });
    const list = await app.inject({ method: 'GET', url: '/api/services/human-for-hire/slots' });
    expect(list.json().slots.map((s: any) => s.startMs)).toContain(slot.startMs);
    await app.close();
  });
});
