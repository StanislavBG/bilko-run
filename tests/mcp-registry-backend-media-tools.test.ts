import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setAppBackend } from '../mcp-host-server/src/app-backend-tool.js';
import { setListingMedia } from '../mcp-host-server/src/listing-media-tool.js';
import { hostedMediaPath } from '../mcp-host-server/src/contract/listing-media.js';

const OWNER = '/tmp/registry-backend-media-owner';
const BASE = 'https://bilko.test';

const stat = {
  slug: 'stat', name: 'Stat', tagline: 'T', category: 'Game', status: 'live', year: 2026,
  host: { kind: 'static-path', path: '/projects/stat/', localPath: OWNER },
  listing: { video: '/projects/stat/old.mp4', detail: 'keep me' },
};

function mockApi(version = 3) {
  return {
    read: vi.fn(async () => [{ entry: structuredClone(stat) as Record<string, unknown>, version }]),
    put: vi.fn(async (e: { slug: string }, _v?: number) => ({ slug: e.slug, version: version + 1 })),
  };
}
const mismatch = () => new Error('registry put "stat" failed: HTTP 409 version_mismatch');
const health = (async () => new Response(JSON.stringify({ appBackends: {} }), { status: 200 })) as unknown as typeof fetch;

describe('setAppBackend through the registry API', () => {
  it('writes the backend with the version it read and says it is live', async () => {
    const api = mockApi(5);
    const res = await setAppBackend({ slug: 'stat', callerRepoPath: OWNER, origin: 'https://api.example.com/' }, { baseUrl: BASE, fetch: health, api });
    expect(res.ok, res.text).toBe(true);
    const [entry, v] = api.put.mock.calls[0] as unknown as [{ host: { backend: string } }, number];
    expect(entry.host.backend).toBe('https://api.example.com');
    expect(v).toBe(5);
    expect(res.text).toContain('forwards /projects/stat/api/* -> https://api.example.com/api/*');
    expect(res.text).toContain('live immediately');
    expect(res.text).not.toMatch(/redeploy in|pushed:/);
  });

  it('clears the backend and writes nothing when unchanged', async () => {
    const api = mockApi();
    const none = await setAppBackend({ slug: 'stat', callerRepoPath: OWNER, origin: null }, { baseUrl: BASE, fetch: health, api });
    expect(none).toEqual({ ok: true, text: 'no change: stat' });
    expect(api.put).not.toHaveBeenCalled();
  });

  it('re-reads once on version_mismatch, then gives up on a second', async () => {
    const api = mockApi();
    api.put.mockRejectedValueOnce(mismatch());
    const ok = await setAppBackend({ slug: 'stat', callerRepoPath: OWNER, origin: 'https://api.example.com' }, { baseUrl: BASE, fetch: health, api });
    expect(ok.ok, ok.text).toBe(true);
    expect(api.read).toHaveBeenCalledTimes(2);
    expect(api.put).toHaveBeenCalledTimes(2);

    const bad = mockApi();
    bad.put.mockRejectedValue(mismatch());
    const res = await setAppBackend({ slug: 'stat', callerRepoPath: OWNER, origin: 'https://api.example.com' }, { baseUrl: BASE, fetch: health, api: bad });
    expect(res.ok).toBe(false);
    expect(res.text).toMatch(/changed twice/);
    expect(bad.put).toHaveBeenCalledTimes(2);
  });

  it('refuses a caller that does not own the slug without writing', async () => {
    const api = mockApi();
    const res = await setAppBackend({ slug: 'stat', callerRepoPath: '/tmp/intruder', origin: 'https://api.example.com' }, { baseUrl: BASE, fetch: health, api });
    expect(res.ok).toBe(false);
    expect(res.text).toMatch(/owned by/);
    expect(api.put).not.toHaveBeenCalled();
  });
});

function png(w: number, h: number): Buffer {
  const buf = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'latin1');
  buf.writeUInt32BE(w, 16);
  buf.writeUInt32BE(h, 20);
  return buf;
}

describe('setListingMedia through the registry API', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'media-api-'));
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });
  const uploadFetch = (statuses: number[] = []) => {
    const urls: string[] = [];
    const q = [...statuses];
    const fn = (async (u: string) => {
      urls.push(String(u));
      return new Response('x', { status: q.length ? q.shift()! : 201 });
    }) as unknown as typeof fetch;
    return { fn, urls };
  };

  it('writes the hosted path with the version read, keeps other listing keys, uploads bytes, says live', async () => {
    const bytes = png(256, 256);
    const file = join(tmp, 'i.png');
    await writeFile(file, bytes);
    const api = mockApi(9);
    const { fn, urls } = uploadFetch();
    const res = await setListingMedia(
      { slug: 'stat', callerRepoPath: OWNER, media: { icon: file, video: null } },
      { baseUrl: BASE, api, fetch: fn, retryDelaysMs: [1] },
    );
    expect(res.ok, res.text).toBe(true);
    const sha = createHash('sha256').update(bytes).digest('hex');
    const [entry, v] = api.put.mock.calls[0] as unknown as [{ listing: Record<string, string> }, number];
    expect(entry.listing).toEqual({ icon: hostedMediaPath('stat', sha, 'png'), detail: 'keep me' });
    expect(v).toBe(9);
    expect(urls).toEqual([`${BASE}/api/listing-media/stat/${sha}.png`]);
    expect(res.text).toContain('live immediately');
    expect(res.text).not.toMatch(/redeploy|pushed:/);
  });

  it('re-reads once on version_mismatch and retries', async () => {
    const api = mockApi();
    api.put.mockRejectedValueOnce(mismatch());
    const res = await setListingMedia({ slug: 'stat', callerRepoPath: OWNER, media: { video: null } }, { baseUrl: BASE, api, fetch: uploadFetch().fn });
    expect(res.ok, res.text).toBe(true);
    expect(api.read).toHaveBeenCalledTimes(3); // pre-flight + two attempts
    expect(api.put).toHaveBeenCalledTimes(2);
  });

  it('refuses a foreign caller without writing or uploading', async () => {
    const file = join(tmp, 'i.png');
    await writeFile(file, png(256, 256));
    const api = mockApi();
    const { fn, urls } = uploadFetch();
    const res = await setListingMedia({ slug: 'stat', callerRepoPath: '/tmp/intruder', media: { icon: file } }, { baseUrl: BASE, api, fetch: fn });
    expect(res.ok).toBe(false);
    expect(res.text).toMatch(/owned by/);
    expect(api.put).not.toHaveBeenCalled();
    expect(urls).toHaveLength(0);
  });

  it('a failed upload still reports the registry written and says to re-run', async () => {
    const file = join(tmp, 'i.png');
    await writeFile(file, png(256, 256));
    const res = await setListingMedia(
      { slug: 'stat', callerRepoPath: OWNER, media: { icon: file } },
      { baseUrl: BASE, api: mockApi(), fetch: uploadFetch([500]).fn, retryDelaysMs: [1] },
    );
    expect(res.ok).toBe(false);
    expect(res.text).toMatch(/run set_listing_media again/);
  });
});
