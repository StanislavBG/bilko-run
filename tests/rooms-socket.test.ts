import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { GameRoom, type RoomMessage } from '../server/rooms/runtime.js';
import { toyGame, type ToyState } from './fixtures/rooms-toy-game.js';
import {
  handleRoomUpgrade, issueRoomTicket, isAllowedRoomOrigin, registerLiveRoom, unregisterLiveRoom,
  closeAllGameRooms, createRoomHooks, ROOM_SOCKET_PREFIX, ROOM_CLOSE, ROOM_TICKET_TTL_MS, ROOM_MAX_FRAME_BYTES,
} from '../server/rooms/socket.js';

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';

interface Client {
  ws: WebSocket;
  msgs: RoomMessage[];
  closed: Promise<{ code: number; reason: string }>;
}

let server: http.Server;
let port: number;
const open: WebSocket[] = [];
const registered: string[] = [];

beforeAll(async () => {
  server = http.createServer();
  server.on('upgrade', (req, socket, head) => { if (!handleRoomUpgrade(req, socket, head)) socket.destroy(); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(open.splice(0).map((ws) => new Promise<void>((r) => {
    if (ws.readyState === WebSocket.CLOSED) return r();
    ws.once('close', () => r());
    ws.close(1000);
  })));
  for (const id of registered.splice(0)) unregisterLiveRoom(id);
  closeAllGameRooms();
});

afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); });

async function waitFor(cond: () => boolean, ms = 3000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** A live toy room with alice in seat 0, bob in seat 1, AI in seat 2, hand dealt. Timers never fire. */
function liveRoom(roomId: string, opts: { onClose?: (seat: number) => void } = {}): GameRoom<ToyState> {
  const room = new GameRoom<ToyState>(
    roomId,
    toyGame,
    { turnMs: 60_000, aiDelayMs: 60_000, timers: { set: () => 0, clear: () => {} } },
    createRoomHooks(roomId, () => {}),
  );
  const seats = new Map<string, number>();
  seats.set(ALICE, room.seatHuman(ALICE) as number);
  seats.set(BOB, room.seatHuman(BOB) as number);
  room.fillWithAi();
  room.startHand(0);
  registerLiveRoom(roomId, { room, seatFor: (email) => seats.get(email), onClose: opts.onClose });
  registered.push(roomId);
  return room;
}

function url(roomId: string, ticket?: string): string {
  return `ws://127.0.0.1:${port}${ROOM_SOCKET_PREFIX}${roomId}${ticket ? `?ticket=${ticket}` : ''}`;
}

function headersFor(origin: string | undefined): Record<string, string> {
  return origin ? { origin } : {};
}

function refusedWith(target: string, origin?: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target, { headers: headersFor(origin) });
    ws.on('unexpected-response', (_req, res) => { resolve(res.statusCode ?? 0); ws.terminate(); });
    ws.on('open', () => { ws.close(); reject(new Error('handshake accepted')); });
    ws.on('error', () => { /* surfaced via unexpected-response */ });
  });
}

async function connectWith(roomId: string, ticket: string, origin?: string): Promise<Client> {
  const ws = new WebSocket(url(roomId, ticket), { headers: headersFor(origin) });
  open.push(ws);
  const msgs: RoomMessage[] = [];
  ws.on('message', (data) => msgs.push(JSON.parse(String(data))));
  const closed = new Promise<{ code: number; reason: string }>((r) => ws.on('close', (code, reason) => r({ code, reason: String(reason) })));
  await new Promise<void>((resolve, reject) => { ws.once('open', () => resolve()); ws.once('error', reject); });
  return { ws, msgs, closed };
}

async function connect(roomId: string, email: string, origin?: string): Promise<Client> {
  const { ticket } = issueRoomTicket(email, roomId);
  return connectWith(roomId, ticket, origin);
}

