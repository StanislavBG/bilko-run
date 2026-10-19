import { describe, it, expect } from 'vitest';
import {
  RADAR_SECTORS, FLIP_DESTS, CHANNELS_RADAR, buildRadarItems, angDiff,
  sectorIndexAt, stepSweep, isLit, radarSize,
} from '../src/data/homeRadar.js';

const card = (i: number, over: Record<string, unknown> = {}) => ({
  slug: `proj-${i}`, name: `Proj ${i}`, category: 'Tool', blurb: `Blurb ${i}`,
  href: `/projects/proj-${i}/`, isInternal: false, status: 'live' as const, ...over,
});
const projects = Array.from({ length: 12 }, (_, i) => card(i));
const posts = Array.from({ length: 7 }, (_, i) => ({ slug: `post-${i}`, title: `Post ${i}` }));

describe('buildRadarItems', () => {
  const { items, counts } = buildRadarItems({ projects, posts });
  it('caps each sector', () => {
    expect(items.filter(i => i.sec === 0)).toHaveLength(8);
    expect(items.filter(i => i.sec === 1)).toHaveLength(5);
    expect(items.filter(i => i.sec === 2)).toHaveLength(3);
    expect(counts).toEqual(['12 live', 'Weekly logs', 'Open inbox']);
  });
  it('keeps bearings in sector and points inside the dial', () => {
    for (const it of items) {
      const s = RADAR_SECTORS[it.sec];
      expect(it.b).toBeGreaterThanOrEqual(s.start);
      expect(it.b).toBeLessThan(s.start + s.span);
      expect(Math.hypot(it.x - 260, it.y - 260)).toBeLessThanOrEqual(250);
    }
  });
  it('routes dests per item kind', () => {
    const p = items.find(i => i.sec === 0)!;
    expect(p.dest!.url).toBe('/projects/proj-0/');
    expect(p.dest!.spa).toBe(false);
    const internal = buildRadarItems({ projects: [card(1, { href: '/products/x', isInternal: true })], posts: [] }).items[0];
    expect(internal.dest!.spa).toBe(true);
    const post = items.find(i => i.sec === 1)!;
    expect(post.dest).toMatchObject({ url: '/blog/post-0', spa: true });
    for (const c of items.filter(i => i.sec === 2)) {
      expect(c.dest).toBeNull();
      expect(c.href).toMatch(/^(mailto:|https:\/\/)/);
    }
  });
  it('handles a single item per sector and skips hrefless cards', () => {
    const r = buildRadarItems({ projects: [card(1, { href: undefined }), card(2)], posts: [posts[0]] });
    expect(r.items.filter(i => i.sec === 0)).toHaveLength(1);
    expect(r.items.find(i => i.sec === 1)!.b).toBe(225);
  });
});

describe('constants', () => {
  it('exposes sectors, dests and channels', () => {
    expect(RADAR_SECTORS.map(s => s.mid)).toEqual([90, 225, 315]);
    expect(FLIP_DESTS.projects.url).toBe('/projects');
    expect(CHANNELS_RADAR).toHaveLength(3);
  });
});

describe('math', () => {
  it('angDiff wraps', () => {
    expect(angDiff(350, 10)).toBe(20);
    expect(angDiff(10, 350)).toBe(20);
  });
  it('sectorIndexAt boundaries', () => {
    expect([0, 179.9, 180, 269.9, 270, 359.9].map(sectorIndexAt)).toEqual([0, 0, 1, 1, 2, 2]);
  });
  it('stepSweep free-runs and wraps', () => {
    expect(stepSweep(0, 1, 36, null)).toBeCloseTo(10);
    expect(stepSweep(355, 1, 36, null)).toBeCloseTo(5);
  });
  it('stepSweep eases to target by shortest arc', () => {
    const r = stepSweep(350, 0.1, 36, 10);
    expect(r).toBeCloseTo(8); // 350 + 20*0.9 wraps through 0
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(360);
    expect(stepSweep(100, 1, 36, 100)).toBeCloseTo(100);
  });
  it('isLit manual and auto', () => {
    expect(isLit({ b: 100 }, 105, 36, true)).toBe(true);
    expect(isLit({ b: 100 }, 120, 36, true)).toBe(false);
    expect(isLit({ b: 100 }, 105, 36, false)).toBe(true);
    expect(isLit({ b: 100 }, 95, 36, false)).toBe(false);
  });
  it('radarSize clamps and hides readout', () => {
    expect(radarSize(1600, 2000)).toEqual({ size: 520, scale: 1, showReadout: true });
    expect(radarSize(1600, 100).size).toBe(260);
    expect(radarSize(1179, 2000).showReadout).toBe(false);
    expect(radarSize(400, 2000).size).toBe(336);
  });
});
