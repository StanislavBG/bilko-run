// Resuming saved tables after a restart: the room store keeps a table across a
// process restart (simulated by suspending and dropping every in-memory table
// with resetRooms while the DB stays), the seated player's next ticket claims and
// rebuilds it, and its hand settles exactly once. A table another instance still
// leases answers 503 table_moving, and a table nobody returns to is voided.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { toyGame } from './fixtures/rooms-toy-game.js';
import { initDb, dbRun, dbAll } from '../server/db.js';
import { creditPlay, getPlayBalance } from '../server/services/play-currency.js';
import { loadTable, findTableIdForEmail } from '../server/services/room-store.js';
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
const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const GRANT = 10_000;

let rooms: typeof import('../server/routes/rooms.js');
let app: FastifyInstance;
let port: number;
const sockets: WebSocket[] = [];

async function startServer(): Promise<void> {
  app = Fastify();
  rooms.registerRoomRoutes(app, { modules: { [APP]: toyGame }, aiFillMs: 20, aiDelayMs: 0, turnMs: 60_000, nextHandMs: 60_000 });
  await app.listen({ port: 0, host: '127.0.0.1' });
  app.server.on('upgrade', (req, socket, head) => { if (!handleRoomUpgrade(req, socket as any, head)) socket.destroy(); });
  port = (app.server.address() as AddressInfo).port;
}

interface Client { ws: WebSocket; msgs: any[]; seat: number; roomId: string }

function ticket(email: string, tier = 'tea') {
  return app.inject({
    method: 'POST', url: '/api/rooms/ticket', payload: { app: APP, tier },
    headers: { authorization: `Bearer user:${email}` },
  });
}

async function join(email: string, tier = 'tea'): Promise<Client> {
  const res = await ticket(email, tier);
  expect(res.statusCode).toBe(200);
  const { path, seat, roomId } = res.json();
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  sockets.push(ws);
  const msgs: any[] = [];
  ws.on('message', (data) => { msgs.push(JSON.parse(String(data))); });
  await new Promise<void>((r, j) => { ws.once('open', () => r()); ws.once('error', j); });
  return { ws, msgs, seat, roomId };
}

async function waitFor(cond: () => boolean | Promise<boolean>, ms = 5000): Promise<void> {
  const start = Date.now();
  while (!(await cond())) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

const myTurn = (c: Client) => c.msgs.filter((m) => m.type === 'state' && m.toAct.includes(c.seat)).at(-1);

/** Plays the client's turns (lowest token) until its hand-over message arrives. */
async function playOut(c: Client): Promise<any> {
  let lastSeq = -1;
  await waitFor(() => {
    const over = c.msgs.find((m) => m.type === 'hand_over');
    if (over) return true;
    const turn = myTurn(c);
    if (turn && turn.seq !== lastSeq) {
      lastSeq = turn.seq;
      const lowest = [...turn.view.mine].sort()[0];
      c.ws.send(JSON.stringify({ type: 'action', seq: turn.seq, action: { discard: lowest } }));
    }
    return false;
  }, 10_000);
  return c.msgs.find((m) => m.type === 'hand_over');
}

/** Simulates a restart: the shutdown hook suspends every table, then memory and sockets are dropped; the DB stays. */
async function restart(): Promise<void> {
  await rooms.suspendRoomTables();
  for (const ws of sockets.splice(0)) ws.terminate();
  rooms.resetRooms();
  closeAllGameRooms();
}

const escrowsFor = (ref: string) => dbAll<{ status: string; email: string }>('SELECT status, email FROM play_escrows WHERE ref = ?', ref);
const settleRows = (ref: string) => dbAll('SELECT 1 FROM play_ledger WHERE ref = ?', ref);

beforeAll(async () => {
  await initDb();
  rooms = await import('../server/routes/rooms.js');
});

beforeEach(async () => {
  rooms.resetRooms();
  await dbRun('DELETE FROM play_ledger');
  await dbRun('DELETE FROM play_balances');
  await dbRun('DELETE FROM play_escrows');
  await dbRun('DELETE FROM room_table_seats');
  await dbRun('DELETE FROM room_tables');
  await creditPlay(APP, ALICE, GRANT, 'grant', 'test-grant-a');
});

afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.terminate();
  rooms.resetRooms();
  closeAllGameRooms();
  await app?.close();
});

