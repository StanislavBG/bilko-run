// A paired headless service drives the owner's devices as a 'browser' without a Clerk
// session: the owner (Clerk session, or a paired desktop's device token) mints a client
// code, the service redeems it for a revocable client token, then trades that for
// role:'browser' WS tickets. Its socket is an ordinary browser conn of the same account.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import crypto from 'node:crypto';
import WebSocket from 'ws';
import { initDb, dbRun, dbGet, dbAll } from '../server/db.js';

// Clerk sessions in tests: "a.<base64url email>.sig" (JWT-shaped, two dots) resolves to the email.
vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return {
    ...original,
    requireAuth: vi.fn().mockImplementation(async (req: any, reply: any) => {
      const h: string = req.headers.authorization ?? '';
      const parts = h.startsWith('Bearer ') ? h.slice(7).split('.') : [];
      if (parts.length === 3 && parts[0] === 'a' && parts[2] === 'sig') {
        return Buffer.from(parts[1], 'base64url').toString('utf8');
      }
      reply.status(401).send({ error: 'Sign in required.' });
      return null;
    }),
  };
});

const OWNER = 'relay-owner@test.com';
const OTHER = 'someone-else@test.com';
const DEVICE_ID = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b';
const OTHER_DEVICE_ID = '11111111-2222-4333-8444-555555555555';
const PUB_KEY = 'cHVibGljLWtleQ==';

type Tokens = typeof import('../server/sm-relay/tokens.js');
type Router = typeof import('../server/sm-relay/router.js');
type Msg = Record<string, any>;

const clerk = (email: string) => ({ authorization: `Bearer a.${Buffer.from(email).toString('base64url')}.sig` });
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
let ipSeq = 0;
const freshIp = () => ({ 'x-forwarded-for': `10.1.${Math.floor(ipSeq / 250)}.${ipSeq++ % 250}` });

/** Simulates a fresh deploy: new module instances (empty in-process maps), same DB. */
async function boot(): Promise<{ app: FastifyInstance; tokens: Tokens; router: Router }> {
  vi.resetModules();
  const tokens = await import('../server/sm-relay/tokens.js');
  const router = await import('../server/sm-relay/router.js');
  const { registerSmRelayRoutes } = await import('../server/routes/sm-relay.js');
  const app = Fastify();
  registerSmRelayRoutes(app);
  await app.ready();
  return { app, tokens, router };
}

async function clientOtp(app: FastifyInstance, headers: Record<string, string> = clerk(OWNER)): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/sm-relay/client-otp', headers });
  expect(res.statusCode).toBe(200);
  return res.json().code;
}

async function pairClient(
  app: FastifyInstance,
  headers: Record<string, string> = clerk(OWNER),
): Promise<{ clientToken: string; clientId: string }> {
  const code = await clientOtp(app, headers);
  const res = await app.inject({
    method: 'POST', url: '/api/sm-relay/client-pair', headers: freshIp(),
    payload: { code, clientName: 'idea-board' },
  });
  expect(res.statusCode).toBe(200);
  return res.json();
}

async function waitFor(cond: () => boolean, ms = 2000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
}

interface Peer {
  ws: WebSocket;
  msgs: Msg[];
  closed: { code?: number; reason?: string };
  next: (pred: (m: Msg) => boolean) => Promise<Msg>;
}

const sockets: WebSocket[] = [];
const cleanups: Array<() => Promise<void>> = [];

/** An http server wired to this boot's relay upgrade handler. */
async function relayServer(router: Router): Promise<number> {
  const server = http.createServer();
  server.on('upgrade', (req, socket, head) => { if (!router.handleUpgrade(req, socket, head)) socket.destroy(); });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  cleanups.push(() => new Promise<void>((r) => server.close(() => r())));
  return (server.address() as AddressInfo).port;
}

