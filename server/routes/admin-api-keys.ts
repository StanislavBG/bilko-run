import type { FastifyInstance } from 'fastify';
import { requireAdminSession } from '../clerk.js';
import { listAdminApiKeys, mintAdminApiKey, revokeAdminApiKey } from '../services/admin-api-keys.js';

// Key management requires a real Clerk admin session, never an admin API key.
export function registerAdminApiKeyRoutes(app: FastifyInstance): void {
  app.post('/api/admin/api-keys', async (req, reply) => {
    const email = await requireAdminSession(req, reply);
    if (!email) return;

    const { label, ttlDays } = ((req.body ?? {}) as { label?: unknown; ttlDays?: unknown });
    if (label !== undefined && typeof label !== 'string') {
      reply.status(400).send({ error: 'label must be a string.' });
      return;
    }
    if (ttlDays !== undefined && (typeof ttlDays !== 'number' || !Number.isInteger(ttlDays))) {
      reply.status(400).send({ error: 'ttlDays must be an integer.' });
      return;
    }
    const minted = await mintAdminApiKey(email, label ? label.slice(0, 80) : null, ttlDays);
    return { id: minted.id, key: minted.key, prefix: minted.prefix, expiresAt: minted.expiresAt };
  });

  app.get('/api/admin/api-keys', async (req, reply) => {
    const email = await requireAdminSession(req, reply);
    if (!email) return;
    return await listAdminApiKeys(email);
  });

  app.post('/api/admin/api-keys/:id/revoke', async (req, reply) => {
    const email = await requireAdminSession(req, reply);
    if (!email) return;
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || !(await revokeAdminApiKey(id, email))) {
      reply.status(404).send({ error: 'Key not found.' });
      return;
    }
    return { ok: true };
  });
}
