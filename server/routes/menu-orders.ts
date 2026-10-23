import type { FastifyInstance } from 'fastify';
import { menuPayload } from '../../shared/bilko-menu.js';
import { bookLiveCall, listOrdersForEmail, placeMenuOrder } from '../services/menu-orders.js';
import { walletAuthEmail } from './wallet.js';

const ORDER_LIMIT = 20;
const ORDER_WINDOW_MS = 60_000;
const BODY_LIMIT = 65_536;
const TOPUP_URL = 'https://bilko.run/buy/credits-5';
const orderHits = new Map<string, { count: number; resetAt: number }>();

function orderRateLimited(ip: string): boolean {
  const t = Date.now();
  if (orderHits.size > 1000) {
    for (const [k, v] of orderHits) if (v.resetAt <= t) orderHits.delete(k);
  }
  const hit = orderHits.get(ip);
  if (!hit || hit.resetAt <= t) {
    orderHits.set(ip, { count: 1, resetAt: t + ORDER_WINDOW_MS });
    return false;
  }
  hit.count += 1;
  return hit.count > ORDER_LIMIT;
}

export function registerMenuOrderRoutes(app: FastifyInstance): void {
  app.get('/api/menu', async (_req, reply) => {
    reply.header('Cache-Control', 'public, max-age=300');
    return menuPayload();
  });

  app.post('/api/menu/:itemId/order', { bodyLimit: BODY_LIMIT }, async (req, reply) => {
    if (orderRateLimited(req.ip)) {
      reply.status(429).send({ error: 'Too many requests. Try again in a minute.' });
      return;
    }
    const email = await walletAuthEmail(req, reply);
    if (!email) return;

    const via = req.headers.authorization?.startsWith('Bearer bkk_') ? 'api' : 'web';
    const { itemId } = req.params as { itemId: string };
    const { intake, startMs } = (req.body ?? {}) as { intake?: unknown; startMs?: unknown };
    if (itemId === 'live-call') {
      const booked = await bookLiveCall({ email, startMs, intake, via });
      reply.header('Cache-Control', 'private, no-store');
      switch (booked.status) {
        case 'ok':
          reply.status(201);
          return { booking: booked.booking, balanceCents: booked.balanceCents, emailed: booked.emailed };
        case 'slot_unavailable':
          reply.status(409).send({ error: 'slot_unavailable' });
          return;
        case 'insufficient_credits':
          reply.status(402).send({ error: 'insufficient_credits', balanceCents: booked.balanceCents ?? 0, topUpUrl: TOPUP_URL });
          return;
        default:
          reply.status(400).send({ error: booked.status });
          return;
      }
    }
    const result = await placeMenuOrder({ email, itemId, intake, via });
    reply.header('Cache-Control', 'private, no-store');

    switch (result.status) {
      case 'ok':
        reply.status(201);
        return {
          order: {
            id: result.order.id,
            itemId: result.order.item_id,
            status: result.order.status,
            priceCents: result.order.price_cents,
          },
          balanceCents: result.balanceCents,
        };
      case 'unknown_item':
        reply.status(404).send({ error: 'unknown_item' });
        return;
      case 'invalid_intake':
        reply.status(400).send({ error: 'invalid_intake' });
        return;
      case 'live_needs_slot':
        reply.status(400).send({ error: 'live_needs_slot' });
        return;
      case 'insufficient_credits':
        reply.status(402).send({
          error: 'insufficient_credits',
          balanceCents: result.balanceCents ?? 0,
          topUpUrl: TOPUP_URL,
        });
        return;
      case 'daily_cap':
        reply.status(409).send({ error: 'daily_cap' });
        return;
    }
  });

  app.get('/api/menu/orders', async (req, reply) => {
    const email = await walletAuthEmail(req, reply);
    if (!email) return;
    const rows = await listOrdersForEmail(email);
    reply.header('Cache-Control', 'private, no-store');
    return {
      orders: rows.map(o => ({
        id: o.id,
        itemId: o.item_id,
        status: o.status,
        priceCents: o.price_cents,
        createdAt: o.created_at,
      })),
    };
  });
}
