// Public drop-box ingest: per-box CORS (never credentials), SMF1/size/header checks, the
// in-process rate limits, idempotent report ids, the box quota, and the desktop nudge.
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import WebSocket from 'ws';

import { initDb, dbRun, dbAll } from '../server/db.js';
import { createBox, updateBox, MAX_ENVELOPE_BYTES, MAX_BOX_BYTES } from '../server/sm-relay/boxes.js';
import { deviceConns } from '../server/sm-relay/router.js';
import {
  registerSmRelayBoxIngestRoutes,
  resetSmRelayBoxIngestRateLimits,
} from '../server/routes/sm-relay-box-ingest.js';

const OWNER = 'ingest-owner@test.com';
const DEVICE = '7c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const ORIGIN = 'https://example.com';
const OTHER = 'https://evil.example';
const KEY = 'BPub'.padEnd(87, 'A');

let app: FastifyInstance;
let boxId: string;
let ipSeq = 0;

function envelope(extra = 'ciphertext'): Buffer {
  return Buffer.concat([Buffer.from('SMF1', 'ascii'), Buffer.from(extra)]);
}

function freshIp(): string {
  ipSeq++;
  return `10.0.${Math.floor(ipSeq / 250)}.${ipSeq % 250}`;
}

function postEnv(opts: {
  box?: string;
  origin?: string | null;
  headers?: Record<string, string>;
  body?: Buffer | Readable | string;
  ip?: string;
  reportId?: string;
} = {}) {
  const headers: Record<string, string> = {
    'content-type': 'application/octet-stream',
    'x-sm-envelope': '1',
    'x-sm-report-id': opts.reportId ?? crypto.randomUUID(),
    'x-forwarded-for': `203.0.113.9, ${opts.ip ?? freshIp()}`,
    ...opts.headers,
  };
  const origin = opts.origin === undefined ? ORIGIN : opts.origin;
  if (origin !== null) headers.origin = origin;
  return app.inject({
    method: 'POST',
    url: `/api/sm-relay/boxes/${opts.box ?? boxId}/envelopes`,
    headers,
    payload: (opts.body ?? envelope()) as any,
  });
}

function expectCors(res: { headers: Record<string, unknown> }) {
  expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
  expect(String(res.headers.vary)).toMatch(/Origin/);
  expect(res.headers['access-control-allow-credentials']).toBeUndefined();
}

beforeAll(async () => {
  await initDb();
  app = Fastify();
  // The production global plugin, with credentials on, must stay off these routes.
  await app.register(cors, { origin: true, credentials: true });
  registerSmRelayBoxIngestRoutes(app);
  await app.ready();
});

beforeEach(async () => {
  resetSmRelayBoxIngestRateLimits();
  await dbRun('DELETE FROM sm_relay_envelope_chunks');
  await dbRun('DELETE FROM sm_relay_envelopes');
  await dbRun('DELETE FROM sm_relay_boxes');
  const box = await createBox({ userId: OWNER, deviceId: DEVICE, label: 'Site', publicKey: KEY, allowedOrigins: [ORIGIN] });
  boxId = box!.boxId;
});

afterEach(() => {
  deviceConns.delete(DEVICE);
});

