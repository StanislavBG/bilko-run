import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  hostedMediaPath,
  parseHostedMediaPath,
  isHostedMediaPath,
} from '../mcp-host-server/src/contract/listing-media.js';
import { RegistrySchema, ProjectAssetPathSchema, ProjectVideoPathSchema } from '../mcp-host-server/src/contract/registry.js';

const SHA = 'a'.repeat(64);

function entry(listing: Record<string, string>) {
  return {
    slug: 'demo',
    name: 'Demo',
    tagline: 'A demo app',
    category: 'Tools',
    status: 'live',
    year: 2026,
    host: { kind: 'static-path', path: '/projects/demo/' },
    listing,
  };
}

describe('hosted media path helpers', () => {
  it('builds the hosted path', () => {
    expect(hostedMediaPath('demo', SHA, 'png')).toBe(`/projects/demo/_media/${SHA}.png`);
    expect(hostedMediaPath('my-app', SHA, 'webm')).toBe(`/projects/my-app/_media/${SHA}.webm`);
  });

  it('round-trips through parse', () => {
    for (const ext of ['png', 'mp4', 'webm'] as const) {
      expect(parseHostedMediaPath(hostedMediaPath('demo', SHA, ext))).toEqual({ slug: 'demo', sha256: SHA, ext });
    }
  });

  it('rejects malformed paths', () => {
    for (const p of [
      `/projects/demo/_media/${'A'.repeat(64)}.png`,
      `/projects/demo/_media/${'a'.repeat(63)}.png`,
      `/projects/demo/_media/${SHA}.gif`,
      `/projects/demo/_media/x/${SHA}.png`,
      `/projects/Demo/_media/${SHA}.png`,
      `/projects/demo/img/${SHA}.png`,
      `projects/demo/_media/${SHA}.png`,
      `/projects/demo/_media/${SHA}.png?x=1`,
    ]) {
      expect(parseHostedMediaPath(p)).toBeUndefined();
      expect(isHostedMediaPath(p)).toBe(false);
    }
    expect(isHostedMediaPath(`/projects/demo/_media/${SHA}.mp4`)).toBe(true);
  });

  it('hosted paths already pass the legacy asset regexes', () => {
    expect(ProjectAssetPathSchema.safeParse(hostedMediaPath('demo', SHA, 'png')).success).toBe(true);
    expect(ProjectVideoPathSchema.safeParse(hostedMediaPath('demo', SHA, 'mp4')).success).toBe(true);
    expect(ProjectVideoPathSchema.safeParse(hostedMediaPath('demo', SHA, 'webm')).success).toBe(true);
  });
});

describe('RegistrySchema hosted media rules', () => {
  it('accepts valid hosted paths per field', () => {
    const r = RegistrySchema.safeParse([
      entry({
        icon: hostedMediaPath('demo', SHA, 'png'),
        shareImage: hostedMediaPath('demo', 'b'.repeat(64), 'png'),
        video: hostedMediaPath('demo', 'c'.repeat(64), 'webm'),
      }),
    ]);
    expect(r.success).toBe(true);
    expect(RegistrySchema.safeParse([entry({ video: hostedMediaPath('demo', SHA, 'mp4') })]).success).toBe(true);
  });

  it('accepts ordinary bundle paths', () => {
    expect(RegistrySchema.safeParse([entry({ icon: '/projects/demo/img/icon.png' })]).success).toBe(true);
  });

  it('rejects a /_media/ path that does not parse', () => {
    const value = '/projects/demo/_media/icon.png';
    const r = RegistrySchema.safeParse([entry({ icon: value })]);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain(
      `slug \\"demo\\" field \\"listing.icon\\" has an invalid hosted media path \\"${value}\\"`
    );
  });

  it('rejects a nested /_media/ path', () => {
    const r = RegistrySchema.safeParse([entry({ shareImage: `/projects/demo/img/_media/${SHA}.png` })]);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('invalid hosted media path');
  });

  it('rejects an ext that does not fit the field', () => {
    for (const listing of [
      { icon: hostedMediaPath('demo', SHA, 'mp4') },
      { shareImage: hostedMediaPath('demo', SHA, 'webm') },
      { video: hostedMediaPath('demo', SHA, 'png') },
    ]) {
      const r = RegistrySchema.safeParse([entry(listing)]);
      expect(r.success).toBe(false);
      expect(JSON.stringify(r.error?.issues)).toContain('invalid hosted media path');
    }
  });

  it('rejects a hosted path for another slug', () => {
    const r = RegistrySchema.safeParse([entry({ icon: hostedMediaPath('other', SHA, 'png') })]);
    expect(r.success).toBe(false);
  });

  it('every entry in the live registry still parses', () => {
    const raw = JSON.parse(readFileSync(join(__dirname, '..', 'src/data/standalone-projects.json'), 'utf8'));
    const r = RegistrySchema.safeParse(raw);
    expect(r.error?.issues ?? []).toEqual([]);
  });
});
