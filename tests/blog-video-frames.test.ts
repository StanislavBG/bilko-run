import { describe, expect, it } from 'vitest';
import { isBlankFrame, sampleTimes } from '../scripts/blog-video-frames.js';

describe('sampleTimes', () => {
  const scenes = [
    { start: 0, end: 10 },
    { start: 10, end: 30 },
  ];

  it('includes midpoints, boundaries +-0.25 and the 0.5 / duration-0.5 edges', () => {
    const t = sampleTimes(scenes, 30);
    for (const want of [0.5, 5, 9.75, 10.25, 20, 29.5, 29.75]) expect(t).toContain(want);
  });

  it('is sorted and deduped', () => {
    const t = sampleTimes(scenes, 30);
    expect(t).toEqual([...new Set(t)].sort((a, b) => a - b));
    expect(sampleTimes([{ start: 0.25, end: 0.75 }], 30).filter((x) => x === 0.5)).toHaveLength(1);
  });

  it('clamps to [0, duration]', () => {
    const t = sampleTimes(scenes, 30);
    expect(Math.min(...t)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...t)).toBeLessThanOrEqual(30);
    expect(t).toContain(0);
    expect(t).toContain(30);
  });

  it('falls back to every 2 s with no scenes', () => {
    expect(sampleTimes([], 7)).toEqual([0, 2, 4, 6]);
  });
});

describe('isBlankFrame', () => {
  it('flags low stddev', () => {
    expect(isBlankFrame({ stddev: 7.9, edgeDensity: 0.5 })).toBe(true);
    expect(isBlankFrame({ stddev: 8, edgeDensity: 0.5 })).toBe(false);
  });
  it('flags low edge density', () => {
    expect(isBlankFrame({ stddev: 50, edgeDensity: 0.0099 })).toBe(true);
    expect(isBlankFrame({ stddev: 50, edgeDensity: 0.01 })).toBe(false);
  });
});
