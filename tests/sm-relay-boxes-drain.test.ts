// Drop-box drain routes: only the device that owns a box can list, download and acknowledge
// its envelopes, and the download is the exact stored ciphertext, never compressed.
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import compress from '@fastify/compress';

// Clerk sessions in tests: "a.<base64url email>.sig" (JWT-shaped, two dots) resolves to the email.
vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return {
    ...original,
    ADMIN_EMAILS: ['admin@test.com'],
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
import { issueDeviceToken } from '../server/sm-relay/tokens.js';
import { registerSmRelayBoxRoutes } from '../server/routes/sm-relay-boxes.js';
import { createBox, storeEnvelope } from '../server/sm-relay/boxes.js';

const ADMIN = 'admin@test.com';
const USER_B = 'drain-user-b@test.com';
const DEV_A1 = '4f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a71';
const DEV_A2 = '4f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a72';
const DEV_B1 = '4f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a73';
const ORIGIN = 'https://example.com';

function rawP256Point(): string {
  const { publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const der = publicKey.export({ format: 'der', type: 'spki' });
  return der.subarray(der.length - 65).toString('base64url');
}
const KEY = rawP256Point();

const clerk = (email: string) => ({
  authorization: `Bearer a.${Buffer.from(email).toString('base64url')}.sig`,
});
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

let app: FastifyInstance;
let tokA1: string;
let tokA2: string;
let tokB1: string;
let boxId: string;

async function put(clientReportId: string, body: Buffer, now: number) {
  const r = await storeEnvelope({ boxId, clientReportId, origin: ORIGIN, body, now });
  if (r.kind !== 'created') throw new Error(`store failed: ${r.kind}`);
  return r;
}

const listUrl = () => `/api/sm-relay/boxes/${boxId}/envelopes`;
const envUrl = (id: string) => `/api/sm-relay/boxes/${boxId}/envelopes/${id}`;

beforeAll(async () => {
  await initDb();
  app = Fastify({ bodyLimit: 16 * 1048576 });
  // Same compressible types as production (octet-stream included), so compress: false is what
  // keeps the download raw.
  await app.register(compress, { threshold: 1024, encodings: ['br', 'gzip'], customTypes: /octet-stream(?:;|$)|json/u });
  registerSmRelayBoxRoutes(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  delete process.env.SM_RELAY_ALLOWED_EMAILS;
  await dbRun('DELETE FROM sm_relay_envelope_chunks');
  await dbRun('DELETE FROM sm_relay_envelopes');
  await dbRun('DELETE FROM sm_relay_boxes');
  await dbRun('DELETE FROM sm_relay_devices');
  tokA1 = await issueDeviceToken(DEV_A1, ADMIN, ADMIN, 'cHVi');
  tokA2 = await issueDeviceToken(DEV_A2, ADMIN, ADMIN, 'cHVi');
  tokB1 = await issueDeviceToken(DEV_B1, USER_B, USER_B, 'cHVi');
  const box = await createBox({ userId: ADMIN, deviceId: DEV_A1, label: 'Site', publicKey: KEY, allowedOrigins: [ORIGIN] });
  if (!box) throw new Error('createBox failed');
  boxId = box.boxId;
});

describe('GET /api/sm-relay/boxes/:boxId/envelopes', () => {
  it('lists oldest first with ISO receivedAt and every field', async () => {
    const t0 = Date.UTC(2026, 10, 1, 12, 0, 0);
    const second = await put('r-2', Buffer.from('second'), t0 + 2000);
    const first = await put('r-1', Buffer.from('first!!'), t0 + 1000);
    const res = await app.inject({ method: 'GET', url: listUrl(), headers: bearer(tokA1) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      envelopes: [
        { envelopeId: first.envelopeId, hostId: first.hostId, clientReportId: 'r-1', receivedAt: new Date(t0 + 1000).toISOString(), origin: ORIGIN, bytes: 7 },
        { envelopeId: second.envelopeId, hostId: second.hostId, clientReportId: 'r-2', receivedAt: new Date(t0 + 2000).toISOString(), origin: ORIGIN, bytes: 6 },
      ],
    });
  });

  it('defaults to 20 and honours limit', async () => {
    const t0 = Date.UTC(2026, 10, 1);
    for (let i = 0; i < 22; i++) await put(`r-${i}`, Buffer.from([i]), t0 + i);
    const def = await app.inject({ method: 'GET', url: listUrl(), headers: bearer(tokA1) });
    expect(def.json().envelopes).toHaveLength(20);
    expect(def.json().envelopes[0].clientReportId).toBe('r-0');
    const one = await app.inject({ method: 'GET', url: `${listUrl()}?limit=1`, headers: bearer(tokA1) });
    expect(one.json().envelopes.map((e: any) => e.clientReportId)).toEqual(['r-0']);
    const max = await app.inject({ method: 'GET', url: `${listUrl()}?limit=20`, headers: bearer(tokA1) });
    expect(max.json().envelopes).toHaveLength(20);
  });

  it.each(['0', '21', '-1', '1.5', 'abc', '', '05x'])('limit=%s → 400 invalid_limit', async (limit) => {
    const res = await app.inject({ method: 'GET', url: `${listUrl()}?limit=${limit}`, headers: bearer(tokA1) });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_limit');
  });
});

describe('GET /api/sm-relay/boxes/:boxId/envelopes/:envelopeId', () => {
  it('returns a 2.5 MiB envelope byte-identical, octet-stream, no-store, uncompressed', async () => {
    const body = crypto.randomBytes(Math.floor(2.5 * 1048576));
    const { envelopeId } = await put('big', body, Date.now());
    const res = await app.inject({
      method: 'GET', url: envUrl(envelopeId),
      headers: { ...bearer(tokA1), 'accept-encoding': 'br, gzip' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/octet-stream');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.rawPayload.length).toBe(body.length);
    expect(res.rawPayload.equals(body)).toBe(true);
  });

  it('unknown envelope → 404 envelope_not_found', async () => {
    const res = await app.inject({ method: 'GET', url: envUrl(crypto.randomUUID()), headers: bearer(tokA1) });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe('envelope_not_found');
  });
});

describe('DELETE /api/sm-relay/boxes/:boxId/envelopes/:envelopeId', () => {
  it('acknowledges once: envelope and chunks gone, second DELETE 404', async () => {
    const { envelopeId } = await put('ack', crypto.randomBytes(1048576 + 10), Date.now());
    const chunks = async () =>
      Number((await dbGet<{ n: number }>('SELECT COUNT(*) AS n FROM sm_relay_envelope_chunks WHERE envelope_id = ?', envelopeId))?.n ?? 0);
    expect(await chunks()).toBe(2);

    const del = await app.inject({ method: 'DELETE', url: envUrl(envelopeId), headers: bearer(tokA1) });
    expect(del.statusCode).toBe(200);
    expect(del.json()).toEqual({ ok: true });
    expect(await chunks()).toBe(0);
    const row = await dbGet('SELECT envelope_id FROM sm_relay_envelopes WHERE envelope_id = ?', envelopeId);
    expect(row).toBeUndefined();

    const list = await app.inject({ method: 'GET', url: listUrl(), headers: bearer(tokA1) });
    expect(list.json().envelopes).toEqual([]);
    const get = await app.inject({ method: 'GET', url: envUrl(envelopeId), headers: bearer(tokA1) });
    expect(get.statusCode).toBe(404);

    const again = await app.inject({ method: 'DELETE', url: envUrl(envelopeId), headers: bearer(tokA1) });
    expect(again.statusCode).toBe(404);
    expect(again.json().error).toBe('envelope_not_found');
  });
});

describe('only the owning device drains', () => {
  let envelopeId: string;
  beforeEach(async () => {
    envelopeId = (await put('own', Buffer.from('sealed'), Date.now())).envelopeId;
  });
  const routes = () => [
    { method: 'GET' as const, url: listUrl() },
    { method: 'GET' as const, url: envUrl(envelopeId) },
    { method: 'DELETE' as const, url: envUrl(envelopeId) },
  ];

  it('Clerk session of the owning account → 403 device_token_required', async () => {
    for (const r of routes()) {
      const res = await app.inject({ ...r, headers: clerk(ADMIN) });
      expect(res.statusCode, `${r.method} ${r.url}`).toBe(403);
      expect(res.json().error).toBe('device_token_required');
    }
  });

  it('another device of the same account → 404 box_not_found', async () => {
    for (const r of routes()) {
      const res = await app.inject({ ...r, headers: bearer(tokA2) });
      expect(res.statusCode, `${r.method} ${r.url}`).toBe(404);
      expect(res.json().error).toBe('box_not_found');
    }
  });

  it('a device of another account → 404 box_not_found', async () => {
    for (const r of routes()) {
      const res = await app.inject({ ...r, headers: bearer(tokB1) });
      expect(res.statusCode, `${r.method} ${r.url}`).toBe(404);
      expect(res.json().error).toBe('box_not_found');
    }
  });

  it('no bearer → 401', async () => {
    for (const r of routes()) {
      const res = await app.inject(r);
      expect(res.statusCode, `${r.method} ${r.url}`).toBe(401);
    }
  });

  it('the envelope survives every rejected call', async () => {
    for (const h of [clerk(ADMIN), bearer(tokA2), bearer(tokB1), {}]) {
      await app.inject({ method: 'DELETE', url: envUrl(envelopeId), headers: h });
    }
    const res = await app.inject({ method: 'GET', url: envUrl(envelopeId), headers: bearer(tokA1) });
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.toString()).toBe('sealed');
  });
});
