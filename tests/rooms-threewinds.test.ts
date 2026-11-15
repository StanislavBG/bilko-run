// The real Three Winds engine (@threewinds/engine via ROOM_MODULES.threewinds)
// inside the host's GameRoom: redaction of every seat message, zero-sum
// settlement within maxLossPoints, R14.1 dealer rotation, R4.6 timeout play and
// deadlines, and one full hand through the real socket into the taels ledger.
// If an invariant here fails, the fix belongs to 3PMahjong, not this file.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import type { RoomState } from '@threewinds/engine';
import { GameRoom, type RoomGameModule, type RoomMessage, type HandResult } from '../server/rooms/runtime.js';
import { ROOM_MODULES, THREE_WINDS_CLAIM_MS } from '../server/rooms/modules.js';
import { initDb, dbGet, dbRun } from '../server/db.js';
import { creditPlay, getPlayBalance } from '../server/services/play-currency.js';
import { handleRoomUpgrade, closeAllGameRooms } from '../server/rooms/socket.js';
import { PLAY_APPS } from '../shared/play-currency-catalog.js';

vi.mock('../server/clerk.js', () => ({
  requireAuth: async (req: any, reply: any) => {
    const m = /^Bearer user:(.+)$/.exec(req.headers.authorization ?? '');
    if (m) return m[1];
    reply.status(401).send({ error: 'Authentication required' });
    return null;
  },
}));

const APP = 'threewinds';
const TURN_MS = 10_000;
const AI_MS = 50;
const MAX_LOSS = 400;
const tw = ROOM_MODULES.threewinds as RoomGameModule<RoomState>;

// ── Seeded helpers ─────────────────────────────────────────────────────────

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 32 hex chars from a seeded rng. */
function hexSeeds(rng: () => number): () => string {
  return () => Array.from({ length: 32 }, () => Math.floor(rng() * 16).toString(16)).join('');
}

/** Injected clock + timer queue: nothing runs until advance() (as in tests/rooms-runtime.test.ts). */
function fakeClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => now,
    timers: {
      set(fn: () => void, ms: number) { const id = nextId++; timers.set(id, { at: now + ms, fn }); return id; },
      clear(h: unknown) { timers.delete(h as number); },
    },
    pending: () => timers.size,
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        let best: [number, { at: number; fn: () => void }] | undefined;
        for (const e of timers) if (e[1].at <= end && (!best || e[1].at < best[1].at || (e[1].at === best[1].at && e[0] < best[0]))) best = e;
        if (!best) break;
        timers.delete(best[0]);
        now = best[1].at;
        best[1].fn();
      }
      now = end;
    },
  };
}

interface Applied { seat: number; phase: RoomState['phase']; action: any }

/** Wraps the real module so the test sees the room's real state, its seeds and every applied action. */
function spyModule(base: RoomGameModule<RoomState> = tw) {
  const spy = {
    state: null as RoomState | null,
    seeds: [] as string[],
    applied: [] as Applied[],
    lastActor: null as number | null,
  };
  const mod: RoomGameModule<RoomState> = {
    ...base,
    newHand(seed, dealer) {
      spy.seeds.push(seed);
      spy.lastActor = null;
      spy.state = base.newHand(seed, dealer);
      return spy.state;
    },
    apply(state, seat, action) {
      const r = base.apply(state, seat, action);
      if (r.ok) {
        spy.applied.push({ seat, phase: state.phase, action });
        spy.lastActor = seat;
        spy.state = r.state;
      }
      return r;
    },
  };
  return { mod, spy };
}

function makeRoom(opts: { seed: () => string; base?: RoomGameModule<RoomState> }) {
  const clock = fakeClock();
  const { mod, spy } = spyModule(opts.base);
  const sent: Array<{ seat: number; msg: RoomMessage }> = [];
  const results: HandResult[] = [];
  const hooks = {
    send: (seat: number, msg: RoomMessage) => { sent.push({ seat, msg }); onSend(seat, msg); },
    onHandOver: (r: HandResult) => { results.push(r); },
  };
  let onSend: (seat: number, msg: RoomMessage) => void = () => {};
  const room = new GameRoom('tw1', mod, { turnMs: TURN_MS, aiDelayMs: AI_MS, seed: opts.seed, timers: clock.timers, now: clock.now }, hooks);
  return { clock, spy, sent, results, room, onSend: (f: typeof onSend) => { onSend = f; } };
}

