import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';

const create = vi.fn();
const piRetrieve = vi.fn();
const creditWallet = vi.fn(async () => ({ credited: true, balanceCents: 0 }));
const playLedger = new Map<string, { app: string; email: string; amount: number; kind: string }>();
const creditPlay = vi.fn(async (app: string, email: string, amount: number, kind: string, ref: string) => {
  const key = `${app}|${email}|${ref}`;
  if (playLedger.has(key)) return { credited: false, balance: 0 };
  playLedger.set(key, { app, email, amount, kind });
  return { credited: true, balance: amount };
});
const getPlayBalance = vi.fn(async (app: string, email: string) => {
  let balance = 0;
  for (const [k, v] of playLedger) if (k.startsWith(`${app}|${email}|`)) balance += v.amount;
  return { balance, held: 0 };
});
let stripeAvailable = true;

vi.mock('../server/clerk.js', () => ({ requireAuth: vi.fn() }));
const debitPlay = vi.fn(async (app: string, email: string, amount: number, kind: string, ref: string) => {
  const key = `${app}|${email}|${ref}`;
  if (playLedger.has(key)) return { ok: true, balance: 0 };
  playLedger.set(key, { app, email, amount: -amount, kind });
  return { ok: true, balance: 0 };
});
vi.mock('../server/services/play-currency.js', () => ({ creditPlay, getPlayBalance, debitPlay }));
vi.mock('../server/services/wallet.js', () => ({ creditWallet }));
vi.mock('../server/services/agent-api-keys.js', () => ({ mintAgentApiKey: vi.fn() }));
vi.mock('../server/services/web-products.js', () => ({ recordOrder: async () => {} }));
vi.mock('../server/services/stripe.js', () => ({
  getStripe: () => (stripeAvailable ? {
    checkout: { sessions: { create, listLineItems: vi.fn(), retrieve: vi.fn() } },
    paymentIntents: { retrieve: piRetrieve },
  } : null),
  isStripeConfigured: () => true,
  isAudienceDecoderConfigured: () => true,
  hasActiveSubscription: async () => false,
  hasPurchased: async () => false,
  getCustomerStripeId: async () => null,
  upsertCustomer: async () => {},
  saveSubscription: async () => {},
  updateSubscriptionStatus: async () => {},
  updateSubscriptionPeriod: async () => {},
  saveOneTimePurchase: vi.fn(async () => {}),
  priceToPlanTier: () => 'pro',
  hasActiveSubscriptionLive: async () => false,
}));
vi.mock('../server/services/tokens.js', () => ({
  creditTokens: async () => {}, grantFreeTokens: async () => {}, hasTokenAccount: async () => true,
}));
// Just enough of play_purchases for the refund path: insert-or-ignore, lookup by payment_ref / key, and the refund UPDATE.
type PurchaseRow = { provider: string; external_id: string; app: string; email: string; taels: number; status: string; shortfall: number; payment_ref: string | null };
const purchases = new Map<string, PurchaseRow>();
vi.mock('../server/db.js', () => ({
  dbRun: vi.fn(async (sql: string, ...a: any[]) => {
    if (sql.includes('INSERT OR IGNORE INTO play_purchases')) {
      const [externalId, app, email, , taels, , paymentRef] = a;
      if (!purchases.has(externalId)) purchases.set(externalId, { provider: 'stripe', external_id: externalId, app, email, taels, status: 'credited', shortfall: 0, payment_ref: paymentRef });
    } else if (sql.includes('UPDATE play_purchases SET status')) {
      const [shortfall, , externalId] = a;
      const row = purchases.get(externalId);
      if (row && row.status === 'credited') { row.status = 'refunded'; row.shortfall = shortfall; }
    }
  }),
  dbGet: vi.fn(async (sql: string, ...a: any[]) => {
    if (!sql.includes('FROM play_purchases')) return undefined;
    if (sql.includes('payment_ref = ?')) return [...purchases.values()].find((r) => r.payment_ref === a[0]);
    return purchases.get(a[1]);
  }),
}));

