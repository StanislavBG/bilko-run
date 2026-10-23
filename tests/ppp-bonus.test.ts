import { describe, it, expect } from 'vitest';
import { pppBonusPercent, pppBonusCents } from '../shared/ppp-bonus';

describe('pppBonusPercent', () => {
  it.each(['US', 'DE', 'GB', 'JP'])('%s -> 0', (c) => expect(pppBonusPercent(c)).toBe(0));
  it.each(['BR', 'ZA'])('%s -> 50', (c) => expect(pppBonusPercent(c)).toBe(50));
  it.each(['IN', 'NG', 'PK', 'ET'])('%s -> 100', (c) => expect(pppBonusPercent(c)).toBe(100));
  it('is case-insensitive and trims', () => {
    expect(pppBonusPercent('in')).toBe(100);
    expect(pppBonusPercent(' br ')).toBe(50);
  });
  it('returns 0 for bad input', () => {
    for (const v of [null, undefined, '', 'ZZ', 'USA', 'I', '  ']) expect(pppBonusPercent(v)).toBe(0);
  });
});

describe('pppBonusCents', () => {
  it('computes floor bonus', () => {
    expect(pppBonusCents('IN', 500)).toBe(500);
    expect(pppBonusCents('BR', 300)).toBe(150);
    expect(pppBonusCents('BR', 301)).toBe(150);
    expect(pppBonusCents('US', 1000)).toBe(0);
  });
  it('returns 0 for invalid amounts', () => {
    for (const n of [0, -100, 1.5, NaN, Infinity]) expect(pppBonusCents('IN', n)).toBe(0);
  });
});
