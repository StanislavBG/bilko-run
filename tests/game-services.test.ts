import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { dbRun, initDb } from '../server/db.js';
import {
  submitScore, getTopScores, checkScoreRateLimit, resetScoreRateLimit,
  getGameSave, putGameSave, deleteGameSave,
  unlockAchievement, getUnlocks,
  SAVE_BLOB_MAX,
} from '../server/services/games.js';

const GAME = 'boat-shooter';
const USER = 'test@example.com';
const USER2 = 'other@example.com';

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM game_scores');
  await dbRun('DELETE FROM game_saves');
  await dbRun('DELETE FROM game_achievements');
  resetScoreRateLimit(USER, GAME);
  resetScoreRateLimit(USER2, GAME);
});

// ── Leaderboard ──────────────────────────────────────────────────────────────

describe('Leaderboard', () => {
  it('submits score and appears at top of board', async () => {
    const r = await submitScore(GAME, USER, 100, '', null);
    expect(r.ok).toBe(true);

    const rows = await getTopScores(GAME, 'all', undefined, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.score).toBe(100);
    expect(rows[0]!.display_name).toBe('test');
  });

  it('orders scores desc (higher is better)', async () => {
    await submitScore(GAME, USER, 50, '', null);
    await submitScore(GAME, USER2, 200, '', null);
    await submitScore(GAME, USER, 100, '', null);

    const rows = await getTopScores(GAME, 'all', undefined, 10);
    expect(rows[0]!.score).toBe(200);
    expect(rows[1]!.score).toBe(100);
    expect(rows[2]!.score).toBe(50);
  });

  it('rejects implausible score (MAX_SAFE_INTEGER)', async () => {
    const r = await submitScore(GAME, USER, Number.MAX_SAFE_INTEGER, '', null);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
    expect(r.error).toMatch(/implausible/i);
  });

  it('rejects negative score', async () => {
    const r = await submitScore(GAME, USER, -1, '', null);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it('rejects score for unknown game', async () => {
    const r = await submitScore('sudoku', USER, 100, '', null);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it('rate-limits after 60 submissions', async () => {
    for (let i = 0; i < 60; i++) {
      const r = await submitScore(GAME, USER, i, '', null);
      expect(r.ok).toBe(true);
    }
    const r61 = await submitScore(GAME, USER, 61, '', null);
    expect(r61.ok).toBe(false);
    expect(r61.status).toBe(429);
  });

  it('rate limit is per-user: different user is not affected', async () => {
    for (let i = 0; i < 60; i++) {
      await submitScore(GAME, USER, i, '', null);
    }
    const r = await submitScore(GAME, USER2, 100, '', null);
    expect(r.ok).toBe(true);
  });
});

// ── Save state ────────────────────────────────────────────────────────────────

describe('Save state', () => {
  it('returns null blob for new user', async () => {
    const s = await getGameSave(GAME, USER);
    expect(s.blob).toBeNull();
    expect(s.version).toBe(0);
  });

  it('saves and retrieves blob', async () => {
    await putGameSave(GAME, USER, { level: 3, hp: 2 });
    const s = await getGameSave(GAME, USER);
    expect(s.blob).toEqual({ level: 3, hp: 2 });
    expect(s.version).toBe(1);
  });

  it('increments version on successive writes', async () => {
    await putGameSave(GAME, USER, { v: 1 });
    await putGameSave(GAME, USER, { v: 2 });
    const s = await getGameSave(GAME, USER);
    expect(s.version).toBe(2);
  });

  it('CAS conflict: second PUT with same expectedVersion returns 409', async () => {
    const first = await putGameSave(GAME, USER, { v: 1 }, 0);
    expect(first.ok).toBe(true);
    expect(first.version).toBe(1);

    const second = await putGameSave(GAME, USER, { v: 2 }, 0);
    expect(second.error).toBeDefined();
    expect(second.status).toBe(409);
    expect(second.currentVersion).toBe(1);
  });

  it('CAS succeeds when expectedVersion matches', async () => {
    await putGameSave(GAME, USER, { v: 1 }, 0);
    const r = await putGameSave(GAME, USER, { v: 2 }, 1);
    expect(r.ok).toBe(true);
    expect(r.version).toBe(2);
  });

  it('rejects blob > 32 KB', async () => {
    const big = { data: 'x'.repeat(SAVE_BLOB_MAX + 1) };
    const r = await putGameSave(GAME, USER, big);
    expect(r.status).toBe(413);
    expect(r.error).toMatch(/too large/i);
  });

  it('delete clears save', async () => {
    await putGameSave(GAME, USER, { v: 1 });
    await deleteGameSave(GAME, USER);
    const s = await getGameSave(GAME, USER);
    expect(s.blob).toBeNull();
    expect(s.version).toBe(0);
  });
});

// ── Achievements ──────────────────────────────────────────────────────────────

describe('Achievements', () => {
  it('unlocks an achievement', async () => {
    const r = await unlockAchievement(GAME, USER, 'first_kill');
    expect(r.ok).toBe(true);
    expect(r.unlocked_at).toBeGreaterThan(0);
    expect(r.alreadyUnlocked).toBeFalsy();
  });

  it('unlock is idempotent — second call returns same unlocked_at', async () => {
    const first = await unlockAchievement(GAME, USER, 'first_kill');
    const second = await unlockAchievement(GAME, USER, 'first_kill');
    expect(second.ok).toBe(true);
    expect(second.alreadyUnlocked).toBe(true);
    expect(second.unlocked_at).toBe(first.unlocked_at);
  });

  it('rejects unknown achievement key', async () => {
    const r = await unlockAchievement(GAME, USER, 'godmode_forever');
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
    expect(r.error).toMatch(/unknown achievement/i);
  });

  it('rejects unlock for unknown game', async () => {
    const r = await unlockAchievement('sudoku', USER, 'first_kill');
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it('getUnlocks returns all unlocks for a user', async () => {
    await unlockAchievement(GAME, USER, 'first_kill');
    const unlocks = await getUnlocks(GAME, USER);
    expect(unlocks).toHaveLength(1);
    expect(unlocks[0]!.key).toBe('first_kill');
  });

  it('getUnlocks is per-user (different user has empty list)', async () => {
    await unlockAchievement(GAME, USER, 'first_kill');
    const unlocks = await getUnlocks(GAME, USER2);
    expect(unlocks).toHaveLength(0);
  });
});
