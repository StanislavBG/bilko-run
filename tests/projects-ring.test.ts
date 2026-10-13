import { describe, it, expect } from 'vitest';
import {
  ringOffset, heroBox, spineGeom, tickStyle, pad3, RING_DOTS, ringStats,
} from '../src/data/projectsRing.js';
import type { HubCard } from '../src/data/projectsView.js';

describe('ringOffset', () => {
  it('wraps into [-n/2, n/2]', () => {
    expect(ringOffset(139, 0, 140)).toBe(-1);
    expect(ringOffset(70, 0, 140)).toBe(70);
    expect(ringOffset(71, 0, 140)).toBe(-69);
    expect(ringOffset(3, 5, 140)).toBe(-2);
    expect(ringOffset(0, 139, 140)).toBe(1);
  });
  it('handles n=1', () => {
    expect(ringOffset(0, 0, 1)).toBe(0);
  });
});

describe('heroBox', () => {
  it('matches prototype rounding', () => {
    expect(heroBox(1280)).toEqual({ left: 359, width: 563 });
  });
  it('clamps width', () => {
    expect(heroBox(800)).toEqual({ left: 170, width: 460 });
    expect(heroBox(2000)).toEqual({ left: 660, width: 680 });
  });
});

describe('spineGeom', () => {
  const W = 1280;
  const H = 560;
  const hb = heroBox(W);
  it('centers and hides k=0', () => {
    expect(spineGeom(0, W, H)).toMatchObject({ x: 640 - 32, w: 64, h: 520, opacity: 0, hidden: true });
  });
  it('places first right spine after the 8px hero gap', () => {
    const g = spineGeom(1, W, H);
    expect(g.x).toBe(hb.left + hb.width + 8);
    expect(g.w).toBe(64);
    expect(g.h).toBeCloseTo(520 * 0.95);
    expect(g.opacity).toBe(1);
    expect(g.fontPx).toBe(22);
    expect(g.hidden).toBe(false);
  });
  it('places second right spine after a 6px spine gap', () => {
    const g = spineGeom(2, W, H);
    expect(g.x).toBeCloseTo(hb.left + hb.width + 8 + 64 + 6);
    expect(g.w).toBeCloseTo(57.6);
    expect(g.opacity).toBeCloseTo(0.94);
    expect(g.fontPx).toBe(Math.round(22 * 0.93));
  });
  it('mirrors on the left', () => {
    const g = spineGeom(-1, W, H);
    expect(g.x).toBe(hb.left - 8 - 64);
  });
  it('hides off-stage and beyond 29, clamps j to 30', () => {
    expect(spineGeom(30, W, H).hidden).toBe(true);
    const far = spineGeom(100, W, H);
    expect(far.hidden).toBe(true);
    expect(far.w).toBeCloseTo(64 * Math.pow(0.9, 29));
    expect(far.opacity).toBe(0);
    expect(spineGeom(2, 500, 560).hidden).toBe(true);
  });
  it('floors opacity at .25 and font at 11', () => {
    const g = spineGeom(20, 4000, 560);
    expect(g.opacity).toBe(0.25);
    expect(g.fontPx).toBe(Math.max(11, Math.round(22 * Math.pow(0.93, 19))));
  });
  it('floors height base at 120 and honors falloff', () => {
    expect(spineGeom(0, W, 100).h).toBe(120);
    expect(spineGeom(2, W, H, 0.8).w).toBeCloseTo(51.2);
  });
});

describe('tickStyle / pad3 / RING_DOTS', () => {
  it('tickStyle', () => {
    expect(tickStyle(0)).toEqual({ h: 28, color: '#a83818' });
    expect(tickStyle(6)).toEqual({ h: 16, color: '#5d5648' });
    expect(tickStyle(7)).toEqual({ h: 8, color: '#d4ccb8' });
  });
  it('pad3', () => {
    expect(pad3(0)).toBe('001');
    expect(pad3(139)).toBe('140');
  });
  it('RING_DOTS', () => {
    expect(RING_DOTS).toEqual(['#a83818', '#1a1612', '#2e5a3e']);
  });
});

describe('ringStats', () => {
  const base = { lastCommitAt: 0 } as HubCard;
  it('omits absent entries', () => {
    expect(ringStats(base)).toEqual([]);
  });
  it('builds and upper-cases labels', () => {
    const card = {
      lastCommitAt: Date.UTC(2026, 4, 8, 12),
      metric: '10 yrs',
      metricLabel: 'of data',
      lang: 'Python',
    } as HubCard;
    expect(ringStats(card)).toEqual([
      { v: '10 yrs', l: 'OF DATA' },
      { v: 'Python', l: 'PRIMARY LANG' },
      { v: 'May 8, 2026', l: 'UPDATED' },
    ]);
  });
  it('metric without label gets an empty label', () => {
    expect(ringStats({ ...base, metric: '5' } as HubCard)).toEqual([{ v: '5', l: '' }]);
  });
});