/** Every tile id a view exposes: objects with numeric id + string kind, and every tileId / tileIds field. */
function tileIdsIn(x: unknown, out: number[] = []): number[] {
  if (Array.isArray(x)) { for (const v of x) tileIdsIn(v, out); return out; }
  if (x === null || typeof x !== 'object') return out;
  const o = x as Record<string, unknown>;
  if (typeof o.id === 'number' && typeof o.kind === 'string') out.push(o.id);
  if (typeof o.tileId === 'number') out.push(o.tileId);
  if (Array.isArray(o.tileIds)) for (const t of o.tileIds) if (typeof t === 'number') out.push(t);
  for (const v of Object.values(o)) tileIdsIn(v, out);
  return out;
}

/** R14.1, written out independently of the engine's nextDealer. */
function expectedNextDealer(s: RoomState): number {
  const r = s.result!;
  if (r.kind === 'draw' || r.winners.includes(s.dealer)) return s.dealer;
  if (r.selfDrawn) return r.winners[0];
  const from = r.discarder!;
  for (let k = 1; k <= 2; k++) if (r.winners.includes(((from + k) % 3) as 0 | 1 | 2)) return (from + k) % 3;
  throw new Error('no winner after the thrower');
}

const CLAIM_ONLY = new Set(['pass', 'win']);
const TURN_ONLY = new Set(['discard', 'win', 'selfWin']);

// ── Engine through GameRoom (fake clock) ────────────────────────────────────

