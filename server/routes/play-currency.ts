import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../clerk.js';
import { getStripe } from '../services/stripe.js';
import { creditPlay, getPlayBalance } from '../services/play-currency.js';
import { PLAY_APPS, findPack, type PlayPack } from '../../shared/play-currency-catalog.js';

/**
 * Play-currency (Three Winds taels) balance and Stripe pack checkout.
 * Credits the play ledger only, never Bilko Credits. The webhook branch in
 * routes/stripe.ts does the crediting once the session is paid.
 */

export type PlayCheckoutCurrency = 'usd' | 'myr';
const CURRENCIES: readonly PlayCheckoutCurrency[] = ['usd', 'myr'];

/** Pack price in the smallest unit of the given currency. */
export function packPriceMinor(pack: PlayPack, currency: string): number | undefined {
  if (currency === 'usd') return pack.usdCents;
  if (currency === 'myr') return pack.myrSen;
  return undefined;
}

/** True when `app` is listed in the comma-separated PLAY_CURRENCY_SALES_OPEN env var. */
export function playSalesOpen(app: string): boolean {
  const raw = process.env.PLAY_CURRENCY_SALES_OPEN ?? '';
  return raw.split(',').map(s => s.trim()).filter(Boolean).includes(app);
}

function knownApp(app: unknown): app is string {
  return typeof app === 'string' && Object.prototype.hasOwnProperty.call(PLAY_APPS, app);
}

const RATE_WINDOW_MS = 60_000;
function perUserRate(max: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    take(email: string, now = Date.now()): boolean {
      const entry = hits.get(email);
      if (!entry || now >= entry.resetAt) {
        if (hits.size > 5000) {
          for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
        }
        hits.set(email, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
      }
      if (entry.count >= max) return false;
      entry.count++;
      return true;
    },
    clear(): void { hits.clear(); },
  };
}

const checkoutRate = perUserRate(10);
/** app:email pairs whose signup grant is already in the ledger (skips a write per call). */
const granted = new Set<string>();

export function resetPlayCurrencyRouteState(): void {
  checkoutRate.clear();
  granted.clear();
}

export function registerPlayCurrencyRoutes(app: FastifyInstance): void {
  app.get('/api/play-currency/balance', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    const appId = (req.query as { app?: unknown } | undefined)?.app;
    if (!knownApp(appId)) return reply.code(400).send({ error: 'unknown_app' });

    const key = `${appId}:${email.trim().toLowerCase()}`;
    if (!granted.has(key)) {
      const grant = PLAY_APPS[appId].signupGrant;
      if (grant > 0) await creditPlay(appId, email, grant, 'signup_grant', 'signup_grant');
      granted.add(key);
    }
    const { balance, held } = await getPlayBalance(appId, email);
    reply.header('Cache-Control', 'private, no-store');
    return { balance, held, salesOpen: playSalesOpen(appId) };
  });

  app.post('/api/play-currency/checkout', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    if (!checkoutRate.take(email)) return reply.code(429).send({ error: 'rate_limited' });

    const body = (req.body ?? {}) as { app?: unknown; packId?: unknown; currency?: unknown };
    if (!knownApp(body.app)) return reply.code(400).send({ error: 'unknown_app' });
    const appId = body.app;
    const pack = typeof body.packId === 'string' ? findPack(appId, body.packId) : undefined;
    if (!pack) return reply.code(400).send({ error: 'unknown_pack' });
    const currency = body.currency;
    if (typeof currency !== 'string' || !(CURRENCIES as readonly string[]).includes(currency)) {
      return reply.code(400).send({ error: 'unknown_currency' });
    }
    if (!playSalesOpen(appId)) return reply.code(409).send({ error: 'sales_closed' });

    const stripe = getStripe();
    if (!stripe) return reply.code(503).send({ error: 'Checkout is not available right now.' });

    const unitAmount = packPriceMinor(pack, currency)!;
    const publicUrl = process.env.PUBLIC_URL || 'https://bilko.run';
    const playEmail = email.trim().toLowerCase();
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{
          quantity: 1,
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: { name: `${pack.name} of ${pack.taels.toLocaleString('en-US')} ${PLAY_APPS[appId].currency}` },
          },
        }],
        customer_email: playEmail,
        client_reference_id: playEmail,
        metadata: { play_app: appId, play_pack: pack.id, play_email: playEmail, play_currency: currency },
        success_url: `${publicUrl}/projects/${appId}/?purchase=success`,
        cancel_url: `${publicUrl}/projects/${appId}/?purchase=cancel`,
      } as any);
      if (!session.url) throw new Error('no checkout url');
      reply.header('Cache-Control', 'private, no-store');
      return { url: session.url };
    } catch (err: any) {
      console.error('[play-currency] checkout failed:', err?.message);
      return reply.code(503).send({ error: 'Checkout is not available right now.' });
    }
  });
}
