import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { dbRun, dbGet, initDb } from '../server/db.js';
import * as wallet from '../server/services/wallet.js';
import * as products from '../server/services/web-products.js';
import { creditWallet, getWalletCents } from '../server/services/wallet.js';
import { hasOrderForEmail } from '../server/services/web-products.js';
import { MENU_DAILY_ASYNC_CAP } from '../shared/bilko-menu.js';
import {
  placeMenuOrder, listOrders, listOrdersForEmail, getOrder, setDraft, markDelivered, refundOrder,
} from '../server/services/menu-orders.js';

const E = 'buyer@test.com';
const ask = (email = E) => placeMenuOrder({ email, itemId: 'ask-bilko', intake: { question: 'Why?' }, via: 'web' });

beforeAll(async () => { await initDb(); });
afterEach(() => { vi.restoreAllMocks(); });
beforeEach(async () => {
  await dbRun('DELETE FROM menu_orders');
  await dbRun('DELETE FROM wallet_transactions');
  await dbRun('DELETE FROM wallet_balances');
  await dbRun('DELETE FROM web_product_orders');
});

describe('placeMenuOrder', () => {
  it('queues an async order and debits', async () => {
    await creditWallet(E, 500, 'topup', 't1');
    const r = await ask();
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.order.status).toBe('queued');
    expect(r.balanceCents).toBe(450);
    expect(await getWalletCents(E)).toBe(450);
    expect((await listOrdersForEmail(E)).length).toBe(1);
    expect((await listOrders({ status: 'queued' })).length).toBe(1);
  });

  it('rejects unknown item, invalid intake and live items', async () => {
    await creditWallet(E, 500, 'topup', 't1');
    expect((await placeMenuOrder({ email: E, itemId: 'nope', intake: {}, via: 'api' })).status).toBe('unknown_item');
    expect((await placeMenuOrder({ email: E, itemId: 'ask-bilko', intake: {}, via: 'api' })).status).toBe('invalid_intake');
    expect((await placeMenuOrder({ email: E, itemId: 'live-call', intake: { topic: 'x' }, via: 'api' })).status).toBe('live_needs_slot');
    expect(await getWalletCents(E)).toBe(500);
  });

  it('insufficient credits leaves no row and no debit', async () => {
    await creditWallet(E, 20, 'topup', 't1');
    const r = await ask();
    expect(r).toEqual({ status: 'insufficient_credits', balanceCents: 20 });
    expect(await listOrders()).toHaveLength(0);
    expect(await getWalletCents(E)).toBe(20);
  });

  it('daily cap blocks without charging', async () => {
    await creditWallet(E, 1000, 'topup', 't1');
    for (let i = 0; i < MENU_DAILY_ASYNC_CAP; i++) expect((await ask()).status).toBe('ok');
    const before = await getWalletCents(E);
    expect((await ask()).status).toBe('daily_cap');
    expect(await getWalletCents(E)).toBe(before);
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

describe('order state changes', () => {
  async function queued() {
    await creditWallet(E, 500, 'topup', 't1');
    const r = await ask();
    if (r.status !== 'ok') throw new Error('setup');
    return r.order;
  }

  it('moves queued -> drafted -> delivered and refuses illegal transitions', async () => {
    const o = await queued();
    expect(await markDelivered(o.id, 'x')).toBeNull();
    expect((await setDraft(o.id, 'd1'))?.status).toBe('drafted');
    expect((await setDraft(o.id, 'd2'))?.draft).toBe('d2');
    expect((await markDelivered(o.id, 'final'))?.status).toBe('delivered');
    expect(await setDraft(o.id, 'd3')).toBeNull();
    expect(await refundOrder(o.id)).toBeNull();
    expect((await getOrder(o.id))?.delivered_body).toBe('final');
  });

  it('refunds only once', async () => {
    const o = await queued();
    expect((await refundOrder(o.id))?.status).toBe('refunded');
    expect(await getWalletCents(E)).toBe(500);
    expect(await refundOrder(o.id)).toBeNull();
    expect(await getWalletCents(E)).toBe(500);
    expect(await setDraft(o.id, 'late')).toBeNull();
  });

  it('refundWallet failure then retry credits exactly once and ends refunded', async () => {
    const o = await queued();
    vi.spyOn(wallet, 'refundWallet').mockRejectedValueOnce(new Error('boom'));
    await expect(refundOrder(o.id)).rejects.toThrow('boom');
    expect((await getOrder(o.id))?.status).toBe('queued');
    expect(await getWalletCents(E)).toBe(450);
    expect((await refundOrder(o.id))?.status).toBe('refunded');
    expect(await getWalletCents(E)).toBe(500);
    expect(await refundOrder(o.id)).toBeNull();
    expect(await getWalletCents(E)).toBe(500);
  });

  it('finishes a half-done refund (credit present, status not moved) without a second credit', async () => {
    const o = await queued();
    await wallet.refundWallet(E, o.price_cents, 'x', `refund:${o.ref}`);
    expect((await refundOrder(o.id))?.status).toBe('refunded');
    expect(await getWalletCents(E)).toBe(500);
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
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe('refunded');
  });
});