describe('resuming saved tables', () => {
  it('after a restart the seated player gets the same table and seat, and the hand settles once', async () => {
    await startServer();
    const a = await join(ALICE);
    await waitFor(() => !!myTurn(a));
    const ref = `room:${a.roomId}:hand:1`;
    expect(await escrowsFor(ref)).toEqual([{ status: 'held', email: ALICE }]);

    await restart();
    expect(rooms.roomSnapshot(a.roomId)).toBeUndefined();
    expect(await loadTable(a.roomId)).toMatchObject({ status: 'suspended', owner: null });

    const b = await join(ALICE);
    expect(b.roomId).toBe(a.roomId);
    expect(b.seat).toBe(a.seat);
    expect(rooms.roomSnapshot(b.roomId)).toMatchObject({ hand: 1, state: 'playing', humans: { [b.seat]: ALICE } });
    expect(await loadTable(b.roomId)).toMatchObject({ status: 'active', owner: rooms.roomOwnerId() });
    // Not escrowed again: still the one held escrow of hand 1.
    expect(await escrowsFor(ref)).toEqual([{ status: 'held', email: ALICE }]);

    const over = await playOut(b);
    await waitFor(() => b.msgs.some((m) => m.type === 'settled'));
    const settled = b.msgs.find((m) => m.type === 'settled');
    expect(settled.deltas).toEqual(over.points.map((p: number) => p * 5)); // tea stake 5
    const delta = settled.deltas[b.seat];
    expect(await escrowsFor(ref)).toEqual([{ status: 'settled', email: ALICE }]);
    expect(await getPlayBalance(APP, ALICE)).toEqual({ balance: GRANT + delta, held: 0 });
  });

  it('a hand already settled before the restart pays nothing more', async () => {
    await startServer();
    const a = await join(ALICE);
    await waitFor(() => !!myTurn(a));
    await rooms.suspendRoomTables(); // a durable mid-hand row to replay later
    const midHand = (await loadTable(a.roomId))!;
    expect(midHand.snapshot).not.toBeNull();
    for (const ws of sockets.splice(0)) ws.terminate();
    rooms.resetRooms();
    closeAllGameRooms();

    // Resume once and settle hand 1 for real.
    const b = await join(ALICE);
    expect(b.roomId).toBe(a.roomId);
    const ref = `room:${b.roomId}:hand:1`;
    await playOut(b);
    await waitFor(() => b.msgs.some((m) => m.type === 'settled'));
    const after = await getPlayBalance(APP, ALICE);
    const ledger = (await settleRows(ref)).length;
    expect(ledger).toBeGreaterThan(0);

    // Crash with a stale row that still holds the mid-hand snapshot and escrow, then resume it.
    await restart();
    await dbRun(
      "UPDATE room_tables SET status = 'suspended', owner = NULL, hand = ?, dealer = ?, escrowed = ?, snapshot = ? WHERE id = ?",
      midHand.hand, midHand.dealer, JSON.stringify(midHand.escrowed), JSON.stringify(midHand.snapshot), b.roomId);

    const c = await join(ALICE);
    expect(c.roomId).toBe(b.roomId);
    expect(rooms.roomSnapshot(c.roomId)).toMatchObject({ hand: 1, state: 'playing' });
    await playOut(c);
    await waitFor(() => rooms.roomSnapshot(c.roomId)?.results.length === 1);
    await new Promise((r) => setTimeout(r, 100)); // let the settlement attempt finish
    expect(await getPlayBalance(APP, ALICE)).toEqual(after);
    expect((await settleRows(ref)).length).toBe(ledger);
    expect(c.msgs.some((m) => m.type === 'settled')).toBe(false);
  });

  it('answers 503 table_moving while another instance holds a fresh lease, and the sweeper keeps its escrow', async () => {
    await startServer();
    const a = await join(ALICE);
    await waitFor(() => !!myTurn(a));
    await restart();
    await dbRun("UPDATE room_tables SET status = 'active', owner = 'other-instance', heartbeat_at = ? WHERE id = ?", Date.now(), a.roomId);

    const res = await ticket(ALICE);
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: 'table_moving' });
    expect(res.headers['retry-after']).toBe('5');
    expect(rooms.roomSnapshot(a.roomId)).toBeUndefined();

    const ref = `room:${a.roomId}:hand:1`;
    await dbRun('UPDATE play_escrows SET created_at = ? WHERE ref = ?', Math.floor(Date.now() / 1000) - 120, ref);
    expect(await rooms.sweepOrphanedEscrows()).toBe(0);
    expect(await escrowsFor(ref)).toEqual([{ status: 'held', email: ALICE }]);
    expect(await loadTable(a.roomId)).toMatchObject({ owner: 'other-instance' });

    // Once that lease goes stale, the ticket claims the table.
    await dbRun('UPDATE room_tables SET heartbeat_at = ? WHERE id = ?', Date.now() - 61_000, a.roomId);
    const again = await ticket(ALICE);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ roomId: a.roomId, seat: a.seat });
  });

  it('once the drain starts every ticket answers 503 table_moving, seated or not, and nobody is seated', async () => {
    await startServer();
    await creditPlay(APP, BOB, GRANT, 'grant', 'test-grant-b');
    const a = await join(ALICE);
    await waitFor(() => !!myTurn(a));

    const drain = rooms.suspendRoomTables();
    const during = await ticket(ALICE);
    await drain;
    const seated = await ticket(ALICE); // still in this process's rooms, but its sockets are about to close
    const stranger = await ticket(BOB, 'jade');
    for (const res of [during, seated, stranger]) {
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({ error: 'table_moving' });
      expect(res.headers['retry-after']).toBe('5');
    }
    expect(await findTableIdForEmail(APP, BOB)).toBeNull();
    expect(await escrowsFor(`room:${a.roomId}:hand:1`)).toEqual([{ status: 'held', email: ALICE }]);
  });

  it('voids a table nobody returns to within 10 minutes and releases its escrows', async () => {
    await startServer();
    const a = await join(ALICE);
    await waitFor(() => !!myTurn(a));
    await restart();
    const ref = `room:${a.roomId}:hand:1`;
    await dbRun('UPDATE play_escrows SET created_at = ? WHERE ref = ?', Math.floor(Date.now() / 1000) - 120, ref);

    // Suspended recently: the saved table keeps its escrow.
    expect(await rooms.sweepOrphanedEscrows()).toBe(0);
    expect(await escrowsFor(ref)).toEqual([{ status: 'held', email: ALICE }]);
    expect(await loadTable(a.roomId)).not.toBeNull();

    // Suspended for over 10 minutes: voided.
    await dbRun('UPDATE room_tables SET updated_at = ? WHERE id = ?', Date.now() - 11 * 60_000, a.roomId);
    expect(await rooms.sweepOrphanedEscrows()).toBe(1);
    expect(await escrowsFor(ref)).toEqual([{ status: 'released', email: ALICE }]);
    expect(await getPlayBalance(APP, ALICE)).toEqual({ balance: GRANT, held: 0 });
    expect(await loadTable(a.roomId)).toBeNull();
    expect(await findTableIdForEmail(APP, ALICE)).toBeNull();
    expect(await settleRows(ref)).toEqual([]);

    // The next ticket seats the player at a new table.
    const res = await ticket(ALICE);
    expect(res.statusCode).toBe(200);
    expect(res.json().roomId).not.toBe(a.roomId);
  });
});
