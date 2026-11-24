// Drop-box owner routes: a device token sees only its own boxes, a Clerk session sees every
// box of its account, box creation needs a device token and passes the owner-first gate and
// the per-account cap.
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

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

import { initDb, dbRun } from '../server/db.js';
import { issueDeviceToken } from '../server/sm-relay/tokens.js';
import { registerSmRelayBoxRoutes } from '../server/routes/sm-relay-boxes.js';
import { createBox, storeEnvelope, MAX_BOXES_PER_ACCOUNT } from '../server/sm-relay/boxes.js';

const ADMIN = 'admin@test.com';
const USER_B = 'box-user-b@test.com';
const DEV_A1 = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a61';
const DEV_A2 = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a62';
const DEV_B1 = '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a63';
const ORIGINS = ['https://example.com'];

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

function post(headers: Record<string, string>, payload: unknown) {
  return app.inject({ method: 'POST', url: '/api/sm-relay/boxes', headers, payload: payload as any });
}
const goodBody = { label: 'Site', publicKey: KEY, allowedOrigins: ORIGINS };

beforeAll(async () => {
  await initDb();
  app = Fastify();
  registerSmRelayBoxRoutes(app);
  await app.ready();
});

beforeEach(async () => {
  delete process.env.SM_RELAY_BOXES_ALLOWED_EMAILS;
  delete process.env.SM_RELAY_ALLOWED_EMAILS;
  await dbRun('DELETE FROM sm_relay_envelope_chunks');
  await dbRun('DELETE FROM sm_relay_envelopes');
  await dbRun('DELETE FROM sm_relay_boxes');
  await dbRun('DELETE FROM sm_relay_devices');
  tokA1 = await issueDeviceToken(DEV_A1, ADMIN, ADMIN, 'cHVi');
  tokA2 = await issueDeviceToken(DEV_A2, ADMIN, ADMIN, 'cHVi');
  tokB1 = await issueDeviceToken(DEV_B1, USER_B, USER_B, 'cHVi');
});

afterEach(() => {
  delete process.env.SM_RELAY_BOXES_ALLOWED_EMAILS;
  delete process.env.SM_RELAY_ALLOWED_EMAILS;
});

describe('auth', () => {
  it('missing or unknown bearer → 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/sm-relay/boxes' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/sm-relay/boxes', headers: bearer('nope') })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/sm-relay/boxes', headers: { authorization: 'Bearer x.y.z' } })).statusCode).toBe(401);
  });

  it('email outside SM_RELAY_ALLOWED_EMAILS → 403 not_allowed (device and Clerk)', async () => {
    process.env.SM_RELAY_ALLOWED_EMAILS = 'other@test.com';
    const d = await app.inject({ method: 'GET', url: '/api/sm-relay/boxes', headers: bearer(tokA1) });
    expect(d.statusCode).toBe(403);
    expect(d.json().error).toBe('not_allowed');
    const c = await app.inject({ method: 'GET', url: '/api/sm-relay/boxes', headers: clerk(ADMIN) });
    expect(c.statusCode).toBe(403);
    expect(c.json().error).toBe('not_allowed');
  });
});

