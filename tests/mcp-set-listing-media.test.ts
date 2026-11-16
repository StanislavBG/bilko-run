import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { setListingMedia } from '../mcp-host-server/src/listing-media-tool.js';
import { hostedMediaPath } from '../mcp-host-server/src/contract/listing-media.js';

const exec = promisify(execFile);

process.env.GIT_AUTHOR_NAME = 'Test Author';
process.env.GIT_AUTHOR_EMAIL = 'test-author@example.com';
process.env.GIT_COMMITTER_NAME = 'Test Committer';
process.env.GIT_COMMITTER_EMAIL = 'test-committer@example.com';

const REGISTRY = 'src/data/standalone-projects.json';
const BASE_URL = 'https://bilko.test';

async function git(cwd: string, args: string[]): Promise<string> {
  return (await exec('git', args, { cwd })).stdout.trim();
}

function png(width: number, height: number): Buffer {
  const buf = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'latin1');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf.write(`${width}x${height}`, 30, 'latin1');
  return buf;
}
function mp4(extra = 'clip'): Buffer {
  const head = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  return Buffer.concat([head, Buffer.from(extra)]);
}
function webm(): Buffer {
  return Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('webm-body')]);
}
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

interface Put { url: string; method?: string; contentType: string | null; body: Buffer }

function recordingFetch(statuses: number[] = []) {
  const puts: Put[] = [];
  const queue = [...statuses];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const body = Buffer.from(init?.body as Uint8Array);
    puts.push({ url: String(url), method: init?.method, contentType: headers.get('content-type'), body });
    const status = queue.length > 0 ? queue.shift()! : 201;
    return new Response(status === 204 ? null : 'x', { status });
  }) as typeof fetch;
  return { fn, puts };
}

let tmp: string;
let originDir: string;
let hostDir: string;
let checkoutDir: string;
let owner: string;
let files: string;

function registry() {
  return [
    {
      slug: 'ext', name: 'Ext', tagline: 'T', category: 'Game', status: 'live', year: 2026,
      host: { kind: 'external-url', url: 'https://ext.example.app', localPath: owner },
    },
    {
      slug: 'stat', name: 'Stat', tagline: 'T', category: 'Game', status: 'live', year: 2026,
      host: { kind: 'static-path', path: '/projects/stat/', localPath: owner },
      listing: { video: '/projects/stat/old.mp4', detail: 'keep me' },
    },
  ];
}

