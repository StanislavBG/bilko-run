import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { dbRun, initDb } from '../server/db.js';
import { creditWallet } from '../server/services/wallet.js';
import { MENU_DAILY_ASYNC_CAP } from '../shared/bilko-menu.js';

vi.mock('../server/clerk.js', () => ({
  requireAuth: async (req: any, reply: any) => {
    if (req.headers.authorization === 'Bearer clerk-ok') return 'Buyer@Example.com';
    reply.status(401).send({ error: 'Authentication required' });
    return null;
  },
}));
vi.mock('../server/services/agent-api-keys.js', () => ({
  verifyAgentApiKey: async (k: string) => (k === 'bkk_good' ? 'agent@example.com' : null),
}));

let n = 0;
const nextIp = () => `10.7.${Math.floor(n / 250)}.${(n++ % 250) + 1}`;

async function buildApp() {
  const { registerMenuOrderRoutes } = await import('../server/routes/menu-orders.js');
  const app = Fastify();
  registerMenuOrderRoutes(app);
  return app;
}
const order = (app: any, itemId: string, body: unknown, auth = 'Bearer clerk-ok', ip = nextIp()) =>
  app.inject({
    method: 'POST', url: `/api/menu/${itemId}/order`, payload: body as any,
    headers: auth ? { authorization: auth } : {}, remoteAddress: ip,
  });
const ask = (app: any, auth = 'Bearer clerk-ok', ip?: string) =>
  order(app, 'ask-bilko', { intake: { question: 'Why?' } }, auth, ip);

beforeAll(async () => { await initDb(); });
beforeEach(async () => {
  await dbRun('DELETE FROM menu_orders');
  await dbRun('DELETE FROM wallet_transactions');
  await dbRun('DELETE FROM wallet_balances');
  await dbRun('DELETE FROM web_product_orders');
});

describe('menu order routes', () => {
  it('GET /api/menu is public and cacheable', async () => {
    const app = await buildApp();
    const { menuPayload } = await import('../shared/bilko-menu.js');
    const res = await app.inject({ method: 'GET', url: '/api/menu' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    expect(res.json()).toEqual(JSON.parse(JSON.stringify(menuPayload())));
    await app.close();
  });

  it('POST orders with Clerk (web) and agent key (api) -> 201', async () => {
    const app = await buildApp();
    await creditWallet('buyer@example.com', 500, 'topup', 't1');
    await creditWallet('agent@example.com', 500, 'topup', 't2');
    const web = await ask(app, 'Bearer clerk-ok');
    expect(web.statusCode).toBe(201);
    expect(web.json()).toMatchObject({
      order: { itemId: 'ask-bilko', status: 'queued', priceCents: 50 }, balanceCents: 450,
    });
    expect(typeof web.json().order.id).toBe('number');
    const api = await ask(app, 'Bearer bkk_good');
    expect(api.statusCode).toBe(201);
    const { dbAll } = await import('../server/db.js');
    const rows = await dbAll<{ email: string; via: string }>('SELECT email, via FROM menu_orders ORDER BY id');
    expect(rows).toEqual([
      { email: 'buyer@example.com', via: 'web' },
      { email: 'agent@example.com', via: 'api' },
    ]);
    await app.close();
  });

  it('maps unknown_item 404, invalid_intake 400, live_needs_slot 400', async () => {
    const app = await buildApp();
    await creditWallet('buyer@example.com', 500, 'topup', 't1');
    expect((await order(app, 'nope', { intake: {} })).statusCode).toBe(404);
    expect((await order(app, 'ask-bilko', { intake: {} })).statusCode).toBe(400);
    expect((await order(app, 'ask-bilko', {})).statusCode).toBe(400);
    expect((await order(app, 'live-call', { intake: { topic: 'x' } })).statusCode).toBe(400);
    await app.close();
  });

  it('maps insufficient_credits to 402 with top-up url', async () => {
    const app = await buildApp();
    await creditWallet('buyer@example.com', 20, 'topup', 't1');
    const res = await ask(app, 'Bearer clerk-ok');
    expect(res.statusCode).toBe(402);
    expect(res.json()).toEqual({
      error: 'insufficient_credits', balanceCents: 20, topUpUrl: 'https://bilko.run/buy/credits-5',
    });
    await app.close();
  });

  it('maps daily_cap to 409', async () => {
    const app = await buildApp();
    await creditWallet('buyer@example.com', 1000, 'topup', 't1');
    for (let i = 0; i < MENU_DAILY_ASYNC_CAP; i++) expect((await ask(app, 'Bearer clerk-ok')).statusCode).toBe(201);
    const res = await ask(app, 'Bearer clerk-ok');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'daily_cap' });
    await app.close();
  });

  it('GET /api/menu/orders returns only the caller\'s orders, no text', async () => {
    const app = await buildApp();
    await creditWallet('buyer@example.com', 500, 'topup', 't1');
    await creditWallet('agent@example.com', 500, 'topup', 't2');
    await ask(app, 'Bearer clerk-ok');
    await ask(app, 'Bearer bkk_good');
    const res = await app.inject({
      method: 'GET', url: '/api/menu/orders', headers: { authorization: 'Bearer clerk-ok' }, remoteAddress: nextIp(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    const { orders } = res.json();
    expect(orders).toHaveLength(1);
    expect(Object.keys(orders[0]).sort()).toEqual(['createdAt', 'id', 'itemId', 'priceCents', 'status']);
    await app.close();
  });

  it('401 without auth or with an invalid key', async () => {
    const app = await buildApp();
    expect((await ask(app, '')).statusCode).toBe(401);
    expect((await ask(app, 'Bearer bkk_bad')).statusCode).toBe(401);
    for (const auth of [undefined, 'Bearer bkk_bad']) {
      const res = await app.inject({
        method: 'GET', url: '/api/menu/orders', headers: auth ? { authorization: auth } : {}, remoteAddress: nextIp(),
      });
      expect(res.statusCode).toBe(401);
    }
    await app.close();
  });

  it('rate limits to 20 order requests a minute per IP', async () => {
    const app = await buildApp();
    const ip = nextIp();
    for (let i = 0; i < 20; i++) expect((await ask(app, '', ip)).statusCode).toBe(401);
    expect((await ask(app, '', ip)).statusCode).toBe(429);
    await app.close();
  });

  it('rejects bodies over 64 KB', async () => {
    const app = await buildApp();
    const res = await order(app, 'ask-bilko', { intake: { question: 'x'.repeat(70_000) } });
    expect(res.statusCode).toBe(413);
    await app.close();
  });
});