describe('POST /api/sm-relay/boxes', () => {
  it('creates a box for a device token → 201', async () => {
    const res = await post(bearer(tokA1), goodBody);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.state).toBe('open');
    expect(typeof body.boxId).toBe('string');
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);
  });

  it('Clerk session → 403 device_token_required', async () => {
    const res = await post(clerk(ADMIN), goodBody);
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('device_token_required');
  });

  it('validates fields', async () => {
    const cases: Array<[unknown, string]> = [
      [{ ...goodBody, label: '' }, 'invalid_label'],
      [{ ...goodBody, publicKey: 'abc' }, 'invalid_public_key'],
      [{ ...goodBody, allowedOrigins: ['http://example.com'] }, 'invalid_allowed_origins'],
      [{ ...goodBody, allowedOrigins: [] }, 'invalid_allowed_origins'],
    ];
    for (const [payload, error] of cases) {
      const res = await post(bearer(tokA1), payload);
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe(error);
    }
  });

  it('gate unset: only ADMIN_EMAILS may create', async () => {
    expect((await post(bearer(tokA1), goodBody)).statusCode).toBe(201);
    const res = await post(bearer(tokB1), goodBody);
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('not_enabled');
  });

  it('gate empty behaves like unset', async () => {
    process.env.SM_RELAY_BOXES_ALLOWED_EMAILS = '  ';
    expect((await post(bearer(tokB1), goodBody)).json().error).toBe('not_enabled');
    expect((await post(bearer(tokA1), goodBody)).statusCode).toBe(201);
  });

  it('gate set to another email: only that email (case-insensitive)', async () => {
    process.env.SM_RELAY_BOXES_ALLOWED_EMAILS = 'someone@test.com, BOX-USER-B@test.com';
    expect((await post(bearer(tokB1), goodBody)).statusCode).toBe(201);
    const res = await post(bearer(tokA1), goodBody);
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('not_enabled');
  });

  it("gate '*' allows every account", async () => {
    process.env.SM_RELAY_BOXES_ALLOWED_EMAILS = '*';
    expect((await post(bearer(tokB1), goodBody)).statusCode).toBe(201);
    expect((await post(bearer(tokA1), goodBody)).statusCode).toBe(201);
  });

  it('gate comes before field checks', async () => {
    const res = await post(bearer(tokB1), { label: '' });
    expect(res.json().error).toBe('not_enabled');
  });

  it('26th box for one account → 403 box_limit_reached', async () => {
    for (let i = 0; i < MAX_BOXES_PER_ACCOUNT; i++) {
      const tok = i % 2 === 0 ? tokA1 : tokA2;
      expect((await post(bearer(tok), { ...goodBody, label: `Box ${i}` })).statusCode).toBe(201);
    }
    const bad = await post(bearer(tokA1), { ...goodBody, label: '' });
    expect(bad.json().error).toBe('invalid_label');
    const res = await post(bearer(tokA2), goodBody);
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('box_limit_reached');
  });
});

