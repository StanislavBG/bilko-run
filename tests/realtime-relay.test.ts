import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';

// requireAuth is mocked so the ticket route never hits Clerk's network
vi.mock('../server/clerk.js', () => ({
  requireAuth: vi.fn(),
  ADMIN_EMAILS: [],
}));

import http from 'node:http';
import type { AddressInfo } from 'node:net';
import Fastify from 'fastify';
import WebSocket from 'ws';
import { requireAuth } from '../server/clerk.js';
import { registerRealtimeRoutes, resetRealtimeTicketRate } from '../server/routes/realtime.js';
import {
  handleUpgrade, issueTicket, consumeTicket, isAllowedOrigin, closeAllRooms, roomSnapshot, roomCount,
  REALTIME_PATH_PREFIX, CLOSE, MAX_SEATS, RATE_PER_SEC, SEAT_HOLD_MS, TICKET_TTL_MS, TARGET_BROADCAST, TARGET_ECHO,
} from '../server/realtime/relay.js';

const ORIGIN = 'https://bilko.run';

interface Peer {
  ws: WebSocket;
  seat: number;
  bin: Buffer[];
  events: Array<Record<string, any>>;
  closed: Promise<{ code: number; reason: string }>;
}

let server: http.Server;
let port: number;
const open: WebSocket[] = [];

beforeAll(async () => {
  server = http.createServer();
  server.on('upgrade', (req, socket, head) => { if (!handleUpgrade(req, socket, head)) socket.destroy(); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(open.splice(0).map((ws) => new Promise<void>((r) => {
    if (ws.readyState === WebSocket.CLOSED) return r();
    ws.once('close', () => r());
    ws.close(1000);
  })));
  closeAllRooms();
});

afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); });

// Polls on setImmediate so tests that fake setTimeout can still wait on real sockets.
async function waitFor(cond: () => boolean, ms = 3000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setImmediate(r));
  }
}

function url(roomId: string, ticket?: string): string {
  return `ws://127.0.0.1:${port}${REALTIME_PATH_PREFIX}${roomId}${ticket ? `?ticket=${ticket}` : ''}`;
}

/** Resolves with the HTTP status the handshake was refused with. */
function refusedWith(target: string, origin = ORIGIN): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target, { headers: { origin } });
    ws.on('unexpected-response', (_req, res) => { resolve(res.statusCode ?? 0); ws.terminate(); });
    ws.on('open', () => { ws.close(); reject(new Error('handshake accepted')); });
    ws.on('error', () => { /* surfaced via unexpected-response */ });
  });
}

async function connect(roomId: string, email: string): Promise<Peer> {
  const { ticket } = issueTicket(email, roomId);
  const ws = new WebSocket(url(roomId, ticket), { headers: { origin: ORIGIN } });
  open.push(ws);
  const bin: Buffer[] = [];
  const events: Array<Record<string, any>> = [];
  let welcome: Record<string, any> | null = null;
  ws.on('message', (data, isBinary) => {
    if (isBinary) { bin.push(data as Buffer); return; }
    const msg = JSON.parse(data.toString());
    if (msg.type === 'welcome') welcome = msg; else events.push(msg);
  });
  const closed = new Promise<{ code: number; reason: string }>((r) => ws.on('close', (code, reason) => r({ code, reason: reason.toString() })));
  await waitFor(() => welcome !== null || ws.readyState === WebSocket.CLOSED);
  return { ws, seat: welcome ? (welcome as any).seat : -1, bin, events, closed };
}

const frame = (target: number, ...payload: number[]) => Buffer.from([target, ...payload]);

describe('realtime relay — tickets', () => {
  it('is single use, expires, and is bound to its room', () => {
    const now = Date.now();
    const a = issueTicket('t@test.com', 'room-a', now);
    expect(consumeTicket(a.ticket, 'room-a', now)).toEqual({ ok: true, email: 't@test.com' });
    expect(consumeTicket(a.ticket, 'room-a', now)).toEqual({ ok: false, reason: 'unknown' });

    const b = issueTicket('t@test.com', 'room-a', now);
    expect(consumeTicket(b.ticket, 'room-a', now + TICKET_TTL_MS + 1)).toEqual({ ok: false, reason: 'expired' });

    const c = issueTicket('t@test.com', 'room-a', now);
    expect(consumeTicket(c.ticket, 'room-b', now)).toEqual({ ok: false, reason: 'wrong_room' });
  });

  it('refuses the handshake without a valid ticket', async () => {
    expect(await refusedWith(url('r1'))).toBe(401);
    expect(await refusedWith(url('r1', 'not-a-ticket'))).toBe(401);

    const expired = issueTicket('t@test.com', 'r1', Date.now() - TICKET_TTL_MS - 1).ticket;
    expect(await refusedWith(url('r1', expired))).toBe(401);

    const wrongRoom = issueTicket('t@test.com', 'r2').ticket;
    expect(await refusedWith(url('r1', wrongRoom))).toBe(401);

    const reused = issueTicket('t@test.com', 'r1').ticket;
    const first = new WebSocket(url('r1', reused), { headers: { origin: ORIGIN } });
    open.push(first);
    await new Promise((r) => first.once('open', r));
    expect(await refusedWith(url('r1', reused))).toBe(401);
  });

  it('refuses foreign origins and malformed room ids', async () => {
    expect(await refusedWith(url('r1', issueTicket('t@test.com', 'r1').ticket), 'https://evil.example')).toBe(403);
    expect(await refusedWith(url('bad.room', issueTicket('t@test.com', 'bad.room').ticket))).toBe(404);
    expect(isAllowedOrigin('https://bilko.run', true)).toBe(true);
    expect(isAllowedOrigin('https://www.bilko.run', true)).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173', true)).toBe(false);
    expect(isAllowedOrigin(undefined, true)).toBe(false);
  });
});

