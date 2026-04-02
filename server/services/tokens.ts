import { dbGet, dbRun, dbTransaction, txGet, txRun } from '../db.js';

const FREE_TOKEN_GRANT = 1;
const TOKENS_PER_SINGLE = 1;
const TOKENS_PER_BUNDLE = 7;

export { TOKENS_PER_SINGLE, TOKENS_PER_BUNDLE };

export async function getTokenBalance(email: string): Promise<number> {
  const row = await dbGet<{ balance: number }>('SELECT balance FROM token_balances WHERE email = ?', email);
  return row?.balance ?? 0;
}

export async function hasTokenAccount(email: string): Promise<boolean> {
  const row = await dbGet<{ '1': number }>('SELECT 1 FROM token_balances WHERE email = ?', email);
  return !!row;
}

/** Grant free tokens to a new user. Returns false if account already exists. */
export async function grantFreeTokens(email: string, amount: number = FREE_TOKEN_GRANT): Promise<boolean> {
  return dbTransaction(async (tx) => {
    const result = await txRun(tx,
      'INSERT OR IGNORE INTO token_balances (email, balance) VALUES (?, ?)',
      email, amount,
    );
    if (result.changes === 0) return false;
    await txRun(tx,
      'INSERT INTO token_transactions (email, amount, reason) VALUES (?, ?, ?)',
      email, amount, 'free_grant',
    );
    return true;
  });
}

/** Deduct tokens atomically. Returns { success, balance }. Fails if insufficient balance. */
export async function deductToken(email: string, cost: number = 1, reason: string = 'page_roast'): Promise<{ success: boolean; balance: number }> {
  return dbTransaction(async (tx) => {
    // Atomic deduction — WHERE clause prevents negative balance even under concurrency
    const result = await txRun(tx,
      'UPDATE token_balances SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE email = ? AND balance >= ?',
      cost, email, cost,
    );
    if (result.changes === 0) {
      const row = await txGet<{ balance: number }>(tx, 'SELECT balance FROM token_balances WHERE email = ?', email);
      return { success: false, balance: row?.balance ?? 0 };
    }
    await txRun(tx,
      'INSERT INTO token_transactions (email, amount, reason) VALUES (?, ?, ?)',
      email, -cost, reason,
    );
    const row = await txGet<{ balance: number }>(tx, 'SELECT balance FROM token_balances WHERE email = ?', email);
    return { success: true, balance: row?.balance ?? 0 };
  });
}

/** Credit tokens from a Stripe purchase. Idempotent on stripe_payment_intent_id. */
export async function creditTokens(email: string, amount: number, stripePaymentIntentId: string): Promise<void> {
  await dbTransaction(async (tx) => {
    // Check for duplicate payment intent
    const existing = await txGet(tx,
      'SELECT 1 FROM token_transactions WHERE stripe_payment_intent_id = ?',
      stripePaymentIntentId,
    );
    if (existing) return; // Already credited — idempotent

    // Ensure account exists
    await txRun(tx,
      'INSERT OR IGNORE INTO token_balances (email, balance) VALUES (?, 0)',
      email,
    );
    await txRun(tx,
      'UPDATE token_balances SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?',
      amount, email,
    );
    await txRun(tx,
      'INSERT INTO token_transactions (email, amount, reason, stripe_payment_intent_id) VALUES (?, ?, ?, ?)',
      email, amount, 'stripe_purchase', stripePaymentIntentId,
    );
  });
}