import { requireAuth } from '../server/clerk.js';

async function routes() {
  return { ...(await import('../server/routes/play-currency.js')), ...(await import('../server/routes/stripe.js')) };
}
async function resetPlayCurrencyRouteState() {
  (await routes()).resetPlayCurrencyRouteState();
}

const USER = 'player@test.com';

async function build() {
  const { registerPlayCurrencyRoutes, registerStripeRoutes } = await routes();
  const app = Fastify();
  registerPlayCurrencyRoutes(app);
  registerStripeRoutes(app);
  return app;
}

async function checkout(body: Record<string, unknown>) {
  const app = await build();
  const res = await app.inject({ method: 'POST', url: '/api/play-currency/checkout', payload: body });
  await app.close();
  return res;
}

async function webhook(obj: Record<string, unknown>) {
  const app = await build();
  const res = await app.inject({
    method: 'POST', url: '/api/stripe/webhook',
    payload: { type: 'checkout.session.completed', data: { object: {
      id: 'cs_test_p1', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_1', currency: 'usd',
      metadata: { play_app: 'threewinds', play_pack: 'purse', play_email: 'Player@Test.com', play_currency: 'usd' },
      customer_details: { email: 'other@test.com' }, amount_total: 499, amount_subtotal: 499, ...obj,
    } } },
  });
  await app.close();
  return res.statusCode;
}

