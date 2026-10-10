import { vi, describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';

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
import { verifyClerkToken, requireAuth } from '../server/clerk.js';
import { askGemini } from '../server/gemini.js';
import { initDb, dbRun, dbGet } from '../server/db.js';
import { grantFreeTokens, getTokenBalance } from '../server/services/tokens.js';
import {
  freeTierGate, creditGate, askGeminiJson, toolErrorReply, enforceCallLimits, handleGenerateEndpoint,
  setCeilingCacheTtl, hashIp, freeGateMsg, FREE_TIER_LIMIT,
} from '../server/routes/tools/_shared.js';

const ENDPOINT = 'gateway-helpers-test';

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM usage_tracking');
  await dbRun('DELETE FROM usage_daily');
  await dbRun('DELETE FROM cost_alerts');
  await dbRun('DELETE FROM app_spend_ceilings');
  await dbRun('DELETE FROM funnel_events');
  vi.mocked(verifyClerkToken).mockReset().mockResolvedValue(null as any);
  vi.mocked(requireAuth).mockReset();
  vi.mocked(askGemini).mockReset();
});

async function inject(handler: Parameters<FastifyInstance['post']>[1], headers: Record<string, string> = {}) {
  const app = Fastify({ logger: false });
  app.post('/t', handler as any);
  await app.ready();
  return app.inject({ method: 'POST', url: '/t', headers, remoteAddress: '9.9.9.9' });
}

