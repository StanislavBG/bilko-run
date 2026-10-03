import { describe, expect, it } from 'vitest';
import { findSpacingViolations, nextAllowedSlot, type SeededPost } from '../scripts/blog-cadence-gate.js';

const SINCE = '2026-10-01T00:00:00.000Z';

describe('findSpacingViolations', () => {
  it('flags a same-day pair', () => {
    const posts: SeededPost[] = [
      { slug: 'a', publishedAt: '2026-10-03T16:08:00.000Z' },
      { slug: 'b', publishedAt: '2026-10-03T17:26:00.000Z' },
    ];
    const violations = findSpacingViolations(posts, 3, SINCE);
    expect(violations).toEqual([{ earlier: 'a', later: 'b', gapHours: expect.closeTo(1.3, 1) }]);
  });

  it('allows a pair exactly 3 days apart', () => {
    const posts: SeededPost[] = [
      { slug: 'a', publishedAt: '2026-10-05T00:00:00.000Z' },
      { slug: 'b', publishedAt: '2026-10-08T00:00:00.000Z' },
    ];
    expect(findSpacingViolations(posts, 3, SINCE)).toEqual([]);
  });

  it('ignores pairs whose later post is before the enforcement cutoff', () => {
    const posts: SeededPost[] = [
      { slug: 'a', publishedAt: '2026-09-01T00:00:00.000Z' },
      { slug: 'b', publishedAt: '2026-09-01T01:00:00.000Z' },
    ];
    expect(findSpacingViolations(posts, 3, SINCE)).toEqual([]);
  });

  it('sorts unsorted input before comparing adjacent pairs', () => {
    const posts: SeededPost[] = [
      { slug: 'b', publishedAt: '2026-10-03T17:26:00.000Z' },
      { slug: 'a', publishedAt: '2026-10-03T16:08:00.000Z' },
      { slug: 'c', publishedAt: '2026-10-10T00:00:00.000Z' },
    ];
    const violations = findSpacingViolations(posts, 3, SINCE);
    expect(violations).toHaveLength(1);
    expect(violations[0].earlier).toBe('a');
    expect(violations[0].later).toBe('b');
  });

  it('returns no violations for an empty list', () => {
    expect(findSpacingViolations([], 3, SINCE)).toEqual([]);
  });
});

describe('nextAllowedSlot', () => {
  it('returns now for an empty post list', () => {
    const now = new Date('2026-10-10T00:00:00.000Z');
    expect(nextAllowedSlot([], 3, now)).toBe(now.toISOString());
  });

  it('returns latest + 3 days for a recent post', () => {
    const now = new Date('2026-10-10T00:00:00.000Z');
    const posts: SeededPost[] = [{ slug: 'a', publishedAt: '2026-10-09T00:00:00.000Z' }];
    expect(nextAllowedSlot(posts, 3, now)).toBe('2026-10-12T00:00:00.000Z');
  });

  it('returns now for an old post whose gap has already elapsed', () => {
    const now = new Date('2026-10-10T00:00:00.000Z');
    const posts: SeededPost[] = [{ slug: 'a', publishedAt: '2026-01-01T00:00:00.000Z' }];
    expect(nextAllowedSlot(posts, 3, now)).toBe(now.toISOString());
  });
});
