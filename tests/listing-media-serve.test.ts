import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import staticPlugin from '@fastify/static';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerListingMediaRoutes } from '../server/routes/listing-media.js';
import type { ListingMedia, ListingMediaMeta } from '../server/services/listing-media.js';

const IMMUTABLE = 'public, max-age=31536000, immutable';

const bytes = Buffer.from(Array.from({ length: 100 }, (_, i) => i));
const hash = createHash('sha256').update(bytes).digest('hex');
const mp4 = `${hash}.mp4`;
const etag = `"${hash.slice(0, 16)}"`;

const media: ListingMedia = { content: bytes, bytes: bytes.length, hasAudio: true, contentType: 'video/mp4' };
const store = new Map<string, ListingMedia>([[`demo/${mp4}`, media]]);

const deps = {
  getMedia: async (slug: string, file: string) => store.get(`${slug}/${file}`) ?? null,
  getMeta: async (slug: string, file: string): Promise<ListingMediaMeta | null> => {
    const m = store.get(`${slug}/${file}`);
    return m ? { bytes: m.bytes, hasAudio: m.hasAudio, contentType: m.contentType } : null;
  },
};

describe('listing media serve route', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = Fastify();
    registerListingMediaRoutes(app, deps);
    await app.ready();
  });
  afterAll(() => app.close());

  const url = (file: string, slug = 'demo') => `/projects/${slug}/_media/${file}`;

  it('serves a stored file with immutable caching headers', async () => {
    const res = await app.inject({ method: 'GET', url: url(mp4) });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('video/mp4');
    expect(res.headers['content-length']).toBe('100');
    expect(res.headers['cache-control']).toBe(IMMUTABLE);
    expect(res.headers.etag).toBe(etag);
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.rawPayload.equals(bytes)).toBe(true);
  });

  it('HEAD returns the headers without a body', async () => {
    const res = await app.inject({ method: 'HEAD', url: url(mp4) });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-length']).toBe('100');
    expect(res.headers['content-type']).toBe('video/mp4');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.rawPayload.length).toBe(0);
  });

  it('answers 304 on a matching If-None-Match', async () => {
    const res = await app.inject({ method: 'GET', url: url(mp4), headers: { 'if-none-match': etag } });
    expect(res.statusCode).toBe(304);
    expect(res.rawPayload.length).toBe(0);
    const weak = await app.inject({ method: 'GET', url: url(mp4), headers: { 'if-none-match': `W/${etag}` } });
    expect(weak.statusCode).toBe(304);
    const other = await app.inject({ method: 'GET', url: url(mp4), headers: { 'if-none-match': '"nope"' } });
    expect(other.statusCode).toBe(200);
  });

  it.each([
    ['bytes=10-19', 10, 19],
    ['bytes=90-', 90, 99],
    ['bytes=-5', 95, 99],
    ['bytes=95-500', 95, 99],
    ['bytes=0-0', 0, 0],
  ])('%s answers 206 with exactly those bytes', async (range, a, b) => {
    const res = await app.inject({ method: 'GET', url: url(mp4), headers: { range } });
    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe(`bytes ${a}-${b}/100`);
    expect(res.headers['content-length']).toBe(String(b - a + 1));
    expect(res.headers['cache-control']).toBe(IMMUTABLE);
    expect(res.headers['content-type']).toBe('video/mp4');
    expect(res.rawPayload.equals(bytes.subarray(a, b + 1))).toBe(true);
  });

  it('HEAD with a range answers 206 headers only', async () => {
    const res = await app.inject({ method: 'HEAD', url: url(mp4), headers: { range: 'bytes=0-9' } });
    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 0-9/100');
    expect(res.headers['content-length']).toBe('10');
    expect(res.rawPayload.length).toBe(0);
  });

  it.each(['bytes=100-', 'bytes=200-300', 'bytes=50-10', 'bytes=-0'])(
    'unsatisfiable %s answers 416',
    async (range) => {
      const res = await app.inject({ method: 'GET', url: url(mp4), headers: { range } });
      expect(res.statusCode).toBe(416);
      expect(res.headers['content-range']).toBe('bytes */100');
    },
  );

  it('a multi-range header answers the full 200', async () => {
    const res = await app.inject({ method: 'GET', url: url(mp4), headers: { range: 'bytes=0-1,5-9' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-range']).toBeUndefined();
    expect(res.headers['content-length']).toBe('100');
    expect(res.rawPayload.equals(bytes)).toBe(true);
  });

  it('<file>.json answers the metadata with immutable caching', async () => {
    const res = await app.inject({ method: 'GET', url: url(`${mp4}.json`) });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.headers['cache-control']).toBe(IMMUTABLE);
    expect(res.json()).toEqual({ bytes: 100, contentType: 'video/mp4', audio: true });
  });

  it.each([
    ['missing file', url(`${'a'.repeat(64)}.mp4`)],
    ['missing meta', url(`${'a'.repeat(64)}.png.json`)],
    ['other slug', url(mp4, 'other')],
    ['bad extension', url(`${hash}.gif`)],
    ['uppercase hash', url(`${hash.toUpperCase()}.mp4`)],
    ['short hash', url(`${hash.slice(1)}.mp4`)],
    ['double json', url(`${mp4}.json.json`)],
    ['traversal', url('..%2F..%2Fetc%2Fpasswd')],
  ])('%s answers 404 no-store', async (_name, u) => {
    const res = await app.inject({ method: 'GET', url: u });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Not found' });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-bilko-media']).toBe('missing');
  });

  it('HEAD on a missing file answers 404', async () => {
    const res = await app.inject({ method: 'HEAD', url: url(`${'b'.repeat(64)}.webm`) });
    expect(res.statusCode).toBe(404);
    expect(res.headers['x-bilko-media']).toBe('missing');
  });
});

describe('listing media route wins over @fastify/static', () => {
  let app: FastifyInstance;
  let root: string;
  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'listing-media-static-'));
    mkdirSync(join(root, 'projects', 'demo', '_media'), { recursive: true });
    writeFileSync(join(root, 'index.html'), '<html>spa</html>');
    writeFileSync(join(root, 'projects', 'demo', 'index.html'), '<html>demo app</html>');
    // A stale on-disk file with the same name must not be served instead of the DB bytes.
    writeFileSync(join(root, 'projects', 'demo', '_media', mp4), 'disk bytes');
    app = Fastify();
    registerListingMediaRoutes(app, deps);
    await app.register(staticPlugin, { root, prefix: '/', redirect: true, cacheControl: false });
    app.setNotFoundHandler(async (_req, reply) => reply.type('text/html').send('<html>spa</html>'));
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('serves the DB bytes, not a redirect or index.html', async () => {
    const res = await app.inject({ method: 'GET', url: `/projects/demo/_media/${mp4}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers.location).toBeUndefined();
    expect(res.headers['cache-control']).toBe(IMMUTABLE);
    expect(res.rawPayload.equals(bytes)).toBe(true);
    const head = await app.inject({ method: 'HEAD', url: `/projects/demo/_media/${mp4}` });
    expect(head.statusCode).toBe(200);
    expect(head.headers['content-length']).toBe('100');
  });

  it('a missing media file 404s from the route, not the SPA fallback', async () => {
    const res = await app.inject({ method: 'GET', url: `/projects/demo/_media/${'c'.repeat(64)}.png` });
    expect(res.statusCode).toBe(404);
    expect(res.headers['x-bilko-media']).toBe('missing');
    expect(res.json()).toEqual({ error: 'Not found' });
  });

  it('the app itself is still served by the static plugin', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/demo/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('demo app');
  });
});
