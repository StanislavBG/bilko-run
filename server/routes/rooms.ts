// Game-room matchmaking — REST half of the authoritative rooms
// (server/rooms/runtime.ts runs a hand, server/rooms/socket.ts carries it).
// POST /api/rooms/ticket seats a signed-in player at a table of the requested
// stake tier and returns a single-use socket ticket; GET /api/rooms/tiers lists
// open seats per tier. Empty seats are filled with AI aiFillMs after the first
// human sits. At each hand start every human seat's maximum loss is escrowed;
// at hand end settleHand pays the module's zero-sum points x stake through the
// play ledger (AI seats against the house), then deals again after NEXT_HAND_MS
// or closes the table. A sweeper releases held escrows whose table is neither
// live in this process nor saved in the room store, and voids saved tables
// nobody came back to within ABANDONED_TABLE_MS.
// Each live table is also written to the room store (server/services/room-store.ts)
// on every GameRoom change, under a lease owned by this process (renewed every
// HEARTBEAT_MS); closing a table deletes its row, and on shutdown
// suspendRoomTables saves and suspends every table so the next instance can resume it.
// Resume is lazy: the first ticket of a seated human claims the saved table
// (claimTable, lease TABLE_LEASE_STALE_MS) and rebuilds it, hand and escrows
// included; while another instance holds a fresh lease the answer is 503 table_moving.
// ROOM_MODULES (server/rooms/modules.ts) binds each app id to its game module;
// today that is Three Winds from @threewinds/engine.
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../clerk.js';
import { envListIncludes } from '../env-list.js';
import { ROOM_MODULES } from '../rooms/modules.js';
import { GameRoom, type HandResult, type RoomGameModule, type RoomMessage } from '../rooms/runtime.js';
import {
  ROOM_SOCKET_PREFIX, ROOM_CLOSE, ROOM_TICKET_TTL_MS, issueRoomTicket, registerLiveRoom, unregisterLiveRoom, sendToSeat, closeSeatSocket, createRoomHooks,
} from '../rooms/socket.js';
import { PLAY_APPS, findTier, type PlayTier } from '../../shared/play-currency-catalog.js';
import {
  getPlayBalance, escrowPlay, settlePlayHand, releasePlayEscrow, listHeldEscrows, HOUSE_ACCOUNT, type PlayEntry,
} from '../services/play-currency.js';
import {
  saveTable, heartbeatTables, suspendTables, deleteTable, claimTable, loadTable, findTableIdForEmail, listTables,
  type StoredRoomTable,
} from '../services/room-store.js';
import type { RoomSnapshot } from '../rooms/runtime.js';

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
/** How often this process renews the lease on the tables it owns. */
export const HEARTBEAT_MS = 15_000;
/** A lease whose heartbeat is older than this may be claimed by another instance. */
export const TABLE_LEASE_STALE_MS = 60_000;
/** A saved table not resumed (suspended, or with no heartbeat) for this long is voided by the sweeper. */
export const ABANDONED_TABLE_MS = 10 * 60_000;
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
  /** Store writes for this table, chained so they never overlap or reorder. */
  saveChain: Promise<void>;
  /** A save is queued on saveChain and has not started yet (it will read the latest state). */
  saveQueued: boolean;
}

const rooms = new Map<string, TableRoom>();

/** Lease owner id of this process in the room store. */
const OWNER = process.env.RENDER_INSTANCE_ID || `proc-${crypto.randomUUID()}`;
export function roomOwnerId(): string { return OWNER; }

/** Set once the shutdown hook has suspended the tables: no more writes from this process. */
let persistenceStopped = false;

// A local libSQL file allows one open write transaction per process, and the
// ledger and the room store each serialize only their own writes. Every write
// this file starts goes through one chain so a table save never collides with
// an escrow or settlement; a store write also retries SQLITE_BUSY from writers elsewhere.
let writeChain: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn);
  writeChain = run.catch(() => undefined);
  return run;
}

const STORE_BUSY_RETRIES = 5;
async function storeWrite<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await exclusive(fn);
    } catch (err) {
      if (attempt >= STORE_BUSY_RETRIES || !/SQLITE_BUSY/.test(String((err as Error)?.message ?? err))) throw err;
      await new Promise((r) => setTimeout(r, 20 * 2 ** attempt));
    }
  }
}

function logStoreError(what: string, id: string, err: unknown): void {
  console.error(`[rooms] ${what} failed for ${id}: ${(err as Error)?.message ?? err}`);
}

