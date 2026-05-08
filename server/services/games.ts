import crypto from 'crypto';
import { dbAll, dbGet, dbRun, dbTransaction, txGet, txRun } from '../db.js';
import { GAME_CONFIGS, type GameConfig } from '../../shared/game-config.js';

// ── In-memory rate limiter: 60 score submissions / hour / (user + game) ──────

const _scoreCounts = new Map<string, { count: number; windowStart: number }>();
const SCORE_RATE_LIMIT = 60;
const SCORE_RATE_WINDOW_MS = 60 * 60 * 1000;

export function checkScoreRateLimit(userEmail: string, game: string): boolean {
  const key = `${userEmail}:${game}`;
  const now = Date.now();
  const entry = _scoreCounts.get(key);
  if (!entry || now - entry.windowStart > SCORE_RATE_WINDOW_MS) {
    _scoreCounts.set(key, { count: 1, windowStart: now });
    if (_scoreCounts.size > 10_000) {
      for (const [k, v] of _scoreCounts) {
        if (now - v.windowStart > SCORE_RATE_WINDOW_MS) _scoreCounts.delete(k);
      }
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= SCORE_RATE_LIMIT;
}

/** Exposed for tests: reset the rate-limit counter for a (user, game) pair. */
export function resetScoreRateLimit(userEmail: string, game: string): void {
  _scoreCounts.delete(`${userEmail}:${game}`);
}

// ── Config helpers ─────────────────────────────────────────────────────────

export function getGameConfig(slug: string): GameConfig | undefined {
  return GAME_CONFIGS[slug];
}

// ── Leaderboard ────────────────────────────────────────────────────────────

export interface SubmitScoreResult {
  ok: boolean;
  error?: string;
  status?: number;
}

export async function submitScore(
  game: string,
  userEmail: string,
  score: number,
  mode: string,
  payloadJson: string | null,
  sig?: string,
  ts?: string,
): Promise<SubmitScoreResult> {
  const config = GAME_CONFIGS[game];
  if (!config) return { ok: false, error: `unknown game: ${game}`, status: 400 };

  if (!Number.isFinite(score) || score < 0 || score > config.maxPlausibleScore) {
    return { ok: false, error: 'implausible score', status: 400 };
  }

  if (!checkScoreRateLimit(userEmail, game)) {
    return { ok: false, error: 'rate limit exceeded', status: 429 };
  }

  const hmacKey = process.env.BILKO_GAME_HMAC_KEY;
  if (hmacKey && sig) {
    const expected = crypto
      .createHmac('sha256', hmacKey)
      .update(`${game}:${score}:${mode}:${ts ?? ''}`)
      .digest('hex');
    if (expected !== sig) return { ok: false, error: 'bad signature', status: 401 };
  }

  await dbRun(
    `INSERT INTO game_scores (game, user_email, score, mode, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    game, userEmail, score, mode, payloadJson, Math.floor(Date.now() / 1000),
  );
  return { ok: true };
}

export interface ScoreRow {
  display_name: string;
  score: number;
  mode: string;
  created_at: number;
}

export async function getTopScores(
  game: string,
  range: string,
  mode: string | undefined,
  limit: number,
): Promise<ScoreRow[]> {
  const config = GAME_CONFIGS[game];
  const order = config?.scoreOrder === 'asc' ? 'ASC' : 'DESC';
  const since =
    range === 'today' ? Math.floor(Date.now() / 1000) - 86_400 :
    range === 'week'  ? Math.floor(Date.now() / 1000) - 7 * 86_400 : 0;
  const rows = await dbAll<{ user_email: string; score: number; mode: string; created_at: number }>(
    `SELECT user_email, score, mode, created_at
     FROM game_scores
     WHERE game = ? AND created_at >= ? ${mode ? 'AND mode = ?' : ''}
     ORDER BY score ${order} LIMIT ?`,
    ...(mode ? [game, since, mode, limit] : [game, since, limit]),
  );
  return rows.map((r) => ({ ...r, display_name: r.user_email.split('@')[0]! }));
}

// ── Save state ─────────────────────────────────────────────────────────────

export const SAVE_BLOB_MAX = 32_768;

export interface GetSaveResult {
  blob: unknown;
  version: number;
  updated_at: number;
}

export async function getGameSave(game: string, userEmail: string): Promise<GetSaveResult> {
  const row = await dbGet<{ blob_json: string; version: number; updated_at: number }>(
    `SELECT blob_json, version, updated_at FROM game_saves WHERE game = ? AND user_email = ?`,
    game, userEmail,
  );
  if (!row) return { blob: null, version: 0, updated_at: 0 };
  return { blob: JSON.parse(row.blob_json), version: row.version, updated_at: row.updated_at };
}

export interface PutSaveResult {
  ok?: boolean;
  version?: number;
  error?: string;
  currentVersion?: number;
  status?: number;
}

export async function putGameSave(
  game: string,
  userEmail: string,
  blob: unknown,
  expectedVersion?: number,
): Promise<PutSaveResult> {
  const blobJson = JSON.stringify(blob);
  if (blobJson.length > SAVE_BLOB_MAX) {
    return { error: `save too large (${blobJson.length} > ${SAVE_BLOB_MAX})`, status: 413 };
  }

  return dbTransaction(async (tx) => {
    const cur = await txGet<{ version: number }>(
      tx,
      `SELECT version FROM game_saves WHERE game = ? AND user_email = ?`,
      game, userEmail,
    );
    const curVer = cur?.version ?? 0;
    if (expectedVersion !== undefined && expectedVersion !== curVer) {
      return { error: 'version mismatch', currentVersion: curVer, status: 409 };
    }
    const newVer = curVer + 1;
    await txRun(
      tx,
      `INSERT INTO game_saves (game, user_email, blob_json, version, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(game, user_email) DO UPDATE
       SET blob_json = excluded.blob_json,
           version = excluded.version,
           updated_at = excluded.updated_at`,
      game, userEmail, blobJson, newVer, Math.floor(Date.now() / 1000),
    );
    return { ok: true, version: newVer };
  });
}

export async function deleteGameSave(game: string, userEmail: string): Promise<void> {
  await dbRun(`DELETE FROM game_saves WHERE game = ? AND user_email = ?`, game, userEmail);
}

// ── Achievements ───────────────────────────────────────────────────────────

export interface UnlockResult {
  ok: boolean;
  alreadyUnlocked?: boolean;
  unlocked_at?: number;
  error?: string;
  status?: number;
}

export async function unlockAchievement(
  game: string,
  userEmail: string,
  key: string,
): Promise<UnlockResult> {
  const config = GAME_CONFIGS[game];
  if (!config) return { ok: false, error: `unknown game: ${game}`, status: 400 };
  if (!config.achievements.some((a) => a.key === key)) {
    return { ok: false, error: `unknown achievement: ${key}`, status: 400 };
  }

  const existing = await dbGet<{ unlocked_at: number }>(
    `SELECT unlocked_at FROM game_achievements WHERE game = ? AND user_email = ? AND key = ?`,
    game, userEmail, key,
  );
  if (existing) {
    return { ok: true, alreadyUnlocked: true, unlocked_at: existing.unlocked_at };
  }

  const ts = Math.floor(Date.now() / 1000);
  await dbRun(
    `INSERT INTO game_achievements (game, user_email, key, unlocked_at) VALUES (?, ?, ?, ?)`,
    game, userEmail, key, ts,
  );
  return { ok: true, unlocked_at: ts };
}

export async function getUnlocks(
  game: string,
  userEmail: string,
): Promise<Array<{ key: string; unlocked_at: number }>> {
  return dbAll<{ key: string; unlocked_at: number }>(
    `SELECT key, unlocked_at FROM game_achievements WHERE game = ? AND user_email = ?`,
    game, userEmail,
  );
}
