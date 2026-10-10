import { describe, expect, it } from 'vitest';
import { isAllowedNavigation, parseShotList, qualitySteps } from '../scripts/blog-video-capture.js';

const shot = (over: Record<string, unknown> = {}) => ({
  name: 'home',
  url: 'https://bilko.run/projects/outdoor-hours/',
  ...over,
});

describe('parseShotList', () => {
  it('accepts a valid list', () => {
    const list = [
      shot(),
      shot({
        name: 'repo-2',
        url: 'https://github.com/StanislavBG/bilko-run',
        scrollY: 400,
        waitMs: 500,
        actions: [{ click: 'button' }, { fill: ['input', 'x'] }, { press: 'Enter' }, { wait: 300 }],
      }),
    ];
    expect(parseShotList(list)).toHaveLength(2);
  });

  it('rejects http://', () => {
    expect(() => parseShotList([shot({ url: 'http://bilko.run/' })])).toThrow();
  });

  it('rejects other hosts', () => {
    expect(() => parseShotList([shot({ url: 'https://evil.example/' })])).toThrow();
    expect(() => parseShotList([shot({ url: 'https://bilko.run.evil.example/' })])).toThrow();
  });

  it('rejects credentials in the URL', () => {
    expect(() => parseShotList([shot({ url: 'https://user:pass@bilko.run/' })])).toThrow();
  });

  it('rejects more than 6 shots', () => {
    const seven = Array.from({ length: 7 }, (_, i) => shot({ name: `s-${i}` }));
    expect(() => parseShotList(seven)).toThrow(/6/);
  });

  it('rejects a bad name', () => {
    expect(() => parseShotList([shot({ name: '../etc' })])).toThrow();
    expect(() => parseShotList([shot({ name: 'Home' })])).toThrow();
  });

  it('rejects more than 5 actions', () => {
    const actions = Array.from({ length: 6 }, () => ({ press: 'Tab' }));
    expect(() => parseShotList([shot({ actions })])).toThrow(/5/);
  });

  it('rejects waits over 10000 ms', () => {
    expect(() => parseShotList([shot({ waitMs: 20000 })])).toThrow();
    expect(() => parseShotList([shot({ actions: [{ wait: 20000 }] })])).toThrow();
  });

  it('rejects non-array input', () => {
    expect(() => parseShotList({})).toThrow();
  });
});

describe('record', () => {
  it('rejects seconds outside 1..6', () => {
    expect(() => parseShotList([shot({ record: { seconds: 0 } })])).toThrow();
    expect(() => parseShotList([shot({ record: { seconds: 7 } })])).toThrow();
  });

  it('accepts seconds 3', () => {
    expect(parseShotList([shot({ record: { seconds: 3 } })])[0].record).toEqual({ seconds: 3 });
  });
});

describe('isAllowedNavigation', () => {
  it('blocks off-list navigations', () => {
    expect(isAllowedNavigation('https://evil.test/', true)).toBe(false);
  });

  it('allows off-list subresources', () => {
    expect(isAllowedNavigation('https://evil.test/font.png', false)).toBe(true);
  });

  it('allows allow-listed navigations', () => {
    expect(isAllowedNavigation('https://bilko.run/x', true)).toBe(true);
  });
});

describe('qualitySteps', () => {
  it('returns the bounded ladder', () => {
    expect(qualitySteps()).toEqual([80, 70, 60, 50, 40]);
  });
});
