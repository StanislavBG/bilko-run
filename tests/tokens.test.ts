import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../server/db.js';
import {
  getTokenBalance, hasTokenAccount, grantFreeTokens,
  deductToken, creditTokens,
} from '../server/services/tokens.js';

// Fresh DB for each test (in-memory via vitest config)
beforeEach(() => {
  const db = getDb();
  db.exec('DELETE FROM token_balances');
  db.exec('DELETE FROM token_transactions');
});

describe('Token System', () => {
  it('grants 1 free token to new user', () => {
    expect(hasTokenAccount('new@test.com')).toBe(false);
    const granted = grantFreeTokens('new@test.com');
    expect(granted).toBe(true);
    expect(getTokenBalance('new@test.com')).toBe(1);
    expect(hasTokenAccount('new@test.com')).toBe(true);
  });

  it('does not double-grant free tokens', () => {
    grantFreeTokens('user@test.com');
    const second = grantFreeTokens('user@test.com');
    expect(second).toBe(false);
    expect(getTokenBalance('user@test.com')).toBe(1);
  });

  it('deducts token successfully', () => {
    grantFreeTokens('user@test.com');
    const result = deductToken('user@test.com', 1, 'page_roast');
    expect(result.success).toBe(true);
    expect(result.balance).toBe(0);
  });

  it('rejects deduction when balance insufficient', () => {
    grantFreeTokens('user@test.com');
    deductToken('user@test.com', 1, 'page_roast');
    const result = deductToken('user@test.com', 1, 'page_roast');
    expect(result.success).toBe(false);
    expect(result.balance).toBe(0);
  });

  it('balance never goes negative', () => {
    grantFreeTokens('user@test.com');
    deductToken('user@test.com', 1, 'test');
    const result = deductToken('user@test.com', 1, 'test');
    expect(result.success).toBe(false);
    expect(getTokenBalance('user@test.com')).toBe(0);
  });

  it('deducts 2 tokens for compare', () => {
    grantFreeTokens('user@test.com', 3);
    const result = deductToken('user@test.com', 2, 'compare');
    expect(result.success).toBe(true);
    expect(result.balance).toBe(1);
  });

  it('rejects compare when only 1 token left', () => {
    grantFreeTokens('user@test.com');
    const result = deductToken('user@test.com', 2, 'compare');
    expect(result.success).toBe(false);
    expect(result.balance).toBe(1);
  });

  it('credits tokens from Stripe purchase', () => {
    grantFreeTokens('user@test.com');
    deductToken('user@test.com', 1, 'test');
    creditTokens('user@test.com', 5, 'pi_test_123');
    expect(getTokenBalance('user@test.com')).toBe(5);
  });

  it('credit is idempotent on payment intent', () => {
    grantFreeTokens('user@test.com');
    creditTokens('user@test.com', 5, 'pi_test_456');
    creditTokens('user@test.com', 5, 'pi_test_456'); // duplicate
    expect(getTokenBalance('user@test.com')).toBe(6); // 1 free + 5, not 11
  });

  it('credits create account if none exists', () => {
    expect(hasTokenAccount('new@test.com')).toBe(false);
    creditTokens('new@test.com', 5, 'pi_test_789');
    expect(getTokenBalance('new@test.com')).toBe(5);
  });

  it('returns 0 balance for unknown user', () => {
    expect(getTokenBalance('unknown@test.com')).toBe(0);
  });
});
