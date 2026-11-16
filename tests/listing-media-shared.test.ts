import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Resvg } from '@resvg/resvg-js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkCardMediaFile } from '../mcp-host-server/src/gates/share-assets.js';
import { parseHostedMediaPath as mcpParse, isHostedMediaPath as mcpIs } from '../mcp-host-server/src/contract/listing-media.js';
import {
  CARD_MEDIA_LIMITS,
  checkCardMediaBytes,
  hostedMediaMetaUrl,
  isHostedMediaPath,
  mediaContentType,
  parseHostedMediaPath,
} from '../shared/listing-media.js';

function png(width: number, height: number): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#336699"/></svg>`;
  return Buffer.from(new Resvg(svg).render().asPng());
}

const mp4 = (): Buffer => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom', 'latin1'), Buffer.alloc(64)]);
const webm = (): Buffer => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(64)]);

type Field = 'icon' | 'shareImage' | 'video';
type Ext = 'png' | 'mp4' | 'webm';
interface Fixture { name: string; field: Field; ext: Ext; bytes: () => Buffer; valid: boolean }

const fixtures: Fixture[] = [
  { name: 'valid icon 256', field: 'icon', ext: 'png', bytes: () => png(256, 256), valid: true },
  { name: 'icon not a PNG', field: 'icon', ext: 'png', bytes: () => Buffer.from('not a png at all, just text padding.....'), valid: false },
  { name: 'icon not square', field: 'icon', ext: 'png', bytes: () => png(256, 200), valid: false },
  { name: 'icon too small', field: 'icon', ext: 'png', bytes: () => png(64, 64), valid: false },
  { name: 'icon too large', field: 'icon', ext: 'png', bytes: () => png(2048, 2048), valid: false },
  { name: 'icon over 512 KB', field: 'icon', ext: 'png', bytes: () => Buffer.concat([png(256, 256), Buffer.alloc(512 * 1024)]), valid: false },
  { name: 'valid shareImage', field: 'shareImage', ext: 'png', bytes: () => png(1200, 630), valid: true },
  { name: 'shareImage not a PNG', field: 'shareImage', ext: 'png', bytes: () => Buffer.from('short'), valid: false },
  { name: 'shareImage wrong size', field: 'shareImage', ext: 'png', bytes: () => png(1200, 600), valid: false },
  { name: 'shareImage over 5 MB', field: 'shareImage', ext: 'png', bytes: () => Buffer.concat([png(1200, 630), Buffer.alloc(5 * 1024 * 1024 + 1)]), valid: false },
  { name: 'valid MP4', field: 'video', ext: 'mp4', bytes: mp4, valid: true },
  { name: 'MP4 without ftyp', field: 'video', ext: 'mp4', bytes: () => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('nope', 'latin1'), Buffer.alloc(64)]), valid: false },
  { name: 'valid WebM', field: 'video', ext: 'webm', bytes: webm, valid: true },
  { name: 'WebM without EBML', field: 'video', ext: 'webm', bytes: () => Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.alloc(64)]), valid: false },
  { name: 'MP4 bytes as WebM', field: 'video', ext: 'webm', bytes: mp4, valid: false },
  { name: 'video of 8388609 bytes', field: 'video', ext: 'mp4', bytes: () => { const b = Buffer.alloc(8388609); mp4().copy(b); return b; }, valid: false },
];

let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'listing-media-shared-')); });
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('checkCardMediaBytes parity with checkCardMediaFile', () => {
  it.each(fixtures.map((f, i) => [f.name, f, i] as const))('%s', (_name, f, i) => {
    const bytes = f.bytes();
    const file = join(dir, `f${i}.${f.ext}`);
    writeFileSync(file, bytes);
    const mcp = checkCardMediaFile(f.field, file);
    const shared = checkCardMediaBytes(f.field, f.ext, bytes);
    expect(shared).toBe(mcp);
    expect(shared === undefined).toBe(f.valid);
  });

  it('rejects an extension that does not fit the field', () => {
    expect(checkCardMediaBytes('icon', 'mp4', png(256, 256))).toMatch(/png/);
    expect(checkCardMediaBytes('shareImage', 'webm', png(1200, 630))).toMatch(/png/);
    expect(checkCardMediaBytes('video', 'png', mp4())).toMatch(/mp4|webm/);
  });
});

describe('hosted media path helpers', () => {
  const sha = 'a'.repeat(64);
  const samples = [
    `/projects/demo/_media/${sha}.png`,
    `/projects/demo-2/_media/${sha}.mp4`,
    `/projects/demo/_media/${sha}.webm`,
    `/projects/demo/_media/${'A'.repeat(64)}.png`,
    `/projects/demo/_media/${'a'.repeat(63)}.png`,
    `/projects/demo/_media/${sha}.jpg`,
    `/projects/demo/_media/../${sha}.png`,
    `/projects/../_media/${sha}.png`,
    `/projects/demo/${sha}.png`,
    `/projects/demo/media/${sha}.png`,
    `/projects/Demo/_media/${sha}.png`,
    '',
  ];

  it.each(samples)('agrees with the MCP copy on %s', (p) => {
    expect(parseHostedMediaPath(p)).toEqual(mcpParse(p));
    expect(isHostedMediaPath(p)).toBe(mcpIs(p));
  });

  it('accepts valid paths and rejects invalid ones', () => {
    expect(parseHostedMediaPath(samples[0])).toEqual({ slug: 'demo', sha256: sha, ext: 'png' });
    expect(samples.filter(isHostedMediaPath)).toEqual(samples.slice(0, 3));
  });

  it('meta url, content types and limits', () => {
    expect(hostedMediaMetaUrl(samples[0])).toBe(`${samples[0]}.json`);
    expect(mediaContentType('png')).toBe('image/png');
    expect(mediaContentType('mp4')).toBe('video/mp4');
    expect(mediaContentType('webm')).toBe('video/webm');
    expect(CARD_MEDIA_LIMITS.video.maxBytes).toBe(8388608);
    expect(CARD_MEDIA_LIMITS.shareImage).toMatchObject({ width: 1200, height: 630, maxBytes: 5242880 });
    expect(CARD_MEDIA_LIMITS.icon).toMatchObject({ min: 128, max: 1024, maxBytes: 524288 });
  });
});
