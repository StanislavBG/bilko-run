// Game-room matchmaking — REST half of the authoritative rooms
// (server/rooms/runtime.ts runs a hand, server/rooms/socket.ts carries it).
// POST /api/rooms/ticket seats a signed-in player at a table of the requested
// stake tier and returns a single-use socket ticket; GET /api/rooms/tiers lists
// open seats per tier. Empty seats are filled with AI aiFillMs after the first
// human sits. At each hand start every human seat's maximum loss is escrowed;
// at hand end settleHand pays the module's zero-sum points x stake through the
// play ledger (AI seats against the house), then deals again after NEXT_HAND_MS
// or closes the table. Rooms live only in memory, so a sweeper releases held
// escrows whose table no longer exists in this process (deploy, crash).
// ROOM_MODULES (server/rooms/modules.ts) binds each app id to its game module;
// today that is Three Winds from @threewinds/engine.
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../clerk.js';
import { ROOM_MODULES } from '../rooms/modules.js';
import { GameRoom, type HandResult, type RoomGameModule, type RoomMessage } from '../rooms/runtime.js';
import {
  ROOM_SOCKET_PREFIX, ROOM_CLOSE, ROOM_TICKET_TTL_MS, issueRoomTicket, registerLiveRoom, unregisterLiveRoom, sendToSeat, closeSeatSocket, createRoomHooks,
} from '../rooms/socket.js';
import { PLAY_APPS, findTier, type PlayTier } from '../../shared/play-currency-catalog.js';
import {
  getPlayBalance, escrowPlay, settlePlayHand, releasePlayEscrow, listHeldEscrows, HOUSE_ACCOUNT, type PlayEntry,
} from '../services/play-currency.js';

/** Game modules by app id (re-exported from ../rooms/modules.js). */
export { ROOM_MODULES };

export const MAX_ROOMS = 200;
export const DEFAULT_AI_FILL_MS = 8000;
export const DEFAULT_TURN_MS = 20_000;
export const DEFAULT_AI_DELAY_MS = 800;
export const NEXT_HAND_MS = 5000;
export const ESCROW_SWEEP_MS = 60_000;
/** A held escrow younger than this is never swept (its table may still be starting). */
export const ESCROW_ORPHAN_AGE_SEC = 60;
const ROOM_REF_RE = /^room:(.+):hand:\d+$/;
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
  /** Seat that deals the next hand: 0 for a new table, then HandResult.nextDealer; a voided hand keeps it. */
  dealer: number;
  fillTimer: ReturnType<typeof setTimeout> | null;
  /** Results recorded by onHandOver, in order. */
  results: HandResult[];
  /** seat → email escrowed for the current hand (the hand's settlement set). */
  escrowed: Map<number, string>;
  /** Seats whose socket closed normally (1000) mid-hand: unseated once the hand settles. */
  leaving: Set<number>;
  /** Seats with a live socket right now. */
  connected: Set<number>;
  /** Seats that had a live socket at any time since the last hand ended (or since they sat). */
  heard: Set<number>;
  /** seat → expiry of a ticket issued but not yet used to connect. */
  ticketUntil: Map<number, number>;
  /** Settlement of the last hand, while it runs. */
  settling: Promise<void> | null;
  nextTimer: ReturnType<typeof setTimeout> | null;
  nextHandMs: number;
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
  if (t.nextTimer) { clearTimeout(t.nextTimer); t.nextTimer = null; }
  rooms.delete(t.id);
  unregisterLiveRoom(t.id);
}

/**
 * Starts the table's next hand: escrows each human's maximum loss (a human who
 * cannot cover it is replaced by AI and told so), fills empty seats with AI,
 * and deals from t.dealer (set by the last settled hand's nextDealer; a voided
 * hand is dealt again by the same dealer). A table left with no humans is closed.
 */