describe('realtime relay — fan-out', () => {
  it('relays a frame from one of 10 seats to the other 9, seat-prefixed, never echoed', async () => {
    const peers: Peer[] = [];
    for (let i = 0; i < MAX_SEATS; i++) peers.push(await connect('full', `p${i}@test.com`));
    expect(peers.map((p) => p.seat)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

    const sender = peers[3];
    sender.ws.send(frame(TARGET_BROADCAST, 1, 2, 3));
    const others = peers.filter((p) => p !== sender);
    await waitFor(() => others.every((p) => p.bin.length === 1));
    for (const p of others) expect([...p.bin[0]]).toEqual([3, 1, 2, 3]);

    // A follow-up echo probe proves the broadcast was never echoed back.
    sender.ws.send(frame(TARGET_ECHO, 9));
    await waitFor(() => sender.bin.length === 1);
    expect([...sender.bin[0]]).toEqual([3, 9]);
  });

  it('unicasts to one seat when a target seat is set', async () => {
    const [a, b, c] = [await connect('uni', 'a@test.com'), await connect('uni', 'b@test.com'), await connect('uni', 'c@test.com')];
    a.ws.send(frame(c.seat, 42));
    await waitFor(() => c.bin.length === 1);
    expect([...c.bin[0]]).toEqual([a.seat, 42]);
    a.ws.send(frame(TARGET_ECHO));
    await waitFor(() => a.bin.length === 1);
    expect(b.bin).toHaveLength(0);
  });

  it('closes an 11th player with room_full', async () => {
    for (let i = 0; i < MAX_SEATS; i++) await connect('cap', `cap${i}@test.com`);
    const extra = await connect('cap', 'late@test.com');
    expect((await extra.closed).code).toBe(CLOSE.ROOM_FULL);
  });
});

describe('realtime relay — limits', () => {
  it('kicks a frame over 64 bytes and releases its seat', async () => {
    const a = await connect('size', 'a@test.com');
    const b = await connect('size', 'b@test.com');
    a.ws.send(frame(TARGET_BROADCAST, ...new Array(63).fill(1))); // 64 bytes: ok
    await waitFor(() => b.bin.length === 1);
    a.ws.send(frame(TARGET_BROADCAST, ...new Array(64).fill(1))); // 65 bytes
    expect((await a.closed).code).toBe(CLOSE.FRAME_TOO_LARGE);
    await waitFor(() => b.events.some((e) => e.event === 'leave' && e.seat === a.seat));
    expect(b.bin).toHaveLength(1);
  });

  it('kicks text frames and bad target bytes', async () => {
    const a = await connect('bad', 'a@test.com');
    a.ws.send('hello');
    expect((await a.closed).code).toBe(CLOSE.BAD_FRAME);
    const b = await connect('bad', 'b@test.com');
    b.ws.send(frame(0x20, 1));
    expect((await b.closed).code).toBe(CLOSE.BAD_FRAME);
  });

  it('kicks a socket above the message rate', async () => {
    const a = await connect('rate', 'a@test.com');
    const b = await connect('rate', 'b@test.com');
    for (let i = 0; i < RATE_PER_SEC * 2; i++) a.ws.send(frame(TARGET_BROADCAST, i & 0xff));
    expect((await a.closed).code).toBe(CLOSE.RATE_LIMITED);
    expect(b.bin.length).toBeGreaterThanOrEqual(RATE_PER_SEC);
    expect(b.bin.length).toBeLessThan(RATE_PER_SEC * 2);
  });
});

describe('realtime relay — join, leave, reconnect', () => {
  it('announces join and leave; a 1000 close releases the seat at once', async () => {
    const a = await connect('life', 'a@test.com');
    const b = await connect('life', 'b@test.com');
    await waitFor(() => a.events.some((e) => e.event === 'join' && e.seat === b.seat));
    b.ws.close(1000);
    await waitFor(() => a.events.some((e) => e.event === 'leave' && e.seat === b.seat));
    expect(roomSnapshot('life')!.map((s) => s.seat)).toEqual([a.seat]);
  });

  it('holds a dropped seat and gives it back on reconnect within the hold window', async () => {
    const a = await connect('hold', 'a@test.com');
    const b = await connect('hold', 'b@test.com');
    const c = await connect('hold', 'c@test.com');
    b.ws.terminate(); // network drop, no close frame
    await waitFor(() => a.events.some((e) => e.event === 'drop' && e.seat === b.seat));

    const b2 = await connect('hold', 'b@test.com');
    expect(b2.seat).toBe(b.seat);
    await waitFor(() => a.events.some((e) => e.event === 'reconnect' && e.seat === b.seat));
    expect(c.events.some((e) => e.event === 'leave')).toBe(false);

    a.ws.send(frame(TARGET_BROADCAST, 7));
    await waitFor(() => b2.bin.length === 1 && c.bin.length === 1);
    expect([...b2.bin[0]]).toEqual([a.seat, 7]);
  });

  it('a second socket for the same user supersedes the first and keeps the seat', async () => {
    const a = await connect('sup', 'a@test.com');
    const b = await connect('sup', 'b@test.com');
    const b2 = await connect('sup', 'b@test.com');
    expect(b2.seat).toBe(b.seat);
    expect((await b.closed).code).toBe(CLOSE.SUPERSEDED);
    await waitFor(() => a.events.some((e) => e.event === 'reconnect' && e.seat === b.seat));
    expect(a.events.some((e) => e.event === 'drop' || e.event === 'leave')).toBe(false);
  });

  it('releases a held seat after the hold window', async () => {
    const a = await connect('expire', 'a@test.com');
    const b = await connect('expire', 'b@test.com');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    b.ws.terminate();
    await waitFor(() => a.events.some((e) => e.event === 'drop'));
    vi.advanceTimersByTime(SEAT_HOLD_MS + 1);
    await waitFor(() => a.events.some((e) => e.event === 'leave' && e.seat === b.seat));
    expect(roomSnapshot('expire')!.map((s) => s.email)).toEqual(['a@test.com']);
  });

  it('drains every socket with 1012 on shutdown and forgets the rooms', async () => {
    const a = await connect('drain', 'a@test.com');
    closeAllRooms();
    expect((await a.closed).code).toBe(CLOSE.SERVER_RESTART);
    expect(roomCount()).toBe(0);
  });
});

describe('POST /api/realtime/ticket', () => {
  const app = Fastify({ logger: false });
  registerRealtimeRoutes(app);
  beforeAll(async () => { await app.ready(); });
  afterAll(async () => { await app.close(); });
  afterEach(() => { resetRealtimeTicketRate(); vi.mocked(requireAuth).mockReset(); });

  const post = (body: unknown) => app.inject({ method: 'POST', url: '/api/realtime/ticket', payload: body as any });

  it('requires a Clerk session', async () => {
    vi.mocked(requireAuth).mockImplementation(async (_req: any, reply: any) => { reply.status(401).send({ error: 'Sign in required.' }); return null; });
    expect((await post({ roomId: 'x' })).statusCode).toBe(401);
  });

  it('returns a ticket that opens the room socket', async () => {
    vi.mocked(requireAuth).mockResolvedValue('route@test.com');
    const res = await post({ roomId: 'via-route' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.path).toBe(`${REALTIME_PATH_PREFIX}via-route?ticket=${body.ticket}`);
    const ws = new WebSocket(`ws://127.0.0.1:${port}${body.path}`, { headers: { origin: ORIGIN } });
    open.push(ws);
    const welcome = await new Promise<any>((r) => ws.once('message', (d) => r(JSON.parse(d.toString()))));
    expect(welcome).toMatchObject({ type: 'welcome', roomId: 'via-route', seat: 0 });
    expect(roomSnapshot('via-route')).toEqual([{ seat: 0, email: 'route@test.com', connected: true }]);
  });

  it('rejects bad room ids and full rooms', async () => {
    vi.mocked(requireAuth).mockResolvedValue('late@test.com');
    expect((await post({ roomId: '../etc' })).statusCode).toBe(400);
    expect((await post({})).statusCode).toBe(400);
    for (let i = 0; i < MAX_SEATS; i++) await connect('route-full', `f${i}@test.com`);
    expect((await post({ roomId: 'route-full' })).statusCode).toBe(409);
  });

  it('rate-limits ticket minting per user', async () => {
    vi.mocked(requireAuth).mockResolvedValue('spam@test.com');
    for (let i = 0; i < 30; i++) expect((await post({ roomId: 'spam' })).statusCode).toBe(200);
    expect((await post({ roomId: 'spam' })).statusCode).toBe(429);
  });
});
