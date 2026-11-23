// Drop-box store: only a real on-curve P-256 point is accepted as a box key, only bare
// https (or local http) origins may post, the per-account cap holds, and every query is
// scoped to the owning account / device.
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initDb, dbRun } from '../server/db.js';
import {
  MAX_BOXES_PER_ACCOUNT, newBoxId, newHostId, parseBoxPublicKey, parseAllowedOrigins,
  parseBoxLabel, createBox, getBox, listBoxes, updateBox, deleteBox,
} from '../server/sm-relay/boxes.js';

const USER_A = 'box-owner-a@test.com';
const USER_B = 'box-owner-b@test.com';
const DEV_1 = 'device-1';
const DEV_2 = 'device-2';
const ORIGINS = ['https://example.com'];

function rawP256Point(): Buffer {
  const { publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const der = publicKey.export({ format: 'der', type: 'spki' });
  return der.subarray(der.length - 65);
}

const REAL_KEY = rawP256Point().toString('base64url');

async function makeBox(userId = USER_A, deviceId = DEV_1, label = 'Site') {
  return createBox({ userId, deviceId, label, publicKey: REAL_KEY, allowedOrigins: ORIGINS });
}

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM sm_relay_envelope_chunks');
  await dbRun('DELETE FROM sm_relay_envelopes');
  await dbRun('DELETE FROM sm_relay_boxes');
});

describe('ids', () => {
  it('box ids are 8 Crockford base32 chars, host ids FB- plus 5', () => {
    for (let i = 0; i < 200; i++) {
      expect(newBoxId()).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
      expect(newHostId()).toMatch(/^FB-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{5}$/);
    }
    expect(new Set(Array.from({ length: 100 }, newBoxId)).size).toBe(100);
  });
});

describe('parseBoxPublicKey', () => {
  it('accepts a real generated P-256 point', () => {
    const raw = Buffer.from(REAL_KEY, 'base64url');
    expect(raw.length).toBe(65);
    expect(raw[0]).toBe(0x04);
    expect(parseBoxPublicKey(REAL_KEY)).toBe(REAL_KEY);
  });

  it('rejects a 65-byte 0x04 point that is not on the curve', () => {
    const raw = Buffer.from(rawP256Point());
    raw[64] ^= 0x01;
    expect(parseBoxPublicKey(raw.toString('base64url'))).toBeNull();
    const junk = Buffer.alloc(65, 0x11);
    junk[0] = 0x04;
    expect(parseBoxPublicKey(junk.toString('base64url'))).toBeNull();
  });

  it('rejects padded, standard-base64, wrong-length and wrong-prefix keys', () => {
    const raw = rawP256Point();
    expect(parseBoxPublicKey(raw.toString('base64'))).toBeNull();
    expect(parseBoxPublicKey(`${raw.toString('base64url')}=`)).toBeNull();
    expect(parseBoxPublicKey(raw.subarray(0, 64).toString('base64url'))).toBeNull();
    const compressed = Buffer.from(raw);
    compressed[0] = 0x02;
    expect(parseBoxPublicKey(compressed.toString('base64url'))).toBeNull();
    expect(parseBoxPublicKey(42)).toBeNull();
    expect(parseBoxPublicKey('')).toBeNull();
  });
});

describe('parseAllowedOrigins', () => {
  it('accepts https and local http origins, deduplicated', () => {
    expect(parseAllowedOrigins([
      'https://example.com', 'http://localhost:5173', 'http://127.0.0.1:8080', 'https://example.com',
    ])).toEqual(['https://example.com', 'http://localhost:5173', 'http://127.0.0.1:8080']);
  });

  it('rejects origin edge cases', () => {
    expect(parseAllowedOrigins(['https://example.com/'])).toBeNull();
    expect(parseAllowedOrigins(['https://example.com/path'])).toBeNull();
    expect(parseAllowedOrigins(['http://example.com'])).toBeNull();
    expect(parseAllowedOrigins(['*'])).toBeNull();
    expect(parseAllowedOrigins(['https://*.example.com'])).toBeNull();
    expect(parseAllowedOrigins(Array.from({ length: 11 }, (_, i) => `https://s${i}.example.com`))).toBeNull();
    expect(parseAllowedOrigins([])).toBeNull();
    expect(parseAllowedOrigins('https://example.com')).toBeNull();
    expect(parseAllowedOrigins([7])).toBeNull();
    expect(parseAllowedOrigins(['ftp://example.com'])).toBeNull();
  });
});

describe('parseBoxLabel', () => {
  it('trims and accepts 1-80 chars', () => {
    expect(parseBoxLabel('  My site ')).toBe('My site');
    expect(parseBoxLabel('x'.repeat(80))).toBe('x'.repeat(80));
    expect(parseBoxLabel('x'.repeat(81))).toBeNull();
    expect(parseBoxLabel('   ')).toBeNull();
    expect(parseBoxLabel(null)).toBeNull();
  });
});

