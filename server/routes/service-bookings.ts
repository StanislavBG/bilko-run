import type { FastifyInstance } from 'fastify';
import { resolvePaidOrder } from './web-products.js';
import { bookingsForSession, claimSlot, claimedStarts } from '../services/service-bookings.js';
import { bookingConfirmationEmail, bookingNoticeEmail, sendMail } from '../services/mailer.js';
import { SERVICE_SLOT_CONFIG, buildIcs, generateSlots } from '../../shared/service-slots.js';
import {
  WEB_PRODUCTS, isValidCheckoutSessionId, isValidWebProductSlug, productKind, productPageSlug, webProductBySlug,
  type WebProduct,
} from '../../shared/web-products.js';

const RATE_WINDOW_MS = 60_000;
const BOOKING_LIMIT = 10;
const EMAIL_RE = /^[^\s@<>,;:"]+@[^\s@<>,;:"]+\.[^\s@<>,;:"]+$/;

const rateCounts = new Map<string, { count: number; windowStart: number }>();

function rateOk(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateCounts.get(key);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateCounts.set(key, { count: 1, windowStart: now });
    if (rateCounts.size > 5000) {
      for (const [k, v] of rateCounts) {
        if (now - v.windowStart > RATE_WINDOW_MS) rateCounts.delete(k);
      }
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

interface Intake { repo: string; broken: string; done: string; contact: string }

function parseIntake(raw: unknown): Intake | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const { repo, broken, done, contact } = r;
  if (typeof repo !== 'string' || typeof broken !== 'string' || typeof done !== 'string' || typeof contact !== 'string') {
    return null;
  }
  if (repo.length > 300 || broken.length > 2000 || done.length > 2000) return null;
  const c = contact.trim();
  if (c.length > 254 || !EMAIL_RE.test(c)) return null;
  return { repo, broken, done, contact: c };
}

function organizerEmail(): string {
  const from = process.env.MAIL_FROM ?? '';
  const m = /<([^>]+)>/.exec(from);
  const addr = (m ? m[1] : from).trim();
  if (EMAIL_RE.test(addr)) return addr;
  return process.env.BILKO_INBOX || 'noreply@bilko.run';
}

export function registerServiceBookingRoutes(
  app: FastifyInstance,
  opts: { products?: readonly WebProduct[] } = {},
): void {
  const products = opts.products ?? WEB_PRODUCTS;
  const lookupService = (slug: unknown): WebProduct | undefined => {
    if (!isValidWebProductSlug(slug)) return undefined;
    const p = webProductBySlug(slug, products);
    return p && productKind(p) === 'service' ? p : undefined;
  };

  async function openSlots(pageSlug: string) {
    const config = SERVICE_SLOT_CONFIG[pageSlug];
    if (!config) return null;
    const now = Date.now();
    const claimed = new Set(await claimedStarts(pageSlug, now));
    return { config, slots: generateSlots(config, now).filter((s) => !claimed.has(s.startMs)) };
  }

  app.get('/api/services/:pageSlug/slots', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const pageSlug = (req.params as { pageSlug?: string }).pageSlug ?? '';
    const open = Object.prototype.hasOwnProperty.call(SERVICE_SLOT_CONFIG, pageSlug) ? await openSlots(pageSlug) : null;
    if (!open) {
      reply.status(404);
      return { error: 'Not found' };
    }
    return {
      timeZone: open.config.timeZone,
      durationMinutes: open.config.durationMinutes,
      slots: open.slots.map((s) => ({ startMs: s.startMs, endMs: s.endMs })),
    };
  });

  async function paidOrder(product: WebProduct, sessionId: string, reply: any) {
    try {
      const result = await resolvePaidOrder(product, sessionId);
      if (result.status === 'not_found') {
        reply.status(404).send({ error: 'Order not found' });
        return null;
      }
      if (result.status === 'unpaid') {
        reply.status(402).send({ paid: false });
        return null;
      }
      return result.order;
    } catch (err: any) {
      console.error('[service-bookings] verify failed:', err?.message);
      reply.status(502).send({ error: 'Could not verify the order. Try again shortly.' });
      return null;
    }
  }

  app.post('/api/web-products/:slug/booking', async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    const product = lookupService((req.params as { slug?: string }).slug);
    if (!product) return reply.status(404).send({ error: 'Not found' });
    const sessionId = (req.query as { session_id?: unknown }).session_id;
    if (!isValidCheckoutSessionId(sessionId)) return reply.status(400).send({ error: 'Invalid session id' });
    if (!rateOk(`svc-booking:${req.ip}`, BOOKING_LIMIT)) {
      return reply.status(429).send({ error: 'Too many requests. Try again in a minute.' });
    }
    const body = (req.body ?? {}) as { startMs?: unknown; intake?: unknown };
    const intake = parseIntake(body.intake);
    if (!Number.isSafeInteger(body.startMs) || !intake) return reply.status(400).send({ error: 'Invalid request' });
    const startMs = body.startMs as number;

    const order = await paidOrder(product, sessionId, reply);
    if (!order) return reply;

    const pageSlug = productPageSlug(product);
    const open = await openSlots(pageSlug);
    const slot = open?.slots.find((s) => s.startMs === startMs);
    if (!slot) return reply.status(409).send({ error: 'slot_unavailable' });

    const claim = await claimSlot({
      pageSlug, slug: product.slug, checkoutSessionId: sessionId, startMs: slot.startMs, endMs: slot.endMs,
      email: order.email, intake, sessionsPerMonth: product.sessionsPerMonth ?? 1,
    });
    if (claim.status === 'taken') return reply.status(409).send({ error: 'slot_unavailable' });
    if (claim.status === 'limit') return reply.status(409).send({ error: 'limit' });

    const meetingLink = process.env.HFH_MEETING_LINK ?? '';
    const ics = buildIcs({
      uid: `booking-${claim.booking.id}@bilko.run`,
      startMs: slot.startMs,
      endMs: slot.endMs,
      summary: `${product.name} with Bilko`,
      description: meetingLink.trim() ? `Meeting link: ${meetingLink.trim()}` : 'Bilko will email the meeting link before the session.',
      organizerName: 'Bilko',
      organizerEmail: organizerEmail(),
      attendeeEmail: order.email || intake.contact,
      location: meetingLink.trim() || 'Online',
    });

    let emailed = false;
    try {
      const confirmation = bookingConfirmationEmail({
        offerName: product.name, startMs: slot.startMs, timeZone: open!.config.timeZone, meetingLink, icsContent: ics,
      });
      const recipients = [...new Set([order.email, intake.contact].filter(Boolean).map((e) => e.toLowerCase()))];
      const results = await Promise.all(recipients.map((to) => sendMail({ to, ...confirmation })));
      emailed = results.some((r) => r.sent);
      const inbox = process.env.BILKO_INBOX;
      if (inbox) {
        await sendMail({
          to: inbox,
          ...bookingNoticeEmail({ offerName: product.name, startMs: slot.startMs, buyerEmail: order.email, intake }),
        });
      }
    } catch (err: any) {
      console.error('[service-bookings] mail failed:', err?.message);
    }

    return {
      booking: { startMs: slot.startMs, endMs: slot.endMs },
      icsUrl: `/api/web-products/${product.slug}/booking.ics?session_id=${sessionId}`,
      emailed,
    };
  });

  app.get('/api/web-products/:slug/booking.ics', async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    const product = lookupService((req.params as { slug?: string }).slug);
    if (!product) return reply.status(404).send({ error: 'Not found' });
    const sessionId = (req.query as { session_id?: unknown }).session_id;
    if (!isValidCheckoutSessionId(sessionId)) return reply.status(400).send({ error: 'Invalid session id' });
    if (!rateOk(`svc-ics:${req.ip}`, BOOKING_LIMIT * 3)) {
      return reply.status(429).send({ error: 'Too many requests. Try again in a minute.' });
    }
    const order = await paidOrder(product, sessionId, reply);
    if (!order) return reply;

    const mine = (await bookingsForSession(sessionId)).filter((b) => b.slug === product.slug);
    const latest = mine.sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)[0];
    if (!latest) return reply.status(404).send({ error: 'No booking' });

    const meetingLink = (process.env.HFH_MEETING_LINK ?? '').trim();
    const ics = buildIcs({
      uid: `booking-${latest.id}@bilko.run`,
      startMs: latest.slotStartMs,
      endMs: latest.slotEndMs,
      summary: `${product.name} with Bilko`,
      description: meetingLink ? `Meeting link: ${meetingLink}` : 'Bilko will email the meeting link before the session.',
      organizerName: 'Bilko',
      organizerEmail: organizerEmail(),
      attendeeEmail: latest.email,
      location: meetingLink || 'Online',
    });
    reply.header('Content-Type', 'text/calendar; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="bilko-session.ics"');
    return reply.send(ics);
  });
}
