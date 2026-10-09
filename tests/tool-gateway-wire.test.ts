import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

vi.mock('../server/clerk.js', () => ({
  verifyClerkToken: vi.fn().mockResolvedValue(null),
  ADMIN_EMAILS: [],
}));

vi.mock('../server/services/stripe.js', () => ({
  hasPurchased: vi.fn().mockResolvedValue(false),
  getActiveSubscriptionLive: vi.fn().mockResolvedValue({ isPro: false, tier: 'free' }),
}));

const SCORE = vi.hoisted(() => JSON.stringify({
  total_score: 70,
  grade: 'B',
  framework_scores: {
    rule_of_one: { score: 20, max: 30, feedback: '' },
    value_equation: { score: 20, max: 30, feedback: '' },
    readability: { score: 15, max: 20, feedback: '' },
    proof_promise_plan: { score: 15, max: 20, feedback: '' },
  },
  verdict: 'v',
  suggested_hybrid: 'h',
}));

vi.mock('../server/gemini.js', () => ({
  askGemini: vi.fn().mockResolvedValue(SCORE),
}));

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { askGemini } from '../server/gemini.js';
import { initDb, dbRun, dbGet } from '../server/db.js';
import { registerHeadlineGraderRoutes } from '../server/routes/tools/headline-grader.js';

let app: FastifyInstance;

beforeAll(async () => {
  await initDb();
  app = Fastify({ logger: false });
  registerHeadlineGraderRoutes(app);
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM usage_tracking');
  await dbRun('DELETE FROM usage_daily');
  await dbRun('DELETE FROM cost_alerts');
  await dbRun('DELETE FROM app_spend_ceilings');
  vi.mocked(askGemini).mockReset();
  vi.mocked(askGemini).mockResolvedValue(SCORE);
});

async function dailyCalls(): Promise<number> {
  const row = await dbGet<{ total: number }>(
    `SELECT SUM(calls) AS total FROM usage_daily WHERE app_slug = 'headline-grader'`,
  );
  return row?.total ?? 0;
}

describe('headline-grader gateway wiring', () => {
  it('compare counts its 3 Gemini calls against the ceiling', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/headline-grader/compare',
      payload: { headlineA: 'Cut your AWS bill 40%', headlineB: 'Tips for better marketing' },
    });
    expect(res.statusCode).toBe(200);
    expect(vi.mocked(askGemini)).toHaveBeenCalledTimes(3);
    expect(await dailyCalls()).toBe(3);
  });

  it('single score counts 1 call', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/headline-grader',
      payload: { headline: 'Cut your AWS bill 40%' },
    });
    expect(res.statusCode).toBe(200);
    expect(await dailyCalls()).toBe(1);
  });

  it('a Gemini failure replies a generic 500 without err.message', async () => {
    vi.mocked(askGemini).mockRejectedValue(new Error('secret upstream detail'));
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/headline-grader',
      payload: { headline: 'Cut your AWS bill 40%' },
    });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('secret upstream detail');
  });
});
