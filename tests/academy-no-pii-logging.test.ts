import { vi, describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';

vi.mock('../server/clerk.js', () => ({
  requireAuth: vi.fn(),
  ADMIN_EMAILS: [],
}));

import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { registerAcademyRoutes, resetIpMinuteLimit } from '../server/routes/academy.js';
import { requireAuth } from '../server/clerk.js';
import { initDb, dbRun } from '../server/db.js';

// Magic strings that must never appear in any log line
const MAGIC_PROMPT = 'BANANAFISH-XYZ-9920';
const MAGIC_SYSTEM = 'SECRET-SYSTEM-PROMPT-77441';

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
  resetIpMinuteLimit(require('crypto').createHash('sha256').update('10.0.0.2').digest('hex'));
  process.env.ANTHROPIC_API_KEY_ACADEMY = 'test-key';
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY_ACADEMY;
});

describe('academy no-PII logging', () => {
  it('does not log prompt or response text on a successful call', async () => {
    const app = await buildApp();
    vi.mocked(requireAuth).mockResolvedValue('nopii@test.com');

    const responseText = `The answer is: ${MAGIC_PROMPT}-response`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: responseText }],
        usage: { input_tokens: 5, output_tokens: 10 },
      }),
    }));

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await app.inject({
      method: 'POST',
      url: '/api/academy/ask',
      headers: { 'x-forwarded-for': '10.0.0.2', 'content-type': 'application/json' },
      body: JSON.stringify({ user: MAGIC_PROMPT, system: MAGIC_SYSTEM, lessonSlug: 'test-lesson' }),
    });

    const allLogged = consoleSpy.mock.calls.map(args => String(args[0])).join('\n');

    expect(allLogged).not.toContain(MAGIC_PROMPT);
    expect(allLogged).not.toContain(MAGIC_SYSTEM);
    expect(allLogged).not.toContain(responseText);

    consoleSpy.mockRestore();
    await app.close();
  });

  it('does not log prompt on upstream error', async () => {
    const app = await buildApp();
    vi.mocked(requireAuth).mockResolvedValue('nopii2@test.com');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'upstream rate limit',
    }));

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await app.inject({
      method: 'POST',
      url: '/api/academy/ask',
      headers: { 'x-forwarded-for': '10.0.0.2', 'content-type': 'application/json' },
      body: JSON.stringify({ user: MAGIC_PROMPT }),
    });

    const allLogged = consoleSpy.mock.calls.map(args => String(args[0])).join('\n');
    expect(allLogged).not.toContain(MAGIC_PROMPT);

    consoleSpy.mockRestore();
    await app.close();
  });

  it('does not log prompt on fetch exception', async () => {
    const app = await buildApp();
    vi.mocked(requireAuth).mockResolvedValue('nopii3@test.com');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await app.inject({
      method: 'POST',
      url: '/api/academy/ask',
      headers: { 'x-forwarded-for': '10.0.0.2', 'content-type': 'application/json' },
      body: JSON.stringify({ user: MAGIC_PROMPT }),
    });

    const allLogged = consoleSpy.mock.calls.map(args => String(args[0])).join('\n');
    expect(allLogged).not.toContain(MAGIC_PROMPT);

    consoleSpy.mockRestore();
    await app.close();
  });
});
