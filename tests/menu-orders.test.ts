import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { dbRun, dbGet, initDb } from '../server/db.js';
import * as wallet from '../server/services/wallet.js';
import * as products from '../server/services/web-products.js';
import { availableMenuPayload } from '../server/services/menu-orders.js';
import { creditWallet, getWalletCents } from '../server/services/wallet.js';
import { hasOrderForEmail } from '../server/services/web-products.js';
import {
  placeMenuOrder, listOrders, listOrdersForEmail,
} from '../server/services/menu-orders.js';

const E = 'buyer@test.com';
const kit = (email = E) => placeMenuOrder({ email, itemId: 'agent-factory-kit', intake: {}, via: 'web' });

beforeAll(async () => { await initDb(); });
afterEach(() => { vi.restoreAllMocks(); });
beforeEach(async () => {
  vi.spyOn(products, 'isReleaseStored').mockResolvedValue(true);
  await dbRun('DELETE FROM menu_orders');
  await dbRun('DELETE FROM wallet_transactions');
  await dbRun('DELETE FROM wallet_balances');
  await dbRun('DELETE FROM web_product_orders');
});

describe('placeMenuOrder', () => {
  it('rejects unknown item, invalid intake and retired ids', async () => {
    await creditWallet(E, 500, 'topup', 't1');
    expect((await placeMenuOrder({ email: E, itemId: 'nope', intake: {}, via: 'api' })).status).toBe('unknown_item');
    expect((await placeMenuOrder({ email: E, itemId: 'ask-bilko', intake: { question: 'x' }, via: 'api' })).status).toBe('unknown_item');
    expect((await placeMenuOrder({ email: E, itemId: 'live-call', intake: { topic: 'x' }, via: 'api' })).status).toBe('unknown_item');
    expect((await placeMenuOrder({ email: E, itemId: 'agent-factory-kit', intake: { x: '1' }, via: 'api' })).status).toBe('invalid_intake');
    expect(await getWalletCents(E)).toBe(500);
  });

  it('insufficient credits leaves no row and no debit', async () => {
    await creditWallet(E, 20, 'topup', 't1');
    const r = await kit();
    expect(r).toEqual({ status: 'insufficient_credits', balanceCents: 20 });
    expect(await listOrders()).toHaveLength(0);
    expect(await getWalletCents(E)).toBe(20);
  });

  it('kit order is delivered and grants the download entitlement', async () => {
    await creditWallet(E, 500, 'topup', 't1');
    const r = await placeMenuOrder({ email: E, itemId: 'agent-factory-kit', intake: {}, via: 'web' });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.order.status).toBe('delivered');
    expect(await getWalletCents(E)).toBe(200);
    expect(await hasOrderForEmail('agent-factory-kit', E)).toBe(true);
    const row = await dbGet<{ checkout_session_id: string }>('SELECT checkout_session_id FROM web_product_orders WHERE email = ?', E);
    expect(row?.checkout_session_id).toBe(`wallet_${r.order.ref}`);
  });
});

describe('kit not stored', () => {
  it('returns unavailable with no debit and no rows, and is not listed', async () => {
    vi.spyOn(products, 'isReleaseStored').mockResolvedValue(false);
    await creditWallet(E, 500, 'topup', 't1');
    const r = await placeMenuOrder({ email: E, itemId: 'agent-factory-kit', intake: {}, via: 'web' });
    expect(r).toEqual({ status: 'unavailable' });
    expect(await getWalletCents(E)).toBe(500);
    expect(await listOrders()).toHaveLength(0);
    expect(await dbGet('SELECT 1 FROM web_product_orders WHERE email = ?', E)).toBeFalsy();
    const ids = (await availableMenuPayload()).items.map((i) => i.id);
    expect(ids).not.toContain('agent-factory-kit');
  });

  it('stored kit is listed', async () => {
    const ids = (await availableMenuPayload()).items.map((i) => i.id);
    expect(ids).toContain('agent-factory-kit');
  });
});

describe('kit order failure', () => {
  it('recordOrder failure leaves no entitlement, wallet whole, order refunded', async () => {
    await creditWallet(E, 500, 'topup', 't1');
    vi.spyOn(products, 'recordOrder').mockRejectedValueOnce(new Error('rec fail'));
    await expect(placeMenuOrder({ email: E, itemId: 'agent-factory-kit', intake: {}, via: 'web' })).rejects.toThrow('rec fail');
    expect(await dbGet('SELECT 1 FROM web_product_orders WHERE email = ?', E)).toBeFalsy();
    expect(await getWalletCents(E)).toBe(500);
    const orders = await listOrdersForEmail(E);
    expect((await listOrders({ status: 'delivered' }))).toHaveLength(0);
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe('refunded');
  });
});
