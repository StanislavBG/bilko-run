import type { FastifyInstance } from 'fastify';
import { dbGet } from '../db.js';
import { requireAdmin } from '../clerk.js';
import { MENU_DAILY_ASYNC_CAP, menuItemById } from '../../shared/bilko-menu.js';
import { getOrder, listOrders, markDelivered, refundOrder, type MenuOrder, type MenuOrderStatus } from '../services/menu-orders.js';
import { draftMenuOrder } from '../services/menu-drafts.js';
import { sendMail } from '../services/mailer.js';

const STATUSES: readonly MenuOrderStatus[] = ['queued', 'drafted', 'delivered', 'refunded', 'booked'];
const MAX_BODY = 50_000;

const dayLA = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function view(o: MenuOrder) {
  let intake: unknown = {};
  try { intake = JSON.parse(o.intake_json); } catch { /* keep empty */ }
  return {
    id: o.id,
    ref: o.ref,
    itemId: o.item_id,
    itemName: menuItemById(o.item_id)?.name ?? o.item_id,
    email: o.email,
    priceCents: o.price_cents,
    kind: o.kind,
    status: o.status,
    via: o.via,
    intake,
    draft: o.draft,
    deliveredBody: o.delivered_body,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}

/** 401 when no credentials are sent at all; otherwise requireAdmin (403 for non-admins). */
async function adminGate(req: any, reply: any): Promise<string | null> {
  if (!req.headers.authorization) {
    reply.status(401).send({ error: 'Authentication required.' });
    return null;
  }
  return requireAdmin(req, reply);
}

function parseId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function registerAdminMenuOrderRoutes(app: FastifyInstance): void {
  app.get('/api/admin/menu-orders', async (req, reply) => {
    if (!await adminGate(req, reply)) return;
    reply.header('Cache-Control', 'no-store');
    const raw = (req.query as { status?: unknown })?.status;
    let status: MenuOrderStatus | undefined;
    if (raw !== undefined && raw !== '') {
      if (typeof raw !== 'string' || !STATUSES.includes(raw as MenuOrderStatus)) {
        return reply.status(400).send({ error: 'Invalid status' });
      }
      status = raw as MenuOrderStatus;
    }
    const orders = (await listOrders({ status })).slice().reverse();
    const row = await dbGet<{ n: number }>(
      "SELECT COUNT(*) AS n FROM menu_orders WHERE kind = 'async' AND status != 'refunded' AND created_day = ?",
      dayLA(new Date()),
    );
    return {
      orders: orders.map(view),
      asyncToday: Number(row?.n ?? 0),
      asyncCap: MENU_DAILY_ASYNC_CAP,
    };
  });

  app.post('/api/admin/menu-orders/:id/draft', async (req, reply) => {
    if (!await adminGate(req, reply)) return;
    const id = parseId((req.params as { id?: unknown }).id);
    if (!id) return reply.status(400).send({ error: 'Invalid id' });
    const order = await getOrder(id);
    if (!order) return reply.status(404).send({ error: 'Order not found' });
    if (order.status !== 'queued' && order.status !== 'drafted') {
      return reply.status(409).send({ error: `Order is ${order.status}` });
    }
    try {
      const draft = await draftMenuOrder(id);
      return { draft };
    } catch (err: any) {
      console.error('[admin-menu-orders] draft failed:', err?.message);
      return reply.status(502).send({ error: 'Draft generation failed' });
    }
  });

  app.post('/api/admin/menu-orders/:id/approve', async (req, reply) => {
    if (!await adminGate(req, reply)) return;
    const id = parseId((req.params as { id?: unknown }).id);
    if (!id) return reply.status(400).send({ error: 'Invalid id' });
    const body = (req.body as { body?: unknown } | null)?.body;
    if (typeof body !== 'string' || body.trim().length < 1 || body.length > MAX_BODY) {
      return reply.status(400).send({ error: `body must be 1..${MAX_BODY} characters` });
    }
    const order = await getOrder(id);
    if (!order) return reply.status(404).send({ error: 'Order not found' });
    if (order.status !== 'drafted') return reply.status(409).send({ error: `Order is ${order.status}` });

    const name = menuItemById(order.item_id)?.name ?? order.item_id;
    const result = await sendMail({
      to: order.email,
      subject: `Your ${name} from Bilko`,
      text: body,
      html: escapeHtml(body).replace(/\r?\n/g, '<br>'),
    });
    if (!result.sent) {
      return reply.status(502).send({ error: 'Email was not sent', reason: result.reason });
    }
    const delivered = await markDelivered(id, body);
    if (!delivered) return reply.status(409).send({ error: 'Order changed state; email was sent' });
    return { order: view(delivered) };
  });

  app.post('/api/admin/menu-orders/:id/refund', async (req, reply) => {
    if (!await adminGate(req, reply)) return;
    const id = parseId((req.params as { id?: unknown }).id);
    if (!id) return reply.status(400).send({ error: 'Invalid id' });
    const order = await getOrder(id);
    if (!order) return reply.status(404).send({ error: 'Order not found' });
    const refunded = await refundOrder(id);
    if (!refunded) return reply.status(409).send({ error: `Order is ${order.status}` });
    return { order: view(refunded) };
  });
}
