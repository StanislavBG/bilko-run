import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Resvg } from '@resvg/resvg-js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shareAssetsGate, checkCardMediaFile, validShareAssetFiles } from '../mcp-host-server/src/gates/share-assets.js';
import { budgetGate } from '../mcp-host-server/src/gates/budget.js';
import { randomBytes } from 'node:crypto';
import type { GateContext } from '../mcp-host-server/src/gates/index.js';

function png(width: number, height: number): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#336699"/></svg>`;
  return Buffer.from(new Resvg(svg).render().asPng());
}

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'share-assets-')); mkdirSync(join(dir, 'img')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const put = (rel: string, data: Buffer | string) => writeFileSync(join(dir, rel), data);
const run = (listing?: GateContext['listing']) =>
  shareAssetsGate({ slug: 'demo', bundleDir: dir, bypass: new Set(), listing });

describe('shareAssetsGate', () => {
  it('passes when nothing is declared', async () => {
    const r = await run(undefined);
    expect(r).toMatchObject({ status: 'pass', details: 'no share assets declared' });
    expect((await run({})).status).toBe('pass');
  });

  it('passes with a valid icon and shareImage', async () => {
    put('img/share.png', png(1200, 630));
    put('img/icon.png', png(256, 256));
    const r = await run({ icon: '/projects/demo/img/icon.png', shareImage: '/projects/demo/img/share.png' });
    expect(r.status).toBe('pass');
  });

  it('fails when shareImage is missing', async () => {
    const r = await run({ shareImage: '/projects/demo/img/share.png' });
    expect(r.status).toBe('fail');
    expect(r.details).toContain('shareImage');
    expect(r.details).toContain('/projects/demo/img/share.png');
    expect(r.details).toContain('not found');
  });

  it('fails when shareImage is not a PNG', async () => {
    put('img/share.png', 'not a png at all, just text padding.....');
    expect((await run({ shareImage: '/projects/demo/img/share.png' })).details).toContain('not a PNG');
  });

  it('fails when shareImage is not 1200x630', async () => {
    put('img/share.png', png(1200, 600));
    const r = await run({ shareImage: '/projects/demo/img/share.png' });
    expect(r.status).toBe('fail');
    expect(r.details).toContain('1200x600');
  });

  it('fails when shareImage exceeds 5 MB', async () => {
    put('img/share.png', Buffer.concat([png(1200, 630), Buffer.alloc(5 * 1024 * 1024 + 1)]));
    expect((await run({ shareImage: '/projects/demo/img/share.png' })).details).toContain('5 MB');
  });

  it('fails when icon is missing', async () => {
    const r = await run({ icon: '/projects/demo/img/icon.png' });
    expect(r.status).toBe('fail');
    expect(r.details).toContain('icon /projects/demo/img/icon.png');
  });

  it('fails when icon is not a PNG', async () => {
    put('img/icon.png', 'GIF89a not a png, long enough to read');
    expect((await run({ icon: '/projects/demo/img/icon.png' })).details).toContain('not a PNG');
  });

  it('fails when icon is not square', async () => {
    put('img/icon.png', png(256, 200));
    expect((await run({ icon: '/projects/demo/img/icon.png' })).details).toContain('square');
  });

  it('fails when icon is outside 128-1024 px', async () => {
    put('img/icon.png', png(64, 64));
    expect((await run({ icon: '/projects/demo/img/icon.png' })).details).toContain('128-1024');
    put('img/icon.png', png(1100, 1100));
    expect((await run({ icon: '/projects/demo/img/icon.png' })).status).toBe('fail');
  });

  it('fails when icon exceeds 512 KB', async () => {
    put('img/icon.png', Buffer.concat([png(256, 256), Buffer.alloc(512 * 1024 + 1)]));
    expect((await run({ icon: '/projects/demo/img/icon.png' })).details).toContain('512 KB');
  });

  it('fails when a path escapes the bundle', async () => {
    const r = await run({ icon: '/projects/demo/../../etc/x.png' });
    expect(r.status).toBe('fail');
    expect(r.details).toContain('escapes');
  });
});

const mp4 = (n: number) => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), randomBytes(n)]);
const webm = (n: number) => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(n)]);

