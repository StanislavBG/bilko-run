import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';

// requireAuth is mocked so the lobby routes never hit Clerk's network
vi.mock('../server/clerk.js', () => ({
  requireAuth: vi.fn(),
  ADMIN_EMAILS: [],
}));

import http from 'node:http';
import type { AddressInfo } from 'node:net';
import Fastify from 'fastify';
import WebSocket from 'ws';
import { requireAuth } from '../server/clerk.js';
import { registerRealtimeRoutes, resetRealtimeRateLimits } from '../server/routes/realtime.js';
import { handleUpgrade, issueTicket, closeAllRooms, roomSnapshot, REALTIME_PATH_PREFIX } from '../server/realtime/relay.js';
import { LOBBY_TTL_MS, MAX_LOBBIES, parseLobbyBody, upsertLobby, lobbyCount, resetLobbies } from '../server/realtime/lobbies.js';

const ORIGIN = 'https://bilko.run';
const ROOM = 'ga-ABC234';
const BODY = { app: 'game-academy', gameId: 'tinpot-tanks', host: 'JUNO', humans: 1, bots: 1, capacity: 4 };
const T0 = 1_800_000_000_000;

const app = Fastify({ logger: false });
registerRealtimeRoutes(app);
let server: http.Server;
let port: number;
const sockets: WebSocket[] = [];

beforeAll(async () => {
  server = http.createServer();
  server.on('upgrade', (req, socket, head) => { if (!handleUpgrade(req, socket, head)) socket.destroy(); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
  await app.ready();
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(sockets.splice(0).map((ws) => new Promise<void>((r) => {
    if (ws.readyState === WebSocket.CLOSED) return r();
    ws.once('close', () => r());
    ws.close(1000);
  })));
  closeAllRooms();
  resetLobbies();
  resetRealtimeRateLimits();
  vi.mocked(requireAuth).mockReset();
});

afterAll(async () => {
  await app.close();
  await new Promise<void>((r) => server.close(() => r()));
});

// performance.now, not Date.now: some tests fake Date.
async function waitFor(cond: () => boolean, ms = 3000): Promise<void> {
  const start = performance.now();
  while (!cond()) {
    if (performance.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setImmediate(r));
  }
}

/** The signed-in caller for the next requests; null = signed out. */
function as(email: string | null): void {
  vi.mocked(requireAuth).mockImplementation(async (_req: any, reply: any) => {
    if (email) return email;
    reply.status(401).send({ error: 'Sign in required.' });
    return null;
  });
}

/** Opens a relay socket and waits for its welcome, so `email` holds a seat in `roomId`. */
async function sit(roomId: string, email: string): Promise<WebSocket> {
  const { ticket } = issueTicket(email, roomId);
  const ws = new WebSocket(`ws://127.0.0.1:${port}${REALTIME_PATH_PREFIX}${roomId}?ticket=${ticket}`, { headers: { origin: ORIGIN } });
  sockets.push(ws);
  await new Promise<void>((resolve, reject) => { ws.once('message', () => resolve()); ws.once('error', reject); });
  return ws;
}

const put = (roomId: string, body: unknown = BODY) =>
  app.inject({ method: 'PUT', url: `/api/realtime/lobbies/${roomId}`, payload: body as any });
const del = (roomId: string) => app.inject({ method: 'DELETE', url: `/api/realtime/lobbies/${roomId}` });
const get = (query = '?app=game-academy') => app.inject({ method: 'GET', url: `/api/realtime/lobbies${query}` });
const listed = async (appId = 'game-academy'): Promise<string[]> =>
  (await get(`?app=${appId}`)).json().lobbies.map((l: { roomId: string }) => l.roomId);

describe('GET /api/realtime/lobbies', () => {
  it('publicly lists an announced room while its owner holds a seat, with no emails and no caching', async () => {
    await sit(ROOM, 'host@test.com');
    as('host@test.com');
    const res = await put(ROOM);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, listed: true });

    vi.mocked(requireAuth).mockReset();
    const list = await get();
    expect(list.statusCode).toBe(200);
    expect(list.headers['cache-control']).toBe('no-store');
    expect(list.body).not.toContain('@');
    expect(list.json()).toEqual({
      lobbies: [{ roomId: ROOM, gameId: 'tinpot-tanks', host: 'JUNO', humans: 1, bots: 1, capacity: 4, updatedAt: expect.any(Number) }],
    });
    expect(requireAuth).not.toHaveBeenCalled();
  });

  it('lists only the asked app, newest first, and needs a well-formed app', async () => {
    await sit('ga-AAA222', 'a@test.com');
    await sit('ga-BBB333', 'b@test.com');
    await sit('other-1', 'c@test.com');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    as('a@test.com'); await put('ga-AAA222');
    vi.setSystemTime(T0 + 1000);
    as('b@test.com'); await put('ga-BBB333');
    as('c@test.com'); await put('other-1', { ...BODY, app: 'other-app' });

    expect(await listed()).toEqual(['ga-BBB333', 'ga-AAA222']);
    expect(await listed('other-app')).toEqual(['other-1']);
    expect(await listed('nobody')).toEqual([]);
    expect((await get('')).statusCode).toBe(400);
    expect((await get('?app=Game_Academy')).statusCode).toBe(400);
  });

  it('hides a listing whose owner holds no seat, and shows it once they sit down', async () => {
    as('host@test.com');
    expect((await put(ROOM)).json()).toMatchObject({ ok: true, listed: false });
    expect(await listed()).toEqual([]);
    await sit(ROOM, 'host@test.com');
    expect(await listed()).toEqual([ROOM]);
  });

  it('hides a listing once its owner leaves a room that still has guests', async () => {
    const host = await sit(ROOM, 'host@test.com');
    await sit(ROOM, 'guest@test.com');
    as('host@test.com'); await put(ROOM);
    expect(await listed()).toEqual([ROOM]);
    host.close(1000);
    await waitFor(() => roomSnapshot(ROOM)?.length === 1);
    expect(await listed()).toEqual([]);
  });
});

