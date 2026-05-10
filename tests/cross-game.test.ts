import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dbRun, initDb } from '../server/db.js';
import { unlockAchievement, getUnlocks } from '../server/services/games.js';

const USER = 'puzzler@example.com';

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM game_achievements');
});

describe('Cross-game puzzler achievement', () => {
  it('unlocking mindswiffer.first_sweep alone does NOT award bilko.puzzler', async () => {
    const r = await unlockAchievement('mindswiffer', USER, 'first_sweep');
    expect(r.ok).toBe(true);
    expect(r.crossUnlock).toBeUndefined();

    const bilkoUnlocks = await getUnlocks('bilko', USER);
    expect(bilkoUnlocks.find(u => u.key === 'puzzler')).toBeUndefined();
  });

  it('after first_sweep, unlocking sudoku.first_win awards bilko.puzzler', async () => {
    await unlockAchievement('mindswiffer', USER, 'first_sweep');

    const r = await unlockAchievement('sudoku', USER, 'first_win');
    expect(r.ok).toBe(true);
    expect(r.crossUnlock).toEqual({ game: 'bilko', key: 'puzzler', name: 'Puzzler' });

    const bilkoUnlocks = await getUnlocks('bilko', USER);
    expect(bilkoUnlocks.find(u => u.key === 'puzzler')).toBeDefined();
  });

  it('re-unlocking sudoku.first_win after puzzler is held returns alreadyUnlocked, no crossUnlock', async () => {
    await unlockAchievement('mindswiffer', USER, 'first_sweep');
    await unlockAchievement('sudoku', USER, 'first_win');

    const r = await unlockAchievement('sudoku', USER, 'first_win');
    expect(r.ok).toBe(true);
    expect(r.alreadyUnlocked).toBe(true);
    expect(r.crossUnlock).toBeUndefined();

    // Still only one puzzler row.
    const bilkoUnlocks = await getUnlocks('bilko', USER);
    expect(bilkoUnlocks.filter(u => u.key === 'puzzler')).toHaveLength(1);
  });

  it('reverse order: sudoku first, then mindswiffer also awards bilko.puzzler', async () => {
    const r1 = await unlockAchievement('sudoku', USER, 'first_win');
    expect(r1.ok).toBe(true);
    expect(r1.crossUnlock).toBeUndefined();

    const r2 = await unlockAchievement('mindswiffer', USER, 'first_sweep');
    expect(r2.ok).toBe(true);
    expect(r2.crossUnlock).toEqual({ game: 'bilko', key: 'puzzler', name: 'Puzzler' });

    const bilkoUnlocks = await getUnlocks('bilko', USER);
    expect(bilkoUnlocks.find(u => u.key === 'puzzler')).toBeDefined();
  });
});
