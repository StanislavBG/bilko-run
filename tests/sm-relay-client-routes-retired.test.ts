// Desktop-to-desktop pairing is retired: the relay serves no desktop-client route,
// and boot destroys every client token issued before, so none can buy a browser
// WS ticket without a Clerk session. Phone/browser pairing is unaffected.
import { describe, it, expect, beforeAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { initDb, dbRun, dbGet } from '../server/db.js';
import { registerSmRelayRoutes } from '../server/routes/sm-relay.js';
import { consumeWsTicket } from '../server/sm-relay/tokens.js';

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
const DEVICE_ID = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b';
const PUB_KEY = 'cHVibGljLWtleQ==';

const RETIRED: Array<{ method: 'GET' | 'POST' | 'DELETE'; url: string }> = [
  { method: 'POST', url: '/api/sm-relay/client-otp' },
  { method: 'POST', url: '/api/sm-relay/client-pair' },
  { method: 'POST', url: '/api/sm-relay/client-ticket' },
  { method: 'GET', url: '/api/sm-relay/client/devices' },
  { method: 'GET', url: '/api/sm-relay/clients' },
  { method: 'DELETE', url: '/api/sm-relay/clients/11111111-2222-4333-8444-555555555555' },
];

let app: FastifyInstance;

beforeAll(async () => {
  await initDb();
  app = Fastify();
  registerSmRelayRoutes(app);
  await app.ready();
});

describe('sm-relay desktop-client routes are retired', () => {
  it.each(RETIRED)('$method $url is not served', async ({ method, url }) => {
    const res = await app.inject({
      method, url,
      headers: { 'x-test-email': OWNER, authorization: 'Bearer some-old-client-token' },
      payload: method === 'POST' ? { code: 'ACDEFGHJ', clientName: 'desk' } : undefined,
    });
    expect(res.statusCode).toBe(404);
  });

  it('boot drops the legacy client-token table, so issued client tokens are gone', async () => {
    await dbRun(`CREATE TABLE IF NOT EXISTS sm_relay_clients (
      client_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL,
      email TEXT NOT NULL, client_name TEXT NOT NULL, issued_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
    )`);
    await dbRun(
      'INSERT INTO sm_relay_clients VALUES (?, ?, ?, ?, ?, ?, ?)',
      'legacy-client', 'legacy-hash', OWNER, OWNER, 'desk', Date.now(), 0,
    );
    await initDb();
    expect(await dbGet("SELECT name FROM sqlite_master WHERE name = 'sm_relay_clients'")).toBeUndefined();
  });

  it('phone pairing and browser tickets still work', async () => {
    const otp = await app.inject({ method: 'POST', url: '/api/sm-relay/otp', headers: { 'x-test-email': OWNER } });
    expect(otp.statusCode).toBe(200);
    const pair = await app.inject({
      method: 'POST', url: '/api/sm-relay/pair', headers: { 'x-forwarded-for': '10.9.0.1' },
      payload: { code: otp.json().code, deviceId: DEVICE_ID, devicePubKey: PUB_KEY },
    });
    expect(pair.statusCode).toBe(200);

    const ticket = await app.inject({ method: 'POST', url: '/api/sm-relay/ws-ticket', headers: { 'x-test-email': OWNER } });
    expect(ticket.statusCode).toBe(200);
    expect(consumeWsTicket(ticket.json().ticket)).toEqual({
      userId: OWNER, email: OWNER, role: 'browser', expiresAt: expect.any(Number),
    });

    const panic = await app.inject({ method: 'DELETE', url: '/api/sm-relay/devices', headers: { 'x-test-email': OWNER } });
    expect(panic.json()).toEqual({ ok: true, revokedCount: 1 });
  });
});
