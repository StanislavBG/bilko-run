import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

vi.mock('../server/clerk.js', () => ({ requireAuth: vi.fn() }));

import { requireAuth } from '../server/clerk.js';
import { dbRun, dbGet, initDb } from '../server/db.js';
import { creditPlay, debitPlay, getPlayBalance } from '../server/services/play-currency.js';
import { setAppleVerifierForTests, type AppleTransaction, type AppleVerifier } from '../server/services/apple-iap.js';
import { registerPlayCurrencyRoutes, resetPlayCurrencyRouteState } from '../server/routes/play-currency.js';

const APP = 'threewinds';
const ALICE = 'alice@test.com';
const BOB = 'bob@test.com';
const POUCH = 5000; // threewinds.taels.pouch

/** Fake JWS: "tx:<json>" verifies to that transaction, "note:<json>" to that notification; anything else is a bad signature. */
const fakeVerifier: AppleVerifier = {
  async verifyTransaction(jws) {
    if (!jws.startsWith('tx:')) throw new Error('bad signature');
    return JSON.parse(jws.slice(3)) as AppleTransaction;
  },
  async verifyNotification(payload) {
    if (!payload.startsWith('note:')) throw new Error('bad signature');
    return JSON.parse(payload.slice(5));
  },
};

function tx(id: string, extra: Partial<AppleTransaction> = {}): AppleTransaction {
  return {
    transactionId: id, originalTransactionId: id, productId: 'threewinds.taels.pouch',
    bundleId: 'run.bilko.threewinds', environment: 'Sandbox', purchaseDate: 1_700_000_000_000, ...extra,
  };
}
const jwsTx = (t: AppleTransaction) => `tx:${JSON.stringify(t)}`;
const jwsNote = (notificationType: string, t?: AppleTransaction) =>
  `note:${JSON.stringify({ notificationType, ...(t ? { transaction: t } : {}) })}`;

async function post(url: string, payload: unknown, user: string | null = ALICE) {
  vi.mocked(requireAuth).mockImplementation(async (_req: any, reply: any) => {
    if (!user) { reply.code(401).send({ error: 'unauthorized' }); return null; }
    return user;
  });
  const app = Fastify();
  registerPlayCurrencyRoutes(app);
  const res = await app.inject({ method: 'POST', url, payload: payload as any });
  await app.close();
  return res;
}
const claim = (signedTransaction: string, user = ALICE) =>
  post('/api/play-currency/apple/transactions', { app: APP, signedTransaction }, user);
const notify = (signedPayload: string) =>
  post('/api/play-currency/apple/notifications', { signedPayload }, null);

const balance = async (email: string) => (await getPlayBalance(APP, email)).balance;
const purchase = (id: string) => dbGet<{ email: string; status: string; shortfall: number; taels: number; pack_id: string }>(
  "SELECT email, status, shortfall, taels, pack_id FROM play_purchases WHERE provider = 'apple' AND external_id = ?", id);

beforeAll(async () => { await initDb(); });
beforeEach(async () => {
  await dbRun('DELETE FROM play_purchases');
  await dbRun('DELETE FROM play_ledger');
  await dbRun('DELETE FROM play_balances');
  resetPlayCurrencyRouteState();
  setAppleVerifierForTests(fakeVerifier);
});
afterAll(() => { setAppleVerifierForTests(undefined); });