describe('GET key', () => {
  it('answers the public key with a wildcard origin and a 60 s public cache', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/sm-relay/boxes/${boxId}/key`, headers: { origin: OTHER } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ boxId, publicKey: KEY, state: 'open' });
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['cache-control']).toBe('public, max-age=60');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('404s an unknown box', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sm-relay/boxes/NOPE/key', headers: { origin: ORIGIN } });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'box_not_found' });
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });
});

describe('OPTIONS envelopes', () => {
  it('answers the preflight for an allowed origin', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: `/api/sm-relay/boxes/${boxId}/envelopes`,
      headers: { origin: ORIGIN, 'access-control-request-method': 'POST' },
    });
    expect(res.statusCode).toBe(204);
    expectCors(res);
    expect(res.headers['access-control-allow-methods']).toBe('POST');
    expect(res.headers['access-control-allow-headers']).toBe('Content-Type, X-Sm-Envelope, X-Sm-Report-Id');
    expect(res.headers['access-control-max-age']).toBe('600');
  });

  it('refuses another origin without an allow-origin header', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: `/api/sm-relay/boxes/${boxId}/envelopes`,
      headers: { origin: OTHER, 'access-control-request-method': 'POST' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'origin_not_allowed' });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });
});

describe('POST envelopes', () => {
  it('stores exactly the posted bytes, answers 201 with the host id and nudges the device', async () => {
    const sent: any[] = [];
    deviceConns.set(DEVICE, {
      ws: { readyState: WebSocket.OPEN, send: (d: string) => sent.push(JSON.parse(d)) },
      deviceId: DEVICE,
    } as any);
    const body = Buffer.concat([envelope(), crypto.randomBytes(1024 * 1024 + 17)]);
    const res = await postEnv({ body });
    expect(res.statusCode).toBe(201);
    expectCors(res);
    const { id } = res.json();
    expect(typeof id).toBe('string');

    const rows = await dbAll<{ envelope_id: string }>('SELECT envelope_id FROM sm_relay_envelopes WHERE box_id = ? AND host_id = ?', boxId, id);
    expect(rows).toHaveLength(1);
    const chunks = await dbAll<{ content: unknown }>(
      'SELECT content FROM sm_relay_envelope_chunks WHERE envelope_id = ? ORDER BY idx', rows[0].envelope_id,
    );
    expect(chunks.length).toBe(2);
    const stored = Buffer.concat(chunks.map((c) => {
      const raw = c.content as any;
      return raw instanceof ArrayBuffer ? Buffer.from(new Uint8Array(raw)) : Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
    }));
    expect(stored.equals(body)).toBe(true);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: 'box:envelope', boxId });
    expect(sent[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof sent[0].ts).toBe('number');
    expect(Object.keys(sent[0]).sort()).toEqual(['boxId', 'id', 'ts', 'type']);
  });

  it('does nothing for an offline device', async () => {
    const res = await postEnv();
    expect(res.statusCode).toBe(201);
  });

  it('answers 200 with the first id for a repeated report id', async () => {
    const reportId = crypto.randomUUID();
    const first = await postEnv({ reportId });
    expect(first.statusCode).toBe(201);
    const again = await postEnv({ reportId, body: envelope('other') });
    expect(again.statusCode).toBe(200);
    expectCors(again);
    expect(again.json()).toEqual({ id: first.json().id });
  });

  it('refuses another or missing origin without an allow-origin header', async () => {
    for (const origin of [OTHER, null]) {
      const res = await postEnv({ origin });
      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ error: 'origin_not_allowed' });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }
    const n = await dbAll('SELECT 1 FROM sm_relay_envelopes');
    expect(n).toHaveLength(0);
  });

  it('404s an unknown box', async () => {
    const res = await postEnv({ box: 'NOPE' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'box_not_found' });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('410s a paused box', async () => {
    await updateBox(boxId, { state: 'paused' });
    const res = await postEnv();
    expect(res.statusCode).toBe(410);
    expect(res.json()).toEqual({ error: 'box_paused' });
    expectCors(res);
  });

  it('400s a missing X-Sm-Envelope', async () => {
    const res = await postEnv({ headers: { 'x-sm-envelope': '2' } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'bad_envelope' });
    expectCors(res);
  });

  it('400s a non-uuid report id', async () => {
    const res = await postEnv({ reportId: 'not-a-uuid' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_report_id' });
    expectCors(res);
  });

  it('400s a body without the SMF1 magic, a magic-only body and a wrong content type', async () => {
    for (const body of [Buffer.from('XXXX1234'), Buffer.from('SMF1')]) {
      const res = await postEnv({ body });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'bad_envelope' });
      expectCors(res);
    }
    const res = await postEnv({ headers: { 'content-type': 'text/plain' }, body: 'SMF1abc' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'bad_envelope' });
    expectCors(res);
  });

  it('413s a body over 12 MiB, by Content-Length and by the parser limit', async () => {
    const big = Buffer.alloc(MAX_ENVELOPE_BYTES + 1, 0x41);
    big.write('SMF1');
    const res = await postEnv({ body: big });
    expect(res.statusCode).toBe(413);
    expectCors(res);

    // A streamed body has no Content-Length, so the scoped parser's bodyLimit answers.
    const streamed = await postEnv({ body: Readable.from([big]) });
    expect(streamed.statusCode).toBe(413);
    expectCors(streamed);
    const n = await dbAll('SELECT 1 FROM sm_relay_envelopes');
    expect(n).toHaveLength(0);
  });

  it('accepts a body of exactly 12 MiB', async () => {
    const max = Buffer.alloc(MAX_ENVELOPE_BYTES, 0x41);
    max.write('SMF1');
    const res = await postEnv({ body: max });
    expect(res.statusCode).toBe(201);
  });

  it('429s past 10 requests a minute from one client IP (rightmost X-Forwarded-For)', async () => {
    const ip = '198.51.100.7';
    for (let i = 0; i < 10; i++) expect((await postEnv({ ip })).statusCode).toBe(201);
    const res = await postEnv({ ip });
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ error: 'rate_limited' });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expectCors(res);
    expect((await postEnv({ ip: '198.51.100.8' })).statusCode).toBe(201);
  });

  it('429s past 60 requests an hour to one box', async () => {
    for (let i = 0; i < 60; i++) expect((await postEnv()).statusCode).toBe(201);
    const res = await postEnv();
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ error: 'rate_limited' });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expectCors(res);
  });

  it('507s when the box is full', async () => {
    await dbRun(
      `INSERT INTO sm_relay_envelopes (envelope_id, box_id, host_id, client_report_id, origin, bytes, chunks, received_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      crypto.randomUUID(), boxId, 'FILLER', crypto.randomUUID(), ORIGIN, MAX_BOX_BYTES, Date.now(),
    );
    const res = await postEnv();
    expect(res.statusCode).toBe(507);
    expect(res.json()).toEqual({ error: 'box_full' });
    expectCors(res);
  });
});

