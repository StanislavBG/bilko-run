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

/** The ledger-only counterparty for AI seats. It never has a play_balances row. */
export const HOUSE_ACCOUNT = 'house';

export type PlayEntry = { account: string; delta: number; escrowRef?: string };

async function txHolding(tx: Tx, app: string, email: string): Promise<{ balance: number; held: number }> {
  const row = await txGet<{ balance: number; held: number }>(tx,
    'SELECT balance, held FROM play_balances WHERE app = ? AND email = ?', app, email);
  return { balance: Number(row?.balance ?? 0), held: Number(row?.held ?? 0) };
}

function checkRef(ref: string): void {
  if (typeof ref !== 'string' || ref.length === 0 || ref.length > 200) {
    throw new RangeError('ref must be a non-empty string of at most 200 characters');
  }
}

/**
 * Hold a player's maximum loss for a hand: moves amount from balance to held atomically.
 * Idempotent on (app, email, ref): an existing escrow returns ok without holding again.
 */
export async function escrowPlay(app: string, email: string, amount: number, ref: string): Promise<{ ok: boolean; balance: number; held: number }> {
  checkApp(app);
  checkAmount(amount);
  checkRef(ref);
  const e = normEmail(email);
  if (e === HOUSE_ACCOUNT) throw new RangeError('the house account holds no escrow');
  return serialized(() => dbTransaction(async (tx) => {
    const existing = await txGet(tx, 'SELECT 1 FROM play_escrows WHERE app = ? AND email = ? AND ref = ?', app, e, ref);
    if (existing) return { ok: true, ...(await txHolding(tx, app, e)) };
    const t = now();
    const res = await txRun(tx,
      'UPDATE play_balances SET balance = balance - ?, held = held + ?, updated_at = ? WHERE app = ? AND email = ? AND balance >= ?',
      amount, amount, t, app, e, amount);
    if (res.changes === 0) return { ok: false, ...(await txHolding(tx, app, e)) };
    await txRun(tx,
      "INSERT INTO play_escrows (app, email, ref, amount, status, created_at) VALUES (?, ?, ?, ?, 'held', ?)",
      app, e, ref, amount, t);
    return { ok: true, ...(await txHolding(tx, app, e)) };
  }));
}

/**
 * Settle one hand from zero-sum deltas, in one transaction. Each user entry releases its held
 * escrow and applies its delta; a loss may not exceed that escrow. 'house' rows are ledger-only.
 * Throws (changing nothing) on invalid entries. A replayed ref returns { settled: false }.
 */
export async function settlePlayHand(app: string, ref: string, entries: PlayEntry[]): Promise<{ settled: boolean }> {
  checkApp(app);
  checkRef(ref);
  if (!Array.isArray(entries) || entries.length < 2) throw new RangeError('a hand needs at least two entries');
  const seen = new Set<string>();
  let sum = 0;
  const norm = entries.map((en) => {
    if (!en || typeof en.account !== 'string') throw new RangeError('entry account must be a string');
    const account = normEmail(en.account);
    if (!account) throw new RangeError('entry account must be non-empty');
    if (!Number.isSafeInteger(en.delta) || Math.abs(en.delta) > MAX_AMOUNT) {
      throw new RangeError(`entry delta must be a safe integer with |delta| <= ${MAX_AMOUNT}`);
    }
    if (seen.has(account)) throw new RangeError(`account ${account} may appear only once per hand`);
    seen.add(account);
    sum += en.delta;
    if (account === HOUSE_ACCOUNT) {
      if (en.escrowRef !== undefined) throw new RangeError('the house account holds no escrow');
      return { account, delta: en.delta, escrowRef: undefined as string | undefined };
    }
    if (en.escrowRef === undefined) {
      if (en.delta < 0) throw new RangeError(`loss for ${account} exceeds held escrow (none given)`);
    } else {
      checkRef(en.escrowRef);
    }
    return { account, delta: en.delta, escrowRef: en.escrowRef };
  });
  if (sum !== 0) throw new RangeError(`hand deltas must sum to 0 (got ${sum})`);

  return serialized(() => dbTransaction(async (tx) => {
    const done = await txGet(tx, "SELECT 1 FROM play_ledger WHERE app = ? AND ref = ? AND kind = 'settle' LIMIT 1", app, ref);
    if (done) return { settled: false };
    const t = now();
    for (const en of norm) {
      if (en.account !== HOUSE_ACCOUNT) {
        let amount = 0;
        if (en.escrowRef !== undefined) {
          const esc = await txGet<{ amount: number }>(tx,
            "SELECT amount FROM play_escrows WHERE app = ? AND email = ? AND ref = ? AND status = 'held'",
            app, en.account, en.escrowRef);
          if (!esc) throw new RangeError(`no held escrow ${en.escrowRef} for ${en.account}`);
          amount = Number(esc.amount);
        }
        if (-en.delta > amount) throw new RangeError(`loss for ${en.account} exceeds held escrow (${amount})`);
        await txRun(tx, 'INSERT OR IGNORE INTO play_balances (app, email, balance, held, updated_at) VALUES (?, ?, 0, 0, ?)', app, en.account, t);
        await txRun(tx,
          'UPDATE play_balances SET held = held - ?, balance = balance + ?, updated_at = ? WHERE app = ? AND email = ?',
          amount, amount + en.delta, t, app, en.account);
        if (en.escrowRef !== undefined) {
          await txRun(tx,
            "UPDATE play_escrows SET status = 'settled' WHERE app = ? AND email = ? AND ref = ? AND status = 'held'",
            app, en.account, en.escrowRef);
        }
      }
      await txRun(tx,
        "INSERT INTO play_ledger (app, account, amount, kind, ref, created_at) VALUES (?, ?, ?, 'settle', ?, ?)",
        app, en.account, en.delta, ref, t);
    }
    return { settled: true };
  }));
}

/** Return a held escrow to balance (voided hand). Idempotent: a settled or released escrow changes nothing. */
export async function releasePlayEscrow(app: string, email: string, ref: string): Promise<{ released: boolean; balance: number; held: number }> {
  checkApp(app);
  checkRef(ref);
  const e = normEmail(email);
  return serialized(() => dbTransaction(async (tx) => {
    const esc = await txGet<{ amount: number }>(tx,
      "SELECT amount FROM play_escrows WHERE app = ? AND email = ? AND ref = ? AND status = 'held'", app, e, ref);
    if (!esc) return { released: false, ...(await txHolding(tx, app, e)) };
    const amount = Number(esc.amount);
    await txRun(tx,
      'UPDATE play_balances SET held = held - ?, balance = balance + ?, updated_at = ? WHERE app = ? AND email = ?',
      amount, amount, now(), app, e);
    await txRun(tx,
      "UPDATE play_escrows SET status = 'released' WHERE app = ? AND email = ? AND ref = ?", app, e, ref);
    return { released: true, ...(await txHolding(tx, app, e)) };
  }));
}
