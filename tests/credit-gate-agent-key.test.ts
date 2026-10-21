import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

vi.mock('../server/clerk.js', () => ({
  verifyClerkToken: vi.fn(),
  requireAuth: vi.fn(),
  ADMIN_EMAILS: [],
}));

vi.mock('../server/services/stripe.js', () => ({
  hasPurchased: vi.fn().mockResolvedValue(false),
  getActiveSubscriptionLive: vi.fn().mockResolvedValue({ isPro: false, tier: 'free' }),
}));

vi.mock('../server/gemini.js', () => ({
  askGemini: vi.fn(),
}));

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../server/clerk.js';
import { initDb, dbRun } from '../server/db.js';
import { getTokenBalance, grantFreeTokens } from '../server/services/tokens.js';
import { mintAgentApiKey, revokeAgentApiKey } from '../server/services/agent-api-keys.js';
import { creditGate } from '../server/routes/tools/_shared.js';

const ENDPOINT = 'credit-gate-agent-key-test';

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM usage_daily');
  vi.mocked(requireAuth).mockReset().mockImplementation(async (_req: any, reply: any) => {
    reply.status(401).send({ error: 'Sign in required.' });
    return null;
  });
});

async function inject(cost: number, headers: Record<string, string> = {}) {
  const app = Fastify({ logger: false });
  app.post('/t', (async (req: any, reply: any) => {
    const g = await creditGate(req, reply, { endpoint: ENDPOINT, cost });
    if (!g) return;
    return { email: g.email };
  }) as Parameters<FastifyInstance['post']>[1]);
  await app.ready();
  return app.inject({ method: 'POST', url: '/t', headers, remoteAddress: '9.9.9.9' });
}

describe('creditGate with agent keys', () => {
  it('passes with the key owner email for a valid key', async () => {
    const minted = await mintAgentApiKey('Agent-Owner@Test.com', 'ci');
    if (!('key' in minted)) throw new Error('mint failed');
    const res = await inject(1, { authorization: `Bearer ${minted.key}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe('agent-owner@test.com');
    expect(requireAuth).not.toHaveBeenCalled();
  });

  it('replies 401 Invalid API key for a revoked key', async () => {
    const minted = await mintAgentApiKey('revoked-owner@test.com', null);
    if (!('key' in minted)) throw new Error('mint failed');
    await revokeAgentApiKey(minted.id, 'revoked-owner@test.com');
    const res = await inject(1, { authorization: `Bearer ${minted.key}` });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Invalid API key.' });
  });

  it('replies 401 for an unknown bkk_ key', async () => {
    const res = await inject(1, { authorization: 'Bearer bkk_doesnotexist' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Invalid API key.' });
  });

  it('replies 402 when the key owner has no credits', async () => {
    const email = 'broke-agent@test.com';
    const minted = await mintAgentApiKey(email, null);
    if (!('key' in minted)) throw new Error('mint failed');
    await grantFreeTokens(email);
    const balance = await getTokenBalance(email);
    const res = await inject(balance + 1, { authorization: `Bearer ${minted.key}` });
    expect(res.statusCode).toBe(402);
    expect(res.json()).toEqual({ error: 'No credits remaining.', requiresTokens: true, balance });
  });

  it('does not accept a bka_ admin key as an agent key', async () => {
    const res = await inject(1, { authorization: 'Bearer bka_someadminkey' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Sign in required.' });
    expect(requireAuth).toHaveBeenCalledTimes(1);
  });

  it('falls through to the Clerk path with no header', async () => {
    const res = await inject(1);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Sign in required.' });
    expect(requireAuth).toHaveBeenCalledTimes(1);
  });
});