// Regression: in production async onSend hooks (security headers, compress, ...) delay the socket
// write, so an async onRequest guard that replies without returning the reply let Fastify run the
// handler too. A bare app with only sync writes hides that, so this one yields in onSend.
describe('early rejections with a slow global onSend hook', () => {
  let slowApp: FastifyInstance;

  beforeAll(async () => {
    slowApp = Fastify();
    slowApp.addHook('onSend', async (_req, _reply, payload) => {
      await new Promise((r) => setTimeout(r, 5));
      return payload;
    });
    await slowApp.register(cors, { origin: true, credentials: true });
    registerSmRelayBoxIngestRoutes(slowApp);
    await slowApp.ready();
  });

  function slowPost(headers: Record<string, string>, ip: string) {
    return slowApp.inject({
      method: 'POST',
      url: `/api/sm-relay/boxes/${boxId}/envelopes`,
      headers: {
        'content-type': 'application/octet-stream',
        'x-sm-report-id': crypto.randomUUID(),
        'x-forwarded-for': `203.0.113.9, ${ip}`,
        origin: ORIGIN,
        ...headers,
      },
      payload: envelope(),
    });
  }

  async function stored(): Promise<number> {
    return (await dbAll('SELECT 1 FROM sm_relay_envelopes WHERE box_id = ?', boxId)).length;
  }

  it('OPTIONS on an unknown box 404s without preflight headers', async () => {
    const res = await slowApp.inject({
      method: 'OPTIONS',
      url: '/api/sm-relay/boxes/ZZZZZZZZ/envelopes',
      headers: { origin: ORIGIN, 'access-control-request-method': 'POST' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'box_not_found' });
    expect(res.headers['access-control-allow-methods']).toBeUndefined();
  });

  it('OPTIONS from a disallowed origin 403s without preflight headers', async () => {
    const res = await slowApp.inject({
      method: 'OPTIONS',
      url: `/api/sm-relay/boxes/${boxId}/envelopes`,
      headers: { origin: OTHER, 'access-control-request-method': 'POST' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.headers['access-control-allow-methods']).toBeUndefined();
  });

  it('POST without X-Sm-Envelope 400s and stores nothing', async () => {
    const res = await slowPost({}, freshIp());
    expect(res.statusCode).toBe(400);
    expect(await stored()).toBe(0);
  });

  it('POST past the per-IP limit 429s and stores nothing extra', async () => {
    const ip = '198.51.100.99';
    for (let i = 0; i < 10; i++) expect((await slowPost({ 'x-sm-envelope': '1' }, ip)).statusCode).toBe(201);
    const res = await slowPost({ 'x-sm-envelope': '1' }, ip);
    expect(res.statusCode).toBe(429);
    expect(await stored()).toBe(10);
  });
});
