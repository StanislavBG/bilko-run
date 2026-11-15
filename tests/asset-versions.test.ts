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
const sha8 = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 8);

describe('asset-versions', () => {
  it('normalizes registry entries like loadOgProjects', () => {
    expect(toCardProject({ slug: 'a', name: 'A', displayName: '', listing: { icon: '', shareImage: 5 } })).toEqual({
      slug: 'a', name: 'A', tagline: '', category: '',
    });
    expect(toCardProject(raw)).toEqual({
      slug: 'fx', name: 'Fx', displayName: 'Fixture X', tagline: 'A fixture', category: 'Test',
      icon: '/projects/fx/icon.png', shareImage: '/projects/fx/og.png',
    });
    expect([...LISTING_ASSET_KEYS]).toEqual(['icon', 'shareImage']);
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

  it('an entry with no listing gets a cards entry and no files entry', () => {
    const av = buildAssetVersions([{ slug: 'bare', name: 'Bare', tagline: 't', category: 'c' }], staticRoot);
    expect(av.cards.bare).toBe(sha8(JSON.stringify(['Bare', 't', 'c'])));
    expect(av.files).toEqual({});
  });
});
