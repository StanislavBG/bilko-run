import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../clerk.js';
import { verifyAgentApiKey } from '../services/agent-api-keys.js';
import { getStripe } from '../services/stripe.js';
import { getWalletCents } from '../services/wallet.js';
import { WALLET_TOPUP_CENTS, formatCents } from '../../shared/bilko-menu.js';

const TOPUP_LIMIT = 10;
const TOPUP_WINDOW_MS = 60_000;
const topupHits = new Map<string, { count: number; resetAt: number }>();

function topupRateLimited(ip: string): boolean {
  const t = Date.now();
  if (topupHits.size > 1000) {
    for (const [k, v] of topupHits) if (v.resetAt <= t) topupHits.delete(k);
  }
  const hit = topupHits.get(ip);
  if (!hit || hit.resetAt <= t) {
    topupHits.set(ip, { count: 1, resetAt: t + TOPUP_WINDOW_MS });
    return false;
  }
  hit.count += 1;
  return hit.count > TOPUP_LIMIT;
}

/**
 * Resolve the caller's email from a bkk_ agent key or a Clerk session.
 * Replies 401 itself and returns null when neither is valid.
 */
export async function walletAuthEmail(req: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer bkk_')) {
    const email = await verifyAgentApiKey(authHeader.slice('Bearer '.length));
    if (!email) {
      reply.status(401).send({ error: 'Invalid API key.' });
      return null;
    }
    return email;
  }
  return (await requireAuth(req, reply)) || null;
}

export function registerWalletRoutes(app: FastifyInstance): void {
  app.get('/api/wallet', async (req, reply) => {
    const email = await walletAuthEmail(req, reply);
    if (!email) return;
    const balanceCents = await getWalletCents(email);
    reply.header('Cache-Control', 'private, no-store');
    return { balanceCents, balance: formatCents(balanceCents) };
  });

  // Clerk session only: agent keys buy credits through /buy/credits-N.
  app.post('/api/wallet/topup', async (req, reply) => {
    if (topupRateLimited(req.ip)) {
      reply.status(429).send({ error: 'Too many requests. Try again in a minute.' });
      return;
    }
    const email = await requireAuth(req, reply);
    if (!email) return;

    const { cents } = ((req.body ?? {}) as { cents?: unknown });
    const allowed = WALLET_TOPUP_CENTS as readonly number[];
    if (typeof cents !== 'number' || !allowed.includes(cents)) {
      reply.status(400).send({ error: `cents must be one of ${allowed.join(', ')}.` });
      return;
    }
    const stripe = getStripe();
    if (!stripe) {
      reply.status(503).send({ error: 'Checkout is not available right now.' });
      return;
    }
    const publicUrl = process.env.PUBLIC_URL || 'https://bilko.run';
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: cents,
            product_data: { name: `Bilko Credits ${formatCents(cents)}` },
          },
        }],
        customer_creation: 'always',
        customer_email: email,
        client_reference_id: email,
        metadata: { wallet_topup: String(cents), wallet_email: email },
        success_url: `${publicUrl}/pricing?topup=success`,
        cancel_url: `${publicUrl}/pricing?topup=cancel`,
      } as any);
      if (!session.url) throw new Error('no checkout url');
      reply.header('Cache-Control', 'private, no-store');
      return { url: session.url };
    } catch (err: any) {
      console.error('[wallet] topup checkout failed:', err?.message);
      reply.status(503).send({ error: 'Checkout is not available right now.' });
    }
  });
}
