import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

vi.mock('../server/clerk.js', () => ({
  verifyClerkToken: vi.fn(),
  ADMIN_EMAILS: [],
}));

vi.mock('../server/services/stripe.js', () => ({
  hasPurchased: vi.fn().mockResolvedValue(false),
  getActiveSubscriptionLive: vi.fn().mockResolvedValue({ isPro: false, tier: 'free' }),
}));

vi.mock('../server/gemini.js', () => ({
  askGemini: vi.fn().mockResolvedValue('{"ok":true}'),
}));

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { verifyClerkToken } from '../server/clerk.js';
import { getActiveSubscriptionLive } from '../server/services/stripe.js';
import { initDb, dbRun } from '../server/db.js';
import {
  checkRateLimitForRequest,
  handleGenerateEndpoint,
  FREE_TIER_LIMIT,
  PAID_TIER_LIMIT,
} from '../server/routes/tools/_shared.js';

const ENDPOINT = 'entitlement-test';
const PAYER = 'payer@test.com';
const USER_A = 'usera@test.com';
const USER_B = 'userb@test.com';

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM usage_tracking');
  await dbRun('DELETE FROM usage_daily');
  vi.mocked(verifyClerkToken).mockReset();
  vi.mocked(getActiveSubscriptionLive).mockReset();
  vi.mocked(getActiveSubscriptionLive).mockResolvedValue({ isPro: false, tier: 'free' });
});

describe('checkRateLimitForRequest', () => {
  it('ignores a body email for a paying user when there is no verified token — free limit applies', async () => {
    vi.mocked(verifyClerkToken).mockResolvedValue(null);
    vi.mocked(getActiveSubscriptionLive).mockImplementation(async (email: string) =>
      email === PAYER ? { isPro: true, tier: 'pro' } : { isPro: false, tier: 'free' },
    );

    const fakeReq = {
      headers: { authorization: undefined },
      body: { email: PAYER },
    } as any;

    const result = await checkRateLimitForRequest(fakeReq, 'iphash-1', ENDPOINT);
    expect(result.isPro).toBe(false);
    expect(result.limit).toBe(FREE_TIER_LIMIT);
  });

  it('grants the paid limit for a valid token belonging to a paying user', async () => {
    vi.mocked(verifyClerkToken).mockResolvedValue(PAYER);
    vi.mocked(getActiveSubscriptionLive).mockImplementation(async (email: string) =>
      email === PAYER ? { isPro: true, tier: 'pro' } : { isPro: false, tier: 'free' },
    );

    const fakeReq = {
      headers: { authorization: 'Bearer valid-token' },
      body: {},
    } as any;

    const result = await checkRateLimitForRequest(fakeReq, 'iphash-2', ENDPOINT);
    expect(result.isPro).toBe(true);
    expect(result.limit).toBe(PAID_TIER_LIMIT);
  });

  it('uses the token owner, not a spoofed body email, when they differ', async () => {
    vi.mocked(verifyClerkToken).mockResolvedValue(USER_A);
    vi.mocked(getActiveSubscriptionLive).mockImplementation(async (email: string) =>
      email === USER_B ? { isPro: true, tier: 'pro' } : { isPro: false, tier: 'free' },
    );

    const fakeReq = {
      headers: { authorization: 'Bearer valid-token-a' },
      body: { email: USER_B },
    } as any;

    const result = await checkRateLimitForRequest(fakeReq, 'iphash-3', ENDPOINT);
    expect(result.isPro).toBe(false);
    expect(result.limit).toBe(FREE_TIER_LIMIT);
  });
});

describe('handleGenerateEndpoint entitlement', () => {
  async function buildApp(bodyEmail?: string): Promise<FastifyInstance> {
    const app = Fastify({ logger: false, trustProxy: true });
    app.post('/generate', async (req, reply) =>
      handleGenerateEndpoint(req, reply, {
        endpoint: ENDPOINT,
        inputField: 'topic',
        inputText: 'a sufficiently long test input',
        bodyEmail,
        systemPrompt: 'system',
        userPrompt: 'user',
        logTag: 'test',
      }),
    );
    await app.ready();
    return app;
  }

  it('rate-limits using the verified token owner, ignoring the deprecated bodyEmail option', async () => {
    vi.mocked(verifyClerkToken).mockResolvedValue(USER_A);
    vi.mocked(getActiveSubscriptionLive).mockImplementation(async (email: string) =>
      email === USER_B ? { isPro: true, tier: 'pro' } : { isPro: false, tier: 'free' },
    );

    const app = await buildApp(USER_B);
    const res = await app.inject({
      method: 'POST',
      url: '/generate',
      headers: { authorization: 'Bearer valid-token-a' },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.usage.isPro).toBe(false);
    expect(json.usage.limit).toBe(FREE_TIER_LIMIT);

    await app.close();
  });
});
