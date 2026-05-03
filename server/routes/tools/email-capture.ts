import type { FastifyInstance } from 'fastify';
import { dbRun } from '../../db.js';
import { EMAIL_RE } from '../../clerk.js';
import { hashIp } from './_shared.js';

export function registerEmailCaptureRoutes(app: FastifyInstance): void {
  app.post('/api/demos/email-capture', async (req, reply) => {
    const body = req.body as { email?: string; tool?: string; score?: string } | null;
    const email = (body?.email ?? '').trim().toLowerCase();
    const tool = (body?.tool ?? '').trim();
    const score = String(body?.score ?? '').trim();
    if (!email || !EMAIL_RE.test(email) || !tool) {
      reply.status(400);
      return { error: 'Valid email and tool are required.' };
    }
    try {
      const ipHash = hashIp(req.ip);
      await dbRun(
        'INSERT OR IGNORE INTO email_captures (email, tool, score, ip_hash, source) VALUES (?, ?, ?, ?, ?)',
        email, tool, score, ipHash, tool,
      );
      return { ok: true };
    } catch (err: any) {
      console.error('email_capture', err);
      reply.status(500);
      return { error: 'Failed to save.' };
    }
  });
}
