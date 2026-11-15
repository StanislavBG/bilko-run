// Hand settlement for authoritative rooms: a real Fastify server + the real
// GameRoom socket + the real play-currency ledger (per-file throwaway DB).
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { toyGame, type ToyState } from './fixtures/rooms-toy-game.js';
import type { RoomGameModule } from '../server/rooms/runtime.js';
import { initDb, dbAll, dbGet, dbRun } from '../server/db.js';
import { creditPlay, escrowPlay, getPlayBalance } from '../server/services/play-currency.js';
import { handleRoomUpgrade, closeAllGameRooms } from '../server/rooms/socket.js';

vi.mock('../server/clerk.js', () => ({
  requireAuth: async (req: any, reply: any) => {
    const m = /^Bearer user:(.+)$/.exec(req.headers.authorization ?? '');
    if (m) return m[1];
    reply.status(401).send({ error: 'Authentication required' });
    return null;
  },
}));

const APP = 'threewinds';
const STAKE = 5; // tea tier
const HUMAN = 'alice@example.com';
const START = 1000;

/** Toy module whose settle() output we record, so the ledger is checked against the module itself. */
const settled: number[][] = [];
/** Dealer argument of every newHand call, in order. */
const dealers: number[] = [];
const toy: RoomGameModule<ToyState> = {
  ...toyGame,
  newHand(seed, dealer) { dealers.push(dealer); return toyGame.newHand(seed, dealer); },
  settle(s) { const p = toyGame.settle(s); settled.push([...p]); return p; },
};

let rooms: typeof import('../server/routes/rooms.js');
let app: FastifyInstance;
let port: number;
const sockets: WebSocket[] = [];

async function startServer(o: { turnMs: number; nextHandMs: number }): Promise<void> {
  app = Fastify();
  rooms.registerRoomRoutes(app, { modules: { [APP]: toy }, aiFillMs: 20, aiDelayMs: 0, ...o });
  await app.listen({ port: 0, host: '127.0.0.1' });
  app.server.on('upgrade', (req, socket, head) => { if (!handleRoomUpgrade(req, socket as any, head)) socket.destroy(); });
  port = (app.server.address() as AddressInfo).port;
}

interface Client { ws: WebSocket; msgs: any[]; seat: number; roomId: string; closed: Promise<number> }

async function join(email: string, autoAct: boolean): Promise<Client> {
  const res = await app.inject({
    method: 'POST', url: '/api/rooms/ticket', payload: { app: APP, tier: 'tea' },
    headers: { authorization: `Bearer user:${email}` },
  });
  expect(res.statusCode).toBe(200);
  const { path, seat, roomId } = res.json();
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  sockets.push(ws);
  const msgs: any[] = [];
  ws.on('message', (data) => {
    const m = JSON.parse(String(data));
    msgs.push(m);
    if (autoAct && m.type === 'state' && m.toAct.includes(seat)) {
      ws.send(JSON.stringify({ type: 'action', seq: m.seq, action: { discard: m.view.mine[0] } }));
    }
  });
  const closed = new Promise<number>((r) => ws.once('close', (code) => r(code)));
  await new Promise<void>((r, j) => { ws.once('open', () => r()); ws.once('error', j); });
  return { ws, msgs, seat, roomId, closed };
}

async function waitFor(cond: () => boolean | Promise<boolean>, ms = 5000): Promise<void> {
  const start = Date.now();
  while (!(await cond())) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

const ledgerFor = (ref: string) =>
  dbAll<{ account: string; amount: number; kind: string }>('SELECT account, amount, kind FROM play_ledger WHERE app = ? AND ref = ? ORDER BY id', APP, ref);
const escrowStatus = async (ref: string, email = HUMAN) =>
  (await dbGet<{ status: string }>('SELECT status FROM play_escrows WHERE app = ? AND email = ? AND ref = ?', APP, email, ref))?.status;

beforeAll(async () => {
  await initDb();
  rooms = await import('../server/routes/rooms.js');
});

beforeEach(async () => {
  settled.length = 0;
  dealers.length = 0;
  rooms.resetRooms();
  await dbRun('DELETE FROM play_ledger');
  await dbRun('DELETE FROM play_balances');
  await dbRun('DELETE FROM play_escrows');
  await creditPlay(APP, HUMAN, START, 'grant', 'test-grant');
});

afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.terminate();
  rooms.resetRooms();
  closeAllGameRooms();
  await app?.close();
});

