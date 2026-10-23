import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

vi.mock('../server/clerk.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../server/clerk.js')>()),
  requireAuth: vi.fn(async () => 'u@test.com'),
}));
vi.mock('../server/services/stripe.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../server/services/stripe.js')>()),
  getActiveSubscriptionLive: vi.fn(async () => ({ isPro: false })),
}));

import { dbRun, initDb } from '../server/db.js';
import { deductToken, creditTokens, getTokenBalance } from '../server/services/tokens.js';
import { creditWallet, getWalletCents } from '../server/services/wallet.js';
import { creditGate } from '../server/routes/tools/_shared.js';

const EMAIL = 'u@test.com';

beforeAll(async () => { await initDb(); });
beforeEach(async () => {
  await dbRun('DELETE FROM token_transactions');
  await dbRun('DELETE FROM token_balances');
  await dbRun('DELETE FROM wallet_transactions');
  await dbRun('DELETE FROM wallet_balances');
});

function fakeReply() {
  const r: any = { code: 0, body: undefined };
  r.status = (c: number) => { r.code = c; return r; };
  r.send = (b: unknown) => { r.body = b; return r; };
  return r;
}
const fakeReq: any = { headers: {}, ip: '127.0.0.1' };

describe('deductToken wallet fallback', () => {
  it('uses tokens first and leaves the wallet alone', async () => {
    await creditTokens(EMAIL, 2, 'pi_1');
    await creditWallet(EMAIL, 500, 'topup', 'ref-1');
    const r = await deductToken(EMAIL, 1, 'page_roast');
    expect(r).toEqual({ success: true, balance: 1, source: 'tokens' });
    expect(await getWalletCents(EMAIL)).toBe(500);
  });

  it('debits the wallet at 100 cents per token when tokens are 0', async () => {
    await creditWallet(EMAIL, 500, 'topup', 'ref-2');
    const r = await deductToken(EMAIL, 2, 'page_roast');
    expect(r.success).toBe(true);
    expect(r.source).toBe('wallet');
    expect(await getWalletCents(EMAIL)).toBe(300);
    expect(await getTokenBalance(EMAIL)).toBe(0);
  });

  it('debits nothing when both are short', async () => {
    await creditTokens(EMAIL, 1, 'pi_2');
    await creditWallet(EMAIL, 150, 'topup', 'ref-3');
    const r = await deductToken(EMAIL, 2, 'page_roast');
    expect(r.success).toBe(false);
    expect(await getTokenBalance(EMAIL)).toBe(1);
    expect(await getWalletCents(EMAIL)).toBe(150);
  });
});

describe('creditGate with wallet', () => {
  it('passes when only the wallet covers the cost', async () => {
    await creditTokens(EMAIL, 0, 'pi_3');
    await creditWallet(EMAIL, 200, 'topup', 'ref-4');
    const reply = fakeReply();
    const g = await creditGate(fakeReq, reply, { endpoint: 'wallet-test-a', cost: 2 });
    expect(g?.email).toBe(EMAIL);
    expect(reply.code).toBe(0);
  });

  it('402s only when tokens and wallet are both short', async () => {
    await creditTokens(EMAIL, 0, 'pi_4');
    await creditWallet(EMAIL, 199, 'topup', 'ref-5');
    const reply = fakeReply();
    const g = await creditGate(fakeReq, reply, { endpoint: 'wallet-test-b', cost: 2 });
    expect(g).toBeNull();
    expect(reply.code).toBe(402);
  });
});