describe('isAllowedRoomOrigin', () => {
  it('allows bilko.run and a missing Origin in production, refuses everything else', () => {
    expect(isAllowedRoomOrigin('https://bilko.run', true)).toBe(true);
    expect(isAllowedRoomOrigin('https://www.bilko.run', true)).toBe(true);
    expect(isAllowedRoomOrigin(undefined, true)).toBe(true);
    expect(isAllowedRoomOrigin('', true)).toBe(true);
    expect(isAllowedRoomOrigin('https://evil.example', true)).toBe(false);
    expect(isAllowedRoomOrigin('http://localhost:5173', true)).toBe(false);
    expect(isAllowedRoomOrigin('null', true)).toBe(false);
  });

  it('also allows localhost and 127.0.0.1 outside production', () => {
    expect(isAllowedRoomOrigin('http://localhost:5173', false)).toBe(true);
    expect(isAllowedRoomOrigin('http://127.0.0.1:4000', false)).toBe(true);
    expect(isAllowedRoomOrigin(undefined, false)).toBe(true);
    expect(isAllowedRoomOrigin('https://evil.example', false)).toBe(false);
  });
});

describe('handshake', () => {
  it('a native client with no Origin and a valid ticket joins and gets its state (production)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    liveRoom('r-native');
    const c = await connect('r-native', ALICE);
    await waitFor(() => c.msgs.length > 0);
    const m = c.msgs[0];
    expect(m.type).toBe('state');
    if (m.type !== 'state') throw new Error('unreachable');
    expect(m.seat).toBe(0);
    expect((m.view as { mine: string[] }).mine).toHaveLength(4);
  });

  it('a bilko.run page joins (production)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    liveRoom('r-web');
    const c = await connect('r-web', BOB, 'https://bilko.run');
    await waitFor(() => c.msgs.length > 0);
    expect(c.msgs[0]).toMatchObject({ type: 'state', seat: 1 });
  });

  it('refuses a foreign Origin with 403 in production, without spending the ticket', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    liveRoom('r-evil');
    const { ticket } = issueRoomTicket(ALICE, 'r-evil');
    expect(await refusedWith(url('r-evil', ticket), 'https://evil.example')).toBe(403);
  });

  it('refuses reused, expired, wrong-room and missing tickets with 401', async () => {
    liveRoom('r-a');
    liveRoom('r-b');
    const { ticket } = issueRoomTicket(ALICE, 'r-a');
    await connectWith('r-a', ticket);
    expect(await refusedWith(url('r-a', ticket))).toBe(401);

    const expired = issueRoomTicket(ALICE, 'r-a', Date.now() - ROOM_TICKET_TTL_MS - 1);
    expect(expired.expiresAt).toBeLessThan(Date.now());
    expect(await refusedWith(url('r-a', expired.ticket))).toBe(401);

    const other = issueRoomTicket(ALICE, 'r-b');
    expect(await refusedWith(url('r-a', other.ticket))).toBe(401);
    // single use: the wrong-room attempt burned it
    expect(await refusedWith(url('r-b', other.ticket))).toBe(401);

    expect(await refusedWith(url('r-a'))).toBe(401);
  });

  it('404s a bad room id or a room that is not live', async () => {
    expect(await refusedWith(url('bad%20id', 'x'))).toBe(404);
    const { ticket } = issueRoomTicket(ALICE, 'r-none');
    expect(await refusedWith(url('r-none', ticket))).toBe(404);
  });

  it('does not claim other paths', () => {
    const req = { url: '/api/realtime/rooms/x', headers: {} } as unknown as http.IncomingMessage;
    expect(handleRoomUpgrade(req, {} as any, Buffer.alloc(0))).toBe(false);
  });

  it('closes 4001 when the ticket holder has no seat in the room', async () => {
    liveRoom('r-noseat');
    const c = await connect('r-noseat', 'carol@example.com');
    expect((await c.closed).code).toBe(ROOM_CLOSE.NO_SEAT);
  });
});

