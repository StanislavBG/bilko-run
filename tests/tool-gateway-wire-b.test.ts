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
import { verifyClerkToken } from '../server/clerk.js';
import { hasPurchased } from '../server/services/stripe.js';
import { askGemini } from '../server/gemini.js';
import { initDb, dbRun, dbGet } from '../server/db.js';
import { registerAudienceDecoderRoutes } from '../server/routes/tools/audience-decoder.js';
import { registerEmailForgeRoutes } from '../server/routes/tools/email-forge.js';

const today = () => new Date().toISOString().slice(0, 10);
const portfolio = 'x'.repeat(60);

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  for (const t of ['usage_tracking', 'usage_daily', 'cost_alerts', 'app_spend_ceilings', 'funnel_events']) {
    await dbRun(`DELETE FROM ${t}`);
  }
  vi.mocked(verifyClerkToken).mockReset().mockResolvedValue(null as any);
  vi.mocked(hasPurchased).mockReset().mockResolvedValue(false);
  vi.mocked(askGemini).mockReset().mockResolvedValue(
    JSON.stringify({ headline: 'h', overall_score: 50, grade: 'C', emails: [] }),
  );
});

async function app() {
  const a = Fastify({ logger: false });
  registerAudienceDecoderRoutes(a);
  registerEmailForgeRoutes(a);
  await a.ready();
  return a;
}

describe('audience-decoder compare', () => {
  it('increments the app ceiling by 3 and makes 3 Gemini calls', async () => {
    const a = await app();
    const res = await a.inject({
      method: 'POST', url: '/api/demos/audience-decoder/compare',
      payload: { content_a: portfolio, content_b: portfolio },
    });
    expect(res.statusCode).toBe(200);
    const row = await dbGet<{ total: number }>(
      'SELECT SUM(calls) AS total FROM usage_daily WHERE app_slug = ? AND date = ?', 'audience-decoder', today(),
    );
    expect(row?.total).toBe(3);
    expect(askGemini).toHaveBeenCalledTimes(3);
  });

  it('503s when the 3-call increment crosses the ceiling', async () => {
    await dbRun(
      'INSERT INTO app_spend_ceilings (app_slug, max_calls_per_day, updated_at) VALUES (?, ?, ?)',
      'audience-decoder', 2, Math.floor(Date.now() / 1000),
    );
    const a = await app();
    const res = await a.inject({
      method: 'POST', url: '/api/demos/audience-decoder/compare',
      payload: { content_a: portfolio, content_b: portfolio },
    });
    expect(res.statusCode).toBe(503);
    expect(askGemini).not.toHaveBeenCalled();
  });

  it('still honours the one-time purchase past the free limit', async () => {
    vi.mocked(verifyClerkToken).mockResolvedValue('buyer@test.com');
    vi.mocked(hasPurchased).mockResolvedValue(true);
    await dbRun(
      'INSERT INTO usage_tracking (ip_hash, endpoint, date, count) VALUES (?, ?, ?, ?)',
      (await import('../server/routes/tools/_shared.js')).hashIp('127.0.0.1'), 'audience-decoder', today(), 10,
    );
    const a = await app();
    const res = await a.inject({
      method: 'POST', url: '/api/demos/audience-decoder',
      payload: { content: portfolio }, headers: { authorization: 'Bearer t' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().usage.isPro).toBe(true);
  });
});

describe('email-forge compare', () => {
  it('counts 3 calls and never leaks err.message', async () => {
    const a = await app();
    const ok = await a.inject({
      method: 'POST', url: '/api/demos/email-forge/compare',
      payload: {
        product_a: 'a product long enough', audience_a: 'audience a', product_b: 'b product long enough', audience_b: 'audience b',
      },
    });
    expect(ok.statusCode).toBe(200);
    const row = await dbGet<{ total: number }>(
      'SELECT SUM(calls) AS total FROM usage_daily WHERE app_slug = ? AND date = ?', 'email-forge', today(),
    );
    expect(row?.total).toBe(3);

    vi.mocked(askGemini).mockRejectedValue(new Error('SECRET upstream detail'));
    const bad = await a.inject({
      method: 'POST', url: '/api/demos/email-forge/compare',
      payload: {
        product_a: 'a product long enough', audience_a: 'audience a', product_b: 'b product long enough', audience_b: 'audience b',
      },
    });
    expect(bad.statusCode).toBe(500);
    expect(bad.body).not.toContain('SECRET');
  });
});
