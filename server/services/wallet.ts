import { dbGet, dbTransaction, txGet, txRun } from '../db.js';

/** Prepaid Bilko Credits wallet, in US cents. Single store for top-ups and menu spending. */

const MAX_CENTS = 100000;

function normEmail(email: string): string {
  return String(email).trim().toLowerCase();
}

function checkCents(cents: number): void {
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_CENTS) {
    throw new RangeError(`cents must be a positive safe integer <= ${MAX_CENTS}`);
  }
}

const now = () => Math.floor(Date.now() / 1000);

// A local libSQL file allows one open write transaction per process; serialize in-process.
let writeQueue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn);
  writeQueue = run.catch(() => undefined);
  return run;
}

export async function getWalletCents(email: string): Promise<number> {
  const row = await dbGet<{ balance_cents: number }>(
    'SELECT balance_cents FROM wallet_balances WHERE email = ?', normEmail(email),
  );
  return Number(row?.balance_cents ?? 0);
}

async function addFunds(email: string, cents: number, reason: string, ref: string): Promise<{ credited: boolean; balanceCents: number }> {
  const e = normEmail(email);
  checkCents(cents);
  return serialized(() => dbTransaction(async (tx) => {
    const balanceOf = async () =>
      Number((await txGet<{ balance_cents: number }>(tx, 'SELECT balance_cents FROM wallet_balances WHERE email = ?', e))?.balance_cents ?? 0);
    const existing = await txGet(tx, 'SELECT 1 FROM wallet_transactions WHERE ref = ?', ref);
    if (existing) return { credited: false, balanceCents: await balanceOf() };
    const t = now();
    await txRun(tx, 'INSERT OR IGNORE INTO wallet_balances (email, balance_cents, updated_at) VALUES (?, 0, ?)', e, t);
    await txRun(tx, 'UPDATE wallet_balances SET balance_cents = balance_cents + ?, updated_at = ? WHERE email = ?', cents, t, e);
    await txRun(tx,
      'INSERT INTO wallet_transactions (email, amount_cents, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)',
      e, cents, reason, ref, t);
    return { credited: true, balanceCents: await balanceOf() };
  }));
}

/** Add funds. Idempotent on ref. */
export function creditWallet(email: string, cents: number, reason: string, ref: string) {
  return addFunds(email, cents, reason, ref);
}

/** Return funds after a failed order. Idempotent on ref. */
export function refundWallet(email: string, cents: number, reason: string, ref: string) {
  return addFunds(email, cents, reason, ref);
}

/** Spend funds atomically; never lets the balance go below 0. */
export async function debitWallet(email: string, cents: number, reason: string, ref: string): Promise<{ ok: boolean; balanceCents: number }> {
  const e = normEmail(email);
  checkCents(cents);
  return serialized(() => dbTransaction(async (tx) => {
    const balanceOf = async () =>
      Number((await txGet<{ balance_cents: number }>(tx, 'SELECT balance_cents FROM wallet_balances WHERE email = ?', e))?.balance_cents ?? 0);
    const t = now();
    const res = await txRun(tx,
      'UPDATE wallet_balances SET balance_cents = balance_cents - ?, updated_at = ? WHERE email = ? AND balance_cents >= ?',
      cents, t, e, cents);
    if (res.changes === 0) return { ok: false, balanceCents: await balanceOf() };
    await txRun(tx,
      'INSERT INTO wallet_transactions (email, amount_cents, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)',
      e, -cents, reason, ref, t);
    return { ok: true, balanceCents: await balanceOf() };
  }));
}