describe('Three Winds engine in GameRoom', () => {
  it('24 seeded 3-human hands: no message holds the wall, the seed or another seat\'s concealed tiles', () => {
    const rng = mulberry32(0x3e1d5);
    const { clock, spy, results, room, onSend } = makeRoom({ seed: hexSeeds(mulberry32(0xa11ce)) });
    for (const k of ['a', 'b', 'c']) room.seatHuman(k);
    expect(room.humanSeats()).toEqual([0, 1, 2]);

    let checked = 0;
    let overChecked = 0;
    let robKongSeen = 0;
    const errors: RoomMessage[] = [];
    const latest = new Map<number, Extract<RoomMessage, { type: 'state' }>>();
    // Per-state redaction facts, computed once per state change and reused for
    // every seat's messages about that state (keyed by the spy's state object).
    interface Facts {
      state: RoomState;
      wall: Set<number>;
      owner: Map<number, number>; // concealed tile id -> seat holding it
      winnerTiles: Set<number>; // public at a win: the winners' hands
      robKong: { from: number; tileId: number } | null; // R4.10 window
    }
    let facts: Facts | null = null;
    const factsFor = (s: RoomState): Facts => {
      if (facts?.state === s) return facts;
      const owner = new Map<number, number>();
      s.hands.forEach((h, i) => { for (const t of h) owner.set(t.id, i); });
      const winnerTiles = new Set<number>();
      if (s.phase === 'over' && s.result?.kind === 'win') for (const w of s.result.winners) for (const t of s.hands[w]) winnerTiles.add(t.id);
      let robKong: Facts['robKong'] = null;
      // R4.10: the added-kong tile is public while others may rob it (one tile, robKong window only).
      if (s.phase === 'claim' && s.claim?.kind === 'robKong') {
        const { from, tile } = s.claim;
        expect(s.hands[from].some((t) => t.id === tile.id), 'robKong tile is in the declarer\'s hand').toBe(true);
        expect(s.melds[from].some((m) => m.type === 'pong' && !m.concealed && m.tiles[0].kind === tile.kind), 'robKong tile matches an exposed pong').toBe(true);
        robKong = { from, tileId: tile.id };
      }
      facts = { state: s, wall: new Set(s.wall.map((t) => t.id)), owner, winnerTiles, robKong };
      return facts;
    };
    onSend((seat, msg) => {
      if (msg.type === 'error') { errors.push(msg); return; }
      const f = factsFor(spy.state!);
      const json = JSON.stringify(msg);
      const leakedSeeds = spy.seeds.filter((seed) => json.includes(seed));
      expect(leakedSeeds, `seed leaked to seat ${seat}`).toEqual([]);
      const robTile = f.robKong && seat !== f.robKong.from ? f.robKong.tileId : null;
      if (robTile !== null) robKongSeen++;
      const leaked = tileIdsIn((msg as any).view).filter((id) => {
        if (f.wall.has(id)) return true;
        const o = f.owner.get(id);
        return o !== undefined && o !== seat && !f.winnerTiles.has(id) && id !== robTile;
      });
      expect(leaked, `seed ${spy.seeds.at(-1)} seat ${seat} ${msg.type} seq ${(msg as any).seq ?? '-'} leaked tiles`).toEqual([]);
      if (msg.type === 'state') latest.set(seat, msg);
      if (msg.type === 'hand_over') overChecked++;
      checked++;
    });

    let dealer = 0;
    let timeouts = 0;
    for (let hand = 1; hand <= 24; hand++) {
      latest.clear();
      room.startHand(dealer);
      let steps = 0;
      while (results.length < hand) {
        if (++steps > 5000) throw new Error(`hand ${hand} (seed ${spy.seeds.at(-1)}) did not finish`);
        const seq = Math.max(...[...latest.values()].map((m) => m.seq));
        const due = [...latest.entries()].filter(([s, m]) => m.seq === seq && m.toAct.includes(s));
        if (due.length === 0 || rng() < 0.12) {
          timeouts++;
          clock.advance(TURN_MS);
          continue;
        }
        const [seat, m] = due[Math.floor(rng() * due.length)];
        const legal = (m.view as any).legal as unknown[];
        expect(legal.length, `seat ${seat} due with no legal action`).toBeGreaterThan(0);
        room.act(seat, m.seq, legal[Math.floor(rng() * legal.length)]);
      }
      const r = results[hand - 1];
      expect(r.voided, `hand ${hand} seed ${spy.seeds.at(-1)} voided`).toBeFalsy();
      dealer = r.nextDealer!;
    }
    expect(errors).toEqual([]);
    expect(overChecked).toBe(24 * 3);
    expect(checked).toBeGreaterThan(24 * 3 * 10);
    expect(timeouts).toBeGreaterThan(0);
    expect(robKongSeen).toBeGreaterThan(0);
    expect(spy.seeds.every((s) => /^[0-9a-f]{32}$/.test(s))).toBe(true);
  }, 120_000);

  it('120 seeded all-AI hands settle zero-sum within maxLossPoints and pass the deal by R14.1', () => {
    expect(tw.maxLossPoints).toBe(MAX_LOSS);
    const { clock, spy, results, room } = makeRoom({ seed: hexSeeds(mulberry32(0x5e771e)) });
    room.fillWithAi();
    expect(room.humanSeats()).toEqual([]);
    let dealer = 0;
    const kinds = { draw: 0, dealerKeeps: 0, passes: 0 };
    for (let hand = 1; hand <= 120; hand++) {
      room.startHand(dealer);
      let steps = 0;
      while (results.length < hand) {
        if (++steps > 2000) throw new Error(`hand ${hand} (seed ${spy.seeds.at(-1)}) did not finish`);
        clock.advance(AI_MS);
      }
      const r = results[hand - 1];
      const s = spy.state!;
      const tag = `hand ${hand} seed ${spy.seeds.at(-1)}`;
      expect(r.voided, `${tag} voided`).toBeFalsy();
      expect(s.phase).toBe('over');
      const p = r.points!;
      expect(p).toHaveLength(3);
      expect(p.every((x) => Number.isInteger(x)), tag).toBe(true);
      expect(p.reduce((a, b) => a + b, 0), tag).toBe(0);
      expect(Math.min(...p), tag).toBeGreaterThanOrEqual(-MAX_LOSS);
      expect(s.dealer).toBe(dealer);
      expect(r.nextDealer, `${tag} next dealer`).toBe(expectedNextDealer(s));
      if (s.result!.kind === 'draw') kinds.draw++;
      else if (r.nextDealer === dealer) kinds.dealerKeeps++;
      else kinds.passes++;
      dealer = r.nextDealer!;
    }
    expect(kinds.passes).toBeGreaterThan(0);
  }, 120_000);

  it('a human who never acts is auto-passed or wins in claim windows, discards or wins on its turn, with R4.6 deadlines', () => {
    const { clock, spy, results, room, onSend } = makeRoom({ seed: hexSeeds(mulberry32(0x71e0)) });
    const HUMAN = 0;
    expect(room.seatHuman('idle')).toBe(HUMAN);
    room.fillWithAi();

    let prevDue = false;
    let prevDeadline: number | null = null;
    const seen = { claimFresh: 0, turnFresh: 0, kept: 0 };
    onSend((seat, msg) => {
      if (msg.type !== 'state') { prevDue = false; return; }
      expect(seat).toBe(HUMAN);
      const due = msg.toAct.includes(HUMAN);
      if (due) {
        const s = spy.state!;
        const fresh = !prevDue || spy.lastActor === HUMAN;
        if (fresh) {
          const ms = s.phase === 'claim' ? THREE_WINDS_CLAIM_MS : TURN_MS;
          expect(msg.deadline, `seed ${spy.seeds.at(-1)} seq ${msg.seq} phase ${s.phase}`).toBe(clock.now() + ms);
          if (s.phase === 'claim') seen.claimFresh++; else seen.turnFresh++;
        } else {
          expect(msg.deadline).toBe(prevDeadline);
          seen.kept++;
        }
        prevDeadline = msg.deadline;
      }
      prevDue = due;
    });

    let dealer = 0;
    for (let hand = 1; hand <= 12; hand++) {
      prevDue = false;
      room.startHand(dealer);
      let steps = 0;
      while (results.length < hand) {
        if (++steps > 5000) throw new Error(`hand ${hand} (seed ${spy.seeds.at(-1)}) did not finish`);
        clock.advance(AI_MS);
      }
      expect(results[hand - 1].voided).toBeFalsy();
      dealer = results[hand - 1].nextDealer!;
    }

    const mine = spy.applied.filter((a) => a.seat === HUMAN);
    const claims = mine.filter((a) => a.phase === 'claim');
    const turns = mine.filter((a) => a.phase !== 'claim');
    expect(claims.length).toBeGreaterThan(0);
    expect(turns.length).toBeGreaterThan(0);
    for (const a of claims) expect(CLAIM_ONLY.has(a.action.type), `claim window: ${JSON.stringify(a.action)}`).toBe(true);
    for (const a of turns) expect(TURN_ONLY.has(a.action.type), `own turn: ${JSON.stringify(a.action)}`).toBe(true);
    expect(seen.claimFresh).toBeGreaterThan(0);
    expect(seen.turnFresh).toBeGreaterThan(0);
  }, 120_000);
});

