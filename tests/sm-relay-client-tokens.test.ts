// A paired desktop Session Manager drives the owner's devices as a 'browser'
// without a Clerk session: owner mints a client OTP, the desktop exchanges it for
// a revocable client token, then trades that for role:'browser' WS tickets.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { initDb, dbRun, dbGet } from '../server/db.js';

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return {
    ...original,
    // Test stand-in for a Clerk session: the x-test-email header is the signed-in user.
    requireAuth: vi.fn().mockImplementation(async (req: any, reply: any) => {
      const email = req.headers['x-test-email'];
      if (!email) { reply.status(401).send({ error: 'Sign in required.' }); return null; }
      return email;
    }),
  };
});

const OWNER = 'relay-owner@test.com';
const OTHER = 'someone-else@test.com';
const DEVICE_ID = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b';
const PUB_KEY = 'cHVibGljLWtleQ==';

type Tokens = typeof import('../server/sm-relay/tokens.js');
type Router = typeof import('../server/sm-relay/router.js');

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

let ipSeq = 0;
const freshIp = () => ({ 'x-forwarded-for': `10.1.${Math.floor(ipSeq / 250)}.${ipSeq++ % 250}` });

async function clientOtp(app: FastifyInstance, email = OWNER): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/api/sm-relay/client-otp', headers: { 'x-test-email': email } });
  expect(res.statusCode).toBe(200);
  return res.json().code;
}

async function pairClient(app: FastifyInstance, email = OWNER): Promise<{ clientToken: string; clientId: string }> {
  const code = await clientOtp(app, email);
  const res = await app.inject({
    method: 'POST', url: '/api/sm-relay/client-pair', headers: freshIp(),
    payload: { code, clientName: 'linux-box' },
  });
  expect(res.statusCode).toBe(200);
  return res.json();
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM sm_relay_clients');
  await dbRun('DELETE FROM sm_relay_devices');
});

