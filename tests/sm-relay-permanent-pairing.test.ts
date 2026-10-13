// A paired desktop (device token) or desktop client (client token) stays linked
// until its owner revokes it: no time-based expiry, and revocation wins immediately.
import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import { initDb, dbRun, dbGet } from '../server/db.js';
import {
  issueDeviceToken, verifyDeviceToken, getDevice, getDevicesForUser, revokeDevice,
  issueClientToken, verifyClientToken, getClient, getClientsForUser, revokeClient,
  purgeExpired,
} from '../server/sm-relay/tokens.js';

const USER = 'relay-owner@test.com';
const DEVICE_ID = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b';
const PUB_KEY = 'cHVibGljLWtleQ==';
const YEARS_AGO = Date.now() - 5 * 365 * 24 * 60 * 60 * 1000;

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM sm_relay_devices');
  await dbRun('DELETE FROM sm_relay_clients');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sm-relay permanent pairing', () => {
  it('a device token paired years ago still verifies and is still listed', async () => {
    const token = await issueDeviceToken(DEVICE_ID, USER, USER, PUB_KEY, YEARS_AGO);
    expect(await verifyDeviceToken(token)).toMatchObject({ deviceId: DEVICE_ID, userId: USER, expiresAt: null });
    expect(await getDevice(DEVICE_ID)).not.toBeNull();
    expect((await getDevicesForUser(USER)).map((d) => d.deviceId)).toEqual([DEVICE_ID]);
  });

  it('a client token paired years ago still verifies and is still listed', async () => {
    const { clientId, clientToken } = await issueClientToken(USER, USER, 'Desk', YEARS_AGO);
    expect(await verifyClientToken(clientToken)).toMatchObject({ clientId, userId: USER, expiresAt: null });
    expect(await getClient(clientId)).not.toBeNull();
    expect((await getClientsForUser(USER)).map((c) => c.clientId)).toEqual([clientId]);
  });

  it('housekeeping never deletes paired rows', async () => {
    await issueDeviceToken(DEVICE_ID, USER, USER, PUB_KEY, YEARS_AGO);
    const { clientId } = await issueClientToken(USER, USER, 'Desk', YEARS_AGO);
    vi.useFakeTimers({ now: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000, toFake: ['Date'] });
    purgeExpired();
    expect(await dbGet('SELECT 1 FROM sm_relay_devices WHERE device_id = ?', DEVICE_ID)).toBeDefined();
    expect(await dbGet('SELECT 1 FROM sm_relay_clients WHERE client_id = ?', clientId)).toBeDefined();
  });

  it('pre-existing rows with a finite legacy expires_at in the past still verify', async () => {
    const token = await issueDeviceToken(DEVICE_ID, USER, USER, PUB_KEY, YEARS_AGO);
    await dbRun('UPDATE sm_relay_devices SET expires_at = ? WHERE device_id = ?', YEARS_AGO + 1, DEVICE_ID);
    expect(await verifyDeviceToken(token)).not.toBeNull();
  });

  it('revocation still ends a pairing immediately', async () => {
    const token = await issueDeviceToken(DEVICE_ID, USER, USER, PUB_KEY, YEARS_AGO);
    expect(await revokeDevice(DEVICE_ID)).toBe(true);
    expect(await verifyDeviceToken(token)).toBeNull();

    const { clientId, clientToken } = await issueClientToken(USER, USER, 'Desk', YEARS_AGO);
    expect(await revokeClient(clientId)).toBe(true);
    expect(await verifyClientToken(clientToken)).toBeNull();
  });
});
