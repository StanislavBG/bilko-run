import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../clerk.js';
import { getStripe } from '../services/stripe.js';
import { creditPlay, debitPlay, getPlayBalance, listPlayEntitlements, purchasePlayItem } from '../services/play-currency.js';
import { getAppleVerifier, type AppleNotification, type AppleTransaction } from '../services/apple-iap.js';
import { dbGet, dbRun } from '../db.js';
import { PLAY_APPS, findPack, findPackByAppleProduct, type PlayPack } from '../../shared/play-currency-catalog.js';

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
const appleTxRate = perUserRate(30);
const itemPurchaseRate = perUserRate(20);
const APPLE_NOTIFICATION_BODY_LIMIT = 64 * 1024;
/** Notification types that take a purchase's taels back. Everything else is acknowledged with no action. */
const APPLE_REFUND_TYPES = new Set(['REFUND', 'REVOKE']);

type PurchaseRow = { app: string; email: string; taels: number; status: string };

function getPurchase(provider: string, externalId: string): Promise<PurchaseRow | undefined> {
  return dbGet<PurchaseRow>(
    'SELECT app, email, taels, status FROM play_purchases WHERE provider = ? AND external_id = ?', provider, externalId);
}

/**
 * Take a refunded/revoked purchase's taels back: debits min(balance, taels) with a fixed
 * ref (so a replay debits nothing), marks the purchase refunded and records the shortfall.
 * A purchase that is unknown or already refunded changes nothing, so a refund and a
 * dispute for the same purchase claw back at most once in total.
 */
export async function refundPlayPurchase(provider: string, externalId: string, kind: string, ref: string): Promise<void> {
  const purchase = await getPurchase(provider, externalId);
  if (!purchase || purchase.status !== 'credited') return;
  const taels = Number(purchase.taels);
  let debited = 0;
  // Retry once: the balance can move (a spend or escrow) between the read and the debit.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { balance } = await getPlayBalance(purchase.app, purchase.email);
    const amount = Math.min(balance, taels);
    if (amount <= 0) break;
    const res = await debitPlay(purchase.app, purchase.email, amount, kind, ref);
    if (res.ok) { debited = amount; break; }
  }
  await dbRun(
    "UPDATE play_purchases SET status = 'refunded', shortfall = ? WHERE provider = ? AND external_id = ? AND status = 'credited'",
    taels - debited, provider, externalId);
}

/**
 * An Apple refund. A REFUND that names a transaction nobody has claimed yet leaves a tombstone
 * row (no account, status 'refunded'), so the still-validly-signed pre-refund JWS can never credit later.
 */
async function refundApplePurchase(transactionId: string): Promise<void> {
  // taels has CHECK (taels > 0); the tombstone's 1 is a placeholder, never credited or debited.
  await dbRun(
    `INSERT OR IGNORE INTO play_purchases (provider, external_id, app, email, pack_id, taels, status, shortfall, created_at)
     VALUES ('apple', ?, '', '', '', 1, 'refunded', 0, ?)`,
    transactionId, Math.floor(Date.now() / 1000));
  await refundPlayPurchase('apple', transactionId, 'refund_apple', `apple_refund:${transactionId}`);
}
/** app:email pairs whose signup grant is already in the ledger (skips a write per call). */
const granted = new Set<string>();

