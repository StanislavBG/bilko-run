// The deploy drain against a hand start in flight. escrowPlay is held open by a gate, so
// the drain begins while the table is taking escrows: the table must not deal, its final
// save keeps that hand's escrow, and the next instance releases it instead of leaving it
// held for the table's whole life.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { toyGame } from './fixtures/rooms-toy-game.js';
import { initDb, dbRun, dbAll } from '../server/db.js';
import { creditPlay, getPlayBalance } from '../server/services/play-currency.js';
import { loadTable } from '../server/services/room-store.js';
import { closeAllGameRooms } from '../server/rooms/socket.js';

const gate = vi.hoisted(() => ({ hold: null as Promise<void> | null, entered: 0 }));

vi.mock('../server/clerk.js', () => ({
  requireAuth: async (req: any, reply: any) => {
    const m = /^Bearer user:(.+)$/.exec(req.headers.authorization ?? '');
    if (m) return m[1];
    reply.status(401).send({ error: 'Authentication required' });
    return null;
  },
}));

vi.mock('../server/services/play-currency.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../server/services/play-currency.js')>();
  return {
    ...orig,
    escrowPlay: async (...args: Parameters<typeof orig.escrowPlay>) => {
      gate.entered++;
      if (gate.hold) await gate.hold;
      return orig.escrowPlay(...args);
    },
  };
});

const APP = 'threewinds';
const ALICE = 'alice@example.com';
const GRANT = 10_000;

let rooms: typeof import('../server/routes/rooms.js');
let app: FastifyInstance;

function ticket(email: string) {
  return app.inject({
    method: 'POST', url: '/api/rooms/ticket', payload: { app: APP, tier: 'tea' },
    headers: { authorization: `Bearer user:${email}` },
  });
}

async function waitFor(cond: () => boolean, ms = 5000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
}

const escrowsFor = (ref: string) => dbAll<{ status: string; email: string }>('SELECT status, email FROM play_escrows WHERE ref = ?', ref);

beforeAll(async () => {
  await initDb();
  rooms = await import('../server/routes/rooms.js');
});

beforeEach(async () => {
  rooms.resetRooms();
  gate.hold = null;
  gate.entered = 0;
  await dbRun('DELETE FROM play_ledger');
  await dbRun('DELETE FROM play_balances');
  await dbRun('DELETE FROM play_escrows');
  await dbRun('DELETE FROM room_table_seats');
  await dbRun('DELETE FROM room_tables');
  await creditPlay(APP, ALICE, GRANT, 'grant', 'test-grant-a');
  app = Fastify();
  rooms.registerRoomRoutes(app, { modules: { [APP]: toyGame }, aiFillMs: 20, aiDelayMs: 0, turnMs: 60_000, nextHandMs: 60_000 });
  await app.ready();
});

afterEach(async () => {
  gate.hold = null;
  rooms.resetRooms();
  closeAllGameRooms();
  await app?.close();
});

describe('drain during a hand start', () => {
  it('deals nothing, saves the escrow taken, and the next instance releases it', async () => {
    let open!: () => void;
    gate.hold = new Promise<void>((r) => { open = r; });
    const res = await ticket(ALICE);
    expect(res.statusCode).toBe(200);
    const { roomId, seat } = res.json();
    await waitFor(() => gate.entered > 0); // the fill timer fired: the hand start waits on ALICE's escrow

    const drain = rooms.suspendRoomTables();
    open();
    await drain;

    const ref = `room:${roomId}:hand:1`;
    expect(rooms.tableGameRoom(roomId)!.inHand).toBe(false);
    expect(await escrowsFor(ref)).toEqual([{ status: 'held', email: ALICE }]);
    expect(await loadTable(roomId)).toMatchObject({
      status: 'suspended', owner: null, hand: 1, escrowed: { [String(seat)]: ALICE }, snapshot: null,
    });

    // The next instance: resuming voids the undealt hand 1, releases its escrow, and keeps the seat.
    gate.hold = null;
    rooms.resetRooms();
    closeAllGameRooms();
    const again = await ticket(ALICE);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ roomId, seat });
    expect(await escrowsFor(ref)).toEqual([{ status: 'released', email: ALICE }]);
    expect(await getPlayBalance(APP, ALICE)).toEqual({ balance: GRANT, held: 0 });
  });
});