describe('sm-relay client tokens', () => {
  it('client-otp requires a Clerk session', async () => {
    const { app } = await boot();
    expect((await app.inject({ method: 'POST', url: '/api/sm-relay/client-otp' })).statusCode).toBe(401);
    await app.close();
  });

  it('a paired client gets a role:browser ticket bound to the owner, after a redeploy too', async () => {
    const first = await boot();
    const { clientToken, clientId } = await pairClient(first.app);
    await first.app.close();

    const { app, tokens } = await boot();
    const res = await app.inject({ method: 'POST', url: '/api/sm-relay/client-ticket', headers: bearer(clientToken) });
    expect(res.statusCode).toBe(200);
    expect(tokens.consumeWsTicket(res.json().ticket)).toMatchObject({
      userId: OWNER, email: OWNER, role: 'browser', clientId,
    });
    await app.close();
  });

  it('stores only a hash of the client token', async () => {
    const { app } = await boot();
    const { clientToken, clientId } = await pairClient(app);
    const row = await dbGet<{ token_hash: string }>('SELECT token_hash FROM sm_relay_clients WHERE client_id = ?', clientId);
    expect(row?.token_hash).toBeDefined();
    expect(row?.token_hash).not.toContain(clientToken);
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

    const deviceOtp = await app.inject({ method: 'POST', url: '/api/sm-relay/otp', headers: { 'x-test-email': OWNER } });
    const asClient = await app.inject({
      method: 'POST', url: '/api/sm-relay/client-pair', headers: freshIp(), payload: { code: deviceOtp.json().code },
    });
    expect(asClient.statusCode).toBe(400);
    expect(asClient.json().error).toBe('invalid_code');

    // Neither misuse consumed the code, and minting one kind didn't clobber the other.
    const ok = await app.inject({
      method: 'POST', url: '/api/sm-relay/client-pair', headers: freshIp(), payload: { code: clientCode },
    });
    expect(ok.statusCode).toBe(200);
    await app.close();
  });

  it('a client code is single-use', async () => {
    const { app } = await boot();
    const code = await clientOtp(app);
    expect((await app.inject({ method: 'POST', url: '/api/sm-relay/client-pair', headers: freshIp(), payload: { code } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/sm-relay/client-pair', headers: freshIp(), payload: { code } })).statusCode).toBe(400);
    await app.close();
  });

  it('client device list returns only the owner\'s devices with their pub keys', async () => {
    const { app, tokens } = await boot();
    await tokens.issueDeviceToken(DEVICE_ID, OWNER, OWNER, PUB_KEY);
    await tokens.issueDeviceToken('11111111-2222-4333-8444-555555555555', OTHER, OTHER, PUB_KEY);
    const { clientToken } = await pairClient(app);

    const res = await app.inject({ method: 'GET', url: '/api/sm-relay/client/devices', headers: bearer(clientToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json().devices).toEqual([
      expect.objectContaining({ deviceId: DEVICE_ID, devicePubKey: PUB_KEY, isOnline: false }),
    ]);
    await app.close();
  });

  it('rejects missing, unknown and device tokens', async () => {
    const { app, tokens } = await boot();
    const deviceToken = await tokens.issueDeviceToken(DEVICE_ID, OWNER, OWNER, PUB_KEY);
    expect((await app.inject({ method: 'POST', url: '/api/sm-relay/client-ticket' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/sm-relay/client-ticket', headers: bearer('nope') })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/sm-relay/client-ticket', headers: bearer(deviceToken) })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/sm-relay/client/devices', headers: bearer(deviceToken) })).statusCode).toBe(401);
    await app.close();
  });

  it('enforces the email allowlist at ticket time', async () => {
    const { app } = await boot();
    const { clientToken } = await pairClient(app);
    vi.stubEnv('SM_RELAY_ALLOWED_EMAILS', OTHER);
    try {
      expect((await app.inject({ method: 'POST', url: '/api/sm-relay/client-ticket', headers: bearer(clientToken) })).statusCode).toBe(403);
    } finally {
      vi.unstubAllEnvs();
    }
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

  it('lists clients for the owner only and revokes them', async () => {
    const { app, tokens } = await boot();
    const mine = await pairClient(app);
    const theirs = await pairClient(app, OTHER);

    const list = await app.inject({ method: 'GET', url: '/api/sm-relay/clients', headers: { 'x-test-email': OWNER } });
    expect(list.json().clients).toEqual([
      expect.objectContaining({ clientId: mine.clientId, clientName: 'linux-box', email: OWNER }),
    ]);

    // Someone else's client is invisible to this owner.
    const cross = await app.inject({ method: 'DELETE', url: `/api/sm-relay/clients/${theirs.clientId}`, headers: { 'x-test-email': OWNER } });
    expect(cross.statusCode).toBe(404);
    expect(await tokens.verifyClientToken(theirs.clientToken)).not.toBeNull();

    const held = await app.inject({ method: 'POST', url: '/api/sm-relay/client-ticket', headers: bearer(mine.clientToken) });
    const del = await app.inject({ method: 'DELETE', url: `/api/sm-relay/clients/${mine.clientId}`, headers: { 'x-test-email': OWNER } });
    expect(del.statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/sm-relay/client-ticket', headers: bearer(mine.clientToken) })).statusCode).toBe(401);
    // A ticket fetched just before revocation is dead too.
    expect(tokens.consumeWsTicket(held.json().ticket)).toBeNull();
    await app.close();
  });

  it('revocation closes the client\'s live relay connection only', async () => {
    const { app, router } = await boot();
    const { clientId } = await pairClient(app);
    const fake = (cid?: string) => ({ userId: OWNER, clientId: cid, ws: { readyState: WebSocket.OPEN, close: vi.fn() } });
    const desktop = fake(clientId);
    const phone = fake();
    router.browserConns.set('desktop', desktop as any);
    router.browserConns.set('phone', phone as any);

    await app.inject({ method: 'DELETE', url: `/api/sm-relay/clients/${clientId}`, headers: { 'x-test-email': OWNER } });
    expect(desktop.ws.close).toHaveBeenCalledWith(4001, 'token_revoked');
    expect(phone.ws.close).not.toHaveBeenCalled();
    router.browserConns.clear();
    await app.close();
  });

  it('panic revoke-all also revokes the owner\'s clients', async () => {
    const { app, tokens } = await boot();
    const mine = await pairClient(app);
    const theirs = await pairClient(app, OTHER);
    const res = await app.inject({ method: 'DELETE', url: '/api/sm-relay/devices', headers: { 'x-test-email': OWNER } });
    expect(res.json()).toMatchObject({ ok: true, revokedClientCount: 1 });
    expect(await tokens.verifyClientToken(mine.clientToken)).toBeNull();
    expect(await tokens.verifyClientToken(theirs.clientToken)).not.toBeNull();
    await app.close();
  });
});
