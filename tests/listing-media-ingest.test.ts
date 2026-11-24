import { createHash } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initDb } from '../server/db.js';
import { registerListingMediaRoutes } from '../server/routes/listing-media.js';
import { isListingMediaDeclared, GITHUB_REGISTRY_URL } from '../server/services/listing-media-declared.js';
import type { CardMediaField } from '../shared/listing-media.js';

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

function png(width: number, height: number, seed = 0): Buffer {
  const b = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'latin1');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  b.writeUInt32BE(seed, 40);
  return b;
}

describe('PUT /api/listing-media/:slug/:file', () => {
  let app: FastifyInstance;
  const declared = new Map<string, CardMediaField>();
  const isDeclared = vi.fn(async (slug: string, file: string) => declared.get(`${slug}/${file}`));

  beforeAll(async () => {
    await initDb();
    app = Fastify();
    registerListingMediaRoutes(app, { isDeclared });
    await app.ready();
  });
  afterAll(() => app.close());

  const put = (slug: string, file: string, body: Buffer, ip = '10.0.0.1', type = 'image/png') =>
    app.inject({
      method: 'PUT',
      url: `/api/listing-media/${slug}/${file}`,
      headers: { 'content-type': type },
      payload: body,
      remoteAddress: ip,
    });

  it('answers 404 for an undeclared file and for a bad file name', async () => {
    const buf = png(1200, 630, 1);
    const res = await put('ingest-a', `${sha(buf)}.png`, buf, '10.0.1.1');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not declared' });

    const bad = await put('ingest-a', 'nothash.png', buf, '10.0.1.1');
    expect(bad.statusCode).toBe(404);
    expect(bad.json()).toEqual({ error: 'not declared' });
  });

  it('stores a declared file with 201, then answers 200 existed', async () => {
    const buf = png(1200, 630, 2);
    const file = `${sha(buf)}.png`;
    declared.set(`ingest-b/${file}`, 'shareImage');
    const url = `/projects/ingest-b/_media/${file}`;

    const first = await put('ingest-b', file, buf, '10.0.2.1');
    expect(first.statusCode).toBe(201);
    expect(first.json()).toEqual({ stored: true, url, bytes: buf.length, audio: false });

    const second = await put('ingest-b', file, buf, '10.0.2.1', 'application/octet-stream');
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ stored: true, existed: true, url, bytes: buf.length, audio: false });

    const served = await app.inject({ method: 'GET', url });
    expect(served.statusCode).toBe(200);
    expect(Buffer.compare(served.rawPayload, buf)).toBe(0);
  });

  it('answers 422 when the bytes do not match the sha256 name', async () => {
    const buf = png(1200, 630, 3);
    const file = `${sha(png(1200, 630, 4))}.png`;
    declared.set(`ingest-c/${file}`, 'shareImage');
    const res = await put('ingest-c', file, buf, '10.0.3.1');
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toMatch(/do not match sha256/);
  });

  it('answers 422 for a 1199x630 shareImage', async () => {
    const buf = png(1199, 630, 5);
    const file = `${sha(buf)}.png`;
    declared.set(`ingest-d/${file}`, 'shareImage');
    const res = await put('ingest-d', file, buf, '10.0.4.1');
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toMatch(/1199x630/);
  });

  it('answers 413 over the 8 MiB body limit', async () => {
    const res = await put('ingest-e', `${'0'.repeat(64)}.mp4`, Buffer.alloc(8388609), '10.0.5.1', 'video/mp4');
    expect(res.statusCode).toBe(413);
  });

  it('answers 429 after 20 uploads from one IP in 10 minutes', async () => {
    const buf = png(1200, 630, 6);
    const file = `${sha(buf)}.png`;
    for (let i = 0; i < 20; i++) {
      const res = await put('ingest-f', file, buf, '10.0.6.1');
      expect(res.statusCode).toBe(404);
    }
    const limited = await put('ingest-f', file, buf, '10.0.6.1');
    expect(limited.statusCode).toBe(429);
    const other = await put('ingest-f', file, buf, '10.0.6.2');
    expect(other.statusCode).toBe(404);
  });
});

describe('isListingMediaDeclared', () => {
  const hash = 'a'.repeat(64);
  const file = `${hash}.png`;
  const path = `/projects/demo/_media/${file}`;
  const entry = (listing: Record<string, unknown>) => [{ slug: 'other', listing: { icon: path } }, { slug: 'demo', listing }];

  it('finds a path declared in the registry, never calling fetch', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    try {
      expect(await isListingMediaDeclared('demo', file, { registry: entry({ video: path }) })).toBe('video');
      expect(await isListingMediaDeclared('demo', file, { registry: entry({ icon: path }) })).toBe('icon');
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });

  it('answers undefined when the registry does not declare it', async () => {
    expect(await isListingMediaDeclared('demo', file, { registry: entry({ shareImage: `/projects/demo/_media/${'b'.repeat(64)}.png` }) })).toBeUndefined();
    // Declared on another slug's entry does not count.
    expect(await isListingMediaDeclared('other', file, { registry: [{ slug: 'demo', listing: { icon: `/projects/other/_media/${file}` } }] })).toBeUndefined();
  });

  describe('GitHub-main fallback', () => {
    const github = (listing: Record<string, unknown>) => [{ slug: 'demo', listing }];
    const okFetch = (body: unknown) => vi.fn(async (_u: string, _i?: RequestInit) => new Response(JSON.stringify(body), { status: 200 }));

    it('does not fetch when the snapshot declares the file', async () => {
      const f = okFetch(github({ icon: path }));
      expect(await isListingMediaDeclared('demo', file, { registry: entry({ icon: path }), fetch: f })).toBe('icon');
      expect(f).not.toHaveBeenCalled();
    });

    it('accepts a file only GitHub main declares, fetching exactly the fixed URL', async () => {
      const f = okFetch(github({ shareImage: path }));
      expect(await isListingMediaDeclared('demo', file, { registry: [], fetch: f })).toBe('shareImage');
      expect(f).toHaveBeenCalledTimes(1);
      expect(f.mock.calls[0][0]).toBe(GITHUB_REGISTRY_URL);
    });

    it('refuses when neither declares it', async () => {
      expect(await isListingMediaDeclared('demo', file, { registry: [], fetch: okFetch(github({})) })).toBeUndefined();
    });

    it('refuses on a non-OK response or a thrown fetch', async () => {
      const bad = vi.fn(async () => new Response('nope', { status: 500 }));
      expect(await isListingMediaDeclared('demo', file, { registry: [], fetch: bad })).toBeUndefined();
      const boom = vi.fn(async () => { throw new Error('net'); });
      expect(await isListingMediaDeclared('demo', file, { registry: [], fetch: boom })).toBeUndefined();
    });
  });

  it('rejects bad slugs and file names without any lookup', async () => {
    expect(await isListingMediaDeclared('../demo', file, { registry: entry({ icon: path }) })).toBeUndefined();
    expect(await isListingMediaDeclared('demo', 'x.png', { registry: entry({ icon: path }) })).toBeUndefined();
  });
});