describe('shareAssetsGate video', () => {
  it('passes with a valid .mp4', async () => {
    put('img/card.mp4', mp4(1000));
    const r = await run({ video: '/projects/demo/img/card.mp4' });
    expect(r).toMatchObject({ status: 'pass', details: 'valid: video' });
  });

  it('passes with a valid .webm', async () => {
    put('img/card.webm', webm(1000));
    expect((await run({ video: '/projects/demo/img/card.webm' })).status).toBe('pass');
  });

  it('fails when the video is missing', async () => {
    const r = await run({ video: '/projects/demo/img/card.mp4' });
    expect(r.status).toBe('fail');
    expect(r.details).toBe('video /projects/demo/img/card.mp4: file not found in the staged bundle');
  });

  it('fails when an .mp4 holds WebM bytes', async () => {
    put('img/card.mp4', webm(1000));
    const r = await run({ video: '/projects/demo/img/card.mp4' });
    expect(r.status).toBe('fail');
    expect(r.details).toBe('video /projects/demo/img/card.mp4: not an MP4');
  });

  it('fails when a .webm holds MP4 bytes', async () => {
    put('img/card.webm', mp4(1000));
    expect((await run({ video: '/projects/demo/img/card.webm' })).details).toContain('not a WebM');
  });

  it('fails when the video exceeds 8 MB', async () => {
    const big = Buffer.concat([mp4(0), Buffer.alloc(8 * 1024 * 1024 + 1 - 12)]);
    put('img/card.mp4', big);
    const r = await run({ video: '/projects/demo/img/card.mp4' });
    expect(r.status).toBe('fail');
    expect(r.details).toBe(`video /projects/demo/img/card.mp4: is ${8 * 1024 * 1024 + 1} bytes, over the 8 MB limit`);
  });

  it('fails when the video path escapes the bundle', async () => {
    expect((await run({ video: '/projects/demo/../../etc/x.mp4' })).details).toContain('escapes');
  });
});

describe('budgetGate share-asset exclusion', () => {
  const manifest = { bundle: { sizeBytesGz: 0, fileCount: 1 } } as unknown as GateContext['manifest'];
  const budget = (listing?: GateContext['listing']) =>
    budgetGate({ slug: 'demo', bundleDir: dir, bypass: new Set(), manifest, listing });
  // A valid 1200x630 PNG padded with incompressible bytes, so exclusion shows in the measured size.
  const heavyShareImage = () => Buffer.concat([png(1200, 630), randomBytes(250_000)]);

  it('a valid declared shareImage does not count against the budget', async () => {
    put('img/share.png', heavyShareImage());
    put('index.html', '<!doctype html><title>demo</title>');
    const r = await budget({ shareImage: '/projects/demo/img/share.png' });
    expect(r.status).toBe('pass');
    expect(r.details).toContain('excluding 1 share asset');
  });

  it('the same bytes count when the image is not declared, and still pass (no size budget)', async () => {
    put('img/share.png', heavyShareImage());
    const r = await budget(undefined);
    expect(r.status).toBe('pass');
    expect(r.details).not.toContain('excluding');
    expect(r.details).toMatch(/^measured 2\d\d\.\d KB gz/);
  });

  it('an invalid declared shareImage is still measured, and passes', async () => {
    put('img/share.png', Buffer.concat([png(1200, 600), randomBytes(250_000)]));
    const r = await budget({ shareImage: '/projects/demo/img/share.png' });
    expect(r.status).toBe('pass');
    expect(r.details).not.toContain('excluding');
  });

  it('other bundle bytes still count', async () => {
    put('img/share.png', heavyShareImage());
    put('blob.bin', randomBytes(250_000));
    const r = await budget({ shareImage: '/projects/demo/img/share.png' });
    expect(r.status).toBe('pass');
    expect(r.details).toContain('excluding 1 share asset');
    expect(r.details).toMatch(/^measured 2\d\d\.\d KB gz/);
  });

  it('a valid declared 6 MB video does not count against the budget', async () => {
    put('img/card.mp4', mp4(6 * 1024 * 1024));
    put('index.html', '<!doctype html><title>demo</title>');
    const r = await budget({ video: '/projects/demo/img/card.mp4' });
    expect(r.status).toBe('pass');
    expect(r.details).toContain('excluding 1 share asset');
  });

  it('the same video counts when it is not declared, and still passes', async () => {
    put('img/card.mp4', mp4(6 * 1024 * 1024));
    const r = await budget(undefined);
    expect(r.status).toBe('pass');
    expect(r.details).not.toContain('excluding');
  });
});

