import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';

// The temporary live-test switch PLAY_CURRENCY_FREE_PACKS: while it lists an app, checkout
// credits the pack's taels with no payment and never opens a Stripe session. Real play
// ledger (per-file throwaway DB); only Clerk and Stripe are mocked.

const create = vi.fn();
vi.mock('../server/clerk.js', () => ({ requireAuth: vi.fn() }));
vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => ({ checkout: { sessions: { create } } }),
}));

import { requireAuth } from '../server/clerk.js';
import { dbAll, dbRun, initDb } from '../server/db.js';
import { getPlayBalance } from '../server/services/play-currency.js';
import { registerPlayCurrencyRoutes, resetPlayCurrencyRouteState } from '../server/routes/play-currency.js';

const APP = 'threewinds';
const USER = 'player@test.com';
const PURSE = 26000;
const PURSE_BODY = { app: APP, packId: 'purse', currency: 'usd' };

function authAs(user: string | null) {
  vi.mocked(requireAuth).mockImplementation(async (_req: any, reply: any) => {
    if (!user) { reply.code(401).send({ error: 'unauthorized' }); return null as any; }
    return user;
  });
}

async function build() {
  const app = Fastify();
  registerPlayCurrencyRoutes(app);
  return app;
}

async function checkout(body: Record<string, unknown> = PURSE_BODY) {
  const app = await build();
  const res = await app.inject({ method: 'POST', url: '/api/play-currency/checkout', payload: body });
  await app.close();
  return res;
}

async function balanceRoute() {
  const app = await build();
  const res = await app.inject({ method: 'GET', url: `/api/play-currency/balance?app=${APP}` });
  await app.close();
  return res;
}

function ledger() {
  return dbAll<{ account: string; amount: number; kind: string; ref: string }>(
    'SELECT account, amount, kind, ref FROM play_ledger WHERE app = ? ORDER BY id', APP);
}

beforeAll(async () => { await initDb(); });

describe('PLAY_CURRENCY_FREE_PACKS (free tael packs for a live test)', () => {
  const OLD_ENV = process.env;
  beforeEach(async () => {
    vi.clearAllMocks();
    await dbRun('DELETE FROM play_ledger');
    await dbRun('DELETE FROM play_balances');
    resetPlayCurrencyRouteState();
    process.env = { ...OLD_ENV };
    delete process.env.PLAY_CURRENCY_SALES_OPEN;
    delete process.env.PLAY_CURRENCY_FREE_PACKS;
    authAs(USER);
    create.mockResolvedValue({ url: 'https://checkout.stripe.test/s' });
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  describe('switch off', () => {
    it('keeps checkout closed (409 sales_closed) and credits nothing', async () => {
      const res = await checkout();
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: 'sales_closed' });
      expect(create).not.toHaveBeenCalled();
      expect(await ledger()).toEqual([]);
    });

    it('stays a paid Stripe session when sales are open', async () => {
      process.env.PLAY_CURRENCY_SALES_OPEN = APP;
      const res = await checkout();
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ url: 'https://checkout.stripe.test/s' });
      expect(create).toHaveBeenCalledTimes(1);
      expect(await ledger()).toEqual([]);
    });

    it('is off for an app the switch does not list', async () => {
      process.env.PLAY_CURRENCY_FREE_PACKS = 'otherapp';
      expect((await checkout()).statusCode).toBe(409);
      expect(await ledger()).toEqual([]);
    });
  });

  describe('switch on', () => {
    beforeEach(() => { process.env.PLAY_CURRENCY_FREE_PACKS = `otherapp, ${APP}`; });

    it('credits the pack at once with no Stripe session', async () => {
      expect((await getPlayBalance(APP, USER)).balance).toBe(0);
      const res = await checkout();
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(res.json()).toEqual({ credited: true, packId: 'purse', taels: PURSE, balance: PURSE });
      expect((await getPlayBalance(APP, USER)).balance).toBe(PURSE);
      expect(create).not.toHaveBeenCalled();
    });

    it('never opens a Stripe session, even when PLAY_CURRENCY_SALES_OPEN also lists the app', async () => {
      process.env.PLAY_CURRENCY_SALES_OPEN = APP;
      const res = await checkout({ app: APP, packId: 'vault', currency: 'myr' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ credited: true, packId: 'vault', taels: 650000, balance: 650000 });
      expect(create).not.toHaveBeenCalled();
    });

    it('credits every call, each under its own ref, all with kind free_test_pack', async () => {
      expect((await checkout()).json().balance).toBe(PURSE);
      expect((await checkout()).json().balance).toBe(2 * PURSE);
      const rows = await ledger();
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.kind === 'free_test_pack' && r.account === USER && Number(r.amount) === PURSE)).toBe(true);
      expect(rows.every((r) => /^free_test:[0-9a-f-]{36}$/.test(r.ref))).toBe(true);
      expect(new Set(rows.map((r) => r.ref)).size).toBe(2);
    });

    it('still answers 401 when signed out, crediting nothing', async () => {
      authAs(null);
      expect((await checkout()).statusCode).toBe(401);
      expect(await ledger()).toEqual([]);
    });

    it('still rate limits at 10 per minute per user', async () => {
      const app = await build();
      const codes: number[] = [];
      for (let i = 0; i < 11; i++) {
        codes.push((await app.inject({ method: 'POST', url: '/api/play-currency/checkout', payload: { app: APP, packId: 'pouch', currency: 'usd' } })).statusCode);
      }
      await app.close();
      expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
      expect(codes[10]).toBe(429);
      expect(await ledger()).toHaveLength(10);
      expect((await getPlayBalance(APP, USER)).balance).toBe(10 * 5000);
    });

    it('still rejects an unknown app, pack or currency with 400, crediting nothing', async () => {
      expect((await checkout({ app: 'nope', packId: 'purse', currency: 'usd' })).json()).toEqual({ error: 'unknown_app' });
      expect((await checkout({ app: APP, packId: 'nope', currency: 'usd' })).json()).toEqual({ error: 'unknown_pack' });
      const res = await checkout({ app: APP, packId: 'purse', currency: 'eur' });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'unknown_currency' });
      expect(await ledger()).toEqual([]);
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('balance', () => {
    it('reports freePacks only while the switch lists the app', async () => {
      expect((await balanceRoute()).json()).toEqual({ balance: 5000, held: 0, salesOpen: false, freePacks: false });
      process.env.PLAY_CURRENCY_FREE_PACKS = APP;
      expect((await balanceRoute()).json()).toEqual({ balance: 5000, held: 0, salesOpen: false, freePacks: true });
      process.env.PLAY_CURRENCY_FREE_PACKS = 'otherapp';
      expect((await balanceRoute()).json()).toMatchObject({ freePacks: false });
    });
  });
});
