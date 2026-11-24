// Every way a pairing ends also deletes that device's drop boxes and their envelopes, and an
// hourly timer purges envelopes older than the 30-day TTL.
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// Clerk sessions in tests: "a.<base64url email>.sig" resolves to the email.
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

import { initDb, dbRun, dbGet } from '../server/db.js';
import { issueDeviceToken, issueOtp } from '../server/sm-relay/tokens.js';
import { registerSmRelayRoutes, runEnvelopePurgeTick, ENVELOPE_PURGE_INTERVAL_MS } from '../server/routes/sm-relay.js';
import { createBox, storeEnvelope, getBox, ENVELOPE_TTL_MS } from '../server/sm-relay/boxes.js';

const USER_A = 'retention-a@test.com';
const USER_B = 'retention-b@test.com';
const DEV_A1 = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5b61';
const DEV_A2 = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5b62';
const DEV_B1 = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5b63';
const PUB = 'cHVibGljLWtleQ==';

function rawP256Point(): string {
  const { publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const der = publicKey.export({ format: 'der', type: 'spki' });
  return der.subarray(der.length - 65).toString('base64url');
}
const KEY = rawP256Point();

const clerk = (email: string) => ({
  authorization: `Bearer a.${Buffer.from(email).toString('base64url')}.sig`,
});

let app: FastifyInstance;

async function boxWithEnvelope(userId: string, deviceId: string, now = Date.now()): Promise<string> {
  const box = await createBox({ userId, deviceId, label: 'Site', publicKey: KEY, allowedOrigins: ['https://example.com'] });
  if (!box) throw new Error('box create failed');
  const res = await storeEnvelope({
    boxId: box.boxId, clientReportId: crypto.randomUUID(), origin: 'https://example.com',
    body: Buffer.from('sealed-bytes'), now,
  });
  expect(res.kind).toBe('created');
  return box.boxId;
}

async function counts(boxId: string): Promise<{ envelopes: number; chunks: number }> {
  const e = await dbGet<{ n: number }>('SELECT COUNT(*) AS n FROM sm_relay_envelopes WHERE box_id = ?', boxId);
  const c = await dbGet<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sm_relay_envelope_chunks
     WHERE envelope_id IN (SELECT envelope_id FROM sm_relay_envelopes WHERE box_id = ?)`,
    boxId,
  );
  return { envelopes: Number(e?.n ?? 0), chunks: Number(c?.n ?? 0) };
}
async function totalChunks(): Promise<number> {
  const r = await dbGet<{ n: number }>('SELECT COUNT(*) AS n FROM sm_relay_envelope_chunks');
  return Number(r?.n ?? 0);
}

async function pair(userId: string, deviceId: string) {
  const otp = issueOtp(userId, userId);
  if (!('code' in otp)) throw new Error('otp issue failed');
  return app.inject({
    method: 'POST', url: '/api/sm-relay/pair',
    headers: { 'x-forwarded-for': `10.1.0.${Math.floor(Math.random() * 250)}` },
    payload: { code: otp.code, deviceId, devicePubKey: PUB },
  });
}

beforeAll(async () => {
  await initDb();
  app = Fastify();
  registerSmRelayRoutes(app);
  await app.ready();
});

beforeEach(async () => {
  delete process.env.SM_RELAY_ALLOWED_EMAILS;
  await dbRun('DELETE FROM sm_relay_envelope_chunks');
  await dbRun('DELETE FROM sm_relay_envelopes');
  await dbRun('DELETE FROM sm_relay_boxes');
  await dbRun('DELETE FROM sm_relay_devices');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('revoking a device deletes its boxes', () => {
  it('DELETE /devices/:deviceId removes that device’s boxes, envelopes and chunks only', async () => {
    await issueDeviceToken(DEV_A1, USER_A, USER_A, PUB);
    await issueDeviceToken(DEV_A2, USER_A, USER_A, PUB);
    const gone = await boxWithEnvelope(USER_A, DEV_A1);
    const kept = await boxWithEnvelope(USER_A, DEV_A2);

    const res = await app.inject({ method: 'DELETE', url: `/api/sm-relay/devices/${DEV_A1}`, headers: clerk(USER_A) });
    expect(res.statusCode).toBe(200);

    expect(await getBox(gone)).toBeNull();
    expect(await counts(gone)).toEqual({ envelopes: 0, chunks: 0 });
    expect(await getBox(kept)).not.toBeNull();
    expect(await counts(kept)).toEqual({ envelopes: 1, chunks: 1 });
    expect(await totalChunks()).toBe(1);
  });

  it('a 404 revoke for another account’s device leaves its boxes alone', async () => {
    await issueDeviceToken(DEV_B1, USER_B, USER_B, PUB);
    const box = await boxWithEnvelope(USER_B, DEV_B1);
    const res = await app.inject({ method: 'DELETE', url: `/api/sm-relay/devices/${DEV_B1}`, headers: clerk(USER_A) });
    expect(res.statusCode).toBe(404);
    expect(await getBox(box)).not.toBeNull();
  });

  it('panic DELETE /devices removes the boxes of every revoked device, not other accounts', async () => {
    await issueDeviceToken(DEV_A1, USER_A, USER_A, PUB);
    await issueDeviceToken(DEV_A2, USER_A, USER_A, PUB);
    await issueDeviceToken(DEV_B1, USER_B, USER_B, PUB);
    const a1 = await boxWithEnvelope(USER_A, DEV_A1);
    const a2 = await boxWithEnvelope(USER_A, DEV_A2);
    const b1 = await boxWithEnvelope(USER_B, DEV_B1);

    const res = await app.inject({ method: 'DELETE', url: '/api/sm-relay/devices', headers: clerk(USER_A) });
    expect(res.statusCode).toBe(200);
    expect(res.json().revokedCount).toBe(2);

    expect(await getBox(a1)).toBeNull();
    expect(await getBox(a2)).toBeNull();
    expect(await counts(a1)).toEqual({ envelopes: 0, chunks: 0 });
    expect(await counts(a2)).toEqual({ envelopes: 0, chunks: 0 });
    expect(await getBox(b1)).not.toBeNull();
    expect(await totalChunks()).toBe(1);
  });
});

describe('re-pairing a device id', () => {
  it('under a different account deletes the device’s boxes', async () => {
    await issueDeviceToken(DEV_A1, USER_A, USER_A, PUB);
    const box = await boxWithEnvelope(USER_A, DEV_A1);

    const res = await pair(USER_B, DEV_A1);
    expect(res.statusCode).toBe(200);
    expect(await getBox(box)).toBeNull();
    expect(await counts(box)).toEqual({ envelopes: 0, chunks: 0 });
    expect(await totalChunks()).toBe(0);
  });

  it('under the same account keeps the device’s boxes', async () => {
    await issueDeviceToken(DEV_A1, USER_A, USER_A, PUB);
    const box = await boxWithEnvelope(USER_A, DEV_A1);

    const res = await pair(USER_A, DEV_A1);
    expect(res.statusCode).toBe(200);
    expect(await getBox(box)).not.toBeNull();
    expect(await counts(box)).toEqual({ envelopes: 1, chunks: 1 });
  });

  it('a failed OTP does not delete anything', async () => {
    await issueDeviceToken(DEV_A1, USER_A, USER_A, PUB);
    const box = await boxWithEnvelope(USER_A, DEV_A1);
    const res = await app.inject({
      method: 'POST', url: '/api/sm-relay/pair',
      headers: { 'x-forwarded-for': '10.2.0.1' },
      payload: { code: 'ZZZZZZZZ', deviceId: DEV_A1, devicePubKey: PUB },
    });
    expect(res.statusCode).not.toBe(200);
    expect(await getBox(box)).not.toBeNull();
  });
});

describe('envelope TTL purge', () => {
  it('the tick purges envelopes older than 30 days and logs only a non-zero count', async () => {
    await issueDeviceToken(DEV_A1, USER_A, USER_A, PUB);
    const now = Date.now();
    const old = await boxWithEnvelope(USER_A, DEV_A1, now - ENVELOPE_TTL_MS - 1000);
    const fresh = await boxWithEnvelope(USER_A, DEV_A1, now - 1000);
    const log = { info: vi.fn() };

    expect(await runEnvelopePurgeTick(log, now)).toBe(1);
    expect(log.info).toHaveBeenCalledTimes(1);
    expect(log.info.mock.calls[0]).toEqual([{ purged: 1 }, expect.any(String)]);
    expect(await counts(old)).toEqual({ envelopes: 0, chunks: 0 });
    expect(await counts(fresh)).toEqual({ envelopes: 1, chunks: 1 });
    expect(await getBox(old)).not.toBeNull();

    expect(await runEnvelopePurgeTick(log, now)).toBe(0);
    expect(log.info).toHaveBeenCalledTimes(1);
  });

  it('registerSmRelayRoutes starts an hourly unref’d timer that runs the purge', async () => {
    expect(ENVELOPE_PURGE_INTERVAL_MS).toBe(60 * 60 * 1000);
    await issueDeviceToken(DEV_A1, USER_A, USER_A, PUB);
    const old = await boxWithEnvelope(USER_A, DEV_A1, Date.now() - ENVELOPE_TTL_MS - 60_000);

    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const timed = Fastify();
    registerSmRelayRoutes(timed);
    const hourly = setIntervalSpy.mock.results.filter(
      (_r, i) => setIntervalSpy.mock.calls[i][1] === ENVELOPE_PURGE_INTERVAL_MS,
    );
    expect(hourly).toHaveLength(1);
    expect((hourly[0].value as NodeJS.Timeout).hasRef()).toBe(false);

    await vi.advanceTimersByTimeAsync(ENVELOPE_PURGE_INTERVAL_MS - 1);
    expect((await counts(old)).envelopes).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    vi.useRealTimers();
    // The tick fired; let its DB work settle on real timers.
    await vi.waitFor(async () => {
      expect(await counts(old)).toEqual({ envelopes: 0, chunks: 0 });
    });
    setIntervalSpy.mockRestore();
    await timed.close();
  });
});
