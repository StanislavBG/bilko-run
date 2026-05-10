import { vi, describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';

// requireAuth is mocked so the route never hits Clerk's network
vi.mock('../server/clerk.js', () => ({
  requireAuth: vi.fn(),
  ADMIN_EMAILS: [],
}));

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerAcademyRoutes, checkIpMinuteLimit, resetIpMinuteLimit } from '../server/routes/academy.js';
import { requireAuth } from '../server/clerk.js';
import { initDb, dbRun } from '../server/db.js';
import { emailHash } from '../server/services/academy-quota.js';

const USER_EMAIL = 'student@ask-test.com';
const TEST_IP = '10.0.0.1';
const TEST_IP_HASH = require('crypto').createHash('sha256').update(TEST_IP).digest('hex');

const MOCK_ANTHROPIC_OK = {
  content: [{ text: 'Great question!' }],
  usage: { input_tokens: 12, output_tokens: 7 },
};

function mockAuthAs(email: string) {
  vi.mocked(requireAuth).mockResolvedValue(email);
}

function mockAuthAnonymous() {
  vi.mocked(requireAuth).mockImplementation(async (_req, reply) => {
    reply.code(401).send({ error: 'sign_in_required' });
    return null;
  });
}

function mockFetchOk() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => MOCK_ANTHROPIC_OK,
  }));
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, trustProxy: true });
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    try { done(null, JSON.parse((body as Buffer).toString())); } catch (e) { done(e as Error, undefined); }
  });
  registerAcademyRoutes(app);
  await app.ready();
  return app;
}

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM academy_quota_daily');
  await dbRun('DELETE FROM usage_daily');
  resetIpMinuteLimit(TEST_IP_HASH);
  delete process.env.ANTHROPIC_API_KEY_ACADEMY;
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('POST /api/academy/ask', () => {
  it('returns 401 when no auth (anonymous user)', async () => {
    const app = await buildApp();
    mockAuthAnonymous();

    const res = await app.inject({
      method: 'POST',
      url: '/api/academy/ask',
      headers: { 'x-forwarded-for': TEST_IP, 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'What is gradient descent?' }),
    });

    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('returns 400 when body uses "prompt" instead of "user"', async () => {
    const app = await buildApp();
    mockAuthAs(USER_EMAIL);
    process.env.ANTHROPIC_API_KEY_ACADEMY = 'test-key';
    mockFetchOk();

    const res = await app.inject({
      method: 'POST',
      url: '/api/academy/ask',
      headers: { 'x-forwarded-for': TEST_IP, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'What is gradient descent?' }),
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('bad_request');
    await app.close();
  });

  it('returns 503 when ANTHROPIC_API_KEY_ACADEMY is not set', async () => {
    const app = await buildApp();
    mockAuthAs(USER_EMAIL);
    // key intentionally not set (deleted in beforeEach)

    const res = await app.inject({
      method: 'POST',
      url: '/api/academy/ask',
      headers: { 'x-forwarded-for': TEST_IP, 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'What is gradient descent?' }),
    });

    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe('not_configured');
    await app.close();
  });

  it('returns 200 with text/tokenIn/tokenOut/provider when authed and key set', async () => {
    const app = await buildApp();
    mockAuthAs(USER_EMAIL);
    process.env.ANTHROPIC_API_KEY_ACADEMY = 'test-key';
    mockFetchOk();

    const res = await app.inject({
      method: 'POST',
      url: '/api/academy/ask',
      headers: { 'x-forwarded-for': TEST_IP, 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'What is gradient descent?', lessonSlug: 'ml-basics' }),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.text).toBe('Great question!');
    expect(body.tokenIn).toBe(12);
    expect(body.tokenOut).toBe(7);
    expect(body.provider).toBe('anthropic');
    await app.close();
  });

  it('returns 429 daily_quota_exceeded after 5 successful calls', async () => {
    const app = await buildApp();
    process.env.ANTHROPIC_API_KEY_ACADEMY = 'test-key';

    // Pre-seed 5 ok records in the quota table
    const eh = emailHash(USER_EMAIL);
    const nowSec = Math.floor(Date.now() / 1000);
    for (let i = 0; i < 5; i++) {
      await dbRun(
        'INSERT INTO academy_quota_daily (email_hash, call_at, outcome) VALUES (?, ?, ?)',
        eh, nowSec - i, 'ok',
      );
    }

    mockAuthAs(USER_EMAIL);
    mockFetchOk();

    const res = await app.inject({
      method: 'POST',
      url: '/api/academy/ask',
      headers: { 'x-forwarded-for': TEST_IP, 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'Another question' }),
    });

    expect(res.statusCode).toBe(429);
    const body = res.json();
    expect(body.error).toBe('daily_quota_exceeded');
    expect(body.suggestion).toBe('BYOK');
    expect(typeof body.resetAt).toBe('string');
    await app.close();
  });

  it('returns 429 rate_limited after 10 requests/min from same IP', async () => {
    const app = await buildApp();
    mockAuthAs(USER_EMAIL);

    // Fill the per-IP bucket by calling the check function directly
    for (let i = 0; i < 10; i++) {
      checkIpMinuteLimit(TEST_IP_HASH);
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/academy/ask',
      headers: { 'x-forwarded-for': TEST_IP, 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'What is gradient descent?' }),
    });

    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe('rate_limited');
    await app.close();
  });

  it('passes the correct model and max_tokens to Anthropic', async () => {
    const app = await buildApp();
    mockAuthAs(USER_EMAIL);
    process.env.ANTHROPIC_API_KEY_ACADEMY = 'test-key';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_ANTHROPIC_OK,
    });
    vi.stubGlobal('fetch', mockFetch);

    await app.inject({
      method: 'POST',
      url: '/api/academy/ask',
      headers: { 'x-forwarded-for': TEST_IP, 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'Hello', model: 'claude-sonnet-4-6-latest' }),
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.model).toBe('claude-sonnet-4-6-latest');
    expect(callBody.max_tokens).toBe(1024);
    await app.close();
  });

  it('rejects disallowed model names', async () => {
    const app = await buildApp();
    mockAuthAs(USER_EMAIL);
    process.env.ANTHROPIC_API_KEY_ACADEMY = 'test-key';

    const res = await app.inject({
      method: 'POST',
      url: '/api/academy/ask',
      headers: { 'x-forwarded-for': TEST_IP, 'content-type': 'application/json' },
      body: JSON.stringify({ user: 'Hello', model: 'gpt-4' }),
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