export async function startTableHand(roomId: string): Promise<void> {
  const t = rooms.get(roomId);
  if (!t) return;
  if (t.fillTimer) { clearTimeout(t.fillTimer); t.fillTimer = null; }
  if (t.nextTimer) { clearTimeout(t.nextTimer); t.nextTimer = null; }
  // A human with no live socket since the last hand ended (and no unexpired ticket) has gone away.
  const now = Date.now();
  for (const seat of [...t.seats.keys()]) {
    if (t.connected.has(seat) || t.heard.has(seat) || (t.ticketUntil.get(seat) ?? 0) > now) continue;
    unseat(t, seat);
  }
  if (t.seats.size === 0) { closeTable(t); return; }
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
      sendToSeat(t.id, seat, { type: 'error', code: 'insufficient_taels', seq: 0 } as unknown as RoomMessage);
      unseat(t, seat);
    }
  }
  if (t.seats.size === 0) { closeTable(t); return; }
  t.escrowed = new Map(t.seats);
  t.leaving.clear();
  t.room.fillWithAi();
  t.room.startHand(t.dealer);
}

/** Frees a human seat and cuts its socket (4001), so a released seat can never steer the AI that takes it over. */
function unseat(t: TableRoom, seat: number): void {
  t.seats.delete(seat);
  t.room.release(seat);
  t.connected.delete(seat);
  t.heard.delete(seat);
  t.ticketUntil.delete(seat);
  closeSeatSocket(t.id, seat, ROOM_CLOSE.NO_SEAT, 'no_seat');
}

async function releaseAll(app: string, held: Map<number, string>, ref: string): Promise<number> {
  let released = 0;
  for (const email of held.values()) {
    try {
      if ((await releasePlayEscrow(app, email, ref)).released) released++;
    } catch { /* the sweeper retries a held escrow once its table is gone */ }
  }
  return released;
}

/**
 * Settles one finished hand from the module's points x the table stake. Human
 * seats settle against their escrow; AI seats' deltas go to the house account
 * as one ledger row (play_ledger is UNIQUE (app, account, ref)). A voided hand
 * or a failed settlement releases every escrow and changes no balance. Then
 * the next hand is scheduled, or the table closes if no human is left.
 */
async function settleHand(t: TableRoom, r: HandResult): Promise<void> {
  // t.hand and the room's hand counter advance together; t.hand names the escrow.
  const hand = t.hand;
  const ref = escrowRef(t, hand);
  const held = t.escrowed;
  t.escrowed = new Map();
  const stake = t.tier.stake;
  let deltas: number[] | null = null;
  if (!r.voided && Array.isArray(r.points) && r.points.length === t.module.seats) {
    const entries: PlayEntry[] = [];
    let house = 0;
    let anyAi = false;
    r.points.forEach((p, seat) => {
      const email = held.get(seat);
      if (email !== undefined) entries.push({ account: email, delta: p * stake, escrowRef: ref });
      else { house += p * stake; anyAi = true; }
    });
    if (anyAi) entries.push({ account: HOUSE_ACCOUNT, delta: house });
    try {
      await settlePlayHand(t.app, ref, entries);
      deltas = r.points.map((p) => p * stake);
    } catch (err) {
      const n = await releaseAll(t.app, held, ref);
      console.error(`[rooms] settle failed for ${ref}: ${(err as Error)?.message ?? err}; released ${n} escrow(s)`);
    }
  } else {
    const n = await releaseAll(t.app, held, ref);
    console.error(`[rooms] hand voided for ${ref}; released ${n} escrow(s)`);
  }

  if (rooms.get(t.id) !== t) return; // closed meanwhile
  if (deltas) {
    for (const seat of held.keys()) {
      sendToSeat(t.id, seat, { type: 'settled', hand, deltas } as unknown as RoomMessage);
    }
  }
  for (const seat of t.leaving) unseat(t, seat);
  t.leaving.clear();
  t.heard = new Set(t.connected);
  scheduleNextHand(t);
}

function scheduleNextHand(t: TableRoom): void {
  if (t.seats.size === 0) { closeTable(t); return; }
  if (t.nextTimer) clearTimeout(t.nextTimer);
  t.nextTimer = setTimeout(() => { t.nextTimer = null; kickoff(t.id); }, t.nextHandMs);
  t.nextTimer.unref?.();
}

/** A seat's socket closed. Mid-hand the seat is kept (autoplayed, still escrowed); a normal close (1000) leaves the table. */
function onSeatClose(t: TableRoom, seat: number, code: number): void {
  t.connected.delete(seat);
  if (rooms.get(t.id) !== t || code !== 1000 || !t.seats.has(seat)) return;
  if (t.room.inHand || t.settling) { t.leaving.add(seat); return; }
  if (t.state !== 'playing') return; // still waiting for the first hand: the seat is kept
  unseat(t, seat);
  if (t.seats.size === 0) closeTable(t);
}

