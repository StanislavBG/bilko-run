import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

// Route tests authenticate as the email in `Authorization: Bearer <email>`.
vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return {
    ...original,
    requireAuth: vi.fn().mockImplementation(async (req: any, reply: any) => {
      const h: string | undefined = req.headers.authorization;
      const email = h?.startsWith('Bearer ') ? h.slice(7) : null;
      if (!email) { reply.status(401).send({ error: 'Sign in required.' }); return null; }
      return email;
    }),
  };
});
import { createClient } from '@libsql/client';
import { dbRun, initDb } from '../server/db.js';
import {
  submitScore, getTopScores, buildTopScoresQuery, checkScoreRateLimit, resetScoreRateLimit,
  getGameSave, putGameSave, deleteGameSave,
  unlockAchievement, getUnlocks,
  SAVE_BLOB_MAX, SAVE_SLOT_MAX,
} from '../server/services/games.js';
import { resetSaveWriteRateLimit } from '../server/routes/games.js';

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
  resetSaveWriteRateLimit();
});

// ── Leaderboard ──────────────────────────────────────────────────────────────

describe('Leaderboard', () => {
  it.each([undefined, 'hard'])('query plan uses idx_scores_game_score (mode=%s)', async (mode) => {
    const { sql, args } = buildTopScoresQuery(GAME, 'all', mode, 10);
    // Separate short-lived connection: an EXPLAIN on the shared client leaves the
    // file locked for the transaction tests that follow.
    const client = createClient({ url: `file:${process.env.BILKO_SQLITE_PATH}` });
    let detail: string;
    try {
      const plan = await client.execute({ sql: `EXPLAIN QUERY PLAN ${sql}`, args });
      detail = plan.rows.map((r) => String(r.detail)).join('\n');
    } finally {
      client.close();
    }
    expect(detail).toContain('idx_scores_game_score');
    expect(detail).not.toMatch(/SCAN (game_scores|scores)\b/);
  });

  it('omitted mode returns scores from every mode', async () => {
    await submitScore(GAME, USER, 10, '', null);
    await submitScore(GAME, USER, 20, 'hard', null);
    const rows = await getTopScores(GAME, 'all', undefined, 10);
    expect(rows.map((r) => r.score)).toEqual([20, 10]);
  });

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

  it('accepts a slug with no GAME_CONFIGS entry (non-game apps like academy store progress here)', async () => {
    await putGameSave('academy', USER, { done: ['welcome'] });
    const s = await getGameSave('academy', USER);
    expect(s.blob).toEqual({ done: ['welcome'] });
    expect(s.version).toBe(1);
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

  it('SAVE_BLOB_MAX is 1 MiB', () => {
    expect(SAVE_BLOB_MAX).toBe(1_048_576);
  });

  // JSON.stringify({ d: s }) is s.length + 8 bytes for ASCII s.
  it('stores a blob of exactly SAVE_BLOB_MAX UTF-8 bytes', async () => {
    const blob = { d: 'x'.repeat(SAVE_BLOB_MAX - 8) };
    expect(Buffer.byteLength(JSON.stringify(blob), 'utf8')).toBe(SAVE_BLOB_MAX);
    const r = await putGameSave(GAME, USER, blob);
    expect(r.ok).toBe(true);
    const s = await getGameSave(GAME, USER);
    expect((s.blob as { d: string }).d.length).toBe(SAVE_BLOB_MAX - 8);
  });

  it('rejects a blob one byte over SAVE_BLOB_MAX with 413', async () => {
    const big = { d: 'x'.repeat(SAVE_BLOB_MAX - 7) };
    const r = await putGameSave(GAME, USER, big);
    expect(r.status).toBe(413);
    expect(r.error).toMatch(/save too large/i);
  });

  it('measures UTF-8 bytes, not characters', async () => {
    // 'é' is 2 bytes: (SAVE_BLOB_MAX - 8) / 2 + 1 chars stays under the char count but exceeds the byte cap.
    const big = { d: 'é'.repeat((SAVE_BLOB_MAX - 8) / 2 + 1) };
    expect(JSON.stringify(big).length).toBeLessThan(SAVE_BLOB_MAX);
    const r = await putGameSave(GAME, USER, big);
    expect(r.status).toBe(413);
  });

  it('refuses a new slot at SAVE_SLOT_MAX slots but still updates existing ones', async () => {
    expect(SAVE_SLOT_MAX).toBe(100);
    await seedSlots(USER, SAVE_SLOT_MAX);
    const r = await putGameSave('new-slot', USER, { v: 1 });
    expect(r.status).toBe(403);
    expect(r.error).toBe('save_slot_limit');
    const upd = await putGameSave('slot-0', USER, { v: 2 });
    expect(upd.ok).toBe(true);
    const other = await putGameSave('new-slot', USER2, { v: 1 });
    expect(other.ok).toBe(true);
  });

  it('delete clears save', async () => {
    await putGameSave(GAME, USER, { v: 1 });
    await deleteGameSave(GAME, USER);
    const s = await getGameSave(GAME, USER);
    expect(s.blob).toBeNull();
    expect(s.version).toBe(0);
  });
});

async function seedSlots(email: string, n: number) {
  for (let i = 0; i < n; i++) {
    await dbRun(
      `INSERT INTO game_saves (game, user_email, blob_json, version, updated_at) VALUES (?, ?, '{}', 1, 0)`,
      `slot-${i}`, email,
    );
  }
}

// ── Save routes ───────────────────────────────────────────────────────────────

describe('Save routes', () => {
  async function makeApp() {
    const { default: Fastify } = await import('fastify');
    const { registerGameRoutes } = await import('../server/routes/games.js');
    const app = Fastify();
    registerGameRoutes(app);
    return app;
  }

  it.each(['GET', 'PUT', 'DELETE'] as const)('%s rejects a bad slug with 400 before auth', async (method) => {
    const app = await makeApp();
    for (const slug of ['Bad', '-lead', 'a_b', 'a.b', 'a'.repeat(65)]) {
      const res = await app.inject({ method, url: `/api/games/${slug}/save`, payload: method === 'PUT' ? { blob: {} } : undefined });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'bad slug' });
    }
    await app.close();
  });

  it.each(['academy', 'ga-platform', 'ga-pong', 'mindswiffer-streak', 'sudoku', 'escape-velocity', 'threewinds', 'a'.repeat(64)])(
    'slug %s passes the pattern', async (slug) => {
      const app = await makeApp();
      const unauth = await app.inject({ method: 'GET', url: `/api/games/${slug}/save` });
      expect(unauth.statusCode).toBe(401);
      const put = await app.inject({
        method: 'PUT', url: `/api/games/${slug}/save`,
        headers: { authorization: `Bearer ${USER}` }, payload: { blob: { ok: 1 } },
      });
      expect(put.statusCode).toBe(200);
      const del = await app.inject({ method: 'DELETE', url: `/api/games/${slug}/save`, headers: { authorization: `Bearer ${USER}` } });
      expect(del.statusCode).toBe(200);
      await app.close();
    },
  );

  it('PUT answers 429 with Retry-After after 300 writes in a minute, across slugs and per user', async () => {
    const app = await makeApp();
    const put = (slug: string, email: string) => app.inject({
      method: 'PUT', url: `/api/games/${slug}/save`,
      headers: { authorization: `Bearer ${email}` }, payload: { blob: { n: 1 } },
    });
    for (let i = 0; i < 300; i++) {
      const res = await put(i % 2 ? 'slot-a' : 'slot-b', USER);
      expect(res.statusCode).toBe(200);
    }
    const res = await put('slot-c', USER);
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({ error: 'rate_limited' });
    const retry = Number(res.headers['retry-after']);
    expect(retry).toBeGreaterThanOrEqual(1);
    expect(retry).toBeLessThanOrEqual(60);
    expect((await put('slot-a', USER2)).statusCode).toBe(200);
    await app.close();
  }, 60_000);

  it('PUT answers 403 save_slot_limit for a new slot at 100 slots; updates still pass', async () => {
    await seedSlots(USER, 100);
    const app = await makeApp();
    const auth = { authorization: `Bearer ${USER}` };
    const res = await app.inject({ method: 'PUT', url: '/api/games/new-slot/save', headers: auth, payload: { blob: {} } });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: 'save_slot_limit' });
    const upd = await app.inject({ method: 'PUT', url: '/api/games/slot-7/save', headers: auth, payload: { blob: { v: 2 } } });
    expect(upd.statusCode).toBe(200);
    expect(upd.json()).toEqual({ ok: true, version: 2 });
    await app.close();
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

// ── GET /api/games/:slug/scores limit clamping ───────────────────────────────

describe('GET scores limit parsing', () => {
  async function fetchScores(limit: string): Promise<{ status: number; count: number }> {
    const { default: Fastify } = await import('fastify');
    const { registerGameRoutes } = await import('../server/routes/games.js');
    const app = Fastify();
    registerGameRoutes(app);
    const res = await app.inject({ method: 'GET', url: `/api/games/${GAME}/scores?limit=${limit}` });
    await app.close();
    return { status: res.statusCode, count: (res.json() as { scores: unknown[] }).scores.length };
  }

  async function seed(n: number) {
    for (let i = 0; i < n; i++) {
      await dbRun(
        `INSERT INTO game_scores (game, user_email, score, mode, created_at) VALUES (?, ?, ?, '', ?)`,
        GAME, `u${i}@example.com`, i + 1, Date.now(),
      );
    }
  }

  it('limit=10 returns at most 10 rows', async () => {
    await seed(15);
    const r = await fetchScores('10');
    expect(r.status).toBe(200);
    expect(r.count).toBeLessThanOrEqual(10);
    expect(r.count).toBeGreaterThan(0);
  });

  it.each(['-1', 'abc', '0', '1.5'])('limit=%s falls back to default (<=100 rows)', async (v) => {
    await seed(120);
    const r = await fetchScores(v);
    expect(r.status).toBe(200);
    expect(r.count).toBeGreaterThan(0);
    expect(r.count).toBeLessThanOrEqual(100);
  });

  it('limit=100000 is clamped to 500', async () => {
    await seed(520);
    const r = await fetchScores('100000');
    expect(r.status).toBe(200);
    expect(r.count).toBeLessThanOrEqual(500);
  });
});