describe('frames', () => {
  it('a valid action calls GameRoom.act for the ticket seat and everyone gets the new state', async () => {
    liveRoom('r-act');
    const a = await connect('r-act', ALICE);
    const b = await connect('r-act', BOB);
    await waitFor(() => a.msgs.length > 0 && b.msgs.length > 0);
    const first = a.msgs[0] as Extract<RoomMessage, { type: 'state' }>;
    const discard = (first.view as { mine: string[] }).mine[0];
    a.ws.send(JSON.stringify({ type: 'action', seq: first.seq, action: { discard } }));
    await waitFor(() => a.msgs.length > 1 && b.msgs.length > 1);
    expect(a.msgs[1]).toMatchObject({ type: 'state', seq: first.seq + 1, seat: 0 });
    expect((a.msgs[1] as any).view.discards).toEqual([discard]);
    expect(b.msgs[1]).toMatchObject({ type: 'state', seq: first.seq + 1, seat: 1 });

    // seat 1 is to act now: alice acting again gets an error, sent to alice only
    a.ws.send(JSON.stringify({ type: 'action', seq: first.seq + 1, action: { discard: 'x' } }));
    await waitFor(() => a.msgs.length > 2);
    expect(a.msgs[2]).toMatchObject({ type: 'error', code: 'not_your_turn' });
    expect(b.msgs).toHaveLength(2);
  });

  it.each([
    ['a binary frame', (ws: WebSocket) => ws.send(Buffer.from([1, 2, 3]))],
    ['a text frame over 2048 bytes', (ws: WebSocket) => ws.send(JSON.stringify({ type: 'action', seq: 1, action: 'x'.repeat(ROOM_MAX_FRAME_BYTES) }))],
    ['invalid JSON', (ws: WebSocket) => ws.send('{nope')],
    ['a non-action type', (ws: WebSocket) => ws.send(JSON.stringify({ type: 'chat', seq: 1, action: {} }))],
    ['a non-integer seq', (ws: WebSocket) => ws.send(JSON.stringify({ type: 'action', seq: 1.5, action: {} }))],
    ['a missing action', (ws: WebSocket) => ws.send(JSON.stringify({ type: 'action', seq: 1 }))],
  ])('%s closes 4003', async (_label, send) => {
    liveRoom('r-bad');
    const c = await connect('r-bad', ALICE);
    send(c.ws);
    expect((await c.closed).code).toBe(ROOM_CLOSE.BAD_FRAME);
  });

  it('over 20 messages per second closes 4002', async () => {
    liveRoom('r-rate');
    const c = await connect('r-rate', BOB);
    for (let i = 0; i < 25; i++) c.ws.send(JSON.stringify({ type: 'action', seq: 0, action: {} }));
    expect((await c.closed).code).toBe(ROOM_CLOSE.RATE_LIMITED);
  });
});

describe('reconnect, supersede, drain', () => {
  it('a reconnect gets a resync of only its own view; the other seat hears nothing', async () => {
    const closes: number[] = [];
    liveRoom('r-re', { onClose: (seat) => closes.push(seat) });
    const a = await connect('r-re', ALICE);
    const b = await connect('r-re', BOB);
    await waitFor(() => a.msgs.length > 0 && b.msgs.length > 0);
    const before = a.msgs[0] as Extract<RoomMessage, { type: 'state' }>;
    const bobView = (b.msgs[0] as Extract<RoomMessage, { type: 'state' }>).view as { mine: string[] };

    a.ws.terminate();
    await a.closed;
    await waitFor(() => closes.length === 1);
    expect(closes).toEqual([0]);

    const a2 = await connect('r-re', ALICE);
    await waitFor(() => a2.msgs.length > 0);
    await new Promise((r) => setTimeout(r, 30));
    expect(a2.msgs).toHaveLength(1);
    const after = a2.msgs[0] as Extract<RoomMessage, { type: 'state' }>;
    expect(after).toMatchObject({ type: 'state', seat: 0, seq: before.seq, hand: before.hand });
    const view = after.view as { mine: string[] };
    expect(view.mine).toEqual((before.view as { mine: string[] }).mine);
    for (const t of bobView.mine) expect(view.mine).not.toContain(t);
    expect(JSON.stringify(after)).not.toContain(JSON.stringify(bobView.mine));
    expect(b.msgs).toHaveLength(1);
  });

  it('a second socket for the same seat supersedes the first with 4000', async () => {
    const closes: number[] = [];
    liveRoom('r-sup', { onClose: (seat) => closes.push(seat) });
    const a = await connect('r-sup', ALICE);
    const a2 = await connect('r-sup', ALICE);
    expect((await a.closed).code).toBe(ROOM_CLOSE.SUPERSEDED);
    await waitFor(() => a2.msgs.length > 0);
    expect(a2.msgs[0]).toMatchObject({ type: 'state', seat: 0 });
    expect(closes).toEqual([]);
  });

  it('closeAllGameRooms closes every socket with 1012', async () => {
    liveRoom('r-drain');
    const a = await connect('r-drain', ALICE);
    const b = await connect('r-drain', BOB);
    closeAllGameRooms();
    expect((await a.closed).code).toBe(ROOM_CLOSE.SERVER_RESTART);
    expect((await b.closed).code).toBe(ROOM_CLOSE.SERVER_RESTART);
  });
});
