import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { cancelFreeHour, claimFreeHour, claimedStarts, hasFreeHour } from '../services/service-bookings.js';
import {
  EMAIL_RE, bookingConfirmationEmail, bookingNoticeEmail, mailerConfigured, organizerEmail, sendMail,
} from '../services/mailer.js';
import { SERVICE_SLOT_CONFIG, buildIcs, generateSlots } from '../../shared/service-slots.js';

const PAGE = 'human-for-hire';
const rateCounts = new Map<string, { count: number; windowStart: number }>();

function rateOk(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateCounts.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    rateCounts.set(key, { count: 1, windowStart: now });
    if (rateCounts.size > 5000) {
      for (const [k, v] of rateCounts) if (now - v.windowStart > 3_600_000) rateCounts.delete(k);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function registerFreeHourRoutes(app: FastifyInstance): void {
  app.post(`/api/services/${PAGE}/free-hour`, { bodyLimit: 8192 }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    if (!rateOk(`free-hour:${req.ip}`, 6, 3_600_000)) return reply.status(429).send({ error: 'rate_limited' });

    const b = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const email = typeof b.email === 'string' ? b.email.trim() : '';
    const topic = b.topic === undefined || b.topic === null ? '' : b.topic;
    const startMs = b.startMs;
    if (
      !email || email.length > 254 || !EMAIL_RE.test(email) ||
      typeof topic !== 'string' || topic.trim().length > 2000 ||
      (b.website !== undefined && b.website !== '') ||
      typeof startMs !== 'number' || !Number.isSafeInteger(startMs)
    ) {
      return reply.status(400).send({ error: 'invalid' });
    }
    const topicText = topic.trim();
    if (!mailerConfigured()) return reply.status(503).send({ error: 'booking_unavailable' });

    const config = SERVICE_SLOT_CONFIG[PAGE];
    const now = Date.now();
    const claimed = new Set(await claimedStarts(PAGE, now));
    const slot = generateSlots(config, now).find((s) => s.startMs === startMs && !claimed.has(s.startMs));
    if (!slot) return reply.status(409).send({ error: 'slot_unavailable' });

    if ((req.query as { dryRun?: unknown }).dryRun === '1') {
      if (await hasFreeHour(email)) return reply.status(409).send({ error: 'already_booked' });
      return reply.status(200).send({ dryRun: true });
    }

    const token = 'free_' + randomUUID();
    const claim = await claimFreeHour({
      pageSlug: PAGE, token, startMs, endMs: slot.endMs, email, intake: { topic: topicText },
    });
    if (claim.status === 'taken') return reply.status(409).send({ error: 'slot_unavailable' });
    if (claim.status === 'already_booked') return reply.status(409).send({ error: 'already_booked' });

    const meetingLink = (process.env.HFH_MEETING_LINK ?? '').trim();
    const ics = buildIcs({
      uid: `booking-${claim.booking.id}@bilko.run`,
      startMs,
      endMs: slot.endMs,
      summary: 'Free hour with Bilko',
      description: meetingLink ? `Meeting link: ${meetingLink}` : 'Bilko will email the meeting link before the session.',
      organizerName: 'Bilko',
      organizerEmail: organizerEmail(),
      attendeeEmail: email,
      location: meetingLink || 'Online',
    });

    let emailed = false;
    try {
      const result = await sendMail({
        to: email,
        ...bookingConfirmationEmail({
          offerName: 'Free hour with Bilko', startMs, timeZone: config.timeZone, meetingLink, icsContent: ics,
        }),
      });
      emailed = result.sent;
      await sendMail({
        to: process.env.BILKO_INBOX!,
        ...bookingNoticeEmail({
          offerName: 'Free hour', startMs, buyerEmail: email,
          intake: { repo: '-', broken: topicText, done: '-', contact: email },
        }),
      });
    } catch (err: any) {
      console.error('[free-hour] mail failed:', err?.message);
    }

    return reply.status(201).send({ booking: { startMs, endMs: slot.endMs }, emailed, ics, cancelToken: token });
  });

  app.post(`/api/services/${PAGE}/free-hour/cancel`, { bodyLimit: 1024 }, async (req, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    if (!rateOk(`free-hour-cancel:${req.ip}`, 10, 60_000)) return reply.status(429).send({ error: 'rate_limited' });
    const token = (req.body as { token?: unknown } | null)?.token;
    if (typeof token !== 'string' || !/^free_[0-9a-f-]{36}$/.test(token)) {
      return reply.status(400).send({ error: 'invalid' });
    }
    const booking = await cancelFreeHour(token);
    if (!booking) return reply.status(404).send({ error: 'not_found' });
    try {
      const inbox = process.env.BILKO_INBOX;
      if (inbox) {
        await sendMail({
          to: inbox,
          ...bookingNoticeEmail({
            offerName: 'Cancelled: free hour', startMs: booking.slotStartMs, buyerEmail: booking.email,
            intake: { repo: '-', broken: '-', done: '-', contact: booking.email },
          }),
        });
      }
    } catch (err: any) {
      console.error('[free-hour] cancel notice failed:', err?.message);
    }
    return reply.status(200).send({ cancelled: true });
  });
}
