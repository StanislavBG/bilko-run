import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';

vi.mock('../server/clerk.js', () => ({ requireAuth: vi.fn() }));

import { requireAuth } from '../server/clerk.js';
import { dbRun, dbGet, initDb } from '../server/db.js';
import { creditPlay, getPlayBalance, purchasePlayItem } from '../server/services/play-currency.js';
import { registerPlayCurrencyRoutes, resetPlayCurrencyRouteState } from '../server/routes/play-currency.js';

const APP = 'threewinds';
const ALICE = 'alice@test.com';
const PEARL_PRICE = 18888;
const PEARL_LIMIT = 888;

function authAs(user: string | null) {
  vi.mocked(requireAuth).mockImplementation(async (_req: any, reply: any) => {
    if (!user) { reply.code(401).send({ error: 'unauthorized' }); return null; }
    return user;
  });
}

async function call(method: 'GET' | 'POST', url: string, user: string | null = ALICE) {
  authAs(user);
  const app = Fastify();
  registerPlayCurrencyRoutes(app);
  const res = await app.inject({ method, url });
  await app.close();
  return res;
}

beforeAll(async () => { await initDb(); });
beforeEach(async () => {
  await dbRun('DELETE FROM play_entitlements');
  await dbRun('DELETE FROM play_ledger');
  await dbRun('DELETE FROM play_balances');
  resetPlayCurrencyRouteState();
});

describe('purchasePlayItem', () => {
  it('debits the price and records the entitlement in one step', async () => {
    await creditPlay(APP, ALICE, 10000, 'purchase', 'p1');
    const r = await purchasePlayItem(APP, ALICE, 'ink');
    expect(r).toEqual({ ok: true, itemId: 'ink', serial: null, balance: 10000 - 3888 });
    expect((await getPlayBalance(APP, ALICE)).balance).toBe(10000 - 3888);
    const row = await dbGet<{ serial: number | null }>(
      'SELECT serial FROM play_entitlements WHERE app = ? AND email = ? AND item_id = ?', APP, ALICE, 'ink');
    expect(row).toBeTruthy();
    expect(row?.serial ?? null).toBeNull();
  });

  it('refuses with insufficient taels and changes nothing', async () => {
    await creditPlay(APP, ALICE, 100, 'purchase', 'p1');
    expect(await purchasePlayItem(APP, ALICE, 'ink')).toEqual({ ok: false, error: 'insufficient_taels' });
    expect((await getPlayBalance(APP, ALICE)).balance).toBe(100);
    expect(await dbGet('SELECT 1 FROM play_entitlements WHERE email = ?', ALICE)).toBeFalsy();
  });

  it('refuses an owned item without debiting again', async () => {
    await creditPlay(APP, ALICE, 20000, 'purchase', 'p1');
    expect((await purchasePlayItem(APP, ALICE, 'jade')).ok).toBe(true);
    expect(await purchasePlayItem(APP, ALICE, 'jade')).toEqual({ ok: false, error: 'already_owned' });
    expect((await getPlayBalance(APP, ALICE)).balance).toBe(20000 - 6888);
    // A default-owned free item is owned without a row and cannot be bought.
    expect(await purchasePlayItem(APP, ALICE, 'ivory')).toEqual({ ok: false, error: 'already_owned' });
    expect(await dbGet('SELECT 1 FROM play_entitlements WHERE item_id = ?', 'ivory')).toBeFalsy();
  });

  it('numbers limited items and refuses once the limit is sold', async () => {
    await creditPlay(APP, ALICE, PEARL_PRICE * 2, 'purchase', 'p1');
    expect(await purchasePlayItem(APP, ALICE, 'pearl')).toEqual({ ok: true, itemId: 'pearl', serial: 1, balance: PEARL_PRICE });
    for (let i = 2; i <= PEARL_LIMIT; i++) {
      await dbRun('INSERT INTO play_entitlements (app, email, item_id, acquired_at, serial) VALUES (?, ?, ?, ?, ?)',
        APP, `p${i}@test.com`, 'pearl', 0, i);
    }
    const bob = 'bob@test.com';
    await creditPlay(APP, bob, PEARL_PRICE, 'purchase', 'p1');
    expect(await purchasePlayItem(APP, bob, 'pearl')).toEqual({ ok: false, error: 'sold_out' });
    expect((await getPlayBalance(APP, bob)).balance).toBe(PEARL_PRICE);
  });

  it('refuses an unknown item', async () => {
    expect(await purchasePlayItem(APP, ALICE, 'nope')).toEqual({ ok: false, error: 'unknown_item' });
    expect(await purchasePlayItem('other-app', ALICE, 'ink')).toEqual({ ok: false, error: 'unknown_item' });
  });
});

describe('entitlement routes', () => {
  it('POST purchase returns 201 with serial and balance, then 409 already_owned', async () => {
    await creditPlay(APP, ALICE, PEARL_PRICE, 'purchase', 'p1');
    const res = await call('POST', `/api/play-currency/items/pearl/purchase?app=${APP}`);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ itemId: 'pearl', serial: 1, balance: 0 });
    const again = await call('POST', `/api/play-currency/items/pearl/purchase?app=${APP}`);
    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ error: 'already_owned' });
  });

  it('POST purchase maps insufficient, unknown and sold-out errors', async () => {
    const poor = await call('POST', `/api/play-currency/items/ink/purchase?app=${APP}`);
    expect(poor.statusCode).toBe(402);
    expect(poor.json()).toEqual({ error: 'insufficient_taels' });
    const unknown = await call('POST', `/api/play-currency/items/nope/purchase?app=${APP}`);
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json()).toEqual({ error: 'unknown_item' });
    for (let i = 1; i <= PEARL_LIMIT; i++) {
      await dbRun('INSERT INTO play_entitlements (app, email, item_id, acquired_at, serial) VALUES (?, ?, ?, ?, ?)',
        APP, `p${i}@test.com`, 'pearl', 0, i);
    }
    await creditPlay(APP, ALICE, PEARL_PRICE, 'purchase', 'p1');
    const sold = await call('POST', `/api/play-currency/items/pearl/purchase?app=${APP}`);
    expect(sold.statusCode).toBe(409);
    expect(sold.json()).toEqual({ error: 'sold_out' });
  });

  it('POST purchase requires auth and a known app', async () => {
    expect((await call('POST', `/api/play-currency/items/ink/purchase?app=${APP}`, null)).statusCode).toBe(401);
    const bad = await call('POST', '/api/play-currency/items/ink/purchase?app=nope');
    expect(bad.statusCode).toBe(400);
  });

  it('GET entitlements lists default-owned and bought items', async () => {
    const empty = await call('GET', `/api/play-currency/entitlements?app=${APP}`);
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual({ items: [{ itemId: 'ivory' }] });
    await creditPlay(APP, ALICE, PEARL_PRICE + 3888, 'purchase', 'p1');
    await purchasePlayItem(APP, ALICE, 'pearl');
    await purchasePlayItem(APP, ALICE, 'ink');
    const res = await call('GET', `/api/play-currency/entitlements?app=${APP}`);
    expect(res.json().items).toEqual(expect.arrayContaining([{ itemId: 'ivory' }, { itemId: 'pearl', serial: 1 }, { itemId: 'ink' }]));
    expect(res.json().items).toHaveLength(3);
    expect((await call('GET', `/api/play-currency/entitlements?app=${APP}`, null)).statusCode).toBe(401);
    expect((await call('GET', '/api/play-currency/entitlements?app=nope')).statusCode).toBe(400);
  });
});
