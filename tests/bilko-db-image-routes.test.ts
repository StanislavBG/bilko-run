import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import compress from '@fastify/compress';
import { gunzipSync } from 'node:zlib';
import { initDb, dbRun } from '../server/db.js';
import { IMAGE_MAX_BYTES, USER_QUOTA_BYTES } from '../server/services/bilko-db.js';

// Bearer "a" → user A, "b" → user B, anything else → 401.
vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  const users: Record<string, string> = { 'Bearer a': 'a@t.dev', 'Bearer b': 'b@t.dev' };
  return {
    ...original,
    requireAuth: vi.fn().mockImplementation(async (req: any, reply: any) => {
      const email = users[req.headers.authorization ?? ''];
      if (email) return email;
      reply.status(401).send({ error: 'Sign in required.' });
      return null;
    }),
  };
});

import { registerBilkoDbRoutes, bilkoDbWriteLimiter } from '../server/routes/bilko-db.js';

const app = Fastify({ logger: false });
// Global compression that WOULD compress images (threshold 0, image/* compressible), so the
// public GET's route-level `compress: false` is what keeps the bytes untouched.
await app.register(compress, { threshold: 0, encodings: ['gzip'], customTypes: /^image\/|json/u });
// Mirror server/index.ts's global JSON parser.
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
  try { done(null, JSON.parse((body as Buffer).toString())); } catch (err) { done(err as Error, undefined); }
});
registerBilkoDbRoutes(app);

const A = { authorization: 'Bearer a' };
const B = { authorization: 'Bearer b' };

// ---------- image builders ----------
function jpegSegment(marker: number, payload: Buffer): Buffer {
  const head = Buffer.from([0xff, marker, 0, 0]);
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
}
const APP0 = jpegSegment(0xe0, Buffer.from([0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]));
const DQT = jpegSegment(0xdb, Buffer.concat([Buffer.from([0]), Buffer.alloc(64, 1)]));
const SOF0 = jpegSegment(0xc0, Buffer.from([8, 0, 1, 0, 1, 1, 1, 0x11, 0]));
const SOS = jpegSegment(0xda, Buffer.from([1, 1, 0, 0, 63, 0]));
const SCAN = Buffer.from([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56]);
const EOI = Buffer.from([0xff, 0xd9]);
const EXIF_APP1 = jpegSegment(0xe1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from('MM\0*GPS-LAT-37.77', 'latin1')]));
const makeJpeg = (app1: Buffer[] = []) => Buffer.concat([Buffer.from([0xff, 0xd8]), APP0, ...app1, DQT, SOF0, SOS, SCAN, EOI]);
// The classic 1x1 transparent GIF89a.
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

function upload(bytes: Buffer, type: string, headers: Record<string, string> = A, appName = 'photos') {
  return app.inject({ method: 'POST', url: `/api/db/${appName}/images`, payload: bytes, headers: { 'content-type': type, ...headers } });
}
const list = (headers: Record<string, string> = A, appName = 'photos') =>
  app.inject({ method: 'GET', url: `/api/db/${appName}/images`, headers });
const del = (id: string, headers: Record<string, string> = A, appName = 'photos') =>
  app.inject({ method: 'DELETE', url: `/api/db/${appName}/images/${id}`, headers });
const pub = (id: string, appName = 'photos', headers: Record<string, string> = {}) =>
  app.inject({ method: 'GET', url: `/api/db/${appName}/images/${id}`, headers });

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM bilko_db_docs');
  await dbRun('DELETE FROM bilko_db_images');
  await dbRun('DELETE FROM bilko_db_image_chunks');
  bilkoDbWriteLimiter.reset();
});

