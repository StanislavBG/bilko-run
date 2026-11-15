import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dbRun, dbGet, dbAll, initDb } from '../server/db.js';
import {
  getPlayBalance, creditPlay, escrowPlay, settlePlayHand, releasePlayEscrow,
} from '../server/services/play-currency.js';

const APP = 'three-winds';

async function snapshot() {
  return {
    balances: await dbAll('SELECT app, email, balance, held FROM play_balances ORDER BY email'),
    ledger: await dbAll('SELECT app, account, amount, kind, ref FROM play_ledger ORDER BY id'),
    escrows: await dbAll('SELECT app, email, ref, amount, status FROM play_escrows ORDER BY email, ref'),
  };
}

beforeAll(async () => { await initDb(); });
beforeEach(async () => {
  await dbRun('DELETE FROM play_ledger');
  await dbRun('DELETE FROM play_balances');
  await dbRun('DELETE FROM play_escrows');
});

describe('play escrow', () => {
  it('moves balance to held atomically and is idempotent on ref', async () => {
    await creditPlay(APP, 'a@test.com', 500, 'purchase', 'p1');
    expect(await escrowPlay(APP, ' A@test.com', 200, 'hand-1')).toEqual({ ok: true, balance: 300, held: 200 });
    expect(await getPlayBalance(APP, 'a@test.com')).toEqual({ balance: 300, held: 200 });
    const esc = await dbGet<{ amount: number; status: string }>(
      'SELECT amount, status FROM play_escrows WHERE app = ? AND email = ? AND ref = ?', APP, 'a@test.com', 'hand-1');
    expect(esc).toMatchObject({ amount: 200, status: 'held' });
    expect(await escrowPlay(APP, 'a@test.com', 200, 'hand-1')).toEqual({ ok: true, balance: 300, held: 200 });
    expect(await getPlayBalance(APP, 'a@test.com')).toEqual({ balance: 300, held: 200 });
  });

  it('refuses insufficient balance and changes nothing', async () => {
    await creditPlay(APP, 'a@test.com', 100, 'purchase', 'p1');
    const before = await snapshot();
    expect(await escrowPlay(APP, 'a@test.com', 200, 'hand-1')).toEqual({ ok: false, balance: 100, held: 0 });
    expect(await escrowPlay(APP, 'nobody@test.com', 1, 'hand-1')).toEqual({ ok: false, balance: 0, held: 0 });
    expect(await snapshot()).toEqual(before);
    const rs = await Promise.all([
      escrowPlay(APP, 'a@test.com', 60, 'h-a'),
      escrowPlay(APP, 'a@test.com', 60, 'h-b'),
    ]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(await getPlayBalance(APP, 'a@test.com')).toEqual({ balance: 40, held: 60 });
  });
});

describe('play settle', () => {
  async function seatTwo() {
    await creditPlay(APP, 'a@test.com', 1000, 'purchase', 'pa');
    await creditPlay(APP, 'b@test.com', 1000, 'purchase', 'pb');
    await escrowPlay(APP, 'a@test.com', 300, 'esc-a');
    await escrowPlay(APP, 'b@test.com', 300, 'esc-b');
  }

  it('settles a 3-seat hand with one house entry; ledger rows sum to 0', async () => {
    await seatTwo();
    const r = await settlePlayHand(APP, 'hand-1', [
      { account: 'a@test.com', delta: 250, escrowRef: 'esc-a' },
      { account: 'b@test.com', delta: -300, escrowRef: 'esc-b' },
      { account: 'house', delta: 50 },
    ]);
    expect(r).toEqual({ settled: true });
    expect(await getPlayBalance(APP, 'a@test.com')).toEqual({ balance: 1250, held: 0 });
    expect(await getPlayBalance(APP, 'b@test.com')).toEqual({ balance: 700, held: 0 });
    expect(await dbGet('SELECT 1 FROM play_balances WHERE email = ?', 'house')).toBeFalsy();
    const rows = await dbAll<{ account: string; amount: number; kind: string }>(
      'SELECT account, amount, kind FROM play_ledger WHERE app = ? AND ref = ? ORDER BY account', APP, 'hand-1');
    expect(rows.map((x) => ({ ...x, amount: Number(x.amount) }))).toEqual([
      { account: 'a@test.com', amount: 250, kind: 'settle' },
      { account: 'b@test.com', amount: -300, kind: 'settle' },
      { account: 'house', amount: 50, kind: 'settle' },
    ]);
    expect(rows.reduce((s, x) => s + Number(x.amount), 0)).toBe(0);
    const st = await dbAll<{ status: string }>('SELECT status FROM play_escrows WHERE app = ?', APP);
    expect(st.map((x) => x.status)).toEqual(['settled', 'settled']);
  });

  it('refuses a non-zero-sum hand and changes nothing', async () => {
    await seatTwo();
    const before = await snapshot();
    await expect(settlePlayHand(APP, 'hand-1', [
      { account: 'a@test.com', delta: 100, escrowRef: 'esc-a' },
      { account: 'b@test.com', delta: -50, escrowRef: 'esc-b' },
    ])).rejects.toThrow(/sum/);
    await expect(settlePlayHand(APP, 'hand-1', [
      { account: 'a@test.com', delta: 1.5, escrowRef: 'esc-a' },
      { account: 'b@test.com', delta: -1.5, escrowRef: 'esc-b' },
    ])).rejects.toThrow();
    await expect(settlePlayHand(APP, 'hand-1', [
      { account: 'a@test.com', delta: 10, escrowRef: 'esc-a' },
      { account: 'a@test.com', delta: -10, escrowRef: 'esc-a' },
    ])).rejects.toThrow(/once/);
    expect(await snapshot()).toEqual(before);
  });

  it('refuses a loss over the held escrow and changes nothing', async () => {
    await seatTwo();
    const before = await snapshot();
    await expect(settlePlayHand(APP, 'hand-1', [
      { account: 'a@test.com', delta: 301, escrowRef: 'esc-a' },
      { account: 'b@test.com', delta: -301, escrowRef: 'esc-b' },
    ])).rejects.toThrow(/escrow/);
    await expect(settlePlayHand(APP, 'hand-1', [
      { account: 'a@test.com', delta: 10, escrowRef: 'esc-a' },
      { account: 'b@test.com', delta: -10, escrowRef: 'missing' },
    ])).rejects.toThrow(/escrow/);
    expect(await snapshot()).toEqual(before);
  });

  it('a replayed settle ref changes nothing', async () => {
    await seatTwo();
    const entries = [
      { account: 'a@test.com', delta: 100, escrowRef: 'esc-a' },
      { account: 'b@test.com', delta: -100, escrowRef: 'esc-b' },
    ];
    expect(await settlePlayHand(APP, 'hand-1', entries)).toEqual({ settled: true });
    const after = await snapshot();
    expect(await settlePlayHand(APP, 'hand-1', entries)).toEqual({ settled: false });
    expect(await snapshot()).toEqual(after);
  });

  it('releases a held escrow back to balance (voided hand) idempotently', async () => {
    await seatTwo();
    expect(await releasePlayEscrow(APP, 'a@test.com', 'esc-a')).toEqual({ released: true, balance: 1000, held: 0 });
    expect(await releasePlayEscrow(APP, 'a@test.com', 'esc-a')).toEqual({ released: false, balance: 1000, held: 0 });
    const esc = await dbGet<{ status: string }>(
      'SELECT status FROM play_escrows WHERE app = ? AND email = ? AND ref = ?', APP, 'a@test.com', 'esc-a');
    expect(esc?.status).toBe('released');
    // A released escrow can no longer back a settlement.
    await expect(settlePlayHand(APP, 'hand-1', [
      { account: 'a@test.com', delta: -10, escrowRef: 'esc-a' },
      { account: 'b@test.com', delta: 10, escrowRef: 'esc-b' },
    ])).rejects.toThrow(/escrow/);
    // A settled escrow cannot be released.
    await settlePlayHand(APP, 'hand-2', [
      { account: 'b@test.com', delta: -10, escrowRef: 'esc-b' },
      { account: 'house', delta: 10 },
    ]);
    expect(await releasePlayEscrow(APP, 'b@test.com', 'esc-b')).toEqual({ released: false, balance: 990, held: 0 });
  });
});
