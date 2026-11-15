import { describe, it, expect, beforeAll } from 'vitest';
import Fastify from 'fastify';
import { initDb } from '../server/db.js';

// Taels are play money: they can be bought and spent, never moved between users or turned back into money.
const FORBIDDEN = /transfer|gift|send|withdraw|cash-?out|payout|redeem/i;

beforeAll(async () => { await initDb(); });

describe('play currency has no transfer or cash-out path', () => {
  it('no registered route path names a transfer or cash-out', async () => {
    const { registerPlayCurrencyRoutes } = await import('../server/routes/play-currency.js');
    const { registerWalletRoutes } = await import('../server/routes/wallet.js');
    const { registerStripeRoutes } = await import('../server/routes/stripe.js');
    const app = Fastify();
    const paths: string[] = [];
    app.addHook('onRoute', (opts) => { paths.push(opts.url); });
    registerPlayCurrencyRoutes(app);
    registerWalletRoutes(app);
    registerStripeRoutes(app);
    await app.ready();
    await app.close();
    const playPaths = paths.filter((p) => p.startsWith('/api/play-currency'));
    expect(playPaths).toEqual(expect.arrayContaining([
      '/api/play-currency/entitlements', '/api/play-currency/items/:itemId/purchase',
    ]));
    expect(paths.filter((p) => FORBIDDEN.test(p))).toEqual([]);
  });

  it('the play-currency service exports no transfer or cash-out function', async () => {
    const mod = await import('../server/services/play-currency.js');
    const fns = Object.keys(mod).filter((k) => typeof (mod as Record<string, unknown>)[k] === 'function');
    expect(fns).toContain('purchasePlayItem');
    expect(fns.filter((k) => FORBIDDEN.test(k))).toEqual([]);
  });
});
