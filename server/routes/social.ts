import type { FastifyInstance } from 'fastify';
import {
  listRivalPairs, addRivalPair, generateSocialRoast,
  listQueue, approveQueueItem, rejectQueueItem,
} from '../services/social-roast.js';

export function registerSocialRoutes(app: FastifyInstance): void {
  // List rival pairs
  app.get('/api/social/rivals', async () => {
    return listRivalPairs();
  });

  // Add a rival pair
  app.post('/api/social/rivals', async (req) => {
    const body = req.body as any;
    const id = addRivalPair({
      name_a: body.name_a,
      url_a: body.url_a,
      x_handle_a: body.x_handle_a || null,
      name_b: body.name_b,
      url_b: body.url_b,
      x_handle_b: body.x_handle_b || null,
      category: body.category || null,
      location: body.location || null,
      last_roasted_at: null,
    } as any);
    return { id };
  });

  // Generate a roast for a rival pair
  app.post('/api/social/generate/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const result = await generateSocialRoast(parseInt(id, 10));
      return result;
    } catch (err: any) {
      reply.status(500);
      return { error: err.message };
    }
  });

  // List queue
  app.get('/api/social/queue', async (req) => {
    const { status } = req.query as { status?: string };
    return listQueue(status);
  });

  // Approve
  app.post('/api/social/queue/:id/approve', async (req) => {
    const { id } = req.params as { id: string };
    approveQueueItem(parseInt(id, 10));
    return { ok: true };
  });

  // Reject
  app.post('/api/social/queue/:id/reject', async (req) => {
    const { id } = req.params as { id: string };
    rejectQueueItem(parseInt(id, 10));
    return { ok: true };
  });
}