async function originRegistry(): Promise<{ projects: any[]; lastFiles: string; subject: string; count: number }> {
  const dir = await mkdtemp(join(tmp, 'verify-'));
  await exec('git', ['clone', '--quiet', originDir, dir]);
  const projects = JSON.parse(await readFile(join(dir, REGISTRY), 'utf8'));
  const lastFiles = await git(dir, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']);
  const subject = await git(dir, ['log', '-1', '--format=%s']);
  const count = Number(await git(dir, ['rev-list', '--count', 'HEAD']));
  return { projects, lastFiles, subject, count };
}

function deps(fetchFn: typeof fetch, extra: Record<string, unknown> = {}) {
  return { hostRoot: hostDir, checkoutDir, fetch: fetchFn, baseUrl: BASE_URL, retryDelaysMs: [1, 1, 1, 1], ...extra };
}

async function put(name: string, bytes: Buffer): Promise<string> {
  const p = join(files, name);
  await writeFile(p, bytes);
  return p;
}

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'set-listing-media-'));
  originDir = resolve(tmp, 'origin.git');
  hostDir = resolve(tmp, 'host');
  checkoutDir = resolve(tmp, 'checkout');
  owner = resolve(tmp, 'owner-repo');
  files = resolve(tmp, 'files');
  await mkdir(owner, { recursive: true });
  await mkdir(files, { recursive: true });
  await mkdir(originDir, { recursive: true });
  await git(originDir, ['init', '--bare', '-b', 'main']);
  await exec('git', ['clone', '--quiet', originDir, hostDir]);
  await mkdir(join(hostDir, 'src/data'), { recursive: true });
  await writeFile(join(hostDir, REGISTRY), JSON.stringify(registry(), null, 2) + '\n', 'utf8');
  await writeFile(join(hostDir, 'README.md'), 'host\n', 'utf8');
  await git(hostDir, ['add', '.']);
  await git(hostDir, ['commit', '-m', 'seed']);
  await git(hostDir, ['push', '--quiet', 'origin', 'main']);
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('setListingMedia', () => {
  it('external-url: commits hosted paths for video, shareImage and icon, then PUTs exact bytes', async () => {
    const video = mp4();
    const share = png(1200, 630);
    const icon = png(256, 256);
    const media = {
      video: await put('clip.mp4', video),
      shareImage: await put('share.png', share),
      icon: await put('icon.png', icon),
    };
    const { fn, puts } = recordingFetch([201, 200, 201]);

    const res = await setListingMedia({ slug: 'ext', callerRepoPath: owner, media }, deps(fn));
    expect(res.ok, res.text).toBe(true);

    const o = await originRegistry();
    expect(o.subject).toBe('listing: media ext');
    expect(o.lastFiles).toBe(REGISTRY);
    const entry = o.projects.find((p) => p.slug === 'ext');
    expect(entry.listing).toEqual({
      video: hostedMediaPath('ext', sha(video), 'mp4'),
      shareImage: hostedMediaPath('ext', sha(share), 'png'),
      icon: hostedMediaPath('ext', sha(icon), 'png'),
    });

    expect(puts).toHaveLength(3);
    const byUrl = new Map(puts.map((p) => [p.url, p]));
    const vurl = `${BASE_URL}/api/listing-media/ext/${sha(video)}.mp4`;
    const surl = `${BASE_URL}/api/listing-media/ext/${sha(share)}.png`;
    const iurl = `${BASE_URL}/api/listing-media/ext/${sha(icon)}.png`;
    expect(byUrl.get(vurl)?.body.equals(video)).toBe(true);
    expect(byUrl.get(vurl)?.contentType).toBe('video/mp4');
    expect(byUrl.get(vurl)?.method).toBe('PUT');
    expect(byUrl.get(surl)?.body.equals(share)).toBe(true);
    expect(byUrl.get(surl)?.contentType).toBe('image/png');
    expect(byUrl.get(iurl)?.body.equals(icon)).toBe(true);

    expect(res.text).toContain(`listing: video -> ${hostedMediaPath('ext', sha(video), 'mp4')}`);
    expect(res.text).toMatch(/pushed: [0-9a-f]{7,}/);
    expect(res.text).toContain(`uploaded: ${vurl}`);
    expect(res.text).toContain(`already stored: ${surl}`);
    expect(res.text).toContain('bilko.run redeploys in about a minute; the card shows the new media after that.');
  });

  it('static-path: webm video replaces the bundle path, null removes a key and uploads nothing, other listing keys kept', async () => {
    const video = webm();
    const { fn, puts } = recordingFetch();
    const res = await setListingMedia(
      { slug: 'stat', callerRepoPath: owner, media: { video: await put('clip.webm', video), icon: null } },
      deps(fn),
    );
    expect(res.ok, res.text).toBe(true);
    const o = await originRegistry();
    expect(o.subject).toBe('listing: media stat');
    expect(o.lastFiles).toBe(REGISTRY);
    const entry = o.projects.find((p) => p.slug === 'stat');
    expect(entry.listing).toEqual({ video: hostedMediaPath('stat', sha(video), 'webm'), detail: 'keep me' });
    expect(puts.map((p) => p.url)).toEqual([`${BASE_URL}/api/listing-media/stat/${sha(video)}.webm`]);
    expect(puts[0].contentType).toBe('video/webm');
    expect(res.text).toContain('listing: icon removed');
  });

  it('null alone removes the key and uploads nothing', async () => {
    const { fn, puts } = recordingFetch();
    const res = await setListingMedia({ slug: 'stat', callerRepoPath: owner, media: { video: null } }, deps(fn));
    expect(res.ok, res.text).toBe(true);
    const entry = (await originRegistry()).projects.find((p) => p.slug === 'stat');
    expect(entry.listing).toEqual({ detail: 'keep me' });
    expect(puts).toHaveLength(0);
    expect(res.text).toContain('listing: video removed');
  });

  it('never writes into public/projects/<slug>/', async () => {
    const { fn } = recordingFetch();
    await setListingMedia({ slug: 'stat', callerRepoPath: owner, media: { icon: await put('i.png', png(128, 128)) } }, deps(fn));
    const dir = await mkdtemp(join(tmp, 'ls-'));
    await exec('git', ['clone', '--quiet', originDir, dir]);
    expect(await git(dir, ['ls-tree', '-r', '--name-only', 'HEAD'])).not.toContain('public/projects');
  });

  describe('rejections leave origin unchanged and PUT nothing', () => {
    const cases: [string, () => Promise<{ slug?: string; caller?: string; media: Record<string, string | null> }>, RegExp][] = [
      ['foreign caller', async () => ({ caller: '/tmp/not-the-owner', media: { icon: await put('i.png', png(256, 256)) } }), /owned by/],
      ['unknown slug', async () => ({ slug: 'nope', media: { icon: await put('i.png', png(256, 256)) } }), /nope.*not found/],
      ['empty media', async () => ({ media: {} }), /media/],
      ['missing file', async () => ({ media: { icon: join(files, 'missing.png') } }), /icon.*not found/],
      ['relative path', async () => ({ media: { icon: 'icon.png' } }), /icon.*absolute/],
      ['wrong extension for icon', async () => ({ media: { icon: await put('i.mp4', mp4()) } }), /icon.*\.png/],
      ['wrong extension for video', async () => ({ media: { video: await put('v.png', png(1200, 630)) } }), /video.*\.mp4.*\.webm/],
      ['wrong share image size', async () => ({ media: { shareImage: await put('s.png', png(1000, 630)) } }), /shareImage.*1200x630/],
      ['mp4 without ftyp', async () => ({ media: { video: await put('v.mp4', Buffer.from('not a video at all')) } }), /video.*not an MP4/],
      ['webm without EBML', async () => ({ media: { video: await put('v.webm', Buffer.from('not a webm at all')) } }), /video.*not a WebM/],
      ['video over 8 MB', async () => ({ media: { video: await put('big.mp4', Buffer.concat([mp4(), Buffer.alloc(8 * 1024 * 1024)])) } }), /video.*8 MB/],
    ];
    for (const [name, make, re] of cases) {
      it(name, async () => {
        const before = await originRegistry();
        const { fn, puts } = recordingFetch();
        const c = await make();
        const res = await setListingMedia(
          { slug: c.slug ?? 'ext', callerRepoPath: c.caller ?? owner, media: c.media as never },
          deps(fn),
        );
        expect(res.ok).toBe(false);
        expect(res.text).toMatch(re);
        const after = await originRegistry();
        expect(after.count).toBe(before.count);
        expect(after.projects).toEqual(before.projects);
        expect(puts).toHaveLength(0);
      });
    }
  });

  it('retries a 404 PUT after each delay, then succeeds', async () => {
    const { fn, puts } = recordingFetch([404, 404, 201]);
    const res = await setListingMedia(
      { slug: 'ext', callerRepoPath: owner, media: { icon: await put('i.png', png(256, 256)) } },
      deps(fn),
    );
    expect(res.ok, res.text).toBe(true);
    expect(puts).toHaveLength(3);
    expect(res.text).toMatch(/uploaded: /);
  });

  it('a final failure says to run set_listing_media again; a re-run with unchanged files makes no commit and re-PUTs', async () => {
    const icon = await put('i.png', png(256, 256));
    const fail = recordingFetch([404, 404, 404, 404, 404]);
    const res = await setListingMedia({ slug: 'ext', callerRepoPath: owner, media: { icon } }, deps(fail.fn));
    expect(res.ok).toBe(false);
    expect(fail.puts).toHaveLength(5);
    expect(res.text).toMatch(/run set_listing_media again with the same files/);
    const afterFirst = await originRegistry();
    expect(afterFirst.subject).toBe('listing: media ext');

    const again = recordingFetch([200]);
    const res2 = await setListingMedia({ slug: 'ext', callerRepoPath: owner, media: { icon } }, deps(again.fn));
    expect(res2.ok, res2.text).toBe(true);
    expect(res2.text).toContain('no changes to commit');
    expect(res2.text).toContain('already stored: ');
    expect(again.puts).toHaveLength(1);
    expect((await originRegistry()).count).toBe(afterFirst.count);
  });

  it('a non-404 failure is not retried', async () => {
    const { fn, puts } = recordingFetch([500]);
    const res = await setListingMedia(
      { slug: 'ext', callerRepoPath: owner, media: { icon: await put('i.png', png(256, 256)) } },
      deps(fn),
    );
    expect(res.ok).toBe(false);
    expect(puts).toHaveLength(1);
    expect(res.text).toMatch(/500/);
  });

  it('defaults retryDelaysMs to [2000, 5000, 10000, 20000]', async () => {
    const mod = await import('../mcp-host-server/src/listing-media-tool.js');
    expect(mod.DEFAULT_RETRY_DELAYS_MS).toEqual([2000, 5000, 10000, 20000]);
  });
});