describe('POST /api/db/:app/images', () => {
  it('stores each allowed type and answers 201 with id, url, type, bytes, createdAt', async () => {
    const res = await upload(GIF, 'image/gif');
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toEqual({
      id: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/),
      url: `/api/db/photos/images/${body.id}`,
      type: 'image/gif',
      bytes: GIF.length,
      createdAt: expect.any(String),
    });
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);
    expect((await upload(makeJpeg(), 'image/jpeg')).statusCode).toBe(201);
  });

  it('401s without a Bearer and 400 bad_app before auth', async () => {
    expect((await upload(GIF, 'image/gif', {})).statusCode).toBe(401);
    expect((await list({})).statusCode).toBe(401);
    expect((await del('x', {})).statusCode).toBe(401);
    const bad = await upload(GIF, 'image/gif', A, 'Bad_App');
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toEqual({ error: 'bad_app' });
  });

  it('400 bad_image when the bytes do not match the type', async () => {
    const res = await upload(GIF, 'image/png');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'bad_image' });
    expect((await upload(Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg')).json()).toEqual({ error: 'bad_image' });
  });

  it('415 for a content type that is not an allowed image type', async () => {
    const res = await upload(Buffer.from('<svg/>'), 'image/svg+xml');
    expect(res.statusCode).toBe(415);
    expect(res.json()).toEqual({ error: 'unsupported_media_type' });
  });

  it('413 too_large over 10 MiB', async () => {
    const big = Buffer.concat([GIF, Buffer.alloc(IMAGE_MAX_BYTES + 1 - GIF.length)]);
    const res = await upload(big, 'image/gif');
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({ error: 'too_large' });
  });

  it('507 quota_exceeded when the user is out of storage', async () => {
    await dbRun(
      `INSERT INTO bilko_db_docs (app, user_email, key, kind, body, bytes, version, updated_at) VALUES (?, ?, ?, 'text', '', ?, 1, ?)`,
      'other-app', 'a@t.dev', 'filler', USER_QUOTA_BYTES - GIF.length + 1, Date.now(),
    );
    const res = await upload(GIF, 'image/gif');
    expect(res.statusCode).toBe(507);
    expect(res.json()).toEqual({ error: 'quota_exceeded' });
    expect((await upload(GIF, 'image/gif', B)).statusCode).toBe(201);
  });

  it('429 rate_limited from the write limiter shared with documents', async () => {
    // 299 writes elsewhere (e.g. document PUTs) plus one doc PUT exhaust the shared budget.
    for (let i = 0; i < 299; i++) bilkoDbWriteLimiter.hit('a@t.dev');
    const doc = await app.inject({ method: 'PUT', url: '/api/db/photos/docs/k', payload: 'x', headers: { 'content-type': 'text/plain', ...A } });
    expect(doc.statusCode).toBe(200);
    const res = await upload(GIF, 'image/gif');
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe('rate_limited');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect((await del('whatever')).statusCode).toBe(429);
    // Reads are not limited; another user is unaffected.
    expect((await list()).statusCode).toBe(200);
    expect((await upload(GIF, 'image/gif', B)).statusCode).toBe(201);
  });
});

describe('list and delete', () => {
  it('lists only the caller\'s images in that app', async () => {
    const a1 = (await upload(GIF, 'image/gif')).json();
    const a2 = (await upload(makeJpeg(), 'image/jpeg')).json();
    await upload(GIF, 'image/gif', B);
    await upload(GIF, 'image/gif', A, 'other-app');
    const res = await list();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ images: [a1, a2] });
    expect((await list(B)).json().images).toHaveLength(1);
  });

  it('deletes only for the owner; 404 not_found otherwise', async () => {
    const img = (await upload(GIF, 'image/gif')).json();
    const byB = await del(img.id, B);
    expect(byB.statusCode).toBe(404);
    expect(byB.json()).toEqual({ error: 'not_found' });
    expect((await del(img.id, A, 'other-app')).statusCode).toBe(404);
    expect((await pub(img.id)).statusCode).toBe(200);

    const ok = await del(img.id);
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ ok: true });
    expect((await del(img.id)).json()).toEqual({ error: 'not_found' });
    expect((await pub(img.id)).statusCode).toBe(404);
    expect((await list()).json()).toEqual({ images: [] });
  });
});

describe('public GET /api/db/:app/images/:id', () => {
  it('serves the bytes with no bearer and the safe headers, uncompressed', async () => {
    const img = (await upload(GIF, 'image/gif')).json();
    const res = await pub(img.id, 'photos', { 'accept-encoding': 'gzip' });
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.equals(GIF)).toBe(true);
    expect(res.headers['content-type']).toBe('image/gif');
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBe("default-src 'none'; sandbox");
    expect(res.headers['content-encoding']).toBeUndefined();
    // Sanity: the global compressor is live for other routes in this app.
    const listed = await app.inject({ method: 'GET', url: '/api/db/photos/images', headers: { ...A, 'accept-encoding': 'gzip' } });
    expect(listed.headers['content-encoding']).toBe('gzip');
    expect(JSON.parse(gunzipSync(listed.rawPayload).toString()).images).toHaveLength(1);
  });

  it('returns a JPEG without its Exif APP1 segment', async () => {
    const withExif = makeJpeg([EXIF_APP1]);
    const img = (await upload(withExif, 'image/jpeg')).json();
    expect(img.bytes).toBe(withExif.length - EXIF_APP1.length);
    const res = await pub(img.id);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.rawPayload.equals(makeJpeg())).toBe(true);
    expect(res.rawPayload.includes(Buffer.from('Exif'))).toBe(false);
    expect(res.rawPayload.includes(Buffer.from('GPS-LAT'))).toBe(false);
  });

  it('404s an unknown id, a malformed id, and an id stored under another app', async () => {
    const img = (await upload(GIF, 'image/gif')).json();
    expect((await pub(img.id, 'other-app')).statusCode).toBe(404);
    expect((await pub(img.id, 'other-app')).json()).toEqual({ error: 'not_found' });
    expect((await pub('A'.repeat(22))).statusCode).toBe(404);
    expect((await pub('not%20an%20id')).statusCode).toBe(404);
    expect((await pub(img.id, 'Bad_App')).statusCode).toBe(404);
  });
});
