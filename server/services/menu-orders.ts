// Bilko menu orders: wallet-paid, the kit download is granted at once.
import { randomUUID } from 'node:crypto';
import { dbAll, dbGet, dbRun } from '../db.js';
import { menuItemById, menuPayload, parseMenuIntake, type MenuItem } from '../../shared/bilko-menu.js';
import { webProductBySlug } from '../../shared/web-products.js';
import { isDeliverable } from './offer-availability.js';
import { debitWallet, refundWallet } from './wallet.js';
import { recordOrder } from './web-products.js';

export type MenuOrderStatus = 'delivered' | 'refunded';
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
  | { status: 'unknown_item' | 'invalid_intake' | 'insufficient_credits' | 'unavailable'; balanceCents?: number };

/** A download item is on sale only when the zip it promises is stored. Other kinds are always on sale. */
async function isMenuItemOnSale(item: MenuItem): Promise<boolean> {
  if (item.kind !== 'download') return true;
  const product = webProductBySlug(item.downloadSlug ?? item.id);
  return !!product && isDeliverable(product);
}

/** menuPayload() without download items whose release zip is not stored yet. */
export async function availableMenuPayload() {
  const payload = menuPayload();
  const ok = await Promise.all(payload.items.map((i) => {
    const item = menuItemById(i.id);
    return item ? isMenuItemOnSale(item) : false;
  }));
  return { ...payload, items: payload.items.filter((_, idx) => ok[idx]) };
}

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
  const intake = parseMenuIntake(item, input.intake);
  if (!intake) return { status: 'invalid_intake' };

  if (!(await isMenuItemOnSale(item))) return { status: 'unavailable' };

  const email = normEmail(input.email);
  const ref = randomUUID();
  const day = dayLA(new Date());

  const debit = await debitWallet(email, item.priceCents, `menu:${item.id}`, `menu:${ref}`);
  if (!debit.ok) return { status: 'insufficient_credits', balanceCents: debit.balanceCents };

  const refundDebit = () =>
    refundWallet(email, item.priceCents, `menu-refund:${item.id}`, `refund:${ref}`);

  let order: MenuOrder;
  try {
    order = await insertOrder({
      ref, itemId: item.id, email, priceCents: item.priceCents, kind: item.kind, intake,
      status: 'delivered', via: input.via, day,
    });
  } catch (err) {
    await refundDebit();
    throw err;
  }

  if (item.kind === 'download') {
    // Order row first; the entitlement is only granted once the order exists.
    try {
      await recordOrder({
        checkoutSessionId: `wallet_${ref}`,
        slug: item.downloadSlug ?? item.id,
        email,
        amountTotal: item.priceCents,
        currency: 'usd',
        paymentStatus: 'paid',
      });
    } catch (err) {
      await refundDebit();
      await transition(order.id, ['delivered'], 'refunded');
      throw err;
    }
  }
  return { status: 'ok', order, balanceCents: debit.balanceCents };
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
