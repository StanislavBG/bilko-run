import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../clerk.js';
import { GAME_CONFIGS } from '../../shared/game-config.js';
import {
  submitScore, getTopScores,
  getGameSave, putGameSave, deleteGameSave,
  unlockAchievement, getUnlocks,
} from '../services/games.js';

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
    const limit = Math.min(Number(q.limit ?? 100), 500);
    const scores = await getTopScores(slug, q.range ?? 'all', q.mode, limit);
    return { scores };
  });

  // ── Save state ────────────────────────────────────────────────────────────

  app.get('/api/games/:slug/save', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const email = await requireAuth(req, reply);
    if (!email) return;
    return getGameSave(slug, email);
  });

  app.put('/api/games/:slug/save', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const email = await requireAuth(req, reply);
    if (!email) return;

    const body = req.body as { blob?: unknown; expectedVersion?: number } | null;
    if (body?.blob === undefined) return reply.code(400).send({ error: 'missing blob' });

    const result = await putGameSave(slug, email, body.blob, body.expectedVersion);
    if (result.error) {
      reply.code(result.status ?? 400);
      return { error: result.error, currentVersion: result.currentVersion };
    }
    return { ok: true, version: result.version };
  });

  app.delete('/api/games/:slug/save', async (req, reply) => {
    const { slug } = req.params as { slug: string };
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
