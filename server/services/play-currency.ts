import { dbGet, dbTransaction, txGet, txRun } from '../db.js';

/**
 * Per-app play currency (Three Winds taels first). Fully separate from the Bilko Credits
 * wallet: integer amounts, a balance that never goes below 0, and credits/debits that are
 * idempotent on (app, account, ref). No transfer, gift or cash-out exists by design.
 */

const MAX_AMOUNT = 10_000_000;
const APP_RE = /^[a-z0-9-]{1,32}$/;

function normEmail(email: string): string {
  return String(email).trim().toLowerCase();
}

function checkApp(app: string): void {
  if (typeof app !== 'string' || !APP_RE.test(app)) {
    throw new RangeError('app must match [a-z0-9-]{1,32}');
  }
}

function checkAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    throw new RangeError(`amount must be a positive safe integer <= ${MAX_AMOUNT}`);
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

type Tx = Parameters<Parameters<typeof dbTransaction>[0]>[0];

async function txBalance(tx: Tx, app: string, email: string): Promise<number> {
  const row = await txGet<{ balance: number }>(tx, 'SELECT balance FROM play_balances WHERE app = ? AND email = ?', app, email);
  return Number(row?.balance ?? 0);
}

export async function getPlayBalance(app: string, email: string): Promise<{ balance: number; held: number }> {
  checkApp(app);
  const row = await dbGet<{ balance: number; held: number }>(
    'SELECT balance, held FROM play_balances WHERE app = ? AND email = ?', app, normEmail(email),
  );
  return { balance: Number(row?.balance ?? 0), held: Number(row?.held ?? 0) };
}

/** Add play currency. Idempotent on (app, account, ref): a replayed ref credits nothing. */
export async function creditPlay(app: string, email: string, amount: number, kind: string, ref: string): Promise<{ credited: boolean; balance: number }> {
  checkApp(app);
  checkAmount(amount);
  const e = normEmail(email);
  return serialized(() => dbTransaction(async (tx) => {
    const existing = await txGet(tx, 'SELECT 1 FROM play_ledger WHERE app = ? AND account = ? AND ref = ?', app, e, ref);
    if (existing) return { credited: false, balance: await txBalance(tx, app, e) };
    const t = now();
    await txRun(tx, 'INSERT OR IGNORE INTO play_balances (app, email, balance, held, updated_at) VALUES (?, ?, 0, 0, ?)', app, e, t);
    await txRun(tx, 'UPDATE play_balances SET balance = balance + ?, updated_at = ? WHERE app = ? AND email = ?', amount, t, app, e);
    await txRun(tx,
      'INSERT INTO play_ledger (app, account, amount, kind, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      app, e, amount, kind, ref, t);
    return { credited: true, balance: await txBalance(tx, app, e) };
  }));
}

/** Spend play currency atomically; never lets the balance go below 0. A replayed ref returns ok without debiting again. */
export async function debitPlay(app: string, email: string, amount: number, kind: string, ref: string): Promise<{ ok: boolean; balance: number }> {
  checkApp(app);
  checkAmount(amount);
  const e = normEmail(email);
  return serialized(() => dbTransaction(async (tx) => {
    const existing = await txGet(tx, 'SELECT 1 FROM play_ledger WHERE app = ? AND account = ? AND ref = ?', app, e, ref);
    if (existing) return { ok: true, balance: await txBalance(tx, app, e) };
    const t = now();
    const res = await txRun(tx,
      'UPDATE play_balances SET balance = balance - ?, updated_at = ? WHERE app = ? AND email = ? AND balance >= ?',
      amount, t, app, e, amount);
    if (res.changes === 0) return { ok: false, balance: await txBalance(tx, app, e) };
    await txRun(tx,
      'INSERT INTO play_ledger (app, account, amount, kind, ref, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      app, e, -amount, kind, ref, t);
    return { ok: true, balance: await txBalance(tx, app, e) };
  }));
}