describe('box store', () => {
  it('create/get/list round trip scoped by userId and deviceId', async () => {
    const a1 = await makeBox(USER_A, DEV_1, 'One');
    const a2 = await makeBox(USER_A, DEV_2, 'Two');
    const b1 = await makeBox(USER_B, 'device-b', 'Other');
    expect(a1 && a2 && b1).toBeTruthy();

    expect(await getBox(a1!.boxId)).toEqual({ ...a1, lastReceivedAt: null });
    expect(a1!.state).toBe('open');
    expect(a1!.allowedOrigins).toEqual(ORIGINS);

    const all = await listBoxes({ userId: USER_A });
    expect(all.map((b) => b.boxId).sort()).toEqual([a1!.boxId, a2!.boxId].sort());
    expect(all.every((b) => b.pending === 0 && b.pendingBytes === 0)).toBe(true);

    const dev2 = await listBoxes({ userId: USER_A, deviceId: DEV_2 });
    expect(dev2.map((b) => b.boxId)).toEqual([a2!.boxId]);
    expect(await listBoxes({ userId: USER_B, deviceId: DEV_1 })).toEqual([]);
  });

  it('list carries pending count and bytes per box', async () => {
    const box = await makeBox();
    const other = await makeBox(USER_A, DEV_1, 'Empty');
    for (const [id, bytes] of [['e1', 100], ['e2', 250]] as const) {
      await dbRun(
        `INSERT INTO sm_relay_envelopes (envelope_id, box_id, host_id, client_report_id, origin, bytes, chunks, received_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        id, box!.boxId, `FB-${id}`, `r-${id}`, ORIGINS[0], bytes, Date.now(),
      );
    }
    const rows = await listBoxes({ userId: USER_A });
    const byId = new Map(rows.map((r) => [r.boxId, r]));
    expect(byId.get(box!.boxId)).toMatchObject({ pending: 2, pendingBytes: 350 });
    expect(byId.get(other!.boxId)).toMatchObject({ pending: 0, pendingBytes: 0 });
  });

  it('update changes only the given fields', async () => {
    const box = await makeBox();
    const paused = await updateBox(box!.boxId, { state: 'paused' });
    expect(paused).toMatchObject({ state: 'paused', label: 'Site', allowedOrigins: ORIGINS });
    const relabeled = await updateBox(box!.boxId, {
      label: 'Renamed', allowedOrigins: ['https://a.example.com', 'http://localhost:3000'],
    });
    expect(relabeled).toMatchObject({
      state: 'paused', label: 'Renamed', allowedOrigins: ['https://a.example.com', 'http://localhost:3000'],
    });
    expect(await getBox(box!.boxId)).toEqual(relabeled);
    expect(await updateBox('NOSUCHID', { label: 'x' })).toBeNull();
  });

  it('delete removes chunks, envelopes and the box row', async () => {
    const box = await makeBox();
    const keep = await makeBox(USER_A, DEV_1, 'Keep');
    for (const [envId, boxId] of [['del-env', box!.boxId], ['keep-env', keep!.boxId]]) {
      await dbRun(
        `INSERT INTO sm_relay_envelopes (envelope_id, box_id, host_id, client_report_id, origin, bytes, chunks, received_at)
         VALUES (?, ?, 'FB-AAAAA', ?, ?, 3, 1, ?)`,
        envId, boxId, `r-${envId}`, ORIGINS[0], Date.now(),
      );
      await dbRun(
        'INSERT INTO sm_relay_envelope_chunks (envelope_id, idx, content) VALUES (?, 0, ?)',
        envId, new Uint8Array([1, 2, 3]),
      );
    }
    expect(await deleteBox(box!.boxId)).toBe(true);
    expect(await getBox(box!.boxId)).toBeNull();
    const { dbAll } = await import('../server/db.js');
    expect(await dbAll('SELECT envelope_id FROM sm_relay_envelopes')).toEqual([
      expect.objectContaining({ envelope_id: 'keep-env' }),
    ]);
    expect(await dbAll('SELECT envelope_id FROM sm_relay_envelope_chunks')).toEqual([
      expect.objectContaining({ envelope_id: 'keep-env' }),
    ]);
    expect(await deleteBox(box!.boxId)).toBe(false);
  });

  it('caps an account at 25 boxes across devices, paused included', async () => {
    expect(MAX_BOXES_PER_ACCOUNT).toBe(25);
    for (let i = 0; i < MAX_BOXES_PER_ACCOUNT; i++) {
      const box = await makeBox(USER_A, i % 2 ? DEV_1 : DEV_2, `Box ${i}`);
      expect(box).not.toBeNull();
      if (i === 0) await updateBox(box!.boxId, { state: 'paused' });
    }
    expect(await makeBox(USER_A, 'device-3', 'Box 26')).toBeNull();
    expect(await listBoxes({ userId: USER_A })).toHaveLength(25);
    expect(await makeBox(USER_B, 'device-b', 'Other account')).not.toBeNull();
  });
});
