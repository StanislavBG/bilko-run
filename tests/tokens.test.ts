import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dbRun, initDb } from '../server/db.js';
import {
  getTokenBalance, hasTokenAccount, grantFreeTokens,
  deductToken, creditTokens,
} from '../server/services/tokens.js';

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM token_transactions');
  await dbRun('DELETE FROM token_balances');
});

describe('Token System', () => {
  it('grants 1 free token to new user', async () => {
    expect(await hasTokenAccount('new@test.com')).toBe(false);
    const granted = await grantFreeTokens('new@test.com');
    expect(granted).toBe(true);
    expect(await getTokenBalance('new@test.com')).toBe(1);
    expect(await hasTokenAccount('new@test.com')).toBe(true);
  });

  it('does not double-grant free tokens', async () => {
    await grantFreeTokens('user@test.com');
    const second = await grantFreeTokens('user@test.com');
    expect(second).toBe(false);
    expect(await getTokenBalance('user@test.com')).toBe(1);
  });

  it('deducts token successfully', async () => {
    await grantFreeTokens('user@test.com');
    const result = await deductToken('user@test.com', 1, 'page_roast');
    expect(result.success).toBe(true);
    expect(result.balance).toBe(0);
  });

  it('rejects deduction when balance insufficient', async () => {
    await grantFreeTokens('user@test.com');
    await deductToken('user@test.com', 1, 'page_roast');
    const result = await deductToken('user@test.com', 1, 'page_roast');
    expect(result.success).toBe(false);
    expect(result.balance).toBe(0);
  });

  it('balance never goes negative', async () => {
    await grantFreeTokens('user@test.com');
    await deductToken('user@test.com', 1, 'test');
    const result = await deductToken('user@test.com', 1, 'test');
    expect(result.success).toBe(false);
    expect(await getTokenBalance('user@test.com')).toBe(0);
  });

  it('deducts 2 tokens for compare', async () => {
    await grantFreeTokens('user@test.com', 3);
    const result = await deductToken('user@test.com', 2, 'compare');
    expect(result.success).toBe(true);
    expect(result.balance).toBe(1);
  });

  it('rejects compare when only 1 token left', async () => {
    await grantFreeTokens('user@test.com');
    const result = await deductToken('user@test.com', 2, 'compare');
    expect(result.success).toBe(false);
    expect(result.balance).toBe(1);
  });

  it('credits tokens from Stripe purchase', async () => {
    await grantFreeTokens('user@test.com');
    await deductToken('user@test.com', 1, 'test');
    await creditTokens('user@test.com', 5, 'pi_test_123');
    expect(await getTokenBalance('user@test.com')).toBe(5);
  });

  it('credit is idempotent on payment intent', async () => {
    await grantFreeTokens('user@test.com');
    await creditTokens('user@test.com', 5, 'pi_test_456');
    await creditTokens('user@test.com', 5, 'pi_test_456'); // duplicate
    expect(await getTokenBalance('user@test.com')).toBe(6); // 1 free + 5, not 11
  });

  it('credits create account if none exists', async () => {
    expect(await hasTokenAccount('new@test.com')).toBe(false);
    await creditTokens('new@test.com', 5, 'pi_test_789');
    expect(await getTokenBalance('new@test.com')).toBe(5);
  });

  it('returns 0 balance for unknown user', async () => {
    expect(await getTokenBalance('unknown@test.com')).toBe(0);
  });
});
