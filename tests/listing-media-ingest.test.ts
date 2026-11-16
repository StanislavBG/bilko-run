import { createHash } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initDb } from '../server/db.js';
import { registerListingMediaRoutes } from '../server/routes/listing-media.js';
import { isListingMediaDeclared } from '../server/services/listing-media-declared.js';
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

  function mockFetch(status: number, body: unknown) {
    return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status }),
    );
  }

  it('finds a path declared on GitHub main only, with the fixed URL and headers', async () => {
    const fetch = mockFetch(200, entry({ shareImage: path }));
    expect(await isListingMediaDeclared('demo', file, { fetch, deployed: entry({}) })).toBe('shareImage');
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe('https://api.github.com/repos/StanislavBG/bilko-run/contents/src/data/standalone-projects.json?ref=main');
    const headers = new Headers(init?.headers);
    expect(headers.get('accept')).toBe('application/vnd.github.raw+json');
    expect(headers.get('user-agent')).toBe('bilko-run');
    expect(init?.signal).toBeDefined();

    // Cached: a second lookup inside 30 s does not refetch.
    expect(await isListingMediaDeclared('demo', file, { fetch, deployed: entry({}) })).toBe('shareImage');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('finds a path in the deployed registry without calling GitHub', async () => {
    const fetch = mockFetch(200, []);
    expect(await isListingMediaDeclared('demo', file, { fetch, deployed: entry({ video: path }) })).toBe('video');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers undefined when neither registry declares it', async () => {
    const fetch = mockFetch(200, entry({ shareImage: `/projects/demo/_media/${'b'.repeat(64)}.png` }));
    expect(await isListingMediaDeclared('demo', file, { fetch, deployed: entry({}) })).toBeUndefined();
    // Declared on another slug's entry does not count.
    expect(await isListingMediaDeclared('other', file, { fetch, deployed: [] })).toBeUndefined();
  });

  it('treats a GitHub 500 as not declared there and still honours the deployed registry', async () => {
    const fetch = mockFetch(500, { message: 'boom' });
    expect(await isListingMediaDeclared('demo', file, { fetch, deployed: entry({}) })).toBeUndefined();
    expect(await isListingMediaDeclared('demo', file, { fetch, deployed: entry({ icon: path }) })).toBe('icon');
  });

  it('rejects bad slugs and file names without any lookup', async () => {
    const fetch = mockFetch(200, entry({ icon: path }));
    expect(await isListingMediaDeclared('../demo', file, { fetch, deployed: [] })).toBeUndefined();
    expect(await isListingMediaDeclared('demo', 'x.png', { fetch, deployed: [] })).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