async function writeTable(t: TableRoom): Promise<void> {
  t.saveQueued = false;
  if (persistenceStopped) return;
  const seats: Record<string, string> = {};
  for (const [seat, email] of t.seats) seats[String(seat)] = email;
  const escrowed: Record<string, string> = {};
  for (const [seat, email] of t.escrowed) escrowed[String(seat)] = email;
  const row = {
    id: t.id, app: t.app, tier: t.tier.id, status: 'active', owner: OWNER, heartbeatAt: Date.now(),
    hand: t.hand, dealer: t.dealer, seats, escrowed, snapshot: t.room.snapshot(),
  } as const;
  const ok = await storeWrite(() => saveTable(row));
  if (!ok) console.error(`[rooms] save skipped for ${t.id}: the stored row is owned by another instance`);
}

/** Queues a store write of the table's current state; never throws into the caller. */
function scheduleSave(t: TableRoom): Promise<void> {
  if (persistenceStopped || rooms.get(t.id) !== t) return t.saveChain;
  if (t.saveQueued) return t.saveChain;
  t.saveQueued = true;
  t.saveChain = t.saveChain.then(() => writeTable(t)).catch((err) => { logStoreError('save', t.id, err); });
  return t.saveChain;
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function ensureHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    if (rooms.size === 0 || persistenceStopped) {
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
      return;
    }
    storeWrite(() => heartbeatTables(OWNER, Date.now())).catch((err) => { logStoreError('heartbeat', OWNER, err); });
  }, HEARTBEAT_MS);
  heartbeatTimer.unref?.();
}

/**
 * Shutdown hook (createShutdown preClose): waits for each table's pending save,
 * writes a final snapshot, then suspends every table this process owns (owner NULL)
 * so the next instance can claim it at once. Never throws.
 */
export async function suspendRoomTables(): Promise<void> {
  if (persistenceStopped) return;
  const tables = [...rooms.values()];
  await Promise.all(tables.map(async (t) => {
    await t.saveChain;
    t.saveQueued = false; // force a fresh write of the final state
    await scheduleSave(t);
  }));
  persistenceStopped = true;
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  try {
    const n = await storeWrite(() => suspendTables(OWNER));
    console.log(`[rooms] suspended ${n} table(s) for the next instance`);
  } catch (err) {
    logStoreError('suspend', OWNER, err);
  }
}

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
  if (persistenceStopped) return; // suspended for the next instance: keep the row
  t.saveChain = t.saveChain.then(() => storeWrite(() => deleteTable(t.id))).catch((err) => { logStoreError('delete', t.id, err); });
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
      ok = (await exclusive(() => escrowPlay(t.app, email, amount, ref))).ok;
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
  t.leaving.delete(seat);
  closeSeatSocket(t.id, seat, ROOM_CLOSE.NO_SEAT, 'no_seat');
}