// ── Money through the routes and the real socket ────────────────────────────

let rooms: typeof import('../server/routes/rooms.js');
let app: FastifyInstance;
let port: number;
const sockets: WebSocket[] = [];

async function startServer(o: { turnMs: number; nextHandMs: number; aiDelayMs: number }): Promise<void> {
  app = Fastify();
  rooms.registerRoomRoutes(app, { aiFillMs: 20, ...o }); // default ROOM_MODULES
  await app.listen({ port: 0, host: '127.0.0.1' });
  app.server.on('upgrade', (req, socket, head) => { if (!handleRoomUpgrade(req, socket as any, head)) socket.destroy(); });
  port = (app.server.address() as AddressInfo).port;
}

const ticket = (email: string, tier: string) => app.inject({
  method: 'POST', url: '/api/rooms/ticket', payload: { app: APP, tier },
  headers: { authorization: `Bearer user:${email}` },
});

async function waitFor(cond: () => boolean | Promise<boolean>, ms = 15_000): Promise<void> {
  const start = Date.now();
  while (!(await cond())) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

const escrowRow = (ref: string, email: string) =>
  dbGet<{ status: string; amount: number }>('SELECT status, amount FROM play_escrows WHERE app = ? AND email = ? AND ref = ?', APP, email, ref);

/** A new account holding only the signup grant (credited as /api/play-currency/balance does). */
async function newAccount(email: string): Promise<number> {
  const grant = PLAY_APPS[APP].signupGrant;
  await creditPlay(APP, email, grant, 'signup_grant', 'signup_grant');
  return grant;
}

describe('Three Winds through the room routes', () => {
  beforeAll(async () => {
    await initDb();
    rooms = await import('../server/routes/rooms.js');
  });

  let savedRoomsOpen: string | undefined;
  beforeEach(async () => {
    savedRoomsOpen = process.env.ROOMS_OPEN;
    process.env.ROOMS_OPEN = 'threewinds';
    rooms.resetRooms();
    await dbRun('DELETE FROM play_ledger');
    await dbRun('DELETE FROM play_balances');
    await dbRun('DELETE FROM play_escrows');
  });

  afterEach(async () => {
    for (const ws of sockets.splice(0)) ws.terminate();
    rooms.resetRooms();
    closeAllGameRooms();
    await app?.close();
    if (savedRoomsOpen === undefined) delete process.env.ROOMS_OPEN; else process.env.ROOMS_OPEN = savedRoomsOpen;
  });

  it('the 5000-tael signup grant buys a tea seat, not jade; the hand escrows 5 x 400 taels', async () => {
    const EMAIL = 'newbie@example.com';
    expect(await newAccount(EMAIL)).toBe(5000);
    await startServer({ turnMs: 60_000, nextHandMs: 60_000, aiDelayMs: 60_000 });

    const jade = await ticket(EMAIL, 'jade');
    expect(jade.statusCode).toBe(402);
    expect(jade.json()).toEqual({ error: 'insufficient_taels', balance: 5000, required: 10_000 });

    const tea = await ticket(EMAIL, 'tea');
    expect(tea.statusCode).toBe(200);
    const { roomId } = tea.json();
    const ref = `room:${roomId}:hand:1`;
    await waitFor(async () => (await escrowRow(ref, EMAIL))?.status === 'held');
    expect(Number((await escrowRow(ref, EMAIL))!.amount)).toBe(2000);
    expect(await getPlayBalance(APP, EMAIL)).toEqual({ balance: 3000, held: 2000 });
  });

  it('one full real-engine hand over the socket settles points x 5 into the ledger', async () => {
    const EMAIL = 'player@example.com';
    const START = await newAccount(EMAIL);
    // 60 ms per AI move keeps the human under the socket's 20 frames/s limit (ROOM_RATE_PER_SEC).
    await startServer({ turnMs: 10_000, nextHandMs: 60_000, aiDelayMs: 60 });
    const res = await ticket(EMAIL, 'tea');
    expect(res.statusCode).toBe(200);
    const { path, seat, roomId } = res.json();
    const rng = mulberry32(0xb0a7);
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    sockets.push(ws);
    const msgs: any[] = [];
    let acted = 0;
    let closeCode: number | null = null;
    ws.on('close', (code) => { closeCode = code; });
    ws.on('message', (data) => {
      const m = JSON.parse(String(data));
      msgs.push(m);
      if (m.type === 'state' && m.toAct.includes(seat)) {
        const legal = m.view.legal as unknown[];
        acted++;
        ws.send(JSON.stringify({ type: 'action', seq: m.seq, action: legal[Math.floor(rng() * legal.length)] }));
      }
    });
    await new Promise<void>((r, j) => { ws.once('open', () => r()); ws.once('error', j); });

    await waitFor(() => msgs.some((m) => m.type === 'settled'));
    expect(acted).toBeGreaterThan(0);
    expect(closeCode).toBeNull();
    // stale_seq can race (an AI moved before the frame arrived); an illegal action cannot.
    expect(msgs.filter((m) => m.type === 'error' && m.code === 'illegal_action')).toEqual([]);
    const over = msgs.find((m) => m.type === 'hand_over');
    expect(over).toMatchObject({ hand: 1 });
    const points = over.points as number[];
    expect(points.reduce((a, b) => a + b, 0)).toBe(0);
    const settled = msgs.find((m) => m.type === 'settled');
    expect(settled).toEqual({ type: 'settled', hand: 1, deltas: points.map((p) => p * 5) });
    expect(msgs.findIndex((m) => m.type === 'hand_over')).toBeLessThan(msgs.findIndex((m) => m.type === 'settled'));

    const ref = `room:${roomId}:hand:1`;
    expect((await escrowRow(ref, EMAIL))?.status).toBe('settled');
    expect(await getPlayBalance(APP, EMAIL)).toEqual({ balance: START + settled.deltas[seat], held: 0 });
  }, 30_000);
});
