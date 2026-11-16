import { createHash } from 'crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, it, expect, afterAll } from 'vitest';
import {
  buildAssetVersions,
  cardVersion,
  fileVersion,
  toCardProject,
  LISTING_ASSET_KEYS,
  CARD_RENDER_REV,
} from '../shared/asset-versions.js';
import { resolveOg } from '../server/og-meta.js';

const staticRoot = mkdtempSync(join(tmpdir(), 'asset-versions-'));
mkdirSync(join(staticRoot, 'projects', 'fx'), { recursive: true });
mkdirSync(join(staticRoot, 'projects', 'other'), { recursive: true });
writeFileSync(join(staticRoot, 'projects', 'fx', 'og.png'), Buffer.from('share-v1'));
writeFileSync(join(staticRoot, 'projects', 'fx', 'icon.png'), Buffer.from('icon-v1'));
writeFileSync(join(staticRoot, 'projects', 'other', 'og.png'), Buffer.from('other'));
afterAll(() => rmSync(staticRoot, { recursive: true, force: true }));

const raw = {
  slug: 'fx',
  name: 'Fx',
  displayName: 'Fixture X',
  tagline: 'A fixture',
  category: 'Test',
  listing: { icon: '/projects/fx/icon.png', shareImage: '/projects/fx/og.png' },
};
const sha8 = (s: string | Uint8Array) => createHash('sha1').update(s).digest('hex').slice(0, 8);

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
/** ISO BMFF box: u32 size + 4-char type + payload. */
function box(type: string, ...payload: Uint8Array[]): Uint8Array {
  const body = concat(...payload);
  const head = new Uint8Array(8);
  new DataView(head.buffer).setUint32(0, 8 + body.length);
  head.set(ascii(type), 4);
  return concat(head, body);
}
/** hdlr full box: version/flags(4) + pre_defined(4) + handler_type(4) + reserved(12) + name. */
const hdlr = (handler: string) => box('hdlr', new Uint8Array(8), ascii(handler), new Uint8Array(12), ascii('h\0'));
const trak = (handler: string) => box('trak', box('mdia', hdlr(handler)));
const mp4 = (...handlers: string[]) => concat(box('ftyp', ascii('isom')), box('moov', ...handlers.map(trak)));