describe('room hand settlement', () => {
  it('settles a full 1-human, 2-AI hand played over the socket into the ledger, zero-sum', async () => {
    await startServer({ turnMs: 10_000, nextHandMs: 60_000 });
    const c = await join(HUMAN, true);
    await waitFor(() => c.msgs.some((m) => m.type === 'settled'));

    const ref = `room:${c.roomId}:hand:1`;
    expect(settled).toHaveLength(1);
    const points = settled[0];
    const over = c.msgs.find((m) => m.type === 'hand_over');
    expect(over).toMatchObject({ hand: 1, points });
    // The human played their own turns: at least one action frame was answered with a new state.
    expect(c.msgs.filter((m) => m.type === 'state').length).toBeGreaterThan(1);

    const rows = await ledgerFor(ref);
    expect(rows.every((r) => r.kind === 'settle')).toBe(true);
    expect(rows.reduce((a, r) => a + Number(r.amount), 0)).toBe(0);
    const snap = rooms.roomSnapshot(c.roomId)!;
    expect(snap.humans).toEqual({ [c.seat]: HUMAN });
    expect(snap.ai.sort()).toEqual([0, 1, 2].filter((s) => s !== c.seat));
    const humanDelta = points[c.seat] * STAKE;
    const houseDelta = snap.ai.reduce((a, s) => a + points[s] * STAKE, 0);
    // play_ledger is UNIQUE (app, account, ref): both AI seats settle as one house row.
    expect(rows.map((r) => ({ account: r.account, amount: Number(r.amount) }))).toEqual([
      { account: HUMAN, amount: humanDelta },
      { account: 'house', amount: houseDelta },
    ]);

    expect(await getPlayBalance(APP, HUMAN)).toEqual({ balance: START + humanDelta, held: 0 });
    expect(await escrowStatus(ref)).toBe('settled');
    expect(c.msgs.find((m) => m.type === 'settled')).toEqual({ type: 'settled', hand: 1, deltas: points.map((p) => p * STAKE) });
  });

  it('a mid-hand disconnect keeps the seat escrowed and autoplayed to the end of that hand, then unseats it', async () => {
    await startServer({ turnMs: 150, nextHandMs: 200 });
    const c = await join(HUMAN, false);
    const ref1 = `room:${c.roomId}:hand:1`;
    await waitFor(async () => (await escrowStatus(ref1)) === 'held');
    c.ws.terminate(); // abnormal close (1006)
    await c.closed;
    expect(rooms.roomSnapshot(c.roomId)?.humans).toEqual({ [c.seat]: HUMAN });
    expect(await escrowStatus(ref1)).toBe('held');

    await waitFor(async () => (await escrowStatus(ref1)) === 'settled');
    const delta = settled[0][c.seat] * STAKE;
    // Nobody reconnected: the absent human is unseated before hand 2 and nothing more is escrowed.
    await waitFor(() => rooms.roomSnapshot(c.roomId) === undefined, 2000);
    expect(await escrowStatus(`room:${c.roomId}:hand:2`)).toBeUndefined();
    expect(await getPlayBalance(APP, HUMAN)).toEqual({ balance: START + delta, held: 0 });
  });

  it('a human who closes with 1000 between hands is unseated and the empty table is removed', async () => {
    await startServer({ turnMs: 10_000, nextHandMs: 400 });
    const c = await join(HUMAN, true);
    await waitFor(() => c.msgs.some((m) => m.type === 'settled'));
    c.ws.close(1000);
    await c.closed;
    await waitFor(() => rooms.roomSnapshot(c.roomId) === undefined, 1000);
    await new Promise((r) => setTimeout(r, 500)); // past nextHandMs: no hand 2
    expect(await escrowStatus(`room:${c.roomId}:hand:2`)).toBeUndefined();
    expect((await getPlayBalance(APP, HUMAN)).held).toBe(0);
  });

  it('a voided hand releases every human escrow and changes no balance', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const orig = toy.settle;
    toy.settle = () => [9, -9, 0]; // past maxLossPoints: the room voids the hand
    try {
      await startServer({ turnMs: 10_000, nextHandMs: 60_000 });
      const c = await join(HUMAN, true);
      const ref = `room:${c.roomId}:hand:1`;
      await waitFor(async () => (await escrowStatus(ref)) === 'released');
      expect(await getPlayBalance(APP, HUMAN)).toEqual({ balance: START, held: 0 });
      expect(await ledgerFor(ref)).toEqual([]);
      expect(spy.mock.calls.filter((a) => String(a[0]).includes(ref))).toHaveLength(1);
      expect(c.msgs.some((m) => m.type === 'settled')).toBe(false);
    } finally {
      toy.settle = orig;
      spy.mockRestore();
    }
  });

  it('the next hand is dealt by the seat the module\'s nextDealer names', async () => {
    toy.nextDealer = () => 2;
    try {
      await startServer({ turnMs: 10_000, nextHandMs: 20 });
      await join(HUMAN, true);
      await waitFor(() => dealers.length >= 3);
      expect(dealers.slice(0, 3)).toEqual([0, 2, 2]);
    } finally {
      delete toy.nextDealer;
    }
  });

  it('without a nextDealer hook the deal passes one seat each hand', async () => {
    expect(toy.nextDealer).toBeUndefined();
    await startServer({ turnMs: 10_000, nextHandMs: 20 });
    await join(HUMAN, true);
    await waitFor(() => dealers.length >= 4);
    expect(dealers.slice(0, 4)).toEqual([0, 1, 2, 0]);
  });

  it('a voided hand is dealt again by the same dealer', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const orig = toy.settle;
    let calls = 0;
    toy.settle = (s) => (++calls === 2 ? [9, -9, 0] : orig(s)); // hand 2 voids
    try {
      await startServer({ turnMs: 10_000, nextHandMs: 20 });
      await join(HUMAN, true);
      await waitFor(() => dealers.length >= 4);
      expect(dealers.slice(0, 4)).toEqual([0, 1, 1, 2]);
    } finally {
      toy.settle = orig;
      spy.mockRestore();
    }
  });

  it('the sweeper releases an orphaned room escrow and keeps a live table\'s escrow', async () => {
    await startServer({ turnMs: 60_000, nextHandMs: 60_000 });
    const c = await join(HUMAN, false); // hand 1 deals; the human never acts, so it stays held
    const liveRef = `room:${c.roomId}:hand:1`;
    await waitFor(async () => (await escrowStatus(liveRef)) === 'held');

    const BOB = 'bob@example.com';
    await creditPlay(APP, BOB, 100, 'grant', 'bob-grant');
    const ghostRef = 'room:threewinds-tea-gone1234:hand:3';
    expect((await escrowPlay(APP, BOB, 40, ghostRef)).ok).toBe(true);
    const young = 'room:threewinds-tea-young123:hand:1';
    expect((await escrowPlay(APP, BOB, 10, young)).ok).toBe(true);
    // Age the ghost and live escrows past 60 s; leave `young` fresh.
    const old = Math.floor(Date.now() / 1000) - 120;
    await dbRun('UPDATE play_escrows SET created_at = ? WHERE ref IN (?, ?)', old, ghostRef, liveRef);

    expect(await rooms.sweepOrphanedEscrows()).toBe(1);
    expect(await escrowStatus(ghostRef, BOB)).toBe('released');
    expect(await escrowStatus(young, BOB)).toBe('held');
    expect(await escrowStatus(liveRef)).toBe('held');
    expect(await getPlayBalance(APP, BOB)).toEqual({ balance: 90, held: 10 });
    expect(await dbAll('SELECT 1 FROM play_ledger WHERE ref = ?', ghostRef)).toEqual([]);
  });
});