export function resetPlayCurrencyRouteState(): void {
  checkoutRate.clear();
  appleTxRate.clear();
  itemPurchaseRate.clear();
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

  app.get('/api/play-currency/entitlements', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    const appId = (req.query as { app?: unknown } | undefined)?.app;
    if (!knownApp(appId)) return reply.code(400).send({ error: 'unknown_app' });
    reply.header('Cache-Control', 'private, no-store');
    return { items: await listPlayEntitlements(appId, email) };
  });

  // Spend taels on a cosmetic item. The only taels sink besides play; no route moves taels between users.
  app.post('/api/play-currency/items/:itemId/purchase', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    if (!itemPurchaseRate.take(email.trim().toLowerCase())) return reply.code(429).send({ error: 'rate_limited' });
    const query = (req.query ?? {}) as { app?: unknown };
    const body = (req.body ?? {}) as { app?: unknown };
    const appId = query.app ?? body.app;
    if (!knownApp(appId)) return reply.code(400).send({ error: 'unknown_app' });
    const { itemId } = req.params as { itemId: string };

    const result = await purchasePlayItem(appId, email, itemId);
    reply.header('Cache-Control', 'private, no-store');
    if (!result.ok) {
      const code = result.error === 'insufficient_taels' ? 402 : result.error === 'unknown_item' ? 404 : 409;
      return reply.code(code).send({ error: result.error });
    }
    return reply.code(201).send({ itemId: result.itemId, serial: result.serial, balance: result.balance });
  });

  // StoreKit 2: the iOS app posts each signed transaction. One transaction id credits one account once.
  app.post('/api/play-currency/apple/transactions', { bodyLimit: APPLE_NOTIFICATION_BODY_LIMIT }, async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    if (!appleTxRate.take(email)) return reply.code(429).send({ error: 'rate_limited' });

    const body = (req.body ?? {}) as { app?: unknown; signedTransaction?: unknown };
    if (!knownApp(body.app)) return reply.code(400).send({ error: 'unknown_app' });
    const appId = body.app;
    if (typeof body.signedTransaction !== 'string' || body.signedTransaction.length === 0) {
      return reply.code(400).send({ error: 'invalid_transaction' });
    }

    const verifier = getAppleVerifier();
    if (!verifier) return reply.code(503).send({ error: 'apple_iap_unavailable' });

    let tx: AppleTransaction;
    try {
      tx = await verifier.verifyTransaction(body.signedTransaction);
    } catch (err: any) {
      // Never log the signed payload itself.
      console.warn('[play-currency] apple transaction rejected:', err?.name ?? 'Error');
      return reply.code(400).send({ error: 'invalid_transaction' });
    }
    if (tx.revocationDate !== undefined) return reply.code(400).send({ error: 'transaction_revoked' });
    const pack = findPackByAppleProduct(appId, tx.productId);
    if (!pack) return reply.code(400).send({ error: 'unknown_product' });

    const playEmail = email.trim().toLowerCase();
    // The PRIMARY KEY (provider, external_id) lets exactly one account own this transaction id.
    await dbRun(
      `INSERT OR IGNORE INTO play_purchases (provider, external_id, app, email, pack_id, taels, status, shortfall, created_at)
       VALUES ('apple', ?, ?, ?, ?, ?, 'credited', 0, ?)`,
      tx.transactionId, appId, playEmail, pack.id, pack.taels, Math.floor(Date.now() / 1000));
    const owner = await getPurchase('apple', tx.transactionId);
    if (!owner || owner.email !== playEmail || owner.app !== appId) {
      return reply.code(409).send({ error: 'already_claimed' });
    }

    reply.header('Cache-Control', 'private, no-store');
    if (owner.status !== 'credited') {
      const { balance } = await getPlayBalance(appId, playEmail);
      return { credited: false, balance };
    }
    // Idempotent on the ledger ref: a retry after a crash between insert and credit still credits once.
    const { credited, balance } = await creditPlay(appId, playEmail, Number(owner.taels), 'purchase_apple', `apple:${tx.transactionId}`);
    return { credited, balance };
  });

  // App Store Server Notifications v2. No session: the signed payload is the credential.
  app.post('/api/play-currency/apple/notifications', { bodyLimit: APPLE_NOTIFICATION_BODY_LIMIT }, async (req, reply) => {
    const body = (req.body ?? {}) as { signedPayload?: unknown };
    if (typeof body.signedPayload !== 'string' || body.signedPayload.length === 0) {
      return reply.code(400).send({ error: 'invalid_notification' });
    }
    const verifier = getAppleVerifier();
    if (!verifier) return reply.code(503).send({ error: 'apple_iap_unavailable' });

    let note: AppleNotification;
    try {
      note = await verifier.verifyNotification(body.signedPayload);
    } catch (err: any) {
      console.warn('[play-currency] apple notification rejected:', err?.name ?? 'Error');
      return reply.code(400).send({ error: 'invalid_notification' });
    }

    if (APPLE_REFUND_TYPES.has(note.notificationType) && note.transaction) {
      await refundApplePurchase(note.transaction.transactionId);
    }
    return { ok: true };
  });
}
