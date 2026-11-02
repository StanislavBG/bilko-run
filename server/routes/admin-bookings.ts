import type { FastifyInstance } from 'fastify';
import { dbGet } from '../db.js';
import { requireAdmin, ADMIN_EMAILS } from '../clerk.js';
import { FREE_HOUR_SLUG, listBookings } from '../services/service-bookings.js';
import { mailerConfigured } from '../services/mailer.js';

const DAY_MS = 86400000;
const PAID_HOUR_SLUG = 'bilko-hour';
const PAGE_SLUG = 'human-for-hire';
// One paid hour costs $100.00 = 10000 cents.
const PAID_HOUR_CENTS = 10000;

function ownerEmails(): string[] {
  return [...ADMIN_EMAILS, 'bilko@bilko.run', process.env.BILKO_INBOX]
    .filter((e): e is string => !!e)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function registerAdminBookingRoutes(app: FastifyInstance): void {
  app.get('/api/admin/bookings', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    reply.header('Cache-Control', 'no-store');
    const rawDays = parseInt(String((req.query as { days?: unknown })?.days ?? ''), 10);
    const days = Number.isFinite(rawDays) ? Math.min(365, Math.max(1, rawDays)) : 7;
    const sinceMs = Date.now() - days * DAY_MS;

    const owners = ownerEmails();
    const marks = owners.map(() => '?').join(', ');
    const notOwner = owners.length ? ` AND LOWER(email) NOT IN (${marks})` : '';

    const free = await dbGet<{ n: number }>(
      `SELECT COUNT(*) AS n FROM service_bookings WHERE slug = ? AND created_at >= ?${notOwner}`,
      FREE_HOUR_SLUG, sinceMs, ...owners,
    );
    const paid = await dbGet<{ cents: number }>(
      `SELECT COALESCE(SUM(amount_total), 0) AS cents FROM web_product_orders
        WHERE slug = ? AND created_at >= ?
          AND checkout_session_id NOT LIKE 'cs\\_test\\_%' ESCAPE '\\'${notOwner}
          AND NOT EXISTS (
            SELECT 1 FROM funnel_events
             WHERE event = 'checkout_start' AND is_admin = 1 AND json_valid(metadata)
               AND json_extract(metadata, '$.checkout_session_id') = web_product_orders.checkout_session_id)`,
      PAID_HOUR_SLUG, sinceMs, ...owners,
    );

    const bookings = await listBookings({ pageSlug: PAGE_SLUG, fromMs: Date.now() });
    return {
      days,
      free_hours_booked: Number(free?.n ?? 0),
      paid_hours: Number(paid?.cents ?? 0) / PAID_HOUR_CENTS,
      mailer_configured: mailerConfigured(),
      upcoming: bookings.map((b) => ({
        slug: b.slug,
        startMs: b.slotStartMs,
        endMs: b.slotEndMs,
        email: b.email,
        topic: (b.intake as { topic?: string } | null)?.topic ?? '',
        createdAt: b.createdAt,
      })),
    };
  });
}
