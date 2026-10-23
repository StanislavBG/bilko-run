// Bilko services menu orders: wallet-paid, queued for an agent draft (async) or granted at once (download).
import { randomUUID } from 'node:crypto';
import { dbAll, dbGet, dbRun } from '../db.js';
import { MENU_DAILY_ASYNC_CAP, menuItemById, parseMenuIntake } from '../../shared/bilko-menu.js';
import { debitWallet, refundWallet } from './wallet.js';
import { recordOrder } from './web-products.js';

export type MenuOrderStatus = 'queued' | 'drafted' | 'delivered' | 'refunded';
export type MenuOrderVia = 'web' | 'api' | 'mcp';

export interface MenuOrder {
  id: number;
  ref: string;
  item_id: string;
  email: string;
  price_cents: number;
  kind: string;
  intake_json: string;
  status: MenuOrderStatus;
  via: string;
  draft: string | null;
  delivered_body: string | null;
  created_day: string;
  created_at: number;
  updated_at: number;
}

export type PlaceMenuOrderResult =
  | { status: 'ok'; order: MenuOrder; balanceCents: number }
  | { status: 'unknown_item' | 'invalid_intake' | 'daily_cap' | 'insufficient_credits' | 'live_needs_slot'; balanceCents?: number };

const nowSec = () => Math.floor(Date.now() / 1000);
const dayLA = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d);
const normEmail = (e: string) => String(e).trim().toLowerCase();

export async function getOrder(id: number): Promise<MenuOrder | null> {
  return (await dbGet<MenuOrder>('SELECT * FROM menu_orders WHERE id = ?', id)) ?? null;
}

export function listOrdersForEmail(email: string): Promise<MenuOrder[]> {
  return dbAll<MenuOrder>('SELECT * FROM menu_orders WHERE email = ? ORDER BY id DESC', normEmail(email));
}

export function listOrders(opts: { status?: MenuOrderStatus } = {}): Promise<MenuOrder[]> {
  return opts.status
    ? dbAll<MenuOrder>('SELECT * FROM menu_orders WHERE status = ? ORDER BY id ASC', opts.status)
    : dbAll<MenuOrder>('SELECT * FROM menu_orders ORDER BY id ASC');
}

async function insertOrder(o: {
  ref: string; itemId: string; email: string; priceCents: number; kind: string;
  intake: Record<string, string>; status: MenuOrderStatus; via: MenuOrderVia; day: string;
}): Promise<MenuOrder> {
  const t = nowSec();
  await dbRun(
    `INSERT INTO menu_orders
       (ref, item_id, email, price_cents, kind, intake_json, status, via, created_day, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    o.ref, o.itemId, o.email, o.priceCents, o.kind, JSON.stringify(o.intake), o.status, o.via, o.day, t, t,
  );
  const row = await dbGet<MenuOrder>('SELECT * FROM menu_orders WHERE ref = ?', o.ref);
  if (!row) throw new Error('menu order insert not found');
  return row;
}

export async function placeMenuOrder(input: {
  email: string; itemId: string; intake: unknown; via: MenuOrderVia;
}): Promise<PlaceMenuOrderResult> {
  const item = menuItemById(input.itemId);
  if (!item) return { status: 'unknown_item' };
  if (item.kind === 'live') return { status: 'live_needs_slot' };
  const intake = parseMenuIntake(item, input.intake);
  if (!intake) return { status: 'invalid_intake' };

  const email = normEmail(input.email);
  const ref = randomUUID();
  const day = dayLA(new Date());

  if (item.kind === 'async') {
    // Soft cap (owner-time protection): two orders racing at cap-1 may both pass. No locking on purpose.
    const row = await dbGet<{ n: number }>(
      "SELECT COUNT(*) AS n FROM menu_orders WHERE kind = 'async' AND status != 'refunded' AND created_day = ?", day);
    if (Number(row?.n ?? 0) >= MENU_DAILY_ASYNC_CAP) return { status: 'daily_cap' };
  }

  const debit = await debitWallet(email, item.priceCents, `menu:${item.id}`, `menu:${ref}`);
  if (!debit.ok) return { status: 'insufficient_credits', balanceCents: debit.balanceCents };

  try {
    if (item.kind === 'download') {
      await recordOrder({
        checkoutSessionId: `wallet_${ref}`,
        slug: item.downloadSlug ?? item.id,
        email,
        amountTotal: item.priceCents,
        currency: 'usd',
        paymentStatus: 'paid',
      });
    }
    const order = await insertOrder({
      ref, itemId: item.id, email, priceCents: item.priceCents, kind: item.kind, intake,
      status: item.kind === 'download' ? 'delivered' : 'queued', via: input.via, day,
    });
    return { status: 'ok', order, balanceCents: debit.balanceCents };
  } catch (err) {
    await refundWallet(email, item.priceCents, `menu-refund:${item.id}`, `refund:${ref}`);
    throw err;
  }
}

async function transition(
  id: number, from: MenuOrderStatus[], to: MenuOrderStatus, set: Record<string, string> = {},
): Promise<MenuOrder | null> {
  const cols = Object.keys(set).map(c => `${c} = ?`).join(', ');
  const res = await dbRun(
    `UPDATE menu_orders SET status = ?, ${cols ? cols + ', ' : ''}updated_at = ?
     WHERE id = ? AND status IN (${from.map(() => '?').join(',')})`,
    to, ...Object.values(set), nowSec(), id, ...from,
  );
  if (!res || res.changes === 0) return null;
  return getOrder(id);
}

/** queued|drafted -> drafted. Null when the order is missing or in another state. */
export function setDraft(id: number, draft: string) {
  return transition(id, ['queued', 'drafted'], 'drafted', { draft });
}

/** drafted -> delivered. */
export function markDelivered(id: number, body: string) {
  return transition(id, ['drafted'], 'delivered', { delivered_body: body });
}

/** queued|drafted -> refunded; refunds the wallet exactly once (ref 'refund:<ref>'). */
export async function refundOrder(id: number): Promise<MenuOrder | null> {
  const order = await getOrder(id);
  if (!order || (order.status !== 'queued' && order.status !== 'drafted')) return null;
  const updated = await transition(id, ['queued', 'drafted'], 'refunded');
  if (!updated) return null;
  await refundWallet(order.email, order.price_cents, `menu-refund:${order.item_id}`, `refund:${order.ref}`);
  return updated;
}