describe('POST /api/play-currency/apple/transactions', () => {
  it('credits a verified pack once and records the purchase', async () => {
    const res = await claim(jwsTx(tx('1000')));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ credited: true, balance: POUCH });
    expect(await purchase('1000')).toMatchObject({ email: ALICE, status: 'credited', taels: POUCH, pack_id: 'pouch' });
    const row = await dbGet<{ kind: string; amount: number }>(
      'SELECT kind, amount FROM play_ledger WHERE app = ? AND account = ? AND ref = ?', APP, ALICE, 'apple:1000');
    expect(row).toMatchObject({ kind: 'purchase_apple' });
    expect(Number(row!.amount)).toBe(POUCH);
  });

  it('a replay by the same user returns credited: false and credits nothing', async () => {
    await claim(jwsTx(tx('1001')));
    const res = await claim(jwsTx(tx('1001')));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ credited: false, balance: POUCH });
    expect(await balance(ALICE)).toBe(POUCH);
  });

  it('the same transaction id from a different user is 409 already_claimed', async () => {
    await claim(jwsTx(tx('1002')));
    const res = await claim(jwsTx(tx('1002')), BOB);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'already_claimed' });
    expect(await balance(BOB)).toBe(0);
    expect((await purchase('1002'))?.email).toBe(ALICE);
  });

  it('rejects a revoked transaction, an unknown product and a bad signature with 400', async () => {
    const revoked = await claim(jwsTx(tx('1003', { revocationDate: 1_700_000_100_000 })));
    expect(revoked.statusCode).toBe(400);
    const unknown = await claim(jwsTx(tx('1004', { productId: 'threewinds.taels.nope' })));
    expect(unknown.statusCode).toBe(400);
    const bad = await claim('not-a-jws');
    expect(bad.statusCode).toBe(400);
    expect(await balance(ALICE)).toBe(0);
    expect(await purchase('1003')).toBeUndefined();
    expect(await purchase('1004')).toBeUndefined();
  });

  it('returns 503 apple_iap_unavailable when no verifier is configured', async () => {
    setAppleVerifierForTests(null);
    const res = await claim(jwsTx(tx('1005')));
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: 'apple_iap_unavailable' });
  });

  it('requires auth', async () => {
    const res = await post('/api/play-currency/apple/transactions', { app: APP, signedTransaction: jwsTx(tx('1006')) }, null);
    expect(res.statusCode).toBe(401);
    expect(await purchase('1006')).toBeUndefined();
  });

  it('rejects an unknown app', async () => {
    const res = await post('/api/play-currency/apple/transactions', { app: 'nope', signedTransaction: jwsTx(tx('1007')) });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/play-currency/apple/notifications', () => {
  it('returns 400 for an unverifiable payload', async () => {
    expect((await notify('garbage')).statusCode).toBe(400);
    expect((await post('/api/play-currency/apple/notifications', {}, null)).statusCode).toBe(400);
  });

  it('accepts other notification types with 200 and no action', async () => {
    await claim(jwsTx(tx('2000')));
    const res = await notify(jwsNote('CONSUMPTION_REQUEST', tx('2000')));
    expect(res.statusCode).toBe(200);
    expect(await balance(ALICE)).toBe(POUCH);
    expect((await purchase('2000'))?.status).toBe('credited');
  });

  it('REFUND debits the taels and marks the purchase refunded; a replay changes nothing', async () => {
    await creditPlay(APP, ALICE, 1000, 'signup_grant', 'signup_grant');
    await claim(jwsTx(tx('2001')));
    expect(await balance(ALICE)).toBe(1000 + POUCH);

    const res = await notify(jwsNote('REFUND', tx('2001', { revocationDate: 1_700_000_200_000 })));
    expect(res.statusCode).toBe(200);
    expect(await balance(ALICE)).toBe(1000);
    expect(await purchase('2001')).toMatchObject({ status: 'refunded' });
    expect(Number((await purchase('2001'))!.shortfall)).toBe(0);
    const row = await dbGet<{ amount: number }>(
      'SELECT amount FROM play_ledger WHERE app = ? AND account = ? AND ref = ?', APP, ALICE, 'apple_refund:2001');
    expect(Number(row?.amount)).toBe(-POUCH);

    const replay = await notify(jwsNote('REFUND', tx('2001', { revocationDate: 1_700_000_200_000 })));
    expect(replay.statusCode).toBe(200);
    expect(await balance(ALICE)).toBe(1000);

    // A refunded transaction cannot be re-claimed for a fresh credit.
    const reclaim = await claim(jwsTx(tx('2001')));
    expect(reclaim.json()).toMatchObject({ credited: false });
    expect(await balance(ALICE)).toBe(1000);
  });

  it('REVOKE with a partly spent balance debits what is left and records the shortfall', async () => {
    await claim(jwsTx(tx('2002')));
    await debitPlay(APP, ALICE, 3000, 'buy_item', 'item:ink');
    expect(await balance(ALICE)).toBe(POUCH - 3000);

    const res = await notify(jwsNote('REVOKE', tx('2002')));
    expect(res.statusCode).toBe(200);
    expect(await balance(ALICE)).toBe(0);
    const p = await purchase('2002');
    expect(p?.status).toBe('refunded');
    expect(Number(p!.shortfall)).toBe(3000);

    await creditPlay(APP, ALICE, 500, 'signup_grant', 'later');
    await notify(jwsNote('REVOKE', tx('2002')));
    expect(await balance(ALICE)).toBe(500);
    expect(Number((await purchase('2002'))!.shortfall)).toBe(3000);
  });

  it('a refund for an unknown transaction is a 200 no-op', async () => {
    const res = await notify(jwsNote('REFUND', tx('9999')));
    expect(res.statusCode).toBe(200);
  });

  it('returns 503 when no verifier is configured', async () => {
    setAppleVerifierForTests(null);
    const res = await notify(jwsNote('REFUND', tx('2003')));
    expect(res.statusCode).toBe(503);
  });

  it('rejects a body over 64 KiB', async () => {
    const res = await notify('note:' + 'x'.repeat(70 * 1024));
    expect(res.statusCode).toBe(413);
  });
});
