import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../clerk.js';
import { GAME_CONFIGS } from '../../shared/game-config.js';
import {
  submitScore, getTopScores,
  getGameSave, putGameSave, deleteGameSave,
  unlockAchievement, getUnlocks,
} from '../services/games.js';

/** Save-slot slugs: lowercase letters, digits and hyphens, 1-64 chars, not starting with a hyphen. */
export const SAVE_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

const SAVE_WRITE_LIMIT = 300;
const SAVE_WRITE_WINDOW_MS = 60_000;
/** In-process sliding window of save-write timestamps per user, across all slugs. */
const saveWrites = new Map<string, number[]>();

/** Returns 0 if the write is allowed (and records it), else seconds until one is. */
function checkSaveWriteRateLimit(email: string, now = Date.now()): number {
  const cutoff = now - SAVE_WRITE_WINDOW_MS;
  const hits = (saveWrites.get(email) ?? []).filter((t) => t > cutoff);
  if (hits.length >= SAVE_WRITE_LIMIT) {
    saveWrites.set(email, hits);
    return Math.max(1, Math.ceil((hits[0]! + SAVE_WRITE_WINDOW_MS - now) / 1000));
  }
  hits.push(now);
  saveWrites.set(email, hits);
  return 0;
}

export function resetSaveWriteRateLimit(email?: string): void {
  if (email === undefined) saveWrites.clear();
  else saveWrites.delete(email);
}

export function registerGameRoutes(app: FastifyInstance): void {

  // ── Leaderboards ─────────────────────────────────────────────────────────

  app.post('/api/games/:slug/scores', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const email = await requireAuth(req, reply);
    if (!email) return;

    const body = req.body as { score?: number; mode?: string; payload?: unknown; sig?: string; ts?: string } | null;
    const result = await submitScore(
      slug, email,
      body?.score ?? NaN,
      body?.mode ?? '',
      body?.payload !== undefined ? JSON.stringify(body.payload) : null,
      body?.sig,
      body?.ts,
    );

    if (!result.ok) {
      reply.code(result.status ?? 400);
      return { error: result.error };
    }
    return { ok: true };
  });

  app.get('/api/games/:slug/scores', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    if (!GAME_CONFIGS[slug]) return reply.code(400).send({ error: `unknown game: ${slug}` });

    const q = req.query as { range?: string; mode?: string; limit?: string };
    const parsed = Number(q.limit);
    const limit = Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, 500) : 100;
    const scores = await getTopScores(slug, q.range ?? 'all', q.mode, limit);
    return { scores };
  });

  // ── Save state ────────────────────────────────────────────────────────────

  app.get('/api/games/:slug/save', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    if (!SAVE_SLUG_RE.test(slug)) return reply.code(400).send({ error: 'bad slug' });
    const email = await requireAuth(req, reply);
    if (!email) return;
    return getGameSave(slug, email);
  });

  app.put('/api/games/:slug/save', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    if (!SAVE_SLUG_RE.test(slug)) return reply.code(400).send({ error: 'bad slug' });
    const email = await requireAuth(req, reply);
    if (!email) return;

    const body = req.body as { blob?: unknown; expectedVersion?: number } | null;
    if (body?.blob === undefined) return reply.code(400).send({ error: 'missing blob' });

    const retryAfter = checkSaveWriteRateLimit(email);
    if (retryAfter > 0) {
      reply.header('Retry-After', String(retryAfter));
      return reply.code(429).send({ error: 'rate_limited' });
    }

    const result = await putGameSave(slug, email, body.blob, body.expectedVersion);
    if (result.error) {
      reply.code(result.status ?? 400);
      return { error: result.error, currentVersion: result.currentVersion };
    }
    return { ok: true, version: result.version };
  });

  app.delete('/api/games/:slug/save', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    if (!SAVE_SLUG_RE.test(slug)) return reply.code(400).send({ error: 'bad slug' });
    const email = await requireAuth(req, reply);
    if (!email) return;
    await deleteGameSave(slug, email);
    return { ok: true };
  });

  // ── Achievements ──────────────────────────────────────────────────────────

  app.post('/api/games/:slug/unlock', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const email = await requireAuth(req, reply);
    if (!email) return;

    const { key } = req.body as { key: string };
    const result = await unlockAchievement(slug, email, key);
    if (!result.ok) {
      reply.code(result.status ?? 400);
      return { error: result.error };
    }
    return {
      ok: true,
      alreadyUnlocked: result.alreadyUnlocked ?? false,
      unlocked_at: result.unlocked_at,
      ...(result.crossUnlock ? { crossUnlock: result.crossUnlock } : {}),
    };
  });

  app.get('/api/games/:slug/unlocks', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const email = await requireAuth(req, reply);
    if (!email) return;
    const unlocks = await getUnlocks(slug, email);
    return { unlocks };
  });

  app.get('/api/games/:slug/achievements', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const config = GAME_CONFIGS[slug];
    if (!config) return reply.code(400).send({ error: `unknown game: ${slug}` });
    return { achievements: config.achievements };
  });
}
