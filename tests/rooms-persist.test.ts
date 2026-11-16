// Room persistence through the routes: every GameRoom change is written to the
// room store (server/services/room-store.ts), a closed table loses its row, and
// the shutdown hook leaves every live table suspended for the next instance.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { toyGame } from './fixtures/rooms-toy-game.js';
import { initDb, dbRun, dbAll } from '../server/db.js';
import { creditPlay } from '../server/services/play-currency.js';
import { loadTable } from '../server/services/room-store.js';
import { handleRoomUpgrade, closeAllGameRooms } from '../server/rooms/socket.js';
import { createShutdown } from '../server/shutdown.js';

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

let rooms: typeof import('../server/routes/rooms.js');
let app: FastifyInstance;
let port: number;
const sockets: WebSocket[] = [];

async function startServer(turnMs: number, aiFillMs = 20): Promise<void> {
  app = Fastify();
  rooms.registerRoomRoutes(app, { modules: { [APP]: toyGame }, aiFillMs, aiDelayMs: 0, turnMs, nextHandMs: 60_000 });
  await app.listen({ port: 0, host: '127.0.0.1' });
  app.server.on('upgrade', (req, socket, head) => { if (!handleRoomUpgrade(req, socket as any, head)) socket.destroy(); });
  port = (app.server.address() as AddressInfo).port;
}

interface Client { ws: WebSocket; msgs: any[]; seat: number; roomId: string }

async function join(email: string, tier = 'tea'): Promise<Client> {
  const res = await app.inject({
    method: 'POST', url: '/api/rooms/ticket', payload: { app: APP, tier },
    headers: { authorization: `Bearer user:${email}` },
  });
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

/** The stored snapshot matches the live room's snapshot right now. */
async function storedMatchesLive(roomId: string): Promise<boolean> {
  const live = rooms.tableGameRoom(roomId)?.snapshot();
  const row = await loadTable(roomId);
  return !!live && !!row && JSON.stringify(row.snapshot) === JSON.stringify(live);
}

const myTurn = (c: Client) => c.msgs.filter((m) => m.type === 'state' && m.toAct.includes(c.seat)).at(-1);

/** Resolves once the server has handled every frame this socket sent before it (the pong comes back in order). */
function roundTrip(ws: WebSocket): Promise<void> {
  return new Promise((r) => { ws.once('pong', () => r()); ws.ping(); });
}

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
  await creditPlay(APP, ALICE, 10_000, 'grant', 'test-grant-a');
  await creditPlay(APP, BOB, 10_000, 'grant', 'test-grant-b');
});

afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.terminate();
  rooms.resetRooms();
  closeAllGameRooms();
  await app?.close();
});