describe('GET / PATCH / DELETE', () => {
  async function seed() {
    const a1 = (await createBox({ userId: ADMIN, deviceId: DEV_A1, label: 'A1', publicKey: KEY, allowedOrigins: ORIGINS }))!;
    const a2 = (await createBox({ userId: ADMIN, deviceId: DEV_A2, label: 'A2', publicKey: KEY, allowedOrigins: ORIGINS }))!;
    const b1 = (await createBox({ userId: USER_B, deviceId: DEV_B1, label: 'B1', publicKey: KEY, allowedOrigins: ORIGINS }))!;
    return { a1, a2, b1 };
  }

  it('a device sees only its own boxes, in full shape', async () => {
    const { a1 } = await seed();
    const res = await app.inject({ method: 'GET', url: '/api/sm-relay/boxes', headers: bearer(tokA1) });
    expect(res.statusCode).toBe(200);
    const { boxes } = res.json();
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toEqual({
      boxId: a1.boxId, label: 'A1', allowedOrigins: ORIGINS, publicKey: KEY, state: 'open',
      pending: 0, pendingBytes: 0, createdAt: new Date(a1.createdAt).toISOString(),
      lastReceivedAt: null, deviceId: DEV_A1,
    });
  });

  it('lastReceivedAt and pending fill in after an envelope', async () => {
    const { a1 } = await seed();
    const now = Date.UTC(2026, 10, 23, 12, 0, 0);
    await storeEnvelope({ boxId: a1.boxId, clientReportId: 'r1', origin: ORIGINS[0], body: Buffer.from('abcd'), now });
    const res = await app.inject({ method: 'GET', url: '/api/sm-relay/boxes', headers: bearer(tokA1) });
    const [box] = res.json().boxes;
    expect(box.pending).toBe(1);
    expect(box.pendingBytes).toBe(4);
    expect(box.lastReceivedAt).toBe(new Date(now).toISOString());
  });

  it('a Clerk session sees every box of its account and none of others', async () => {
    const { a1, a2 } = await seed();
    const res = await app.inject({ method: 'GET', url: '/api/sm-relay/boxes', headers: clerk(ADMIN) });
    expect(res.statusCode).toBe(200);
    expect(res.json().boxes.map((b: any) => b.boxId).sort()).toEqual([a1.boxId, a2.boxId].sort());
  });

  it('device of user B never sees user A boxes', async () => {
    const { b1 } = await seed();
    const res = await app.inject({ method: 'GET', url: '/api/sm-relay/boxes', headers: bearer(tokB1) });
    expect(res.json().boxes.map((b: any) => b.boxId)).toEqual([b1.boxId]);
  });

  it('PATCH updates and validates', async () => {
    const { a1 } = await seed();
    const url = `/api/sm-relay/boxes/${a1.boxId}`;
    const ok = await app.inject({
      method: 'PATCH', url, headers: bearer(tokA1),
      payload: { label: 'Renamed', allowedOrigins: ['https://a.example.com'], state: 'paused' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({
      boxId: a1.boxId, label: 'Renamed', allowedOrigins: ['https://a.example.com'], state: 'paused',
      pending: 0, pendingBytes: 0, deviceId: DEV_A1, lastReceivedAt: null,
      createdAt: new Date(a1.createdAt).toISOString(),
    });
    const viaClerk = await app.inject({ method: 'PATCH', url, headers: clerk(ADMIN), payload: { state: 'open' } });
    expect(viaClerk.statusCode).toBe(200);
    expect(viaClerk.json().state).toBe('open');

    const cases: Array<[unknown, string]> = [
      [{ label: '   ' }, 'invalid_label'],
      [{ allowedOrigins: 'https://x.com' }, 'invalid_allowed_origins'],
      [{ state: 'closed' }, 'invalid_state'],
    ];
    for (const [payload, error] of cases) {
      const res = await app.inject({ method: 'PATCH', url, headers: bearer(tokA1), payload: payload as any });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe(error);
    }
  });

  it('PATCH / DELETE a box the caller does not own → 404 box_not_found', async () => {
    const { a1, a2, b1 } = await seed();
    const tries: Array<[string, Record<string, string>]> = [
      [a2.boxId, bearer(tokA1)], // same account, other device
      [b1.boxId, bearer(tokA1)], // other account
      [a1.boxId, bearer(tokB1)],
      [b1.boxId, clerk(ADMIN)],
      ['ZZZZZZZZ', clerk(ADMIN)], // nonexistent
    ];
    for (const [boxId, headers] of tries) {
      const p = await app.inject({ method: 'PATCH', url: `/api/sm-relay/boxes/${boxId}`, headers, payload: { state: 'paused' } });
      expect(p.statusCode).toBe(404);
      expect(p.json().error).toBe('box_not_found');
      const d = await app.inject({ method: 'DELETE', url: `/api/sm-relay/boxes/${boxId}`, headers });
      expect(d.statusCode).toBe(404);
      expect(d.json().error).toBe('box_not_found');
    }
  });

  it('DELETE removes the box (device and Clerk)', async () => {
    const { a1, a2 } = await seed();
    const d1 = await app.inject({ method: 'DELETE', url: `/api/sm-relay/boxes/${a1.boxId}`, headers: bearer(tokA1) });
    expect(d1.statusCode).toBe(200);
    expect(d1.json()).toEqual({ ok: true });
    const d2 = await app.inject({ method: 'DELETE', url: `/api/sm-relay/boxes/${a2.boxId}`, headers: clerk(ADMIN) });
    expect(d2.json()).toEqual({ ok: true });
    const res = await app.inject({ method: 'GET', url: '/api/sm-relay/boxes', headers: clerk(ADMIN) });
    expect(res.json().boxes).toEqual([]);
  });
});
