import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dbRun, dbGet, initDb } from '../server/db.js';
import { getWalletCents, creditWallet, debitWallet, refundWallet } from '../server/services/wallet.js';

beforeAll(async () => { await initDb(); });
beforeEach(async () => {
  await dbRun('DELETE FROM wallet_transactions');
  await dbRun('DELETE FROM wallet_balances');
});

describe('wallet', () => {
  it('credits and normalizes email', async () => {
    const r = await creditWallet('  A@Test.com ', 500, 'topup', 'r1');
    expect(r).toEqual({ credited: true, balanceCents: 500 });
    expect(await getWalletCents('a@test.com')).toBe(500);
  });

  it('duplicate-ref credit changes nothing', async () => {
    await creditWallet('a@test.com', 500, 'topup', 'r1');
    const r = await creditWallet('a@test.com', 500, 'topup', 'r1');
    expect(r).toEqual({ credited: false, balanceCents: 500 });
  });

  it('debits on success with negative transaction', async () => {
    await creditWallet('a@test.com', 500, 'topup', 'r1');
    const r = await debitWallet('a@test.com', 200, 'menu', 'd1');
    expect(r).toEqual({ ok: true, balanceCents: 300 });
    const tx = await dbGet<{ amount_cents: number }>('SELECT amount_cents FROM wallet_transactions WHERE ref = ?', 'd1');
    expect(tx?.amount_cents).toBe(-200);
  });

  it('rejects insufficient debit without a transaction', async () => {
    await creditWallet('a@test.com', 100, 'topup', 'r1');
    const r = await debitWallet('a@test.com', 200, 'menu', 'd1');
    expect(r).toEqual({ ok: false, balanceCents: 100 });
    expect(await dbGet('SELECT 1 FROM wallet_transactions WHERE ref = ?', 'd1')).toBeFalsy();
  });

  it('two concurrent debits exceeding balance: exactly one succeeds', async () => {
    await creditWallet('a@test.com', 500, 'topup', 'r1');
    const rs = await Promise.all([
      debitWallet('a@test.com', 300, 'menu', 'd1'),
      debitWallet('a@test.com', 300, 'menu', 'd2'),
    ]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(await getWalletCents('a@test.com')).toBe(200);
  });

  it('refund is idempotent', async () => {
    await creditWallet('a@test.com', 500, 'topup', 'r1');
    await debitWallet('a@test.com', 200, 'menu', 'd1');
    expect(await refundWallet('a@test.com', 200, 'refund', 'f1')).toEqual({ credited: true, balanceCents: 500 });
    expect(await refundWallet('a@test.com', 200, 'refund', 'f1')).toEqual({ credited: false, balanceCents: 500 });
  });

  it('rejects invalid cents', async () => {
    for (const c of [0, -1, 1.5, NaN, 100001, Number.MAX_SAFE_INTEGER + 2]) {
      await expect(creditWallet('a@test.com', c, 'x', 'bad')).rejects.toBeInstanceOf(RangeError);
      await expect(debitWallet('a@test.com', c, 'x', 'bad')).rejects.toBeInstanceOf(RangeError);
      await expect(refundWallet('a@test.com', c, 'x', 'bad')).rejects.toBeInstanceOf(RangeError);
    }
  });
});