describe('asset-versions', () => {
  it('normalizes registry entries like loadOgProjects', () => {
    expect(toCardProject({ slug: 'a', name: 'A', displayName: '', listing: { icon: '', shareImage: 5 } })).toEqual({
      slug: 'a', name: 'A', tagline: '', category: '',
    });
    expect(toCardProject(raw)).toEqual({
      slug: 'fx', name: 'Fx', displayName: 'Fixture X', tagline: 'A fixture', category: 'Test',
      icon: '/projects/fx/icon.png', shareImage: '/projects/fx/og.png',
    });
    expect([...LISTING_ASSET_KEYS]).toEqual(['icon', 'shareImage', 'video']);
  });

  it('cardVersion hashes CARD_RENDER_REV before the copy fields', () => {
    const p = toCardProject({ slug: 'plain', name: 'Plain', displayName: 'Three Winds 三風', tagline: 'T', category: 'Game' });
    expect(cardVersion(p, staticRoot)).toBe(sha8(JSON.stringify([CARD_RENDER_REV, p.displayName ?? p.name, p.tagline, p.category])));
    const q = toCardProject({ slug: 'plain', name: 'Plain', tagline: 'T', category: 'Game' });
    expect(cardVersion(q)).toBe(sha8(JSON.stringify([CARD_RENDER_REV, q.name, q.tagline, q.category])));
  });

  it('cardVersion equals the v= the server puts in og:image', () => {
    const p = toCardProject(raw);
    const img = resolveOg('/projects/fx/', { projects: [p], blogPosts: [], staticRoot })!.image;
    const v = new URL(img).searchParams.get('v');
    expect(v).toMatch(/^[0-9a-f]{8}$/);
    expect(cardVersion(p, staticRoot)).toBe(v);
  });

  it('rewriting shareImage bytes changes cardVersion and its files entry', () => {
    const p = toCardProject(raw);
    const before = buildAssetVersions([raw], staticRoot);
    expect(before.cards.fx).toBe(cardVersion(p, staticRoot));
    expect(before.files['/projects/fx/og.png']).toBe(sha8('share-v1'));
    expect(before.files['/projects/fx/icon.png']).toBe(sha8('icon-v1'));
    writeFileSync(join(staticRoot, 'projects', 'fx', 'og.png'), Buffer.from('share-v2'));
    const after = buildAssetVersions([raw], staticRoot);
    expect(after.cards.fx).not.toBe(before.cards.fx);
    expect(after.files['/projects/fx/og.png']).toBe(sha8('share-v2'));
    expect(after.files['/projects/fx/icon.png']).toBe(before.files['/projects/fx/icon.png']);
  });

  it('ignores escaping and missing paths', () => {
    expect(fileVersion(staticRoot, 'fx', '/projects/fx/../other/og.png')).toBeUndefined();
    expect(fileVersion(staticRoot, 'fx', '/projects/fx/missing.png')).toBeUndefined();
    const textOnly = toCardProject({ slug: 'fx', name: 'Fx', tagline: 't', category: 'c' });
    for (const shareImage of ['/projects/fx/../other/og.png', '/projects/fx/missing.png']) {
      const p = toCardProject({ ...textOnly, listing: { shareImage } });
      expect(cardVersion(p, staticRoot)).toBe(cardVersion(textOnly, staticRoot));
      const av = buildAssetVersions([{ slug: 'fx', name: 'Fx', tagline: 't', category: 'c', listing: { shareImage } }], staticRoot);
      expect(av.files).toEqual({});
    }
  });

  it('a declared listing.video gets a files entry that tracks its bytes; cardVersion ignores it', () => {
    writeFileSync(join(staticRoot, 'projects', 'fx', 'card.mp4'), Buffer.from('clip-v1'));
    const withVideo = { ...raw, listing: { ...raw.listing, video: '/projects/fx/card.mp4' } };
    const before = buildAssetVersions([withVideo], staticRoot);
    expect(before.files['/projects/fx/card.mp4']).toBe(sha8('clip-v1'));
    expect(before.cards.fx).toBe(buildAssetVersions([raw], staticRoot).cards.fx);
    writeFileSync(join(staticRoot, 'projects', 'fx', 'card.mp4'), Buffer.from('clip-v2'));
    const after = buildAssetVersions([withVideo], staticRoot);
    expect(after.files['/projects/fx/card.mp4']).toBe(sha8('clip-v2'));
    expect(after.files['/projects/fx/card.mp4']).not.toBe(before.files['/projects/fx/card.mp4']);
    expect(after.cards.fx).toBe(before.cards.fx);
  });

  it('an entry with no listing gets a cards entry and no files entry', () => {
    const av = buildAssetVersions([{ slug: 'bare', name: 'Bare', tagline: 't', category: 'c' }], staticRoot);
    expect(av.cards.bare).toBe(sha8(JSON.stringify([CARD_RENDER_REV, 'Bare', 't', 'c'])));
    expect(av.files).toEqual({});
    expect(av.audio).toEqual([]);
  });

  it('audio lists, sorted, only declared videos whose bytes carry a sound track', () => {
    const sound = mp4('vide', 'soun');
    const silent = mp4('vide');
    writeFileSync(join(staticRoot, 'projects', 'fx', 'sound.mp4'), sound);
    writeFileSync(join(staticRoot, 'projects', 'other', 'silent.mp4'), silent);
    writeFileSync(join(staticRoot, 'projects', 'other', 'loud.mp4'), sound);
    const entries = [
      { ...raw, listing: { ...raw.listing, video: '/projects/fx/sound.mp4' } },
      { slug: 'other', name: 'O', tagline: 't', category: 'c', listing: { video: '/projects/other/silent.mp4' } },
      { slug: 'missing', name: 'M', tagline: 't', category: 'c', listing: { video: '/projects/missing/clip.mp4' } },
      { slug: 'other', name: 'O', tagline: 't', category: 'c', listing: { video: '/projects/other/loud.mp4' } },
      // An icon whose bytes look like an audio mp4 is not a declared video.
      { slug: 'other', name: 'O', tagline: 't', category: 'c', listing: { icon: '/projects/other/loud.mp4' } },
    ];
    const av = buildAssetVersions(entries, staticRoot);
    expect(av.audio).toEqual(['/projects/fx/sound.mp4', '/projects/other/loud.mp4']);
    expect(av.files['/projects/fx/sound.mp4']).toBe(sha8(sound));
    expect(av.files['/projects/other/silent.mp4']).toBe(sha8(silent));
    expect(av.files['/projects/missing/clip.mp4']).toBeUndefined();
  });
  it('hashes a hosted icon/shareImage path string, so a new sha256 changes the card version', () => {
    const hosted = (c: string) => `/projects/fx/_media/${c.repeat(64)}.png`;
    const textOnly = { slug: 'fx', name: 'Fx', tagline: 't', category: 'c' };
    const base = cardVersion(toCardProject(textOnly), staticRoot);
    for (const key of ['shareImage', 'icon'] as const) {
      const a = toCardProject({ ...textOnly, listing: { [key]: hosted('a') } });
      const b = toCardProject({ ...textOnly, listing: { [key]: hosted('b') } });
      expect(cardVersion(a, staticRoot)).not.toBe(base);
      expect(cardVersion(a, staticRoot)).not.toBe(cardVersion(b, staticRoot));
      expect(cardVersion(a, staticRoot)).toBe(cardVersion(a, staticRoot));
      const expected = createHash('sha1')
        .update(JSON.stringify([CARD_RENDER_REV, 'Fx', 't', 'c']))
        .update(hosted('a'))
        .digest('hex')
        .slice(0, 8);
      expect(cardVersion(a, staticRoot)).toBe(expected);
      const av = buildAssetVersions([{ ...textOnly, listing: { [key]: hosted('a'), video: '/projects/fx/_media/' + 'c'.repeat(64) + '.mp4' } }], staticRoot);
      expect(av.cards.fx).toBe(expected);
      expect(av.files).toEqual({});
      expect(av.audio).toEqual([]);
    }
  });

  it('keeps bundle-path card versions unchanged: copy fields then file bytes', () => {
    writeFileSync(join(staticRoot, 'projects', 'fx', 'og.png'), Buffer.from('share-v1'));
    const p = toCardProject(raw);
    const expected = createHash('sha1')
      .update(JSON.stringify([CARD_RENDER_REV, 'Fixture X', 'A fixture', 'Test']))
      .update(Buffer.from('icon-v1'))
      .update(Buffer.from('share-v1'))
      .digest('hex')
      .slice(0, 8);
    expect(cardVersion(p, staticRoot)).toBe(expected);
  });
});
