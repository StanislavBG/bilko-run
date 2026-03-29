import { getDb } from '../db.js';

const FREE_TOKEN_GRANT = 3;
const TOKENS_PER_BUNDLE = 10;

export { TOKENS_PER_BUNDLE };

export function getTokenBalance(email: string): number {
  const db = getDb();
  const row = db.prepare('SELECT balance FROM token_balances WHERE email = ?').get(email) as { balance: number } | undefined;
  return row?.balance ?? 0;
}

export function hasTokenAccount(email: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM token_balances WHERE email = ?').get(email);
  return !!row;
}

/** Grant free tokens to a new user. Returns false if account already exists. */
export function grantFreeTokens(email: string, amount: number = FREE_TOKEN_GRANT): boolean {
  const db = getDb();
  const txn = db.transaction(() => {
    const result = db.prepare(
      'INSERT OR IGNORE INTO token_balances (email, balance) VALUES (?, ?)'
    ).run(email, amount);

    if (result.changes === 0) return false;

    db.prepare(
      'INSERT INTO token_transactions (email, amount, reason) VALUES (?, ?, ?)'
    ).run(email, amount, 'free_grant');

    return true;
  });

  return txn();
}

/** Deduct tokens. Returns { success, balance }. Fails if insufficient balance. */
export function deductToken(email: string, cost: number = 1, reason: string = 'page_roast'): { success: boolean; balance: number } {
  const db = getDb();
  const txn = db.transaction(() => {
    const row = db.prepare('SELECT balance FROM token_balances WHERE email = ?').get(email) as { balance: number } | undefined;
    const currentBalance = row?.balance ?? 0;

    if (currentBalance < cost) {
      return { success: false, balance: currentBalance };
    }

    db.prepare(
      'UPDATE token_balances SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?'
    ).run(cost, email);

    db.prepare(
      'INSERT INTO token_transactions (email, amount, reason) VALUES (?, ?, ?)'
    ).run(email, -cost, reason);

    return { success: true, balance: currentBalance - cost };
  });

  return txn();
}

/** Credit tokens from a Stripe purchase. Idempotent on stripe_payment_intent_id. */
export function creditTokens(email: string, amount: number, stripePaymentIntentId: string): void {
  const db = getDb();
  const txn = db.transaction(() => {
    // Check for duplicate payment intent
    const existing = db.prepare(
      'SELECT 1 FROM token_transactions WHERE stripe_payment_intent_id = ?'
    ).get(stripePaymentIntentId);

    if (existing) return; // Already credited — idempotent

    // Ensure account exists
    db.prepare(
      'INSERT OR IGNORE INTO token_balances (email, balance) VALUES (?, 0)'
    ).run(email);

    db.prepare(
      'UPDATE token_balances SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?'
    ).run(amount, email);

    db.prepare(
      'INSERT INTO token_transactions (email, amount, reason, stripe_payment_intent_id) VALUES (?, ?, ?, ?)'
    ).run(email, amount, 'stripe_purchase', stripePaymentIntentId);
  });

  txn();
}
