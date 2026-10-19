// Realtime input relay — REST half. A signed-in client trades its Clerk Bearer
// token for a single-use WebSocket ticket bound to (email, roomId); the socket
// half lives in server/realtime/relay.ts and is mounted on the http `upgrade`
// event in server/index.ts. Contract: docs/host-contract.md → "Realtime relay".
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../clerk.js';
import {
  REALTIME_PATH_PREFIX, ROOM_ID_RE, MAX_SEATS, MAX_FRAME_BYTES, RATE_PER_SEC, SEAT_HOLD_MS,
  issueTicket, canJoin, closeAllRooms,
} from '../realtime/relay.js';

const TICKET_RATE_MAX = 30;
const TICKET_RATE_WINDOW_MS = 60_000;
const ticketRate = new Map<string, { count: number; resetAt: number }>();

function checkTicketRate(email: string, now = Date.now()): boolean {
  const entry = ticketRate.get(email);
  if (!entry || now >= entry.resetAt) {
    if (ticketRate.size > 5000) {
      for (const [k, v] of ticketRate) if (now >= v.resetAt) ticketRate.delete(k);
    }
    ticketRate.set(email, { count: 1, resetAt: now + TICKET_RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= TICKET_RATE_MAX) return false;
  entry.count++;
  return true;
}

export function resetRealtimeTicketRate(): void {
  ticketRate.clear();
}

export function registerRealtimeRoutes(app: FastifyInstance): void {
  app.post('/api/realtime/ticket', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;

    const roomId = (req.body as { roomId?: unknown } | null)?.roomId;
    if (typeof roomId !== 'string' || !ROOM_ID_RE.test(roomId)) {
      return reply.code(400).send({ error: 'roomId must be 1-64 chars of [A-Za-z0-9_-]' });
    }
    if (!checkTicketRate(email)) return reply.code(429).send({ error: 'rate_limited' });

    const join = canJoin(roomId, email);
    if (join === 'room_full') return reply.code(409).send({ error: 'room_full' });
    if (join === 'server_full') return reply.code(503).send({ error: 'server_full' });

    const { ticket, expiresAt } = issueTicket(email, roomId);
    reply.header('cache-control', 'no-store');
    return {
      ticket,
      expiresAt,
      path: `${REALTIME_PATH_PREFIX}${roomId}?ticket=${ticket}`,
      limits: { maxSeats: MAX_SEATS, maxFrameBytes: MAX_FRAME_BYTES, ratePerSec: RATE_PER_SEC, seatHoldMs: SEAT_HOLD_MS },
    };
  });

  // Deploy drain: Render SIGTERMs the old instance → app.close() → every socket
  // gets 1012 (Service Restart) so clients reconnect to the new instance.
  app.addHook('onClose', async () => { closeAllRooms(); });
}
