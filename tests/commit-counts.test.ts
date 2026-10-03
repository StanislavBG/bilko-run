import { describe, expect, it } from 'vitest';
import commitCounts from '../src/data/commit-counts.json' with { type: 'json' };
import commitOrder from '../src/data/commit-order.json' with { type: 'json' };

describe('commit-counts.json', () => {
  it('is an object whose values are all positive integers', () => {
    const values = Object.values(commitCounts as Record<string, number>);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  it('has every key also present in commit-order.json', () => {
    const orderKeys = new Set(Object.keys(commitOrder as Record<string, string>));
    for (const key of Object.keys(commitCounts as Record<string, number>)) {
      expect(orderKeys.has(key)).toBe(true);
    }
  });
});
