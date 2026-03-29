/**
 * Integration tests for all 12 API endpoints.
 * Uses Fastify's inject() — no real HTTP server, no real Claude calls.
 * Claude is mocked to return valid JSON immediately.
 * Rate limiting uses an in-memory SQLite DB (CONTENTGRADE_DB_PATH=:memory:).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Mock Claude to avoid real API calls
vi.mock('../../server/claude.js', () => ({
  askClaude: vi.fn().mockResolvedValue(
    JSON.stringify({
      total_score: 72,
      grade: 'B',
      framework_scores: {
        rule_of_one: { score: 22, max: 30, feedback: 'Good single focus.' },
        value_equation: { score: 20, max: 30, feedback: 'Clear value.' },
        readability: { score: 16, max: 20, feedback: 'Easy to read.' },
        proof_promise_plan: { score: 14, max: 20, feedback: 'Some proof.' },
      },
      diagnosis: 'Strong headline with room to add urgency.',
      rewrites: [
        { text: 'Rewrite 1', predicted_score: 82, optimized_for: 'rule_of_one', technique: 'Added number' },
        { text: 'Rewrite 2', predicted_score: 79, optimized_for: 'value_equation', technique: 'Added outcome' },
        { text: 'Rewrite 3', predicted_score: 76, optimized_for: 'proof_promise_plan', technique: 'Added proof' },
      ],
      upgrade_hook: 'A full audit would reveal your above-the-fold CTA friction.',
    })
  ),
}));

// Mock Stripe to avoid real API calls
vi.mock('../../server/services/stripe.js', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    hasActiveSubscriptionLive: vi.fn().mockResolvedValue(false),
  };
});

let app: FastifyInstance;

beforeAll(async () => {
  const { createApp } = await import('../../server/app.js');
  app = await createApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  const { _resetDbForTests } = await import('../../server/db.js');
  _resetDbForTests();
});

// ── Health check ──────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns alive status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('alive');
  });
});

// ── HeadlineGrader ────────────────────────────────────────────────────────

describe('POST /api/demos/headline-grader', () => {
  it('returns 400 for missing headline', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/headline-grader',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/at least 3 characters/);
  });

  it('returns 400 for headline under 3 chars', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/headline-grader',
      payload: { headline: 'ab' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for headline over 500 chars', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/headline-grader',
      payload: { headline: 'a'.repeat(501) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/500 characters/);
  });

  it('returns analysis for valid headline', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/headline-grader',
      payload: { headline: 'How I 10x My Revenue in 30 Days Without Cold Calls' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total_score).toBeDefined();
    expect(body.usage).toBeDefined();
    expect(body.usage.remaining).toBeGreaterThanOrEqual(0);
    expect(body.usage.limit).toBe(50);
  });

  it('returns 400 for empty body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/headline-grader',
      payload: { headline: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/demos/headline-grader/compare', () => {
  it('returns 400 when either headline is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/headline-grader/compare',
      payload: { headlineA: 'Good headline here', headlineB: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when both headlines are too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/headline-grader/compare',
      payload: { headlineA: 'ab', headlineB: 'cd' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('accepts valid headline comparison', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/headline-grader/compare',
      payload: {
        headlineA: 'How to Double Your Conversion Rate in 30 Days',
        headlineB: 'The Simple Trick That 10x My Landing Page Signups',
      },
    });
    expect(res.statusCode).toBe(200);
  });
});

// ── PageRoast ─────────────────────────────────────────────────────────────

describe('POST /api/demos/page-roast', () => {
  it('returns 400 for missing URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/page-roast',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/URL is required/);
  });

  it('returns 400 for malformed URL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/page-roast',
      payload: { url: 'not a valid url at all' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/Invalid URL/);
  });

  it('returns 400 when page fetch fails', async () => {
    // localhost:9 is a discard port — connection refused immediately
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/page-roast',
      payload: { url: 'http://localhost:9/this-doesnt-exist' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/Could not fetch page/);
  });
});

describe('POST /api/demos/page-roast/compare', () => {
  it('returns 400 when either URL is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/page-roast/compare',
      payload: { url_a: 'https://example.com' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/Both URLs are required/);
  });
});

// ── AdScorer ──────────────────────────────────────────────────────────────

describe('POST /api/demos/ad-scorer', () => {
  it('returns 400 for missing ad copy', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/ad-scorer',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/at least 10 characters/);
  });

  it('returns 400 for too-short ad copy', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/ad-scorer',
      payload: { adCopy: 'Too short' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for over-length ad copy', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/ad-scorer',
      payload: { adCopy: 'a'.repeat(2001) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/2000 characters/);
  });

  it('accepts valid ad copy', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/ad-scorer',
      payload: { adCopy: 'Get 50% off your first month of our SaaS platform. Limited time offer.' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.usage).toBeDefined();
  });
});

describe('POST /api/demos/ad-scorer/compare', () => {
  it('returns 400 when ad copies are too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/ad-scorer/compare',
      payload: { adCopyA: 'short one', adCopyB: 'also short!' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── ThreadGrader ──────────────────────────────────────────────────────────

describe('POST /api/demos/thread-grader', () => {
  it('returns 400 for missing thread', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/thread-grader',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/at least 20 characters/);
  });

  it('returns 400 for too-long thread', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/thread-grader',
      payload: { threadText: 'a'.repeat(5001) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/5000 characters/);
  });

  it('accepts valid thread', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/thread-grader',
      payload: { threadText: 'This is my Twitter thread about building products. 1/ Start with the problem. 2/ Show the solution.' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.usage).toBeDefined();
  });
});

// ── EmailForge ────────────────────────────────────────────────────────────

describe('POST /api/demos/email-forge', () => {
  it('returns 400 for missing product description', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/email-forge',
      payload: { audience: 'SaaS founders' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/at least 10 characters/);
  });

  it('returns 400 for missing audience', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/email-forge',
      payload: { product: 'A great product that does amazing things' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/at least 5 characters/);
  });

  it('accepts valid email forge request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/email-forge',
      payload: {
        product: 'ContentGrade — AI content quality analyzer',
        audience: 'Content marketers at SaaS companies',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.usage).toBeDefined();
  });
});

// ── AudienceDecoder ───────────────────────────────────────────────────────

describe('POST /api/demos/audience-decoder', () => {
  it('returns 400 for missing content', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/audience-decoder',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/at least 50 characters/);
  });

  it('returns 400 for too-short content', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/audience-decoder',
      payload: { content: 'Too short.' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for over-length content', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/audience-decoder',
      payload: { content: 'a'.repeat(15001) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/15000 characters/);
  });

  it('accepts valid content portfolio', async () => {
    const sampleContent = `
      Post 1: Building in public is the best marketing strategy for indie hackers.
      Post 2: I analyzed 100 landing pages and found the #1 mistake founders make.
      Post 3: Cold outreach works if you lead with value, not with your pitch.
      Post 4: The best product launches I've seen all shared one thing in common.
    `.repeat(3); // make it 50+ chars

    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/audience-decoder',
      payload: { content: sampleContent },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.usage).toBeDefined();
  });
});

describe('POST /api/demos/audience-decoder/compare', () => {
  it('returns 400 when content is too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/audience-decoder/compare',
      payload: {
        content_a: 'Too short',
        content_b: 'Also too short.',
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── Rate limiting end-to-end ──────────────────────────────────────────────

describe('rate limiting enforcement', () => {
  beforeEach(async () => {
    // Clear usage tracking so each test starts with a fresh counter
    const { getDb } = await import('../../server/db.js');
    getDb().prepare('DELETE FROM usage_tracking').run();
  });

  it('blocks after 50 free requests on headline-grader', async () => {
    // Use a unique IP via x-forwarded-for to isolate from other tests
    const headers = { 'x-forwarded-for': '10.0.99.1' };
    const payload = { headline: 'This headline is definitely long enough to test' };
    const { createHash } = await import('crypto');
    const { getDb } = await import('../../server/db.js');
    const ipHash = createHash('sha256').update('10.0.99.1').digest('hex');
    const today = new Date().toISOString().slice(0, 10);

    // Pre-seed 49 usage records so next real request is the 50th (last free)
    getDb().prepare(
      'INSERT INTO usage_tracking (ip_hash, endpoint, date, count) VALUES (?, ?, ?, ?) ON CONFLICT(ip_hash, endpoint, date) DO UPDATE SET count = ?'
    ).run(ipHash, 'headline-grader', today, 49, 49);

    // 50th request should still be allowed
    const resOk = await app.inject({
      method: 'POST',
      url: '/api/demos/headline-grader',
      payload,
      headers,
    });
    expect(resOk.statusCode).toBe(200);
    if (resOk.json().gated) {
      throw new Error('Gated too early — should allow the 50th request');
    }

    // 51st request should be gated
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/headline-grader',
      payload,
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.gated).toBe(true);
    expect(body.remaining).toBe(0);
    expect(body.message).toMatch(/50\/day|daily limit/i);
    // Gate message must include a valid upgrade URL
    expect(body.message).toMatch(/content-grade\.github\.io|contentgrade\.ai|buy\.stripe\.com/);
  });

  it('rate limit is per-endpoint: page-roast has separate counter', async () => {
    // headline exhausted above, but page-roast should still work for same IP
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/page-roast',
      payload: { url: 'http://localhost:9/test' },
      headers: { 'x-forwarded-for': '10.0.99.1' },
    });
    // This will fail with a fetch error (connection refused), NOT with gated:true
    // The point is it tried to fetch the page, not blocked at rate limit
    expect(res.json().gated).toBeUndefined();
  });
});

// ── Email capture ─────────────────────────────────────────────────────────

describe('POST /api/demos/email-capture', () => {
  it('returns 400 for invalid email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/email-capture',
      payload: { email: 'notanemail', tool: 'headline-grader' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for missing tool', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/email-capture',
      payload: { email: 'test@example.com', tool: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('saves valid email capture', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demos/email-capture',
      payload: { email: 'test@example.com', tool: 'headline-grader' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });
});
