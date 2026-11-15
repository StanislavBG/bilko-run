import { describe, expect, it } from 'vitest';
import {
  PLAY_APPS,
  findItem,
  findPack,
  findPackByAppleProduct,
  findTier,
} from '../shared/play-currency-catalog';

const isPositiveInt = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n > 0;
const unique = (ids: string[]) => new Set(ids).size === ids.length;

describe('play currency catalog', () => {
  const tw = PLAY_APPS.threewinds;

  it('defines Three Winds with taels and a 5000 signup grant', () => {
    expect(tw).toBeDefined();
    expect(tw.currency).toBe('taels');
    expect(tw.signupGrant).toBe(5000);
  });

  it('has the four stake tiers, three seats each', () => {
    expect(tw.tiers.map(t => [t.id, t.stake, t.seats])).toEqual([
      ['tea', 5, 3],
      ['jade', 25, 3],
      ['peony', 100, 3],
      ['imperial', 500, 3],
    ]);
  });

  it('has the six tael packs with USD, MYR and Apple product ids', () => {
    expect(tw.packs.map(p => [p.id, p.taels, p.usdCents, p.myrSen])).toEqual([
      ['pouch', 5000, 99, 490],
      ['purse', 26000, 499, 2290],
      ['box', 55000, 999, 4490],
      ['chest', 115000, 1999, 8990],
      ['cabinet', 300000, 4999, 22990],
      ['vault', 650000, 9999, 44990],
    ]);
    for (const p of tw.packs) {
      expect(p.appleProductId).toBe(`threewinds.taels.${p.id}`);
      expect(isPositiveInt(p.usdCents)).toBe(true);
      expect(isPositiveInt(p.myrSen)).toBe(true);
      expect(isPositiveInt(p.taels)).toBe(true);
    }
  });

  it('has the tile sets; only ivory is free and owned by default', () => {
    expect(tw.items.map(i => [i.id, i.price])).toEqual([
      ['ivory', 0],
      ['pearl', 18888],
      ['lacquer', 8888],
      ['jade', 6888],
      ['ink', 3888],
    ]);
    expect(findItem('threewinds', 'ivory')?.defaultOwned).toBe(true);
    expect(findItem('threewinds', 'pearl')?.limit).toBe(888);
    for (const i of tw.items) {
      if (i.defaultOwned) continue;
      expect(isPositiveInt(i.price)).toBe(true);
      expect(i.defaultOwned).toBeFalsy();
    }
  });

  it('uses unique ids within each list', () => {
    for (const app of Object.values(PLAY_APPS)) {
      expect(unique(app.tiers.map(t => t.id))).toBe(true);
      expect(unique(app.packs.map(p => p.id))).toBe(true);
      expect(unique(app.packs.map(p => p.appleProductId))).toBe(true);
      expect(unique(app.items.map(i => i.id))).toBe(true);
      for (const t of app.tiers) expect(isPositiveInt(t.stake)).toBe(true);
    }
  });

  it('finds known ids', () => {
    expect(findTier('threewinds', 'peony')?.name).toBe('Peony Lounge');
    expect(findPack('threewinds', 'vault')?.name).toBe('The vault');
    expect(findPackByAppleProduct('threewinds', 'threewinds.taels.chest')?.id).toBe('chest');
    expect(findItem('threewinds', 'ink')?.name).toBe('The Ink Set');
  });

  it('returns undefined for unknown ids and unknown apps', () => {
    expect(findTier('threewinds', 'nope')).toBeUndefined();
    expect(findPack('threewinds', 'nope')).toBeUndefined();
    expect(findPackByAppleProduct('threewinds', 'threewinds.taels.nope')).toBeUndefined();
    expect(findPackByAppleProduct('threewinds', 'pouch')).toBeUndefined();
    expect(findItem('threewinds', 'nope')).toBeUndefined();
    expect(findTier('nope', 'tea')).toBeUndefined();
    expect(findPack('nope', 'pouch')).toBeUndefined();
    expect(findPackByAppleProduct('nope', 'threewinds.taels.pouch')).toBeUndefined();
    expect(findItem('nope', 'ivory')).toBeUndefined();
    expect(findTier('toString', 'tea')).toBeUndefined();
  });
});