describe('play-currency Stripe packs', () => {
  const OLD_ENV = process.env;
  beforeEach(async () => {
    vi.clearAllMocks();
    playLedger.clear();
    purchases.clear();
    await resetPlayCurrencyRouteState();
    stripeAvailable = true;
    process.env = { ...OLD_ENV, NODE_ENV: 'test' };
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.PUBLIC_URL;
    delete process.env.PLAY_CURRENCY_SALES_OPEN;
    vi.mocked(requireAuth).mockResolvedValue(USER);
    create.mockResolvedValue({ url: 'https://checkout.stripe.test/s' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = OLD_ENV;
    vi.restoreAllMocks();
  });

  describe('checkout', () => {
    it('is sales_closed when PLAY_CURRENCY_SALES_OPEN is unset, and creates no session', async () => {
      const res = await checkout({ app: 'threewinds', packId: 'purse', currency: 'usd' });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: 'sales_closed' });
      expect(create).not.toHaveBeenCalled();
    });

    it('stays closed when another app is listed', async () => {
      process.env.PLAY_CURRENCY_SALES_OPEN = 'otherapp';
      expect((await checkout({ app: 'threewinds', packId: 'purse', currency: 'usd' })).statusCode).toBe(409);
      expect(create).not.toHaveBeenCalled();
    });

    it('creates a USD session with inline price_data and play metadata when open', async () => {
      process.env.PLAY_CURRENCY_SALES_OPEN = 'threewinds';
      const res = await checkout({ app: 'threewinds', packId: 'purse', currency: 'usd', email: 'attacker@evil.com' });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ url: 'https://checkout.stripe.test/s' });
      const params = create.mock.calls[0][0];
      expect(params.mode).toBe('payment');
      expect(params.line_items[0].price_data).toMatchObject({ currency: 'usd', unit_amount: 499 });
      expect(params.metadata).toEqual({ play_app: 'threewinds', play_pack: 'purse', play_email: USER, play_currency: 'usd' });
      expect(params.customer_email).toBe(USER);
      expect(params.success_url).toBe('https://bilko.run/projects/threewinds/?purchase=success');
      expect(params.cancel_url).toBe('https://bilko.run/projects/threewinds/?purchase=cancel');
    });

    it('creates a MYR session priced in sen', async () => {
      process.env.PLAY_CURRENCY_SALES_OPEN = 'foo, threewinds';
      const res = await checkout({ app: 'threewinds', packId: 'vault', currency: 'myr' });
      expect(res.statusCode).toBe(200);
      const params = create.mock.calls[0][0];
      expect(params.line_items[0].price_data).toMatchObject({ currency: 'myr', unit_amount: 44990 });
      expect(params.metadata.play_currency).toBe('myr');
      expect(params.metadata.play_pack).toBe('vault');
    });

    it('rejects an unknown pack or currency with 400', async () => {
      process.env.PLAY_CURRENCY_SALES_OPEN = 'threewinds';
      expect((await checkout({ app: 'threewinds', packId: 'nope', currency: 'usd' })).statusCode).toBe(400);
      expect((await checkout({ app: 'threewinds', packId: 'purse', currency: 'eur' })).statusCode).toBe(400);
      expect(create).not.toHaveBeenCalled();
    });

    it('returns 503 when Stripe is unavailable', async () => {
      process.env.PLAY_CURRENCY_SALES_OPEN = 'threewinds';
      stripeAvailable = false;
      expect((await checkout({ app: 'threewinds', packId: 'purse', currency: 'usd' })).statusCode).toBe(503);
    });

    it('rate limits at 10 per minute per user', async () => {
      process.env.PLAY_CURRENCY_SALES_OPEN = 'threewinds';
      const app = await build();
      const codes: number[] = [];
      for (let i = 0; i < 11; i++) {
        codes.push((await app.inject({ method: 'POST', url: '/api/play-currency/checkout', payload: { app: 'threewinds', packId: 'pouch', currency: 'usd' } })).statusCode);
      }
      await app.close();
      expect(codes.slice(0, 10).every(c => c === 200)).toBe(true);
      expect(codes[10]).toBe(429);
    });

    it('requires auth', async () => {
      vi.mocked(requireAuth).mockImplementation(async (_req, reply: any) => { reply.code(401).send({ error: 'auth' }); return null as any; });
      expect((await checkout({ app: 'threewinds', packId: 'purse', currency: 'usd' })).statusCode).toBe(401);
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('balance', () => {
    it('credits the signup grant once and reports salesOpen', async () => {
      const app = await build();
      const r1 = await app.inject({ method: 'GET', url: '/api/play-currency/balance?app=threewinds' });
      expect(r1.statusCode).toBe(200);
      expect(r1.json()).toEqual({ balance: 5000, held: 0, salesOpen: false });
      await resetPlayCurrencyRouteState(); // drop the in-process cache: the ledger ref alone must stop a second grant
      process.env.PLAY_CURRENCY_SALES_OPEN = 'threewinds';
      const r2 = await app.inject({ method: 'GET', url: '/api/play-currency/balance?app=threewinds' });
      expect(r2.json()).toEqual({ balance: 5000, held: 0, salesOpen: true });
      await app.close();
      const grants = creditPlay.mock.calls.filter(c => c[3] === 'signup_grant');
      expect(grants.every(c => c[4] === 'signup_grant' && c[2] === 5000)).toBe(true);
      expect([...playLedger.values()].filter(v => v.kind === 'signup_grant')).toHaveLength(1);
    });

    it('rejects an unknown app', async () => {
      const app = await build();
      expect((await app.inject({ method: 'GET', url: '/api/play-currency/balance?app=nope' })).statusCode).toBe(400);
      await app.close();
    });
  });

  describe('webhook', () => {
    it('credits a paid pack to the play ledger, never the wallet, even with sales closed', async () => {
      expect(await webhook({})).toBe(200);
      expect(creditPlay).toHaveBeenCalledWith('threewinds', 'player@test.com', 26000, 'purchase_stripe', 'stripe:cs_test_p1');
      expect(creditWallet).not.toHaveBeenCalled();
    });

    it('credits a MYR pack checked against the sen price', async () => {
      expect(await webhook({ currency: 'myr', amount_subtotal: 2290, metadata: { play_app: 'threewinds', play_pack: 'purse', play_currency: 'myr' } })).toBe(200);
      expect(creditPlay).toHaveBeenCalledWith('threewinds', 'other@test.com', 26000, 'purchase_stripe', 'stripe:cs_test_p1');
    });

    it('does not credit twice on replay', async () => {
      await webhook({});
      await webhook({});
      expect([...playLedger.values()]).toEqual([{ app: 'threewinds', email: 'player@test.com', amount: 26000, kind: 'purchase_stripe' }]);
      expect(creditWallet).not.toHaveBeenCalled();
    });

    it('ignores a wrong amount', async () => {
      expect(await webhook({ amount_subtotal: 99 })).toBe(200);
      expect(await webhook({ currency: 'myr', amount_subtotal: 499 })).toBe(200);
      expect(creditPlay).not.toHaveBeenCalled();
      expect(creditWallet).not.toHaveBeenCalled();
    });

    it('ignores an unpaid session', async () => {
      expect(await webhook({ payment_status: 'unpaid' })).toBe(200);
      expect(creditPlay).not.toHaveBeenCalled();
      expect(creditWallet).not.toHaveBeenCalled();
    });

    describe('refunds and disputes', () => {
      const KEY = 'threewinds|player@test.com|';
      const PACK = 26000; // purse
      async function event(type: string, obj: Record<string, unknown>) {
        const app = await build();
        const res = await app.inject({ method: 'POST', url: '/api/stripe/webhook', payload: { type, data: { object: obj } } });
        await app.close();
        return res.statusCode;
      }
      const refund = () => event('charge.refunded', { id: 'ch_1', payment_intent: 'pi_1', refunded: true });
      const dispute = () => event('charge.dispute.created', { id: 'dp_1', payment_intent: 'pi_1' });
      const debits = () => [...playLedger.entries()].filter(([k, v]) => k.startsWith(KEY) && v.amount < 0);

      it('charge.refunded takes the pack back once; a replay debits nothing', async () => {
        await webhook({});
        expect(await refund()).toBe(200);
        expect(debits()).toEqual([[`${KEY}stripe_refund:cs_test_p1`, { app: 'threewinds', email: 'player@test.com', amount: -PACK, kind: 'refund_stripe' }]]);
        expect(purchases.get('cs_test_p1')).toMatchObject({ status: 'refunded', shortfall: 0 });
        expect(await refund()).toBe(200);
        expect(debits()).toHaveLength(1);
        expect((await getPlayBalance('threewinds', 'player@test.com')).balance).toBe(0);
      });

      it('debits only min(balance, taels) and records the shortfall when the balance is short', async () => {
        await webhook({});
        playLedger.set(`${KEY}spent`, { app: 'threewinds', email: 'player@test.com', amount: -20000, kind: 'item' }); // 6000 left
        expect(await refund()).toBe(200);
        expect(debits().map(([, v]) => v.amount).sort((a, b) => a - b)).toEqual([-20000, -6000]);
        expect(purchases.get('cs_test_p1')).toMatchObject({ status: 'refunded', shortfall: PACK - 6000 });
        await refund();
        expect(debits()).toHaveLength(2);
      });

      it('charge.dispute.created takes the pack back once, and refund plus dispute together only once', async () => {
        await webhook({});
        expect(await dispute()).toBe(200);
        expect(debits()).toHaveLength(1);
        expect(await dispute()).toBe(200);
        expect(await refund()).toBe(200);
        expect(debits()).toHaveLength(1);
        expect(debits()[0][1].amount).toBe(-PACK);
      });

      it('ignores a partial refund, an unknown payment_intent and a non-play charge', async () => {
        await webhook({});
        expect(await event('charge.refunded', { id: 'ch_1', payment_intent: 'pi_1', refunded: false })).toBe(200);
        expect(await event('charge.refunded', { id: 'ch_2', payment_intent: 'pi_other', refunded: true })).toBe(200);
        expect(await event('charge.dispute.created', { id: 'dp_2' })).toBe(200);
        expect(debits()).toHaveLength(0);
        expect(purchases.get('cs_test_p1')?.status).toBe('credited');
      });
    });
  });
});