/**
 * Releases every held escrow older than ESCROW_ORPHAN_AGE_SEC whose ref names a
 * room that is not a live table in this process. Returns how many were released.
 */
export async function sweepOrphanedEscrows(): Promise<number> {
  let released = 0;
  for (const esc of await listHeldEscrows(ESCROW_ORPHAN_AGE_SEC)) {
    const m = ROOM_REF_RE.exec(esc.ref);
    if (!m || rooms.has(m[1])) continue;
    try {
      if ((await releasePlayEscrow(esc.app, esc.email, esc.ref)).released) released++;
    } catch { /* retried next sweep */ }
  }
  return released;
}

let sweepTimer: ReturnType<typeof setInterval> | null = null;

function runSweep(): void {
  sweepOrphanedEscrows().catch((err) => {
    console.error(`[rooms] escrow sweep failed: ${(err as Error)?.message ?? err}`);
  });
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
  /** Delay between a settled hand and the next deal. Default NEXT_HAND_MS. */
  nextHandMs?: number;
}

function createTable(app: string, tier: PlayTier, module: RoomGameModule<any>, o: Required<Omit<RoomRouteOptions, 'modules'>>): TableRoom {
  let id = `${app}-${tier.id}-${randomBase36(8)}`;
  while (rooms.has(id)) id = `${app}-${tier.id}-${randomBase36(8)}`;
  const results: HandResult[] = [];
  const room = new GameRoom<unknown>(
    id, module, { turnMs: o.turnMs, aiDelayMs: o.aiDelayMs },
    createRoomHooks(id, (r) => {
      results.push(r);
      if (!r.voided && Number.isInteger(r.nextDealer) && (r.nextDealer as number) >= 0 && (r.nextDealer as number) < module.seats) {
        t.dealer = r.nextDealer as number;
      }
      const run = settleHand(t, r)
        .catch((err) => { console.error(`[rooms] settlement crashed for ${id}: ${(err as Error)?.message ?? err}`); })
        .finally(() => { if (t.settling === run) t.settling = null; });
      t.settling = run;
    }),
  );
  const t: TableRoom = {
    id, app, tier, module, room, seats: new Map(), state: 'waiting', createdAt: Date.now(), hand: 0, dealer: 0, fillTimer: null, results,
    escrowed: new Map(), leaving: new Set(), connected: new Set(), heard: new Set(), ticketUntil: new Map(), settling: null, nextTimer: null, nextHandMs: o.nextHandMs,
  };
  rooms.set(id, t);
  registerLiveRoom(id, {
    room,
    seatFor(email: string) {
      for (const [seat, e] of t.seats) if (e === email) {
        t.leaving.delete(seat);
        t.connected.add(seat);
        t.heard.add(seat);
        t.ticketUntil.delete(seat);
        return seat;
      }
      return undefined;
    },
    onClose(seat: number, code: number) { onSeatClose(t, seat, code); },
  });
  return t;
}

function seatInTable(t: TableRoom, email: string, aiFillMs: number): number | null {
  const seat = t.room.seatHuman(email);
  if (seat === 'full') return null;
  t.seats.set(seat, email);
  // The caller's ticket is issued right after this returns; a kickoff below must not see the seat as abandoned.
  t.ticketUntil.set(seat, Date.now() + ROOM_TICKET_TTL_MS);
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
  if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
}

export function registerRoomRoutes(app: FastifyInstance, opts: RoomRouteOptions = {}): void {
  const modules = opts.modules ?? ROOM_MODULES;
  const timing = {
    aiFillMs: opts.aiFillMs ?? DEFAULT_AI_FILL_MS,
    turnMs: opts.turnMs ?? DEFAULT_TURN_MS,
    aiDelayMs: opts.aiDelayMs ?? DEFAULT_AI_DELAY_MS,
    nextHandMs: opts.nextHandMs ?? NEXT_HAND_MS,
  };

  runSweep();
  if (sweepTimer) clearInterval(sweepTimer);
  sweepTimer = setInterval(runSweep, ESCROW_SWEEP_MS);
  sweepTimer.unref?.();

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
      t.ticketUntil.set(seat, expiresAt);
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
