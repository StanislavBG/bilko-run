import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { toyGame } from './fixtures/rooms-toy-game.js';
import type { RoomGameModule } from '../server/rooms/runtime.js';
import { threeWindsRoomModule } from '@threewinds/engine';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { handleRoomUpgrade, closeAllGameRooms, ROOM_CLOSE } from '../server/rooms/socket.js';

vi.mock('../server/clerk.js', () => ({
  requireAuth: async (req: any, reply: any) => {
    const m = /^Bearer user:(.+)$/.exec(req.headers.authorization ?? '');
    if (m) return m[1];
    reply.status(401).send({ error: 'Authentication required' });
    return null;
  },
}));

const balances = new Map<string, number>();
const getPlayBalance = vi.fn(async (_app: string, email: string) => ({ balance: balances.get(email) ?? 0, held: 0 }));
const escrowPlay = vi.fn(async (_app: string, email: string, amount: number, _ref: string) => {
  const b = balances.get(email) ?? 0;
  if (b < amount) return { ok: false, balance: b, held: 0 };
  balances.set(email, b - amount);
  return { ok: true, balance: b - amount, held: amount };
});
const settlePlayHand = vi.fn(async () => ({ settled: true }));
const releasePlayEscrow = vi.fn(async () => ({ released: true, balance: 0, held: 0 }));
const listHeldEscrows = vi.fn(async () => []);
vi.mock('../server/services/play-currency.js', () => ({
  getPlayBalance, escrowPlay, settlePlayHand, releasePlayEscrow, listHeldEscrows, HOUSE_ACCOUNT: 'house',
}));

// threewinds is in PLAY_APPS; toy maxLossPoints 10 → tea (stake 5) needs 50.
const toy: RoomGameModule<any> = { ...toyGame, maxLossPoints: 10 };
const MODULES = { threewinds: toy, notplay: toy };
const AI_FILL_MS = 150;

const A = 'alice@example.com';
const B = 'bob@example.com';
const C = 'carol@example.com';

async function buildApp(modules: Record<string, RoomGameModule<any>> | 'default' = MODULES) {
  const { registerRoomRoutes } = await import('../server/routes/rooms.js');
  const app = Fastify();
  registerRoomRoutes(app, { modules: modules === 'default' ? undefined : modules, aiFillMs: AI_FILL_MS, turnMs: 60_000, aiDelayMs: 60_000 });
  return app;
}

