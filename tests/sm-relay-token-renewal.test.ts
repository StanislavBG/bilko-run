// Relay tokens expire on a sliding window: a token in use stays paired forever,
// an idle one still lapses after the TTL, and revocation still wins immediately.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initDb, dbRun, dbGet } from '../server/db.js';
import {
  issueDeviceToken, verifyDeviceToken, revokeDevice,
  issueClientToken, verifyClientToken, revokeClient,
} from '../server/sm-relay/tokens.js';

const USER = 'relay-owner@test.com';
const DEVICE_ID = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b';
const PUB_KEY = 'cHVibGljLWtleQ==';
const DAY = 24 * 60 * 60 * 1000;
const TTL = 90 * DAY;
const T0 = 1_800_000_000_000;

const deviceExpiry = async () =>
  Number((await dbGet<{ expires_at: number }>('SELECT expires_at FROM sm_relay_devices WHERE device_id = ?', DEVICE_ID))?.expires_at);
const clientExpiry = async (clientId: string) =>
  Number((await dbGet<{ expires_at: number }>('SELECT expires_at FROM sm_relay_clients WHERE client_id = ?', clientId))?.expires_at);

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM sm_relay_devices');
  await dbRun('DELETE FROM sm_relay_clients');
});

describe('sm-relay device token sliding expiry', () => {
  it('leaves a recently issued token alone', async () => {
    const token = await issueDeviceToken(DEVICE_ID, USER, USER, PUB_KEY, T0);
    const rec = await verifyDeviceToken(token, T0 + 5 * DAY);
    expect(rec?.expiresAt).toBe(T0 + TTL);
    expect(await deviceExpiry()).toBe(T0 + TTL);
  });

  it('renews an aging token to a full TTL from now', async () => {
    const token = await issueDeviceToken(DEVICE_ID, USER, USER, PUB_KEY, T0);
    const now = T0 + 60 * DAY;
    const rec = await verifyDeviceToken(token, now);
    expect(rec?.expiresAt).toBe(now + TTL);
    expect(await deviceExpiry()).toBe(now + TTL);
  });

  it('a token used at least every 90 days never expires', async () => {
    const token = await issueDeviceToken(DEVICE_ID, USER, USER, PUB_KEY, T0);
    let now = T0;
    for (let i = 0; i < 6; i++) {
      now += 85 * DAY;
      expect(await verifyDeviceToken(token, now)).not.toBeNull();
    }
  });

  it('an unused token still expires and is deleted', async () => {
    const token = await issueDeviceToken(DEVICE_ID, USER, USER, PUB_KEY, T0);
    expect(await verifyDeviceToken(token, T0 + TTL + 1)).toBeNull();
    expect(await dbGet('SELECT 1 FROM sm_relay_devices WHERE device_id = ?', DEVICE_ID)).toBeUndefined();
  });

  it('revocation still wins over a renewed token', async () => {
    const token = await issueDeviceToken(DEVICE_ID, USER, USER, PUB_KEY, T0);
    expect(await verifyDeviceToken(token, T0 + 60 * DAY)).not.toBeNull();
    expect(await revokeDevice(DEVICE_ID)).toBe(true);
    expect(await verifyDeviceToken(token, T0 + 61 * DAY)).toBeNull();
  });
});

describe('sm-relay client token sliding expiry', () => {
  it('leaves a recent token alone and renews an aging one', async () => {
    const { clientId, clientToken } = await issueClientToken(USER, USER, 'Desk', T0);
    expect((await verifyClientToken(clientToken, T0 + 5 * DAY))?.expiresAt).toBe(T0 + TTL);
    const now = T0 + 60 * DAY;
    expect((await verifyClientToken(clientToken, now))?.expiresAt).toBe(now + TTL);
    expect(await clientExpiry(clientId)).toBe(now + TTL);
  });

  it('an unused token expires; revocation still wins', async () => {
    const idle = await issueClientToken(USER, USER, 'Idle', T0);
    expect(await verifyClientToken(idle.clientToken, T0 + TTL + 1)).toBeNull();
    expect(await dbGet('SELECT 1 FROM sm_relay_clients WHERE client_id = ?', idle.clientId)).toBeUndefined();

    const used = await issueClientToken(USER, USER, 'Used', T0);
    expect(await verifyClientToken(used.clientToken, T0 + 60 * DAY)).not.toBeNull();
    expect(await revokeClient(used.clientId)).toBe(true);
    expect(await verifyClientToken(used.clientToken, T0 + 61 * DAY)).toBeNull();
  });
});
