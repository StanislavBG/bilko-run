import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { toyGame } from './fixtures/rooms-toy-game.js';
import type { RoomGameModule } from '../server/rooms/runtime.js';

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
vi.mock('../server/services/play-currency.js', () => ({ getPlayBalance, escrowPlay }));

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

  it('ROOM_MODULES is empty, so production knows no app', async () => {
    expect(rooms.ROOM_MODULES).toEqual({});
    const app = await buildApp('default');
    const res = await ticket(app, A, { app: 'threewinds', tier: 'tea' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'unknown_app' });
    await app.close();
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