async function connect(port: number, ticket: string): Promise<Peer> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/projects/session-manager/relay?ticket=${ticket}`);
  sockets.push(ws);
  const msgs: Msg[] = [];
  const closed: Peer['closed'] = {};
  ws.on('message', (d) => msgs.push(JSON.parse(d.toString())));
  ws.on('close', (code, reason) => { closed.code = code; closed.reason = reason.toString(); });
  const next = async (pred: (m: Msg) => boolean): Promise<Msg> => {
    await waitFor(() => msgs.some(pred));
    return msgs.splice(msgs.findIndex(pred), 1)[0];
  };
  await next((m) => m.type === 'auth:ok');
  return { ws, msgs, closed, next };
}

async function ticketFor(app: FastifyInstance, url: string, token: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url, headers: bearer(token) });
  expect(res.statusCode).toBe(200);
  return res.json().ticket;
}

const env = (type: string, extra: Msg = {}) => JSON.stringify({ type, id: crypto.randomUUID(), ts: Date.now(), ...extra });

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM sm_relay_paired_clients');
  await dbRun('DELETE FROM sm_relay_devices');
});

afterEach(async () => {
  await Promise.all(sockets.splice(0).map((ws) => new Promise<void>((r) => {
    if (ws.readyState === WebSocket.CLOSED) return r();
    ws.once('close', () => r());
    ws.close();
  })));
  for (const c of cleanups.splice(0)) await c();
  vi.unstubAllEnvs();
});

describe('sm-relay client tokens: pairing', () => {
  it('a paired client gets a role:browser ticket bound to the owner, after a redeploy too', async () => {
    const first = await boot();
    const { clientToken, clientId } = await pairClient(first.app);
    await first.app.close();

    const { app, tokens } = await boot();
    const ticket = await ticketFor(app, '/api/sm-relay/client-ticket', clientToken);
    expect(tokens.consumeWsTicket(ticket)).toEqual({
      userId: OWNER, email: OWNER, role: 'browser', clientId, expiresAt: expect.any(Number),
    });
    await app.close();
  });

  it('client-otp works with a Clerk session and with a device token, for that account only', async () => {
    const { app, tokens } = await boot();
    const viaClerk = await pairClient(app, clerk(OWNER));
    const deviceToken = await tokens.issueDeviceToken(DEVICE_ID, OWNER, OWNER, PUB_KEY);
    const viaDevice = await pairClient(app, bearer(deviceToken));
    expect(await tokens.verifyClientToken(viaClerk.clientToken)).toMatchObject({ userId: OWNER });
    expect(await tokens.verifyClientToken(viaDevice.clientToken)).toMatchObject({ userId: OWNER, email: OWNER });

    // Another account's device token mints codes for that other account, never this one.
    const otherDeviceToken = await tokens.issueDeviceToken(OTHER_DEVICE_ID, OTHER, OTHER, PUB_KEY);
    const theirs = await pairClient(app, bearer(otherDeviceToken));
    expect(await tokens.verifyClientToken(theirs.clientToken)).toMatchObject({ userId: OTHER });
    await app.close();
  });

  it('client-otp answers 401 for a missing, bad, unknown, revoked or client token', async () => {
    const { app, tokens } = await boot();
    const otp = (headers: Record<string, string> = {}) =>
      app.inject({ method: 'POST', url: '/api/sm-relay/client-otp', headers });

    expect((await otp()).statusCode).toBe(401);
    expect((await otp(bearer('a.bad.jwt'))).statusCode).toBe(401);
    expect((await otp(bearer('not-a-token'))).statusCode).toBe(401);
    expect((await otp(bearer(crypto.randomBytes(32).toString('base64url')))).statusCode).toBe(401);

    const deviceToken = await tokens.issueDeviceToken(DEVICE_ID, OWNER, OWNER, PUB_KEY);
    await tokens.revokeDevice(DEVICE_ID);
    const revoked = await otp(bearer(deviceToken));
    expect(revoked.statusCode).toBe(401);
    expect(revoked.json().error).toBe('invalid_token');

    // A paired service can never mint more pairing codes.
    const { clientToken } = await pairClient(app);
    expect((await otp(bearer(clientToken))).statusCode).toBe(401);
    await app.close();
  });

  it('client-otp enforces the email allowlist for device tokens too', async () => {
    const { app, tokens } = await boot();
    const deviceToken = await tokens.issueDeviceToken(DEVICE_ID, OWNER, OWNER, PUB_KEY);
    vi.stubEnv('SM_RELAY_ALLOWED_EMAILS', OTHER);
    const res = await app.inject({ method: 'POST', url: '/api/sm-relay/client-otp', headers: bearer(deviceToken) });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('stores only a hash of the client token', async () => {
    const { app } = await boot();
    const { clientToken, clientId } = await pairClient(app);
    const rows = await dbAll<Record<string, unknown>>('SELECT * FROM sm_relay_paired_clients WHERE client_id = ?', clientId);
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toBe(crypto.createHash('sha256').update(clientToken).digest('hex'));
    expect(JSON.stringify(rows[0])).not.toContain(clientToken);
    await app.close();
  });

  it('client and device pairing codes are not interchangeable', async () => {
    const { app } = await boot();
    const clientCode = await clientOtp(app);
    const asDevice = await app.inject({
      method: 'POST', url: '/api/sm-relay/pair', headers: freshIp(),
      payload: { code: clientCode, deviceId: DEVICE_ID, devicePubKey: PUB_KEY },
    });
    expect(asDevice.statusCode).toBe(400);
    expect(asDevice.json().error).toBe('invalid_code');

    const deviceOtp = await app.inject({ method: 'POST', url: '/api/sm-relay/otp', headers: clerk(OWNER) });
    const asClient = await app.inject({
      method: 'POST', url: '/api/sm-relay/client-pair', headers: freshIp(), payload: { code: deviceOtp.json().code },
    });
    expect(asClient.statusCode).toBe(400);
    expect(asClient.json().error).toBe('invalid_code');

    // Neither misuse consumed a code, and minting one kind didn't clobber the other.
    const okClient = await app.inject({
      method: 'POST', url: '/api/sm-relay/client-pair', headers: freshIp(), payload: { code: clientCode },
    });
    expect(okClient.statusCode).toBe(200);
    const okDevice = await app.inject({
      method: 'POST', url: '/api/sm-relay/pair', headers: freshIp(),
      payload: { code: deviceOtp.json().code, deviceId: DEVICE_ID, devicePubKey: PUB_KEY },
    });
    expect(okDevice.statusCode).toBe(200);
    await app.close();
  });

  it('a client code is single-use and the client name is bounded', async () => {
    const { app } = await boot();
    const code = await clientOtp(app);
    const redeem = (payload: Record<string, unknown>) =>
      app.inject({ method: 'POST', url: '/api/sm-relay/client-pair', headers: freshIp(), payload });
    expect((await redeem({ code, clientName: 'x'.repeat(65) })).json().error).toBe('invalid_client_name');
    expect((await redeem({ code })).statusCode).toBe(200);
    expect((await redeem({ code })).statusCode).toBe(400);
    await app.close();
  });

  it('client device list returns only the owner\'s devices with their pub keys', async () => {
    const { app, tokens } = await boot();
    await tokens.issueDeviceToken(DEVICE_ID, OWNER, OWNER, PUB_KEY);
    await tokens.issueDeviceToken(OTHER_DEVICE_ID, OTHER, OTHER, 'b3RoZXIta2V5');
    const { clientToken } = await pairClient(app);

    const res = await app.inject({ method: 'GET', url: '/api/sm-relay/client/devices', headers: bearer(clientToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json().devices).toEqual([
      expect.objectContaining({ deviceId: DEVICE_ID, devicePubKey: PUB_KEY, isOnline: false }),
    ]);
    await app.close();
  });

  it('client routes reject missing, unknown and device tokens', async () => {
    const { app, tokens } = await boot();
    const deviceToken = await tokens.issueDeviceToken(DEVICE_ID, OWNER, OWNER, PUB_KEY);
    for (const [method, url] of [['POST', '/api/sm-relay/client-ticket'], ['GET', '/api/sm-relay/client/devices']] as const) {
      expect((await app.inject({ method, url })).statusCode).toBe(401);
      expect((await app.inject({ method, url, headers: bearer('nope') })).statusCode).toBe(401);
      expect((await app.inject({ method, url, headers: bearer(deviceToken) })).statusCode).toBe(401);
      expect((await app.inject({ method, url, headers: clerk(OWNER) })).statusCode).toBe(401);
    }
    await app.close();
  });

  it('enforces the email allowlist at ticket time', async () => {
    const { app } = await boot();
    const { clientToken } = await pairClient(app);
    vi.stubEnv('SM_RELAY_ALLOWED_EMAILS', OTHER);
    expect((await app.inject({ method: 'POST', url: '/api/sm-relay/client-ticket', headers: bearer(clientToken) })).statusCode).toBe(403);
    await app.close();
  });

  it('rate-limits client tickets per token', async () => {
    const { app } = await boot();
    const { clientToken } = await pairClient(app);
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) {
      codes.push((await app.inject({ method: 'POST', url: '/api/sm-relay/client-ticket', headers: bearer(clientToken) })).statusCode);
    }
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
    expect(codes[10]).toBe(429);
    await app.close();
  });
});

describe('sm-relay client tokens: routing', () => {
  it('a client socket reaches its owner\'s device and never another account\'s device', async () => {
    const { app, tokens, router } = await boot();
    const port = await relayServer(router);
    const ownerDeviceToken = await tokens.issueDeviceToken(DEVICE_ID, OWNER, OWNER, PUB_KEY);
    const otherDeviceToken = await tokens.issueDeviceToken(OTHER_DEVICE_ID, OTHER, OTHER, PUB_KEY);
    const dev = await connect(port, await ticketFor(app, '/api/sm-relay/device-ticket', ownerDeviceToken));
    const otherDev = await connect(port, await ticketFor(app, '/api/sm-relay/device-ticket', otherDeviceToken));

    const { clientToken } = await pairClient(app);
    const svc = await connect(port, await ticketFor(app, '/api/sm-relay/client-ticket', clientToken));
    // A browser conn: it is told which of its owner's devices are online, and only those.
    await svc.next((m) => m.type === 'event:device:status' && m.deviceId === DEVICE_ID);
    expect(svc.msgs.some((m) => m.deviceId === OTHER_DEVICE_ID)).toBe(false);
    const connId = [...router.browserConns.values()].find((c) => c.userId === OWNER)!.id;

    svc.ws.send(env('e2e:hello', { deviceId: DEVICE_ID, fromConn: 'spoofed' }));
    const hello = await dev.next((m) => m.type === 'e2e:hello');
    expect(hello.fromConn).toBe(connId);
    expect(hello).not.toHaveProperty('fromClientId');

    svc.ws.send(env('e2e:hello', { deviceId: OTHER_DEVICE_ID }));
    expect((await svc.next((m) => m.type === 'error')).code).toBe('not_your_device');

    // Device replies unicast to the service conn; the other account's device can't reach it.
    dev.ws.send(env('e2e:box', { toConn: connId, payload: 'for-svc' }));
    expect((await svc.next((m) => m.type === 'e2e:box')).payload).toBe('for-svc');
    otherDev.ws.send(env('e2e:box', { toConn: connId, payload: 'leak' }));
    otherDev.ws.send(env('event:session:list'));
    dev.ws.send(env('marker'));
    await svc.next((m) => m.type === 'marker');
    expect(svc.msgs.some((m) => m.payload === 'leak' || m.type === 'event:session:list')).toBe(false);
    expect(otherDev.msgs.some((m) => m.type === 'e2e:hello')).toBe(false);
    await app.close();
  });

  it('a device token revokes a same-account client and closes its socket; other accounts\' clients are 404', async () => {
    const { app, tokens, router } = await boot();
    const port = await relayServer(router);
    const deviceToken = await tokens.issueDeviceToken(DEVICE_ID, OWNER, OWNER, PUB_KEY);
    const dev = await connect(port, await ticketFor(app, '/api/sm-relay/device-ticket', deviceToken));
    const mine = await pairClient(app, bearer(deviceToken));
    const theirs = await pairClient(app, clerk(OTHER));
    const svc = await connect(port, await ticketFor(app, '/api/sm-relay/client-ticket', mine.clientToken));
    const phone = await connect(port, (await app.inject({ method: 'POST', url: '/api/sm-relay/ws-ticket', headers: clerk(OWNER) })).json().ticket);
    const held = await ticketFor(app, '/api/sm-relay/client-ticket', mine.clientToken);

    const list = await app.inject({ method: 'GET', url: '/api/sm-relay/clients', headers: bearer(deviceToken) });
    expect(list.json().clients).toEqual([
      { clientId: mine.clientId, email: OWNER, clientName: 'idea-board', issuedAt: expect.any(Number), expiresAt: null },
    ]);

    const cross = await app.inject({ method: 'DELETE', url: `/api/sm-relay/clients/${theirs.clientId}`, headers: bearer(deviceToken) });
    expect(cross.statusCode).toBe(404);
    expect(await tokens.verifyClientToken(theirs.clientToken)).not.toBeNull();

    // A client token cannot revoke clients.
    const bySvc = await app.inject({ method: 'DELETE', url: `/api/sm-relay/clients/${mine.clientId}`, headers: bearer(mine.clientToken) });
    expect(bySvc.statusCode).toBe(401);

    const del = await app.inject({ method: 'DELETE', url: `/api/sm-relay/clients/${mine.clientId}`, headers: bearer(deviceToken) });
    expect(del.statusCode).toBe(200);
    await waitFor(() => svc.closed.code !== undefined);
    expect(svc.closed).toEqual({ code: 4001, reason: 'token_revoked' });
    expect((await dev.next((m) => m.type === 'event:client:disconnected')).reason).toBe('token_revoked');
    expect(phone.ws.readyState).toBe(WebSocket.OPEN);
    expect((await app.inject({ method: 'POST', url: '/api/sm-relay/client-ticket', headers: bearer(mine.clientToken) })).statusCode).toBe(401);
    // A ticket fetched just before revocation is dead too.
    expect(tokens.consumeWsTicket(held)).toBeNull();
    await app.close();
  });

  it('a Clerk session lists and revokes its own clients only', async () => {
    const { app, tokens } = await boot();
    const mine = await pairClient(app, clerk(OWNER));
    const theirs = await pairClient(app, clerk(OTHER));
    const list = await app.inject({ method: 'GET', url: '/api/sm-relay/clients', headers: clerk(OWNER) });
    expect(list.json().clients.map((c: { clientId: string }) => c.clientId)).toEqual([mine.clientId]);
    expect((await app.inject({ method: 'DELETE', url: `/api/sm-relay/clients/${theirs.clientId}`, headers: clerk(OWNER) })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/api/sm-relay/clients/${mine.clientId}`, headers: clerk(OWNER) })).statusCode).toBe(200);
    expect(await tokens.verifyClientToken(mine.clientToken)).toBeNull();
    expect(await tokens.verifyClientToken(theirs.clientToken)).not.toBeNull();
    await app.close();
  });

  it('panic revoke-all also revokes the owner\'s clients and closes their sockets', async () => {
    const { app, tokens, router } = await boot();
    const port = await relayServer(router);
    const mine = await pairClient(app);
    const theirs = await pairClient(app, clerk(OTHER));
    const svc = await connect(port, await ticketFor(app, '/api/sm-relay/client-ticket', mine.clientToken));
    const theirSvc = await connect(port, await ticketFor(app, '/api/sm-relay/client-ticket', theirs.clientToken));

    const res = await app.inject({ method: 'DELETE', url: '/api/sm-relay/devices', headers: clerk(OWNER) });
    expect(res.json()).toEqual({ ok: true, revokedCount: 0, revokedClientCount: 1 });
    expect(await tokens.verifyClientToken(mine.clientToken)).toBeNull();
    expect(await tokens.verifyClientToken(theirs.clientToken)).not.toBeNull();
    await waitFor(() => svc.closed.code !== undefined);
    expect(svc.closed.code).toBe(4001);
    expect(theirSvc.ws.readyState).toBe(WebSocket.OPEN);
    await app.close();
  });
});

describe('sm-relay client tokens: storage', () => {
  it('boot drops the legacy client-token table, so its tokens never verify', async () => {
    await dbRun(`CREATE TABLE IF NOT EXISTS sm_relay_clients (
      client_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL,
      email TEXT NOT NULL, client_name TEXT NOT NULL, issued_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
    )`);
    const legacyToken = crypto.randomBytes(32).toString('base64url');
    await dbRun(
      'INSERT INTO sm_relay_clients VALUES (?, ?, ?, ?, ?, ?, ?)',
      'legacy-client', crypto.createHash('sha256').update(legacyToken).digest('hex'), OWNER, OWNER, 'desk', Date.now(), 0,
    );
    await initDb();
    expect(await dbGet("SELECT name FROM sqlite_master WHERE name = 'sm_relay_clients'")).toBeUndefined();
    const { app } = await boot();
    expect((await app.inject({ method: 'POST', url: '/api/sm-relay/client-ticket', headers: bearer(legacyToken) })).statusCode).toBe(401);
    await app.close();
  });
});
