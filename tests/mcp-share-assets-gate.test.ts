import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Resvg } from '@resvg/resvg-js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shareAssetsGate } from '../mcp-host-server/src/gates/share-assets.js';
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