describe('shareAssetsGate hosted card media', () => {
  const SHA = 'f'.repeat(64);

  it('skips a hosted listing.video that is not in the bundle', async () => {
    const r = await run({ video: `/projects/demo/_media/${SHA}.mp4` });
    expect(r.status).toBe('pass');
  });

  it('still checks bundle assets next to a hosted one', async () => {
    put('img/icon.png', png(256, 256));
    const ctx = { slug: 'demo', bundleDir: dir, bypass: new Set<string>(), listing: {
      icon: '/projects/demo/img/icon.png', shareImage: `/projects/demo/_media/${SHA}.png`,
    } };
    expect((await shareAssetsGate(ctx)).status).toBe('pass');
    expect([...validShareAssetFiles(ctx)]).toEqual([join(dir, 'img/icon.png')]);
    const bad = await run({ icon: '/projects/demo/img/missing.png', video: `/projects/demo/_media/${SHA}.webm` });
    expect(bad.status).toBe('fail');
    expect(bad.details).not.toContain('_media');
  });

  it('fails when the bundle ships a top-level _media folder, even with nothing declared', async () => {
    mkdirSync(join(dir, '_media'));
    const r = await run(undefined);
    expect(r.status).toBe('fail');
    expect(r.details).toContain('_media/ is reserved for hosted card media');
  });

  it('fails when the bundle ships a top-level _media file', async () => {
    put('_media', 'x');
    expect((await run({})).details).toContain('_media/ is reserved for hosted card media');
  });

  it('allows a nested _media folder', async () => {
    mkdirSync(join(dir, 'img', '_media'));
    expect((await run(undefined)).status).toBe('pass');
  });
});

describe('checkCardMediaFile', () => {
  it('accepts valid files', () => {
    put('img/icon.png', png(256, 256));
    put('img/share.png', png(1200, 630));
    put('img/clip.webm', Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(16)]));
    expect(checkCardMediaFile('icon', join(dir, 'img/icon.png'))).toBeUndefined();
    expect(checkCardMediaFile('shareImage', join(dir, 'img/share.png'))).toBeUndefined();
    expect(checkCardMediaFile('video', join(dir, 'img/clip.webm'))).toBeUndefined();
  });

  it('returns today\'s messages', () => {
    put('img/icon.png', png(256, 200));
    put('img/share.png', png(1200, 600));
    put('img/text.png', 'not a png at all, just text padding.....');
    put('img/clip.mp4', 'not an mp4 file at all');
    expect(checkCardMediaFile('icon', join(dir, 'img/icon.png'))).toBe('is 256x200, must be square');
    expect(checkCardMediaFile('shareImage', join(dir, 'img/share.png'))).toBe('is 1200x600, must be exactly 1200x630');
    expect(checkCardMediaFile('icon', join(dir, 'img/text.png'))).toBe('not a PNG');
    expect(checkCardMediaFile('video', join(dir, 'img/clip.mp4'))).toBe('not an MP4');
  });
});
