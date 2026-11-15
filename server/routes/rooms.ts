// Game-room matchmaking — REST half of the authoritative rooms
// (server/rooms/runtime.ts runs a hand, server/rooms/socket.ts carries it).
// POST /api/rooms/ticket seats a signed-in player at a table of the requested
// stake tier and returns a single-use socket ticket; GET /api/rooms/tiers lists
// open seats per tier. Empty seats are filled with AI aiFillMs after the first
// human sits. At each hand start every human seat's maximum loss is escrowed.
// Settlement is not wired here: onHandOver only records the result.
// ROOM_MODULES is empty until the @threewinds/engine binding lands, so in
// production every app is unknown_app and nothing is live yet.
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../clerk.js';
import { GameRoom, type HandResult, type RoomGameModule, type RoomMessage } from '../rooms/runtime.js';
import {
  ROOM_SOCKET_PREFIX, issueRoomTicket, registerLiveRoom, unregisterLiveRoom, sendToSeat, createRoomHooks,
} from '../rooms/socket.js';
import { PLAY_APPS, findTier, type PlayTier } from '../../shared/play-currency-catalog.js';
import { getPlayBalance, escrowPlay } from '../services/play-currency.js';

/** Game modules by app id. Empty in production until the engine binding lands. */
export const ROOM_MODULES: Record<string, RoomGameModule<any>> = {};

export const MAX_ROOMS = 200;
export const DEFAULT_AI_FILL_MS = 8000;
export const DEFAULT_TURN_MS = 20_000;
export const DEFAULT_AI_DELAY_MS = 800;
const ID_RE = /^[a-z0-9-]{1,32}$/;
const RATE_WINDOW_MS = 60_000;

/** Fixed one-minute window per user (copied from routes/realtime.ts). */
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

interface TableRoom {
  id: string;
  app: string;
  tier: PlayTier;
  module: RoomGameModule<any>;
  room: GameRoom<unknown>;
  /** seat → email of the human sitting there */
  seats: Map<number, string>;
  state: 'waiting' | 'playing';
  createdAt: number;
  /** Hands started so far. */
  hand: number;
  fillTimer: ReturnType<typeof setTimeout> | null;
  /** Results recorded by onHandOver; the room-settlement PRD consumes them. */
  results: HandResult[];
}

const rooms = new Map<string, TableRoom>();

function randomBase36(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += crypto.randomInt(36).toString(36);
  return s;
}

function escrowRef(t: TableRoom, hand: number): string {
  return `room:${t.id}:hand:${hand}`;
}

function closeTable(t: TableRoom): void {
  if (t.fillTimer) { clearTimeout(t.fillTimer); t.fillTimer = null; }
  rooms.delete(t.id);
  unregisterLiveRoom(t.id);
}

/**
 * Starts the table's next hand: escrows each human's maximum loss (a human who
 * cannot cover it is replaced by AI and told so), fills empty seats with AI,
 * rotates the dealer and deals. A table left with no humans is closed.
 */
export async function startTableHand(roomId: string): Promise<void> {
  const t = rooms.get(roomId);
  if (!t) return;
  if (t.fillTimer) { clearTimeout(t.fillTimer); t.fillTimer = null; }
  t.state = 'playing';
  t.hand++;
  const hand = t.hand;
  t.room.fillWithAi();
  const amount = t.tier.stake * t.module.maxLossPoints;
  const ref = escrowRef(t, hand);
  for (const [seat, email] of [...t.seats]) {
    let ok = false;
    try {
      ok = (await escrowPlay(t.app, email, amount, ref)).ok;
    } catch {
      ok = false;
    }
    if (rooms.get(roomId) !== t) return; // closed meanwhile
    if (!ok) {
      t.seats.delete(seat);
      t.room.release(seat);
      sendToSeat(t.id, seat, { type: 'error', code: 'insufficient_taels', seq: 0 } as unknown as RoomMessage);
    }
  }
  if (t.seats.size === 0) { closeTable(t); return; }
  t.room.fillWithAi();
  t.room.startHand((hand - 1) % t.module.seats);
}

function kickoff(roomId: string): void {
  startTableHand(roomId).catch(() => {
    const t = rooms.get(roomId);
    if (t) closeTable(t);
  });
}

interface RoomRouteOptions {
  modules?: Record<string, RoomGameModule<any>>;
  aiFillMs?: number;
  turnMs?: number;
  aiDelayMs?: number;
}

function createTable(app: string, tier: PlayTier, module: RoomGameModule<any>, o: Required<Omit<RoomRouteOptions, 'modules'>>): TableRoom {
  let id = `${app}-${tier.id}-${randomBase36(8)}`;
  while (rooms.has(id)) id = `${app}-${tier.id}-${randomBase36(8)}`;
  const results: HandResult[] = [];
  const room = new GameRoom<unknown>(
    id, module, { turnMs: o.turnMs, aiDelayMs: o.aiDelayMs },
    createRoomHooks(id, (r) => { results.push(r); }),
  );
  const t: TableRoom = {
    id, app, tier, module, room, seats: new Map(), state: 'waiting', createdAt: Date.now(), hand: 0, fillTimer: null, results,
  };
  rooms.set(id, t);
  registerLiveRoom(id, {
    room,
    seatFor(email: string) {
      for (const [seat, e] of t.seats) if (e === email) return seat;
      return undefined;
    },
  });
  return t;
}

