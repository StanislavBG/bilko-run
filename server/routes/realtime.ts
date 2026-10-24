// Realtime input relay — REST half. A signed-in client trades its Clerk Bearer
// token for a single-use WebSocket ticket bound to (email, roomId); the socket
// half lives in server/realtime/relay.ts and is mounted on the http `upgrade`
// event in server/index.ts. The lobby directory (server/realtime/lobbies.ts)
// lists open rooms so players join from a list, not a room code.
// Contract: docs/host-contract.md → "Realtime relay".
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../clerk.js';
import {
  REALTIME_PATH_PREFIX, ROOM_ID_RE, MAX_SEATS, MAX_FRAME_BYTES, RATE_PER_SEC, SEAT_HOLD_MS,
  issueTicket, canJoin, closeAllRooms,
} from '../realtime/relay.js';
import { LOBBY_APP_RE, parseLobbyBody, upsertLobby, removeLobby, listLobbies } from '../realtime/lobbies.js';

const RATE_WINDOW_MS = 60_000;
const ROOM_ID_ERROR = 'roomId must be 1-64 chars of [A-Za-z0-9_-]';

/** Fixed one-minute window per user; the map is swept once it tracks more than 5000 users. */
function perUserRate(max: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    take(email: string, now = Date.now()): boolean {
      const entry = hits.get(email);
      if (!entry || now >= entry.resetAt) {
        if (hits.size > 5000) {
          for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
        }
        hits.set(email, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
      }
      if (entry.count >= max) return false;
      entry.count++;
      return true;
    },
    clear(): void { hits.clear(); },
  };
}

const ticketRate = perUserRate(30);
/** Academy hosts PUT every 10 s plus on seat changes ≥ 3 s apart: 6-20 a minute. */
const lobbyPutRate = perUserRate(30);

export function resetRealtimeRateLimits(): void {
  ticketRate.clear();
  lobbyPutRate.clear();
}

export function registerRealtimeRoutes(app: FastifyInstance): void {
  app.post('/api/realtime/ticket', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;

    const roomId = (req.body as { roomId?: unknown } | null)?.roomId;
    if (typeof roomId !== 'string' || !ROOM_ID_RE.test(roomId)) {
      return reply.code(400).send({ error: ROOM_ID_ERROR });
    }
    if (!ticketRate.take(email)) return reply.code(429).send({ error: 'rate_limited' });

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

  // ── Lobby directory ──────────────────────────────────────────────────────

  app.get<{ Querystring: { app?: unknown } }>('/api/realtime/lobbies', async (req, reply) => {
    reply.header('cache-control', 'no-store');
    const appId = req.query.app;
    if (typeof appId !== 'string' || !LOBBY_APP_RE.test(appId)) {
      return reply.code(400).send({ error: 'app must be 1-32 chars of [a-z0-9-]' });
    }
    return { lobbies: listLobbies(appId) };
  });

  app.put<{ Params: { roomId: string } }>('/api/realtime/lobbies/:roomId', { bodyLimit: 1024 }, async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    if (!lobbyPutRate.take(email)) return reply.code(429).send({ error: 'rate_limited' });

    const { roomId } = req.params;
    if (!ROOM_ID_RE.test(roomId)) return reply.code(400).send({ error: ROOM_ID_ERROR });
    const parsed = parseLobbyBody(req.body);
    if ('error' in parsed) return reply.code(400).send({ error: parsed.error });

    const result = upsertLobby(roomId, email, parsed.lobby);
    if (!result.ok) {
      return result.error === 'not_owner'
        ? reply.code(403).send({ error: 'not_owner' })
        : reply.code(503).send({ error: 'directory_full' });
    }
    reply.header('cache-control', 'no-store');
    return { ok: true, expiresAt: result.expiresAt, listed: result.listed };
  });

  app.delete<{ Params: { roomId: string } }>('/api/realtime/lobbies/:roomId', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;

    const { roomId } = req.params;
    if (!ROOM_ID_RE.test(roomId)) return reply.code(400).send({ error: ROOM_ID_ERROR });
    if (removeLobby(roomId, email) === 'not_owner') return reply.code(403).send({ error: 'not_owner' });
    return reply.code(204).send();
  });

  // Deploy drain: Render SIGTERMs the old instance → app.close() → every socket
  // gets 1012 (Service Restart) so clients reconnect to the new instance.
  app.addHook('onClose', async () => { closeAllRooms(); });
}
