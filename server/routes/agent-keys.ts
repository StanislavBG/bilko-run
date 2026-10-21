import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../clerk.js';
import {
  AgentApiKeyLimitError, listAgentApiKeys, mintAgentApiKey, revokeAgentApiKey,
} from '../services/agent-api-keys.js';

const MINT_LIMIT = 10;
const MINT_WINDOW_MS = 60_000;
const mintHits = new Map<string, { count: number; resetAt: number }>();

function mintRateLimited(ip: string): boolean {
  const t = Date.now();
  if (mintHits.size > 1000) {
    for (const [k, v] of mintHits) if (v.resetAt <= t) mintHits.delete(k);
  }
  const hit = mintHits.get(ip);
  if (!hit || hit.resetAt <= t) {
    mintHits.set(ip, { count: 1, resetAt: t + MINT_WINDOW_MS });
    return false;
  }
  hit.count += 1;
  return hit.count > MINT_LIMIT;
}

// Self-serve management of bkk_ agent keys. Clerk session only: requireAuth never accepts
// agent keys, so a leaked key cannot mint or revoke keys.
export function registerAgentKeyRoutes(app: FastifyInstance): void {
  app.post('/api/agent-keys', async (req, reply) => {
    if (mintRateLimited(req.ip)) {
      reply.status(429).send({ error: 'Too many requests. Try again in a minute.' });
      return;
    }
    const email = await requireAuth(req, reply);
    if (!email) return;

    const { label } = ((req.body ?? {}) as { label?: unknown });
    if (label !== undefined && label !== null && typeof label !== 'string') {
      reply.status(400).send({ error: 'label must be a string.' });
      return;
    }
    const trimmed = typeof label === 'string' ? label.trim().slice(0, 80) : '';
    try {
      const minted = await mintAgentApiKey(email, trimmed || null);
      if ('alreadyMinted' in minted) {
        reply.status(409).send({ error: 'Key already minted.' });
        return;
      }
      reply.header('Cache-Control', 'private, no-store');
      reply.status(201).send({ key: minted.key, prefix: minted.prefix, id: minted.id });
    } catch (err) {
      if (err instanceof AgentApiKeyLimitError) {
        reply.status(409).send({ error: err.message });
        return;
      }
      throw err;
    }
  });

  app.get('/api/agent-keys', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    reply.header('Cache-Control', 'private, no-store');
    return await listAgentApiKeys(email);
  });

  app.delete('/api/agent-keys/:id', async (req, reply) => {
    const email = await requireAuth(req, reply);
    if (!email) return;
    const raw = (req.params as { id: string }).id;
    const id = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(id) || !(await revokeAgentApiKey(id, email))) {
      reply.status(404).send({ error: 'Key not found.' });
      return;
    }
    reply.header('Cache-Control', 'private, no-store');
    return { ok: true };
  });
}