describe('freeTierGate', () => {
  it('passes and returns ipHash when under the free limit', async () => {
    const res = await inject(async (req, reply) => {
      const g = await freeTierGate(req, reply, { endpoint: ENDPOINT });
      if (!g) return;
      return { ipHash: g.ipHash, email: g.email ?? null };
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ipHash).toBe(hashIp('9.9.9.9'));
  });

  it('replies 429 with the gated body and returns null', async () => {
    await dbRun(
      'INSERT INTO usage_tracking (ip_hash, endpoint, date, count) VALUES (?, ?, ?, ?)',
      hashIp('9.9.9.9'), ENDPOINT, new Date().toISOString().slice(0, 10), FREE_TIER_LIMIT,
    );
    let gate: unknown = 'unset';
    const res = await inject(async (req, reply) => {
      gate = await freeTierGate(req, reply, { endpoint: ENDPOINT });
    });
    expect(gate).toBeNull();
    expect(res.statusCode).toBe(429);
    expect(res.json()).toEqual({
      gated: true, isPro: false, remaining: 0, limit: FREE_TIER_LIMIT, message: freeGateMsg(),
    });
  });

  it('counts calls:3 against the app ceiling and replies 503', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await dbRun('INSERT INTO app_spend_ceilings (app_slug, max_calls_per_day, updated_at) VALUES (?, ?, ?)', ENDPOINT, 5, 0);
    await dbRun('INSERT INTO usage_daily (user_email, app_slug, date, calls) VALUES (?, ?, ?, ?)', 'other@test.com', ENDPOINT, today, 3);

    const res = await inject(async (req, reply) => {
      const g = await freeTierGate(req, reply, { endpoint: ENDPOINT, calls: 3 });
      if (!g) return;
      return { ok: true };
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toMatch(/ceiling/i);

    const row = await dbGet<{ calls: number }>(
      'SELECT calls FROM usage_daily WHERE user_email = ? AND app_slug = ?', `anon:${hashIp('9.9.9.9')}`, ENDPOINT,
    );
    expect(row?.calls).toBe(3);
  });

  it('calls:1 under the same ceiling still passes', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await dbRun('INSERT INTO app_spend_ceilings (app_slug, max_calls_per_day, updated_at) VALUES (?, ?, ?)', ENDPOINT, 5, 0);
    await dbRun('INSERT INTO usage_daily (user_email, app_slug, date, calls) VALUES (?, ?, ?, ?)', 'other@test.com', ENDPOINT, today, 3);
    const res = await inject(async (req, reply) => {
      const g = await freeTierGate(req, reply, { endpoint: ENDPOINT });
      if (!g) return;
      return { ok: true };
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('enforceCallLimits ceiling memo', () => {
  afterEach(() => setCeilingCacheTtl(0));

  it('memoizes the ceiling row within the TTL', async () => {
    setCeilingCacheTtl(60_000);
    const ctx = { userEmail: 'memo@test.com', ipHash: 'h', isAdmin: false, appSlug: 'memo-app' };
    await dbRun('INSERT INTO app_spend_ceilings (app_slug, max_calls_per_day, updated_at) VALUES (?, ?, ?)', 'memo-app', 1, 0);
    expect((await enforceCallLimits(ctx)).ok).toBe(true);
    await dbRun('DELETE FROM app_spend_ceilings');
    // Second call would be allowed without a ceiling; the memoized row still blocks it.
    expect((await enforceCallLimits(ctx)).ok).toBe(false);
  });
});

describe('creditGate', () => {
  it('replies 402 when the balance is below cost', async () => {
    vi.mocked(requireAuth).mockResolvedValue('broke@test.com');
    await grantFreeTokens('broke@test.com');
    const balance = await getTokenBalance('broke@test.com');

    let gate: unknown = 'unset';
    const res = await inject(async (req, reply) => {
      gate = await creditGate(req, reply, { endpoint: ENDPOINT, cost: balance + 1 });
    });
    expect(gate).toBeNull();
    expect(res.statusCode).toBe(402);
    expect(res.json()).toEqual({ error: 'No credits remaining.', requiresTokens: true, balance });
  });

  it('passes when the balance covers the cost', async () => {
    vi.mocked(requireAuth).mockResolvedValue('rich@test.com');
    const res = await inject(async (req, reply) => {
      const g = await creditGate(req, reply, { endpoint: ENDPOINT, cost: 1 });
      if (!g) return;
      return { email: g.email };
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe('rich@test.com');
  });

  it('returns null without extra reply when auth fails', async () => {
    vi.mocked(requireAuth).mockImplementation(async (_req: any, reply: any) => {
      reply.status(401).send({ error: 'Sign in required.' });
      return null;
    });
    const res = await inject(async (req, reply) => {
      await creditGate(req, reply, { endpoint: ENDPOINT, cost: 1 });
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('askGeminiJson', () => {
  it('parses plain JSON', async () => {
    vi.mocked(askGemini).mockResolvedValue('{"score":7}');
    expect(await askGeminiJson('p')).toEqual({ score: 7 });
  });

  it('falls back to the embedded JSON block when wrapped in prose/fences', async () => {
    vi.mocked(askGemini).mockResolvedValue('Sure!\n```json\n{"score":9,"grade":"A"}\n```');
    expect(await askGeminiJson('p', { systemPrompt: 's' })).toEqual({ score: 9, grade: 'A' });
    expect(askGemini).toHaveBeenCalledWith('p', { systemPrompt: 's' });
  });

  it('throws when no JSON is present', async () => {
    vi.mocked(askGemini).mockResolvedValue('no json here');
    await expect(askGeminiJson('p')).rejects.toThrow(/parse/i);
  });
});

describe('handleGenerateEndpoint', () => {
  it('replies a generic 500 when Gemini throws and never leaks err.message', async () => {
    vi.mocked(verifyClerkToken).mockResolvedValue('gen@test.com' as any);
    vi.mocked(askGemini).mockRejectedValue(new Error('secret detail'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await inject(
      async (req, reply) => handleGenerateEndpoint(req, reply, {
        endpoint: ENDPOINT, inputField: 'topic', inputText: 'a long enough topic',
        systemPrompt: 's', userPrompt: 'p', logTag: 'gen-test',
      }),
      { authorization: 'Bearer t' },
    );
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('secret detail');
    expect(res.json()).toEqual({ error: 'Generation failed. Please try again.' });
    spy.mockRestore();
  });
});

describe('toolErrorReply', () => {
  it('replies a generic 500 and never leaks err.message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await inject(async (_req, reply) => toolErrorReply(reply, new Error('secret db detail'), 'Scoring'));
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: 'Scoring failed. Please try again.' });
    expect(res.body).not.toContain('secret');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
