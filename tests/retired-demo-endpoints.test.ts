import { vi, describe, it, expect, beforeAll } from 'vitest';

vi.mock('../server/clerk.js', () => ({
  verifyClerkToken: vi.fn().mockResolvedValue(null),
  ADMIN_EMAILS: [],
}));

vi.mock('../server/services/stripe.js', () => ({
  hasPurchased: vi.fn().mockResolvedValue(false),
  getActiveSubscriptionLive: vi.fn().mockResolvedValue({ isPro: false, tier: 'free' }),
}));

vi.mock('../server/gemini.js', () => ({
  askGemini: vi.fn().mockResolvedValue('{}'),
}));

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { initDb } from '../server/db.js';
import { registerToolRoutes } from '../server/routes/tools/index.js';

let app: FastifyInstance;

beforeAll(async () => {
  await initDb();
  app = Fastify({ logger: false });
  registerToolRoutes(app);
  await app.ready();
});

describe('retired demo endpoints stay gone', () => {
  it('POST /api/demos/email-capture is not registered', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/email-capture',
      payload: { email: 'a@b.co', tool: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/demos/headline-grader/unlock is not registered', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/headline-grader/unlock',
      payload: { email: 'a@b.co' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/demos/headline-grader is still registered', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/headline-grader',
      payload: {},
    });
    expect(res.statusCode).not.toBe(404);
  });
});
