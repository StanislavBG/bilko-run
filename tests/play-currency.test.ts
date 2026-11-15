import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dbRun, dbGet, initDb } from '../server/db.js';
import { getPlayBalance, creditPlay, debitPlay } from '../server/services/play-currency.js';

const APP = 'three-winds';

beforeAll(async () => { await initDb(); });
beforeEach(async () => {
  await dbRun('DELETE FROM play_ledger');
  await dbRun('DELETE FROM play_balances');
});

describe('play currency', () => {
  it('credits and normalizes email', async () => {
    expect(await getPlayBalance(APP, 'a@test.com')).toEqual({ balance: 0, held: 0 });
    const r = await creditPlay(APP, '  A@Test.com ', 500, 'purchase', 'p1');
    expect(r).toEqual({ credited: true, balance: 500 });
    expect(await getPlayBalance(APP, 'a@test.com')).toEqual({ balance: 500, held: 0 });
    const row = await dbGet<{ account: string; amount: number }>(
      'SELECT account, amount FROM play_ledger WHERE app = ? AND ref = ?', APP, 'p1');
    expect(row).toMatchObject({ account: 'a@test.com', amount: 500 });
  });

  it('replayed credit ref changes nothing', async () => {
    await creditPlay(APP, 'a@test.com', 500, 'purchase', 'p1');
    expect(await creditPlay(APP, 'a@test.com', 500, 'purchase', 'p1')).toEqual({ credited: false, balance: 500 });
    expect(await getPlayBalance(APP, 'a@test.com')).toEqual({ balance: 500, held: 0 });
  });

  it('debits with a negative ledger row; replayed debit ref does not debit again', async () => {
    await creditPlay(APP, 'a@test.com', 500, 'purchase', 'p1');
    expect(await debitPlay(APP, 'a@test.com', 200, 'buy-in', 'd1')).toEqual({ ok: true, balance: 300 });
    const row = await dbGet<{ amount: number }>('SELECT amount FROM play_ledger WHERE app = ? AND ref = ?', APP, 'd1');
    expect(Number(row?.amount)).toBe(-200);
    expect(await debitPlay(APP, 'a@test.com', 200, 'buy-in', 'd1')).toEqual({ ok: true, balance: 300 });
  });

  it('refuses overdraft and changes nothing', async () => {
    await creditPlay(APP, 'a@test.com', 100, 'purchase', 'p1');
    expect(await debitPlay(APP, 'a@test.com', 200, 'buy-in', 'd1')).toEqual({ ok: false, balance: 100 });
    expect(await dbGet('SELECT 1 FROM play_ledger WHERE ref = ?', 'd1')).toBeFalsy();
    expect(await debitPlay(APP, 'nobody@test.com', 1, 'buy-in', 'd2')).toEqual({ ok: false, balance: 0 });
    const rs = await Promise.all([
      debitPlay(APP, 'a@test.com', 60, 'buy-in', 'c1'),
      debitPlay(APP, 'a@test.com', 60, 'buy-in', 'c2'),
    ]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect((await getPlayBalance(APP, 'a@test.com')).balance).toBe(40);
  });

  it('keeps two apps independent for one email', async () => {
    await creditPlay(APP, 'a@test.com', 500, 'purchase', 'same-ref');
    expect(await creditPlay('other-game', 'a@test.com', 70, 'purchase', 'same-ref')).toEqual({ credited: true, balance: 70 });
    expect(await debitPlay('other-game', 'a@test.com', 20, 'buy-in', 'd1')).toEqual({ ok: true, balance: 50 });
    expect(await getPlayBalance(APP, 'a@test.com')).toEqual({ balance: 500, held: 0 });
    expect(await getPlayBalance('other-game', 'a@test.com')).toEqual({ balance: 50, held: 0 });
  });

  it('rejects bad amounts and app names with RangeError', async () => {
    for (const a of [0, -1, 1.5, NaN, Infinity, 10_000_001, Number.MAX_SAFE_INTEGER + 2]) {
      await expect(creditPlay(APP, 'a@test.com', a, 'x', 'bad')).rejects.toBeInstanceOf(RangeError);
      await expect(debitPlay(APP, 'a@test.com', a, 'x', 'bad')).rejects.toBeInstanceOf(RangeError);
    }
    await expect(creditPlay(APP, 'a@test.com', 10_000_000, 'x', 'max')).resolves.toEqual({ credited: true, balance: 10_000_000 });
    for (const app of ['', 'Three-Winds', 'a_b', 'a'.repeat(33), 'x y', '../x']) {
      await expect(getPlayBalance(app, 'a@test.com')).rejects.toBeInstanceOf(RangeError);
      await expect(creditPlay(app, 'a@test.com', 1, 'x', 'bad')).rejects.toBeInstanceOf(RangeError);
      await expect(debitPlay(app, 'a@test.com', 1, 'x', 'bad')).rejects.toBeInstanceOf(RangeError);
    }
  });
});