// No Origin header: the native client sends none.
const ticket = (app: any, email: string | null, body: unknown) =>
  app.inject({
    method: 'POST', url: '/api/rooms/ticket', payload: body as any,
    headers: email ? { authorization: `Bearer user:${email}` } : {},
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('room routes', () => {
  let rooms: typeof import('../server/routes/rooms.js');

  beforeEach(async () => {
    vi.clearAllMocks();
    balances.clear();
    for (const e of [A, B, C]) balances.set(e, 1000);
    rooms = await import('../server/routes/rooms.js');
    rooms.resetRooms();
  });
  afterEach(() => rooms.resetRooms());

  it('ROOM_MODULES binds exactly threewinds to the engine module', () => {
    expect(Object.keys(rooms.ROOM_MODULES)).toEqual(['threewinds']);
    const tw = rooms.ROOM_MODULES.threewinds;
    expect(tw.id).toBe('threewinds');
    expect(tw.seats).toBe(3);
    expect(tw.maxLossPoints).toBe(400);
    expect(tw).toBe(threeWindsRoomModule);
  });

  it('the threewinds binding gives a 4 s deadline only in a claim window (R4.6)', () => {
    const tw = rooms.ROOM_MODULES.threewinds;
    expect(typeof tw.deadlineMs).toBe('function');
    expect(tw.deadlineMs!({ phase: 'claim' } as any, 0)).toBe(4000);
    for (const phase of ['draw', 'act', 'over']) expect(tw.deadlineMs!({ phase } as any, 0)).toBeUndefined();
  });

  describe('ROOMS_OPEN switch (default registry)', () => {
    let saved: string | undefined;
    beforeEach(() => { saved = process.env.ROOMS_OPEN; delete process.env.ROOMS_OPEN; });
    afterEach(() => { if (saved === undefined) delete process.env.ROOMS_OPEN; else process.env.ROOMS_OPEN = saved; });

    it('with ROOMS_OPEN unset, both endpoints answer 409 rooms_closed', async () => {
      const app = await buildApp('default');
      const tiers = await app.inject({ method: 'GET', url: '/api/rooms/tiers?app=threewinds' });
      expect(tiers.statusCode).toBe(409);
      expect(tiers.json()).toEqual({ error: 'rooms_closed' });
      const t = await ticket(app, A, { app: 'threewinds', tier: 'tea' });
      expect(t.statusCode).toBe(409);
      expect(t.json()).toEqual({ error: 'rooms_closed' });
      expect(getPlayBalance).not.toHaveBeenCalled();
      await app.close();
    });

    it('an unregistered app gets 404 unknown_app whether rooms are open or closed', async () => {
      for (const open of [undefined, 'threewinds,nope']) {
        if (open === undefined) delete process.env.ROOMS_OPEN; else process.env.ROOMS_OPEN = open;
        const app = await buildApp('default');
        const tiers = await app.inject({ method: 'GET', url: '/api/rooms/tiers?app=nope' });
        expect(tiers.statusCode).toBe(404);
        expect(tiers.json()).toEqual({ error: 'unknown_app' });
        const t = await ticket(app, A, { app: 'nope', tier: 'tea' });
        expect(t.statusCode).toBe(404);
        expect(t.json()).toEqual({ error: 'unknown_app' });
        await app.close();
      }
    });

    it("with ROOMS_OPEN=' threewinds , other', tiers lists every tier and tickets work", async () => {
      process.env.ROOMS_OPEN = ' threewinds , other';
      const app = await buildApp('default');
      const res = await app.inject({ method: 'GET', url: '/api/rooms/tiers?app=threewinds' });
      expect(res.statusCode).toBe(200);
      const body = JSON.stringify(res.json());
      for (const t of ['tea', 'jade', 'peony', 'imperial']) expect(body).toContain(`"${t}"`);
      balances.set(A, 1_000_000); // real engine: 400 × stake
      const ok = await ticket(app, A, { app: 'threewinds', tier: 'tea' });
      expect(ok.statusCode).toBe(200);
      expect(ok.json().roomId).toMatch(/^threewinds-tea-/);
      balances.set(B, 0);
      const poor = await ticket(app, B, { app: 'threewinds', tier: 'tea' });
      expect(poor.statusCode).toBe(402);
      expect((await ticket(app, C, { app: 'threewinds', tier: 'nope' })).statusCode).toBe(404);
      await app.close();
    });

    it('explicit opts.modules are open even with ROOMS_OPEN unset', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/api/rooms/tiers?app=threewinds' });
      expect(res.statusCode).toBe(200);
      expect((await ticket(app, A, { app: 'threewinds', tier: 'tea' })).statusCode).toBe(200);
      await app.close();
    });
  });

  it('seats callers at the same waiting table and returns a socket ticket', async () => {
    const app = await buildApp();
    const r1 = await ticket(app, A, { app: 'threewinds', tier: 'tea' });
    expect(r1.statusCode).toBe(200);
    expect(r1.headers['cache-control']).toBe('no-store');
    const b1 = r1.json();
    expect(b1.roomId).toMatch(/^threewinds-tea-[0-9a-z]{8}$/);
    expect(b1).toMatchObject({ tier: 'tea', seat: 0 });
    expect(typeof b1.ticket).toBe('string');
    expect(b1.expiresAt).toBeGreaterThan(Date.now());
    expect(b1.path).toBe(`/api/rooms/socket/${b1.roomId}?ticket=${b1.ticket}`);

    const b2 = (await ticket(app, B, { app: 'threewinds', tier: 'tea' })).json();
    expect(b2).toMatchObject({ roomId: b1.roomId, seat: 1 });

    // A different tier gets a different table.
    const b3 = (await ticket(app, C, { app: 'threewinds', tier: 'jade' })).json();
    expect(b3.roomId).toMatch(/^threewinds-jade-/);
    expect(b3.seat).toBe(0);
    await app.close();
  });

  it('a seated caller rejoins the same room, whatever tier they ask for', async () => {
    const app = await buildApp();
    const b1 = (await ticket(app, A, { app: 'threewinds', tier: 'tea' })).json();
    const b2 = (await ticket(app, A, { app: 'threewinds', tier: 'imperial' })).json();
    expect(b2).toMatchObject({ roomId: b1.roomId, tier: 'tea', seat: 0 });
    expect(b2.ticket).not.toBe(b1.ticket);
    await app.close();
  });

  it('a full table starts at once and escrows every human', async () => {
    const app = await buildApp();
    const ids = [];
    for (const e of [A, B, C]) ids.push((await ticket(app, e, { app: 'threewinds', tier: 'tea' })).json().roomId);
    expect(new Set(ids).size).toBe(1);
    const roomId = ids[0];
    await vi.waitFor(() => expect(rooms.roomSnapshot(roomId)?.hand).toBe(1));
    await vi.waitFor(() => expect(escrowPlay).toHaveBeenCalledTimes(3));
    for (const e of [A, B, C]) expect(escrowPlay).toHaveBeenCalledWith('threewinds', e, 50, `room:${roomId}:hand:1`);
    const snap = rooms.roomSnapshot(roomId)!;
    expect(snap.state).toBe('playing');
    expect(snap.ai).toEqual([]);

    // Playing table is not joined; the next caller opens a new one.
    balances.set('dave@example.com', 1000);
    const d = (await ticket(app, 'dave@example.com', { app: 'threewinds', tier: 'tea' })).json();
    expect(d.roomId).not.toBe(roomId);
    // A seated player still rejoins the playing table.
    expect((await ticket(app, B, { app: 'threewinds', tier: 'tea' })).json()).toMatchObject({ roomId, seat: 1 });
    await app.close();
  });

  it('fills empty seats with AI aiFillMs after the first human sat', async () => {
    const app = await buildApp();
    const { roomId } = (await ticket(app, A, { app: 'threewinds', tier: 'tea' })).json();
    await sleep(AI_FILL_MS / 3);
    await ticket(app, B, { app: 'threewinds', tier: 'tea' });
    await sleep(AI_FILL_MS / 3);
    expect(rooms.roomSnapshot(roomId)).toMatchObject({ state: 'waiting', hand: 0, ai: [] });
    expect(escrowPlay).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(rooms.roomSnapshot(roomId)?.hand).toBe(1), { timeout: 1000 });
    await vi.waitFor(() => expect(escrowPlay).toHaveBeenCalledTimes(2));
    expect(rooms.roomSnapshot(roomId)).toMatchObject({ state: 'playing', ai: [2], humans: { 0: A, 1: B } });
    await app.close();
  });

  it('a human who cannot cover the escrow at hand start is replaced by AI', async () => {
    const app = await buildApp();
    const { roomId } = (await ticket(app, A, { app: 'threewinds', tier: 'tea' })).json();
    await ticket(app, B, { app: 'threewinds', tier: 'tea' });
    balances.set(B, 10); // spent elsewhere after sitting
    await ticket(app, C, { app: 'threewinds', tier: 'tea' });
    await vi.waitFor(() => expect(rooms.roomSnapshot(roomId)?.ai).toEqual([1]));
    expect(rooms.roomSnapshot(roomId)).toMatchObject({ hand: 1, humans: { 0: A, 2: C } });
    await app.close();
  });

  it('402 insufficient_taels when the balance cannot cover stake x maxLossPoints', async () => {
    const app = await buildApp();
    balances.set(A, 2499);
    const res = await ticket(app, A, { app: 'threewinds', tier: 'imperial' });
    expect(res.statusCode).toBe(402);
    expect(res.json()).toEqual({ error: 'insufficient_taels', balance: 2499, required: 5000 });
    await app.close();
  });

  it('400 bad body, 401 signed out, 404 unknown app or tier', async () => {
    const app = await buildApp();
    expect((await ticket(app, null, { app: 'threewinds', tier: 'tea' })).statusCode).toBe(401);
    for (const body of [{}, { app: 'threewinds' }, { app: 'threewinds', tier: 5 }, { app: 'Three Winds!', tier: 'tea' }]) {
      expect((await ticket(app, A, body)).statusCode).toBe(400);
    }
    const noApp = await ticket(app, A, { app: 'nope', tier: 'tea' });
    expect(noApp.statusCode).toBe(404);
    expect(noApp.json()).toEqual({ error: 'unknown_app' });
    // In modules but not in PLAY_APPS.
    expect((await ticket(app, A, { app: 'notplay', tier: 'tea' })).json()).toEqual({ error: 'unknown_app' });
    const noTier = await ticket(app, A, { app: 'threewinds', tier: 'gold' });
    expect(noTier.statusCode).toBe(404);
    expect(noTier.json()).toEqual({ error: 'unknown_tier' });
    await app.close();
  });

  it('429 above 30 tickets a minute per user', async () => {
    const app = await buildApp();
    for (let i = 0; i < 30; i++) expect((await ticket(app, A, { app: 'threewinds', tier: 'tea' })).statusCode).toBe(200);
    const res = await ticket(app, A, { app: 'threewinds', tier: 'tea' });
    expect(res.statusCode).toBe(429);
    expect((await ticket(app, B, { app: 'threewinds', tier: 'tea' })).statusCode).toBe(200);
    await app.close();
  });

  it('GET /api/rooms/tiers is public, no-store, and lists open seats without emails', async () => {
    const app = await buildApp();
    await ticket(app, A, { app: 'threewinds', tier: 'tea' });
    await ticket(app, B, { app: 'threewinds', tier: 'jade' });
    await ticket(app, C, { app: 'threewinds', tier: 'jade' });
    const res = await app.inject({ method: 'GET', url: '/api/rooms/tiers?app=threewinds' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.json()).toEqual({
      tiers: [
        { id: 'tea', stake: 5, openSeats: 2 },
        { id: 'jade', stake: 25, openSeats: 1 },
        { id: 'peony', stake: 100, openSeats: 0 },
        { id: 'imperial', stake: 500, openSeats: 0 },
      ],
    });
    expect(res.body).not.toContain('@');
    expect((await app.inject({ method: 'GET', url: '/api/rooms/tiers?app=nope' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/rooms/tiers' })).statusCode).toBe(400);
    await app.close();
  });
});


describe('room seat lifecycle over real sockets', () => {
  let rooms: typeof import('../server/routes/rooms.js');
  let app: ReturnType<typeof Fastify>;
  let port: number;
  const sockets: WebSocket[] = [];

  async function start(o: { aiFillMs: number; turnMs: number; aiDelayMs: number; nextHandMs: number }) {
    const { registerRoomRoutes } = await import('../server/routes/rooms.js');
    app = Fastify();
    registerRoomRoutes(app, { modules: MODULES, ...o });
    await app.listen({ port: 0, host: '127.0.0.1' });
    app.server.on('upgrade', (req, socket, head) => { if (!handleRoomUpgrade(req, socket as any, head)) socket.destroy(); });
    port = (app.server.address() as AddressInfo).port;
  }

  async function seatAt(email: string) {
    const res = await ticket(app, email, { app: 'threewinds', tier: 'tea' });
    expect(res.statusCode).toBe(200);
    return res.json() as { path: string; seat: number; roomId: string };
  }

  async function connect(path: string) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    sockets.push(ws);
    const msgs: any[] = [];
    ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
    const closed = new Promise<number>((r) => ws.once('close', (code) => r(code)));
    await new Promise<void>((r, j) => { ws.once('open', () => r()); ws.once('error', j); });
    return { ws, msgs, closed };
  }

  const flush = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setImmediate(r)); };

  beforeEach(async () => {
    vi.clearAllMocks();
    balances.clear();
    for (const e of [A, B, C]) balances.set(e, 1000);
    rooms = await import('../server/routes/rooms.js');
    rooms.resetRooms();
  });
  afterEach(async () => {
    vi.useRealTimers();
    for (const ws of sockets.splice(0)) ws.terminate();
    rooms.resetRooms();
    closeAllGameRooms();
    await app?.close();
  });

  it('I1: a seat released because its escrow failed is cut off with 4001 and unseated', async () => {
    await start({ aiFillMs: AI_FILL_MS, turnMs: 60_000, aiDelayMs: 60_000, nextHandMs: 60_000 });
    const a = await seatAt(A);
    const b = await seatAt(B);
    const ca = await connect(a.path);
    await connect(b.path);
    balances.set(A, 10); // spent after sitting: seat 0's escrow fails at hand start
    await vi.waitFor(() => expect(rooms.roomSnapshot(a.roomId)?.hand).toBe(1), { timeout: 2000 });
    expect(await ca.closed).toBe(ROOM_CLOSE.NO_SEAT);
    expect(ca.msgs.some((m) => m.type === 'error' && m.code === 'insufficient_taels')).toBe(true);
    const snap = rooms.roomSnapshot(a.roomId)!;
    expect(snap.ai).toContain(0);
    expect(snap.humans).toEqual({ 1: B });
    // A frame from the cut-off socket goes nowhere: the room sends A nothing more.
    const n = ca.msgs.length;
    ca.ws.send(JSON.stringify({ type: 'action', seq: 1, action: { discard: 't00' } }));
    await flush();
    expect(ca.msgs.length).toBe(n);
  });

  it('I2: a human whose socket closed with 1001 is unseated after the hand in progress, with no new escrow', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    await start({ aiFillMs: 150, turnMs: 1000, aiDelayMs: 100, nextHandMs: 200 });
    const a = await seatAt(A);
    const c = await connect(a.path);
    await vi.advanceTimersByTimeAsync(200);
    await flush();
    expect(rooms.roomSnapshot(a.roomId)?.hand).toBe(1);
    c.ws.close(1001);
    await c.closed;
    await flush();
    for (let i = 0; i < 120; i++) { await vi.advanceTimersByTimeAsync(500); await flush(); }
    const escrows = escrowPlay.mock.calls.filter((call) => call[1] === A);
    expect(escrows.length).toBe(1);
    expect(rooms.roomSnapshot(a.roomId)).toBeUndefined();
  });

  it('I2: a ticket whose socket never connects is unseated before the next deal', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    await start({ aiFillMs: 40_000, turnMs: 1000, aiDelayMs: 100, nextHandMs: 200 });
    const a = await seatAt(A); // 30 s ticket, never used
    await vi.advanceTimersByTimeAsync(41_000);
    await flush();
    expect(escrowPlay).not.toHaveBeenCalled();
    expect(rooms.roomSnapshot(a.roomId)).toBeUndefined();
  });
});
