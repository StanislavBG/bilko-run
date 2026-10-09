import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../server/clerk.js', () => ({
  requireAuth: vi.fn().mockResolvedValue('payer@test.com'),
  verifyClerkToken: vi.fn(),
  ADMIN_EMAILS: [],
}));

vi.mock('../server/services/stripe.js', () => ({
  hasPurchased: vi.fn().mockResolvedValue(false),
  getActiveSubscriptionLive: vi.fn().mockResolvedValue({ isPro: false, tier: 'free' }),
}));

vi.mock('../server/gemini.js', () => ({
  askGemini: vi.fn().mockResolvedValue('{"total_score":80,"grade":"B","roast":"ok"}'),
}));

vi.mock('../server/db.js', () => ({
  dbRun: vi.fn().mockResolvedValue(undefined),
  dbGet: vi.fn(),
  dbAll: vi.fn(),
}));

vi.mock('../server/routes/tools/_shared.js', () => ({
  creditGate: vi.fn().mockResolvedValue({ email: 'payer@test.com', ipHash: 'iphash', isPro: false }),
  askGeminiJson: vi.fn().mockResolvedValue({ total_score: 80, grade: 'B', roast: 'ok' }),
  toolErrorReply: vi.fn((reply: any, _err: unknown, label: string) => {
    reply.status(500);
    return { error: `${label} failed. Please try again.` };
  }),
}));

vi.mock('../server/services/page-fetch.js', () => ({
  validatePublicUrl: vi.fn((u: string) => new URL(u)),
  fetchPageBounded: vi.fn().mockResolvedValue('Lorem ipsum dolor sit amet. '.repeat(100)),
}));

vi.mock('@bilkobibitkov/page-roast', () => ({
  roastPage: vi.fn().mockResolvedValue({
    scores: { total_score: 80, grade: 'B', roast: 'ok' },
    scoreA: {}, scoreB: {}, comparison: {},
  }),
}));

// Balance check passes (5 credits) but the atomic deduction loses the race.
vi.mock('../server/services/tokens.js', () => ({
  getTokenBalance: vi.fn().mockResolvedValue(5),
  grantFreeTokens: vi.fn().mockResolvedValue(undefined),
  hasTokenAccount: vi.fn().mockResolvedValue(true),
  deductToken: vi.fn().mockResolvedValue({ success: false, balance: 0 }),
  refundTokens: vi.fn().mockResolvedValue(undefined),
}));

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { deductToken, refundTokens } from '../server/services/tokens.js';
import { askGeminiJson } from '../server/routes/tools/_shared.js';
import { roastPage } from '@bilkobibitkov/page-roast';
import { registerStackAuditRoutes } from '../server/routes/tools/stack-audit.js';
import { registerLaunchGraderRoutes } from '../server/routes/tools/launch-grader.js';
import { registerPageRoastRoutes } from '../server/routes/tools/page-roast.js';

const cases = [
  { name: 'stack-audit', url: '/api/demos/stack-audit', payload: { tools: 'Slack, Notion, Figma, Linear, Zoom' } },
  { name: 'launch-grader', url: '/api/demos/launch-grader', payload: { url: 'https://example.com', description: 'A tool for testing things' } },
  { name: 'page-roast', url: '/api/demos/page-roast', payload: { url: 'https://example.com' } },
  { name: 'page-roast compare', url: '/api/demos/page-roast/compare', payload: { url_a: 'https://a.example.com', url_b: 'https://b.example.com' } },
];

describe('credit-gated tool routes when deduction fails after the balance check', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.mocked(deductToken).mockClear();
    vi.mocked(refundTokens).mockClear();
    vi.mocked(askGeminiJson).mockClear();
    vi.mocked(roastPage).mockClear();
    app = Fastify();
    registerStackAuditRoutes(app);
    registerLaunchGraderRoutes(app);
    registerPageRoastRoutes(app);
    await app.ready();
  });

  for (const c of cases) {
    it(`${c.name} returns 402 and no scored result`, async () => {
      const res = await app.inject({ method: 'POST', url: c.url, payload: c.payload });
      expect(res.statusCode).toBe(402);
      const body = res.json();
      expect(body.requiresTokens).toBe(true);
      expect(body.balance).toBe(0);
      expect(body.error).toEqual(expect.any(String));
      expect(body.total_score).toBeUndefined();
      expect(body.usage).toBeUndefined();
      expect(body.score_a).toBeUndefined();
      expect(deductToken).toHaveBeenCalledTimes(1);
      expect(askGeminiJson).not.toHaveBeenCalled();
      expect(roastPage).not.toHaveBeenCalled();
      expect(refundTokens).not.toHaveBeenCalled();
    });
  }
});

describe('credit-gated tool routes when Gemini fails after a successful deduction', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.mocked(deductToken).mockReset().mockResolvedValue({ success: true, balance: 4 });
    vi.mocked(refundTokens).mockClear();
    vi.mocked(askGeminiJson).mockReset().mockRejectedValue(new Error('secret upstream detail'));
    vi.mocked(roastPage).mockReset().mockRejectedValue(new Error('secret upstream detail'));
    app = Fastify();
    registerStackAuditRoutes(app);
    registerLaunchGraderRoutes(app);
    registerPageRoastRoutes(app);
    await app.ready();
  });

  for (const c of cases) {
    it(`${c.name} refunds the deducted tokens and leaks no error text`, async () => {
      const res = await app.inject({ method: 'POST', url: c.url, payload: c.payload });
      expect(res.statusCode).toBe(500);
      expect(res.body).not.toContain('secret upstream detail');
      const cost = vi.mocked(deductToken).mock.calls[0][1];
      expect(deductToken).toHaveBeenCalledTimes(1);
      expect(refundTokens).toHaveBeenCalledTimes(1);
      expect(refundTokens).toHaveBeenCalledWith('payer@test.com', cost, expect.stringContaining('refund'));
    });
  }
});
