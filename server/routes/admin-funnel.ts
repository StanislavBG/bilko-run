import type { FastifyInstance } from 'fastify';
import { dbGet } from '../db.js';
import { requireAdmin, ADMIN_EMAILS } from '../clerk.js';
import { FREE_HOUR_SLUG } from '../services/service-bookings.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_DAYS = 7;

export interface FunnelCounts {
  since: string;
  utm_source: string;
  visits: number;
  sign_ins: number;
  checkout_start: number;
  paid: number;
  booked: number;
  free_hours_booked: number;
}

/**
 * Per-UTM revenue funnel: a visitor is attributed when one of their sessions
 * since `since` landed with this utm_source, or later viewed a page tagged with
 * it. Sessions keep their landing source, so an in-site link (the Session
 * Manager pages' free-hour links) is attributed only through its page view. Units:
 *   visits             attributed sessions
 *   sign_ins           attributed visitors with a signed-in session since `since`
 *   checkout_start     attributed visitors with a checkout_start event
 *   paid               attributed visitors with a purchase (sessions.purchased, or a
 *                      web-product order matched by checkout session id or email)
 *   booked             paid service bookings matched by checkout session id or email
 *   free_hours_booked  free-hour bookings matched by booking id (the server's
 *                      free_hour_booked event) or email; never part of booked
 * Admin traffic and bots are excluded unless exclude_self=0 / include_bots=1.
 */
export async function funnelCounts(opts: {
  since: string; utmSource: string; excludeSelf: boolean; includeBots: boolean;
}): Promise<FunnelCounts> {
  const sinceMs = new Date(opts.since + 'T00:00:00Z').getTime();
  const admins = opts.excludeSelf ? ADMIN_EMAILS.map(e => e.toLowerCase()) : [];
  const inAdmins = (col: string) => admins.length
    ? ` AND (${col} IS NULL OR LOWER(${col}) NOT IN (${admins.map(() => '?').join(', ')}))`
    : '';
  const badFlags = [opts.includeBots ? null : 'pv.is_bot = 1', opts.excludeSelf ? 'pv.is_admin = 1' : null].filter(Boolean);
  const pvFilter = badFlags.length
    ? ` AND NOT EXISTS (SELECT 1 FROM page_views pv WHERE pv.session_id = s.session_id AND (${badFlags.join(' OR ')}))`
    : '';
  const feAdmin = opts.excludeSelf ? ' AND COALESCE(fe.is_admin, 0) = 0' : '';

  // funnel_events.created_at is TEXT 'YYYY-MM-DD HH:MM:SS', so a bare date compares correctly.
  const row = await dbGet<Record<string, number>>(
    `WITH s AS (
       SELECT s.session_id, s.visitor_id FROM sessions s
       WHERE s.started_at >= ?
         AND (LOWER(s.utm_source) = LOWER(?) OR s.session_id IN (
           SELECT t.session_id FROM page_views t
           WHERE t.date >= ? AND t.session_id IS NOT NULL AND LOWER(t.utm_source) = LOWER(?)
         ))${inAdmins('s.email')}${pvFilter}
     ),
     v AS (SELECT DISTINCT visitor_id FROM s),
     ve AS (
       SELECT DISTINCT s2.visitor_id, LOWER(s2.email) AS email FROM sessions s2
       WHERE s2.visitor_id IN (SELECT visitor_id FROM v) AND s2.email IS NOT NULL AND s2.started_at >= ?${inAdmins('s2.email')}
     ),
     co AS (
       SELECT fe.visitor_id, json_extract(fe.metadata, '$.checkout_session_id') AS cs_id FROM funnel_events fe
       WHERE fe.event = 'checkout_start' AND fe.created_at >= ?
         AND fe.visitor_id IN (SELECT visitor_id FROM v)${feAdmin}
     ),
     o AS (
       SELECT checkout_session_id, LOWER(email) AS email FROM web_product_orders
       WHERE created_at >= ?${inAdmins('email')}
     ),
     fh AS (
       SELECT json_extract(fe.metadata, '$.booking_id') AS booking_id FROM funnel_events fe
       WHERE fe.event = 'free_hour_booked' AND fe.created_at >= ?
         AND fe.visitor_id IN (SELECT visitor_id FROM v)${feAdmin}
     ),
     paid AS (
       SELECT s3.visitor_id FROM sessions s3
       WHERE s3.purchased = 1 AND s3.started_at >= ? AND s3.visitor_id IN (SELECT visitor_id FROM v)
       UNION SELECT co.visitor_id FROM co JOIN o ON o.checkout_session_id = co.cs_id
       UNION SELECT ve.visitor_id FROM ve JOIN o ON o.email = ve.email
     )
     SELECT
       (SELECT COUNT(*) FROM s) AS visits,
       (SELECT COUNT(DISTINCT visitor_id) FROM ve) AS sign_ins,
       (SELECT COUNT(DISTINCT visitor_id) FROM co) AS checkout_start,
       (SELECT COUNT(*) FROM paid) AS paid,
       (SELECT COUNT(*) FROM service_bookings b
         WHERE b.created_at >= ?${inAdmins('b.email')}
           AND b.slug <> ?
           AND (b.checkout_session_id IN (SELECT cs_id FROM co WHERE cs_id IS NOT NULL)
                OR LOWER(b.email) IN (SELECT email FROM ve))) AS booked,
       (SELECT COUNT(*) FROM service_bookings b
         WHERE b.created_at >= ?${inAdmins('b.email')}
           AND b.slug = ?
           AND (b.id IN (SELECT booking_id FROM fh WHERE booking_id IS NOT NULL)
                OR LOWER(b.email) IN (SELECT email FROM ve))) AS free_hours_booked`,
    sinceMs, opts.utmSource, opts.since, opts.utmSource, ...admins,
    sinceMs, ...admins,
    opts.since,
    sinceMs, ...admins,
    opts.since,
    sinceMs,
    sinceMs, ...admins, FREE_HOUR_SLUG,
    sinceMs, ...admins, FREE_HOUR_SLUG,
  );

  const n = (k: string) => Number(row?.[k] ?? 0);
  return {
    since: opts.since,
    utm_source: opts.utmSource,
    visits: n('visits'),
    sign_ins: n('sign_ins'),
    checkout_start: n('checkout_start'),
    paid: n('paid'),
    booked: n('booked'),
    free_hours_booked: n('free_hours_booked'),
  };
}

export function registerAdminFunnelRoutes(app: FastifyInstance): void {
  // GET /api/admin/funnel?since=YYYY-MM-DD&utm_source=<src> — read-only, so bka_ keys work.
  app.get('/api/admin/funnel', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const q = (req.query ?? {}) as Record<string, unknown>;
    const utmSource = typeof q.utm_source === 'string' ? q.utm_source.trim().slice(0, 100) : '';
    if (!utmSource) {
      reply.status(400);
      return { error: 'utm_source is required' };
    }
    let since: string;
    if (q.since === undefined) {
      since = new Date(Date.now() - DEFAULT_DAYS * 86400000).toISOString().slice(0, 10);
    } else if (typeof q.since === 'string' && DATE_RE.test(q.since) && !Number.isNaN(Date.parse(q.since))) {
      since = q.since;
    } else {
      reply.status(400);
      return { error: 'since must be YYYY-MM-DD' };
    }
    reply.header('Cache-Control', 'no-store');
    return funnelCounts({
      since,
      utmSource,
      excludeSelf: q.exclude_self !== '0',
      includeBots: q.include_bots === '1',
    });
  });
}
