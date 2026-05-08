import type { FastifyInstance } from 'fastify';
import { dbAll, dbRun, dbGet } from '../db.js';
import { requireAdmin } from '../clerk.js';

interface SecretRow {
  name: string;
  last_rotated_at: number | null;
  rotated_by: string | null;
  notes: string | null;
}

export function registerSecretsRoutes(app: FastifyInstance): void {
  app.get('/api/admin/secrets', async (req, reply) => {
    const email = await requireAdmin(req, reply);
    if (!email) return;
    return await dbAll<SecretRow>(
      `SELECT name, last_rotated_at, rotated_by, notes FROM secret_metadata ORDER BY name`,
    );
  });

  app.post('/api/admin/secrets/:name/rotated', async (req, reply) => {
    const email = await requireAdmin(req, reply);
    if (!email) return;

    const { name } = req.params as { name: string };
    const { notes } = ((req.body ?? {}) as { notes?: string });

    const exists = await dbGet(`SELECT name FROM secret_metadata WHERE name = ?`, name);
    if (!exists) {
      reply.status(404).send({ error: 'Unknown secret name.' });
      return;
    }

    await dbRun(
      `UPDATE secret_metadata SET last_rotated_at = ?, rotated_by = ?, notes = COALESCE(?, notes) WHERE name = ?`,
      Math.floor(Date.now() / 1000),
      email,
      notes ?? null,
      name,
    );
    return { ok: true };
  });
}