describe('room table persistence', () => {
  it('stores the live snapshot after a hand starts and after an action', async () => {
    await startServer(60_000);
    const c = await join(ALICE);
    await waitFor(() => !!myTurn(c));
    await waitFor(() => storedMatchesLive(c.roomId));

    const row = await loadTable(c.roomId);
    expect(row).toMatchObject({
      app: APP, tier: 'tea', status: 'active', owner: rooms.roomOwnerId(), hand: 1,
      seats: { [String(c.seat)]: ALICE }, escrowed: { [String(c.seat)]: ALICE },
    });
    const seqBefore = (row!.snapshot as { seq: number }).seq;

    const turn = myTurn(c);
    const statesBefore = c.msgs.length;
    c.ws.send(JSON.stringify({ type: 'action', seq: turn.seq, action: { discard: turn.view.mine[0] } }));
    await waitFor(() => c.msgs.slice(statesBefore).some((m) => m.type === 'state' && m.toAct.includes(c.seat)));
    await waitFor(() => storedMatchesLive(c.roomId));
    expect(((await loadTable(c.roomId))!.snapshot as { seq: number }).seq).toBeGreaterThan(seqBefore);
  });

  it('deletes the row when the table closes', async () => {
    await startServer(100);
    const c = await join(ALICE);
    await waitFor(async () => (await loadTable(c.roomId)) !== null);
    c.ws.close(1000);
    await waitFor(() => rooms.roomSnapshot(c.roomId) === undefined);
    await waitFor(async () => (await loadTable(c.roomId)) === null);
  });

  it('the shutdown hook saves and suspends every live table with owner NULL', async () => {
    await startServer(60_000);
    const a = await join(ALICE, 'tea');
    const b = await join(BOB, 'jade');
    expect(a.roomId).not.toBe(b.roomId);
    await waitFor(() => !!myTurn(a) && !!myTurn(b));

    const exits: number[] = [];
    const shutdown = createShutdown({ close: async () => {} }, {
      drainMs: 5_000, exit: (code) => exits.push(code), log: () => {}, preClose: rooms.suspendRoomTables,
    });
    const finals = [a, b].map((c) => JSON.stringify(rooms.tableGameRoom(c.roomId)!.snapshot()));
    shutdown('SIGTERM');
    await waitFor(() => exits.length > 0);
    expect(exits).toEqual([0]);

    for (const [i, c] of [a, b].entries()) {
      const row = await loadTable(c.roomId);
      expect(row).toMatchObject({ status: 'suspended', owner: null });
      expect(JSON.stringify(row!.snapshot)).toBe(finals[i]);
    }
  });

  it('the drain freezes a table before its final save: moves sent meanwhile are dropped, and it resumes as the player last saw it', async () => {
    await startServer(60_000);
    const c = await join(ALICE);
    await waitFor(() => !!myTurn(c));
    await waitFor(() => storedMatchesLive(c.roomId));
    const turn = myTurn(c);
    const final = JSON.stringify(rooms.tableGameRoom(c.roomId)!.snapshot());
    const seen = c.msgs.length;

    const drain = rooms.suspendRoomTables();
    c.ws.send(JSON.stringify({ type: 'action', seq: turn.seq, action: { discard: turn.view.mine[0] } }));
    await drain;
    // After the final save, before the 1012 close: this move used to be applied and broadcast, then lost.
    c.ws.send(JSON.stringify({ type: 'action', seq: turn.seq, action: { discard: turn.view.mine[1] } }));
    await roundTrip(c.ws);

    expect(c.msgs.slice(seen)).toEqual([]);
    expect(JSON.stringify(rooms.tableGameRoom(c.roomId)!.snapshot())).toBe(final);
    const row = await loadTable(c.roomId);
    expect(row).toMatchObject({ status: 'suspended', owner: null });
    expect(JSON.stringify(row!.snapshot)).toBe(final);

    // The next instance: the player's resync is the same seq and view they last saw.
    for (const ws of sockets.splice(0)) ws.terminate();
    rooms.resetRooms();
    closeAllGameRooms();
    const d = await join(ALICE);
    expect(d.roomId).toBe(c.roomId);
    await waitFor(() => !!myTurn(d));
    expect(myTurn(d)).toMatchObject({ seq: turn.seq, view: turn.view });
  });

  it('no timer runs once the drain starts: a table waiting for its AI fill deals nothing and escrows nothing', async () => {
    await startServer(60_000, 300);
    const res = await app.inject({
      method: 'POST', url: '/api/rooms/ticket', payload: { app: APP, tier: 'tea' },
      headers: { authorization: `Bearer user:${ALICE}` },
    });
    expect(res.statusCode).toBe(200);
    const { roomId } = res.json();

    await rooms.suspendRoomTables();
    await new Promise((r) => setTimeout(r, 450)); // past the 300 ms fill
    expect(rooms.roomSnapshot(roomId)).toMatchObject({ hand: 0, state: 'waiting' });
    expect(await dbAll('SELECT ref FROM play_escrows')).toEqual([]);
    expect(await loadTable(roomId)).toMatchObject({ status: 'suspended', hand: 0, snapshot: null });
  });
});