function seatInTable(t: TableRoom, email: string, aiFillMs: number): number | null {
  const seat = t.room.seatHuman(email);
  if (seat === 'full') return null;
  t.seats.set(seat, email);
  if (t.seats.size >= t.module.seats) {
    kickoff(t.id);
  } else if (!t.fillTimer) {
    t.fillTimer = setTimeout(() => { t.fillTimer = null; kickoff(t.id); }, aiFillMs);
    t.fillTimer.unref?.();
  }
  return seat;
}

function moduleFor(modules: Record<string, RoomGameModule<any>>, app: string): RoomGameModule<any> | undefined {
  if (!Object.prototype.hasOwnProperty.call(modules, app)) return undefined;
  if (!Object.prototype.hasOwnProperty.call(PLAY_APPS, app)) return undefined;
  return modules[app];
}

/** Test-only view of a table. Never sent to clients (it holds emails). */
export function roomSnapshot(roomId: string): { app: string; tier: string; state: 'waiting' | 'playing'; hand: number; humans: Record<number, string>; ai: number[]; results: HandResult[] } | undefined {
  const t = rooms.get(roomId);
  if (!t) return undefined;
  const ai: number[] = [];
  for (let s = 0; s < t.module.seats; s++) if (t.room.isAi(s)) ai.push(s);
  return { app: t.app, tier: t.tier.id, state: t.state, hand: t.hand, humans: Object.fromEntries(t.seats), ai, results: [...t.results] };
}

/** Test-only: drop every table, timer and rate window. */
export function resetRooms(): void {
  for (const t of [...rooms.values()]) closeTable(t);
  ticketRate.clear();
}

export function registerRoomRoutes(app: FastifyInstance, opts: RoomRouteOptions = {}): void {
  const modules = opts.modules ?? ROOM_MODULES;
  const timing = {
    aiFillMs: opts.aiFillMs ?? DEFAULT_AI_FILL_MS,
    turnMs: opts.turnMs ?? DEFAULT_TURN_MS,
    aiDelayMs: opts.aiDelayMs ?? DEFAULT_AI_DELAY_MS,
  };

  app.post('/api/rooms/ticket', { bodyLimit: 1024 }, async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    reply.header('cache-control', 'no-store');

    const body = req.body as { app?: unknown; tier?: unknown } | null;
    const appId = body?.app;
    const tierId = body?.tier;
    if (typeof appId !== 'string' || !ID_RE.test(appId) || typeof tierId !== 'string' || !ID_RE.test(tierId)) {
      return reply.code(400).send({ error: 'body must be { app, tier }, each 1-32 chars of [a-z0-9-]' });
    }
    if (!ticketRate.take(email)) return reply.code(429).send({ error: 'rate_limited' });

    const module = moduleFor(modules, appId);
    if (!module) return reply.code(404).send({ error: 'unknown_app' });
    const tier = findTier(appId, tierId);
    if (!tier) return reply.code(404).send({ error: 'unknown_tier' });

    const issue = (t: TableRoom, seat: number) => {
      const { ticket, expiresAt } = issueRoomTicket(email, t.id);
      return { ticket, expiresAt, path: `${ROOM_SOCKET_PREFIX}${t.id}?ticket=${ticket}`, roomId: t.id, tier: t.tier.id, seat };
    };

    // Rejoin: already seated at a live table of this app, whatever tier was asked for.
    for (const t of rooms.values()) {
      if (t.app !== appId) continue;
      for (const [seat, e] of t.seats) if (e === email) return issue(t, seat);
    }

    const required = tier.stake * module.maxLossPoints;
    const { balance } = await getPlayBalance(appId, email);
    if (balance < required) return reply.code(402).send({ error: 'insufficient_taels', balance, required });

    // The balance read awaited: re-check for a seat taken by a concurrent request.
    for (const t of rooms.values()) {
      if (t.app !== appId) continue;
      for (const [seat, e] of t.seats) if (e === email) return issue(t, seat);
    }

    let table: TableRoom | undefined;
    for (const t of rooms.values()) {
      if (t.app !== appId || t.tier.id !== tier.id || t.state !== 'waiting' || t.seats.size >= t.module.seats) continue;
      if (!table || t.createdAt >= table.createdAt) table = t;
    }
    if (!table) {
      if (rooms.size >= MAX_ROOMS) return reply.code(503).send({ error: 'server_full' });
      table = createTable(appId, tier, module, timing);
    }
    const seat = seatInTable(table, email, timing.aiFillMs);
    if (seat === null) return reply.code(503).send({ error: 'server_full' });
    return issue(table, seat);
  });

  app.get<{ Querystring: { app?: unknown } }>('/api/rooms/tiers', async (req, reply) => {
    reply.header('cache-control', 'no-store');
    const appId = req.query.app;
    if (typeof appId !== 'string' || !ID_RE.test(appId)) {
      return reply.code(400).send({ error: 'app must be 1-32 chars of [a-z0-9-]' });
    }
    const module = moduleFor(modules, appId);
    if (!module) return reply.code(404).send({ error: 'unknown_app' });
    const tiers = PLAY_APPS[appId].tiers.map((tier) => {
      let openSeats = 0;
      for (const t of rooms.values()) {
        if (t.app === appId && t.tier.id === tier.id && t.state === 'waiting') openSeats += t.module.seats - t.seats.size;
      }
      return { id: tier.id, stake: tier.stake, openSeats };
    });
    return { tiers };
  });
}
