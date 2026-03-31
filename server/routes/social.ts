import type { FastifyInstance } from 'fastify';
import {
  listRivalPairs, addRivalPair, generateSocialRoast,
  listQueue, approveQueueItem, rejectQueueItem,
} from '../services/social-roast.js';
import { verifyClerkToken } from '../clerk.js';

const ADMIN_EMAILS = ['bilkobibitkov2000@gmail.com'];

async function requireAdmin(req: any, reply: any): Promise<boolean> {
  const email = await verifyClerkToken(req.headers.authorization);
  if (!email || !ADMIN_EMAILS.includes(email.toLowerCase())) {
    reply.status(403);
    reply.send({ error: 'Admin access required.' });
    return false;
  }
  return true;
}

export function registerSocialRoutes(app: FastifyInstance): void {
  app.get('/api/social/rivals', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    return listRivalPairs();
  });

  app.post('/api/social/rivals', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const body = req.body as any;
    const id = addRivalPair({
      name_a: body.name_a, url_a: body.url_a, x_handle_a: body.x_handle_a || null,
      name_b: body.name_b, url_b: body.url_b, x_handle_b: body.x_handle_b || null,
      category: body.category || null, location: body.location || null, last_roasted_at: null,
    } as any);
    return { id };
  });

  app.post('/api/social/generate/:id', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    try {
      return await generateSocialRoast(parseInt(id, 10));
    } catch (err: any) {
      reply.status(500);
      return { error: err.message };
    }
  });

  app.get('/api/social/queue', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const { status } = req.query as { status?: string };
    return listQueue(status);
  });

  app.post('/api/social/queue/:id/approve', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    approveQueueItem(parseInt(id, 10));
    return { ok: true };
  });

  app.post('/api/social/queue/:id/reject', async (req, reply) => {
    if (!await requireAdmin(req, reply)) return;
    const { id } = req.params as { id: string };
    rejectQueueItem(parseInt(id, 10));
    return { ok: true };
  });
}