describe('lobby directory — expiry', () => {
  it('drops a listing 30 s after its last PUT; a heartbeat PUT keeps it', async () => {
    await sit(ROOM, 'host@test.com');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    as('host@test.com'); await put(ROOM);
    vi.setSystemTime(T0 + 20_000);
    expect((await put(ROOM)).statusCode).toBe(200);
    vi.setSystemTime(T0 + 20_000 + LOBBY_TTL_MS - 1);
    expect(await listed()).toEqual([ROOM]);
    vi.setSystemTime(T0 + 20_000 + LOBBY_TTL_MS);
    expect(await listed()).toEqual([]);
    expect(lobbyCount()).toBe(0);

    // An expired room id is free for anyone.
    as('next@test.com');
    expect((await put(ROOM)).statusCode).toBe(200);
  });

  it("drops a listing on its owner's DELETE (204, idempotent)", async () => {
    await sit(ROOM, 'host@test.com');
    as('host@test.com'); await put(ROOM);
    expect((await del(ROOM)).statusCode).toBe(204);
    expect(await listed()).toEqual([]);
    expect((await del(ROOM)).statusCode).toBe(204);
  });

  it('drops a listing as soon as its relay room empties', async () => {
    const host = await sit(ROOM, 'host@test.com');
    as('host@test.com'); await put(ROOM);
    expect(lobbyCount()).toBe(1);
    host.close(1000);
    await waitFor(() => lobbyCount() === 0);
    expect(roomSnapshot(ROOM)).toBeNull();
    // Sitting in the same room id again does not bring the stale listing back.
    await sit(ROOM, 'host@test.com');
    expect(await listed()).toEqual([]);
  });

  it('drops every listing on the deploy drain', async () => {
    await sit(ROOM, 'host@test.com');
    as('host@test.com'); await put(ROOM);
    closeAllRooms();
    expect(lobbyCount()).toBe(0);
  });
});

