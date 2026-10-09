// Device tokens must survive a redeploy (fresh process state, same DB) while
// revocation still takes effect immediately. Wire protocol is unchanged.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { initDb, dbRun, dbGet } from '../server/db.js';

const USER = 'relay-owner@test.com';
const DEVICE_ID = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b';
const PUB_KEY = 'cHVibGljLWtleQ==';

type Tokens = typeof import('../server/sm-relay/tokens.js');

/** Simulates a fresh deploy: new module instances (empty in-process maps), same DB. */
async function boot(): Promise<{ app: FastifyInstance; tokens: Tokens }> {
  vi.resetModules();
  const tokens = await import('../server/sm-relay/tokens.js');
  const { registerSmRelayRoutes } = await import('../server/routes/sm-relay.js');
  const app = Fastify();
  registerSmRelayRoutes(app);
  await app.ready();
  return { app, tokens };
}

async function pair(app: FastifyInstance, tokens: Tokens, deviceId = DEVICE_ID): Promise<string> {
  const otp = tokens.issueOtp(USER, USER);
  if (!('code' in otp)) throw new Error('otp issue failed');
  const res = await app.inject({
    method: 'POST', url: '/api/sm-relay/pair',
    headers: { 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` },
    payload: { code: otp.code, deviceId, devicePubKey: PUB_KEY },
  });
  expect(res.statusCode).toBe(200);
  return res.json().deviceToken;
}

function deviceTicket(app: FastifyInstance, token: string) {
  return app.inject({
    method: 'POST', url: '/api/sm-relay/device-ticket',
    headers: { authorization: `Bearer ${token}` },
  });
}

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM sm_relay_devices');
});

describe('sm-relay device token persistence', () => {
  it('a paired device still gets a WS ticket after a redeploy', async () => {
    const first = await boot();
    const token = await pair(first.app, first.tokens);
    await first.app.close();

    const second = await boot();
    const res = await deviceTicket(second.app, token);
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().ticket).toBe('string');
    expect(second.tokens.consumeWsTicket(res.json().ticket)).toMatchObject({
      userId: USER, role: 'agent', deviceId: DEVICE_ID,
    });
    await second.app.close();
  });

  it('stores only a hash of the token', async () => {
    const { app, tokens } = await boot();
    const token = await pair(app, tokens);
    const row = await dbGet<{ token_hash: string }>('SELECT token_hash FROM sm_relay_devices WHERE device_id = ?', DEVICE_ID);
    expect(row?.token_hash).toBeDefined();
    expect(row?.token_hash).not.toContain(token);
    await app.close();
  });

  it('revocation takes effect immediately and survives a redeploy', async () => {
    const first = await boot();
    const token = await pair(first.app, first.tokens);
    expect(await first.tokens.revokeDevice(DEVICE_ID)).toBe(true);
    expect((await deviceTicket(first.app, token)).statusCode).toBe(401);
    await first.app.close();

    const second = await boot();
    expect((await deviceTicket(second.app, token)).statusCode).toBe(401);
    await second.app.close();
  });

  it('revoke-all removes every device for the user only', async () => {
    const { app, tokens } = await boot();
    const a = await pair(app, tokens);
    const b = await pair(app, tokens, '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d');
    await tokens.issueDeviceToken('11111111-2222-4333-8444-555555555555', 'other@test.com', 'other@test.com', PUB_KEY);

    const revoked = await tokens.revokeAllDevicesForUser(USER);
    expect(revoked.sort()).toEqual([DEVICE_ID, '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'].sort());
    expect(await tokens.verifyDeviceToken(a)).toBeNull();
    expect(await tokens.verifyDeviceToken(b)).toBeNull();
    expect(await tokens.getDevicesForUser('other@test.com')).toHaveLength(1);
    await app.close();
  });

  it('re-pairing a device invalidates its previous token', async () => {
    const { app, tokens } = await boot();
    const oldToken = await pair(app, tokens);
    const newToken = await pair(app, tokens);
    expect(await tokens.verifyDeviceToken(oldToken)).toBeNull();
    expect(await tokens.verifyDeviceToken(newToken)).toMatchObject({ deviceId: DEVICE_ID, userId: USER });
    expect(await tokens.getDevicesForUser(USER)).toHaveLength(1);
    await app.close();
  });

  it('expired tokens are rejected and purged', async () => {
    const { tokens } = await boot();
    const issuedAt = Date.now() - 100 * 24 * 60 * 60 * 1000;
    const token = await tokens.issueDeviceToken(DEVICE_ID, USER, USER, PUB_KEY, issuedAt);
    expect(await tokens.verifyDeviceToken(token)).toBeNull();
    expect(await tokens.getDevice(DEVICE_ID)).toBeNull();

    await tokens.issueDeviceToken(DEVICE_ID, USER, USER, PUB_KEY, issuedAt);
    await tokens.purgeExpired();
    expect(await dbGet('SELECT 1 FROM sm_relay_devices WHERE device_id = ?', DEVICE_ID)).toBeUndefined();
  });
});