async function releaseAll(app: string, held: Map<number, string>, ref: string): Promise<number> {
  let released = 0;
  for (const email of held.values()) {
    try {
      if ((await exclusive(() => releasePlayEscrow(app, email, ref))).released) released++;
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
      // A ref settled before (e.g. by the instance this table was restored from) pays nothing again.
      const { settled } = await exclusive(() => settlePlayHand(t.app, ref, entries));
      if (settled) deltas = r.points.map((p) => p * stake);
      else console.error(`[rooms] ${ref} was already settled; nothing paid again`);
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
  if (rooms.get(t.id) === t) void scheduleSave(t); // seats and dealer after settlement
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
  const nowMs = Date.now();
  const saved = new Map<string, StoredRoomTable>();
  for (const row of await listTables()) saved.set(row.id, row);
  const isAbandoned = (row: StoredRoomTable) => !rooms.has(row.id) && !restoring.has(row.id) && (
    row.status === 'suspended' ? row.updatedAt < nowMs - ABANDONED_TABLE_MS : row.heartbeatAt < nowMs - ABANDONED_TABLE_MS);
  // Fence each abandoned table with a claim first, so a player resuming it right now wins and it is kept.
  const voiding = new Set<string>();
  for (const row of saved.values()) {
    if (!isAbandoned(row)) continue;
    try {
      if (await storeWrite(() => claimTable(row.id, OWNER, Date.now(), ABANDONED_TABLE_MS))) voiding.add(row.id);
    } catch (err) { logStoreError('void claim', row.id, err); }
  }

  let released = 0;
  const failed = new Set<string>();
  for (const esc of await listHeldEscrows(ESCROW_ORPHAN_AGE_SEC)) {
    const m = ROOM_REF_RE.exec(esc.ref);
    if (!m || rooms.has(m[1]) || restoring.has(m[1])) continue;
    if (saved.has(m[1]) && !voiding.has(m[1])) continue; // a saved table may still be resumed
    try {
      if ((await exclusive(() => releasePlayEscrow(esc.app, esc.email, esc.ref))).released) released++;
    } catch { failed.add(m[1]); /* retried next sweep */ }
  }
  for (const id of voiding) {
    if (failed.has(id) || rooms.has(id)) continue;
    try {
      await storeWrite(() => deleteTable(id));
      console.error(`[rooms] voided abandoned table ${id}`);
    } catch (err) { logStoreError('void delete', id, err); }
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

type Timing = Required<Omit<RoomRouteOptions, 'modules'>>;

function createTable(app: string, tier: PlayTier, module: RoomGameModule<any>, o: Timing, restoredId?: string): TableRoom {
  let id = restoredId ?? `${app}-${tier.id}-${randomBase36(8)}`;
  while (!restoredId && rooms.has(id)) id = `${app}-${tier.id}-${randomBase36(8)}`;
  const results: HandResult[] = [];
  const hooks = createRoomHooks(id, (r) => {
      results.push(r);
      if (!r.voided && Number.isInteger(r.nextDealer) && (r.nextDealer as number) >= 0 && (r.nextDealer as number) < module.seats) {
        t.dealer = r.nextDealer as number;
      }
      const run = settleHand(t, r)
        .catch((err) => { console.error(`[rooms] settlement crashed for ${id}: ${(err as Error)?.message ?? err}`); })
        .finally(() => { if (t.settling === run) t.settling = null; });
      t.settling = run;
  });
  const room = new GameRoom<unknown>(
    id, module, { turnMs: o.turnMs, aiDelayMs: o.aiDelayMs },
    { ...hooks, onChange: () => { void scheduleSave(t); } },
  );
  const t: TableRoom = {
    id, app, tier, module, room, seats: new Map(), state: 'waiting', createdAt: Date.now(), hand: 0, dealer: 0, fillTimer: null, results,
    escrowed: new Map(), leaving: new Set(), connected: new Set(), heard: new Set(), ticketUntil: new Map(), settling: null, nextTimer: null, nextHandMs: o.nextHandMs,
    saveChain: Promise.resolve(), saveQueued: false,
  };
  rooms.set(id, t);
  ensureHeartbeat();
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

/** Restores in flight in this process, by table id, so concurrent tickets share one claim. */
const restoring = new Map<string, Promise<TableRoom | 'moving' | null>>();

/**
 * Claims a saved table from the store and rebuilds it in this process: seats, hand,
 * dealer, tier and the current hand's escrowed set (never escrowed again), with the
 * live hand resumed through GameRoom.restore. 'moving' when another instance holds a
 * fresh lease; null when there is nothing to resume (the caller then sits as new).
 */
function resumeTable(id: string, modules: Record<string, RoomGameModule<any>>, o: Timing): Promise<TableRoom | 'moving' | null> {
  const live = rooms.get(id);
  if (live) return Promise.resolve(live);
  let run = restoring.get(id);
  if (!run) {
    run = doResume(id, modules, o).finally(() => { restoring.delete(id); });
    restoring.set(id, run);
  }
  return run;
}

async function doResume(id: string, modules: Record<string, RoomGameModule<any>>, o: Timing): Promise<TableRoom | 'moving' | null> {
  if (persistenceStopped) return 'moving'; // shutting down: the next instance resumes it
  if (!(await storeWrite(() => claimTable(id, OWNER, Date.now(), TABLE_LEASE_STALE_MS)))) {
    return (await loadTable(id)) ? 'moving' : null;
  }
  const row = await loadTable(id);
  if (!row) return null;
  const live = rooms.get(id);
  if (live) return live;
  const escrowed = new Map<number, string>();
  for (const [k, v] of Object.entries((row.escrowed ?? {}) as Record<string, unknown>)) {
    if (/^\d+$/.test(k) && typeof v === 'string') escrowed.set(Number(k), v);
  }
  const module = moduleFor(modules, row.app);
  const tier = module ? findTier(row.app, row.tier) : undefined;
  if (!module || !tier || rooms.size >= MAX_ROOMS) {
    // Cannot run it here: void the current hand and drop the table so nobody is stuck on it.
    await releaseAll(row.app, escrowed, `room:${id}:hand:${row.hand}`);
    await storeWrite(() => deleteTable(id)).catch((err) => { logStoreError('delete', id, err); });
    return null;
  }
  const seats = new Map<number, string>();
  for (const [k, v] of Object.entries(row.seats)) {
    const seat = Number(k);
    if (Number.isInteger(seat) && seat >= 0 && seat < module.seats && typeof v === 'string') seats.set(seat, v);
  }

  const t = createTable(row.app, tier, module, o, id);
  t.hand = Number.isInteger(row.hand) && row.hand >= 0 ? row.hand : 0;
  t.dealer = Number.isInteger(row.dealer) && row.dealer >= 0 && row.dealer < module.seats ? row.dealer : 0;
  t.state = t.hand > 0 ? 'playing' : 'waiting';
  t.seats = seats;
  if (row.snapshot) t.room.restore(row.snapshot as RoomSnapshot);
  if (t.room.inHand) {
    for (const seat of t.room.humanSeats()) if (!seats.has(seat)) t.room.release(seat);
    for (const seat of [...seats.keys()]) if (!t.room.humanSeats().includes(seat)) seats.delete(seat);
    t.escrowed = escrowed; // the live hand settles against the escrows already held
  } else {
    // No live hand to resume: seat the humans at their own seats, holding the gaps with placeholders.
    const holders: number[] = [];
    const top = Math.max(-1, ...seats.keys());
    for (let s = 0; s <= top; s++) {
      const got = t.room.seatHuman(seats.has(s) ? seats.get(s)! : `\u0000restore:${s}`);
      if (!seats.has(s) && got !== 'full') holders.push(got);
    }
    for (const s of holders) t.room.release(s);
    // A hand that was escrowed but cannot continue is voided (a settled escrow is not held, so nothing moves).
    if (escrowed.size > 0) await releaseAll(t.app, escrowed, escrowRef(t, t.hand));
    if (rooms.get(id) !== t) return null;
    if (seats.size === 0) { closeTable(t); return null; }
    if (t.state === 'playing') scheduleNextHand(t);
    else {
      t.fillTimer = setTimeout(() => { t.fillTimer = null; kickoff(t.id); }, o.aiFillMs);
      t.fillTimer.unref?.();
    }
  }
  void scheduleSave(t);
  console.log(`[rooms] resumed table ${id} at hand ${t.hand}${t.room.inHand ? ' (in hand)' : ''}`);
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

/** Test-only: the live GameRoom of a table. */
export function tableGameRoom(roomId: string): GameRoom<unknown> | undefined {
  return rooms.get(roomId)?.room;
}

/** Test-only: drop every table, timer and rate window. */
export function resetRooms(): void {
  for (const t of [...rooms.values()]) closeTable(t);
  ticketRate.clear();
  if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  persistenceStopped = false;
}

export function registerRoomRoutes(app: FastifyInstance, opts: RoomRouteOptions = {}): void {
  const modules = opts.modules ?? ROOM_MODULES;
  // The default registry is open unless the owner lists the app in ROOMS_CLOSED (emergency switch);
  // explicit modules (tests) are always open.
  const gated = opts.modules === undefined;
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
    if (gated && envListIncludes('ROOMS_CLOSED', appId)) return reply.code(409).send({ error: 'rooms_closed' });
    const tier = findTier(appId, tierId);
    if (!tier) return reply.code(404).send({ error: 'unknown_tier' });

    const issue = (t: TableRoom, seat: number) => {
      const { ticket, expiresAt } = issueRoomTicket(email, t.id);
      t.ticketUntil.set(seat, expiresAt);
      return { ticket, expiresAt, path: `${ROOM_SOCKET_PREFIX}${t.id}?ticket=${ticket}`, roomId: t.id, tier: t.tier.id, seat };
    };

    // Rejoin: already seated at a live table of this app, whatever tier was asked for.
    const seatedAt = () => {
      for (const t of rooms.values()) {
        if (t.app !== appId) continue;
        for (const [seat, e] of t.seats) if (e === email) return { t, seat };
      }
      return null;
    };
    let mine = seatedAt();
    if (mine) return issue(mine.t, mine.seat);

    // Resume: seated at a saved table (restart, deploy or another instance's table).
    // A store that cannot be read must not block play: the caller then sits as new.
    let savedId: string | null = null;
    try {
      savedId = await findTableIdForEmail(appId, email);
    } catch (err) { logStoreError('seat lookup', appId, err); }
    if (savedId && !rooms.has(savedId)) {
      let resumed: TableRoom | 'moving' | null = null;
      try {
        resumed = await resumeTable(savedId, modules, timing);
      } catch (err) { logStoreError('resume', savedId, err); }
      if (resumed === 'moving') {
        mine = seatedAt();
        if (mine) return issue(mine.t, mine.seat);
        return reply.code(503).header('retry-after', '5').send({ error: 'table_moving' });
      }
    }
    mine = seatedAt();
    if (mine) return issue(mine.t, mine.seat);

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
    if (gated && envListIncludes('ROOMS_CLOSED', appId)) return reply.code(409).send({ error: 'rooms_closed' });
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