describe('PUT/DELETE /api/realtime/lobbies/:roomId', () => {
  it('requires a Clerk session', async () => {
    as(null);
    expect((await put(ROOM)).statusCode).toBe(401);
    expect((await del(ROOM)).statusCode).toBe(401);
  });

  it('refuses a different user than the owner with 403', async () => {
    await sit(ROOM, 'host@test.com');
    as('host@test.com'); await put(ROOM);
    as('rival@test.com');
    expect((await put(ROOM, { ...BODY, host: 'RIVAL' })).statusCode).toBe(403);
    expect((await del(ROOM)).statusCode).toBe(403);
    expect((await get()).json().lobbies).toEqual([expect.objectContaining({ roomId: ROOM, host: 'JUNO' })]);
  });

  it.each<[string, unknown]>([
    ['no body', undefined],
    ['an array', [BODY]],
    ['no app', { ...BODY, app: undefined }],
    ['a bad app', { ...BODY, app: 'Game Academy' }],
    ['a bad gameId', { ...BODY, gameId: 'Tinpot Tanks' }],
    ['no host', { ...BODY, host: undefined }],
    ['a blank host', { ...BODY, host: ' \u0007 ' }],
    ['a numeric host', { ...BODY, host: 42 }],
    ['zero humans', { ...BODY, humans: 0 }],
    ['fractional humans', { ...BODY, humans: 1.5 }],
    ['string humans', { ...BODY, humans: '1' }],
    ['negative bots', { ...BODY, bots: -1 }],
    ['capacity over 10', { ...BODY, humans: 1, bots: 0, capacity: 11 }],
    ['more players than capacity', { ...BODY, humans: 3, bots: 2, capacity: 4 }],
  ])('rejects %s with 400', async (_label, body) => {
    as('host@test.com');
    // Straight to inject: put()'s default body would replace an undefined one.
    const res = await app.inject({ method: 'PUT', url: `/api/realtime/lobbies/${ROOM}`, payload: body as any });
    expect(res.statusCode).toBe(400);
    expect(lobbyCount()).toBe(0);
  });

  it('rejects malformed room ids with 400', async () => {
    as('host@test.com');
    expect((await put('ga-ABC.234')).statusCode).toBe(400);
    expect((await put('x'.repeat(65))).statusCode).toBe(400);
    expect((await del('ga-ABC.234')).statusCode).toBe(400);
  });

  it('allows 30 PUTs a minute per user, then answers 429', async () => {
    as('host@test.com');
    for (let i = 0; i < 30; i++) expect((await put(ROOM)).statusCode).toBe(200);
    expect((await put(ROOM)).statusCode).toBe(429);
    as('other@test.com');
    expect((await put('ga-XYZ789')).statusCode).toBe(200);
  });

  it("keeps one listing per owner: a new room replaces the old one and frees its id", async () => {
    await sit('ga-AAA222', 'host@test.com');
    await sit('ga-BBB333', 'host@test.com');
    as('host@test.com');
    await put('ga-AAA222');
    await put('ga-BBB333');
    expect(await listed()).toEqual(['ga-BBB333']);
    expect(lobbyCount()).toBe(1);
    as('next@test.com');
    expect((await put('ga-AAA222')).statusCode).toBe(200);
  });

  it('answers 503 once the directory is full', async () => {
    for (let i = 0; i < MAX_LOBBIES; i++) upsertLobby(`room-${i}`, `u${i}@test.com`, BODY);
    as('late@test.com');
    expect((await put(ROOM)).statusCode).toBe(503);
  });
});

describe('parseLobbyBody', () => {
  it('cleans the host label: controls stripped, trimmed, cut to 16 chars without splitting a surrogate pair', () => {
    const host = (raw: string) => {
      const parsed = parseLobbyBody({ ...BODY, host: raw });
      return 'lobby' in parsed ? parsed.lobby.host : parsed.error;
    };
    expect(host('  MAXIMILIAN_ALEXANDER ')).toBe('MAXIMILIAN_ALEXA');
    expect(host('JU‮NO\u0000')).toBe('JUNO');
    expect(host(`${'A'.repeat(15)}\u{1F600}`)).toBe('A'.repeat(15));
    expect(host(`${'A'.repeat(14)}\u{1F600}`)).toBe(`${'A'.repeat(14)}\u{1F600}`);
  });

  it('drops fields outside the contract', () => {
    expect(parseLobbyBody({ ...BODY, owner: 'evil@test.com', updatedAt: 1 })).toEqual({ lobby: BODY });
  });
});
