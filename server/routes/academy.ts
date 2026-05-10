import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../clerk.js';
import { hashIp, enforceCallLimits, isAdminEmail } from './tools/_shared.js';
import { AskRequestSchema } from '../../shared/academy-models.js';
import { quotaUsed, recordCall, nextResetAt, PER_DAY_LIMIT } from '../services/academy-quota.js';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';

// In-memory sliding window for per-IP spike protection (resets on server restart)
const _ipHits = new Map<string, number[]>();
const IP_LIMIT_PER_MIN = 10;

export function checkIpMinuteLimit(ipHash: string): boolean {
  const now = Date.now();
  let hits = _ipHits.get(ipHash) ?? [];
  hits = hits.filter(t => now - t < 60_000);
  if (hits.length >= IP_LIMIT_PER_MIN) {
    _ipHits.set(ipHash, hits);
    return false;
  }
  hits.push(now);
  _ipHits.set(ipHash, hits);
  return true;
}

export function resetIpMinuteLimit(ipHash: string): void {
  _ipHits.delete(ipHash);
}

function logInfo(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: 'info', event, ...fields }));
}

export function registerAcademyRoutes(app: FastifyInstance): void {
  if (!process.env.ANTHROPIC_API_KEY_ACADEMY) {
    console.warn('[Academy] ANTHROPIC_API_KEY_ACADEMY not set — /api/academy/ask will return 503.');
  }

  app.post('/api/academy/ask', async (req: FastifyRequest, reply: FastifyReply) => {
    // 1. Require signed-in user — anonymous cannot use Bilko's quota
    const email = await requireAuth(req, reply);
    if (!email) return;

    const ipHash = hashIp(req.ip);

    // 2. Per-IP abuse rate limit (10/min, in-memory sliding window)
    if (!checkIpMinuteLimit(ipHash)) {
      await recordCall(email, 'rate_limited');
      return reply.code(429).send({ error: 'rate_limited' });
    }

    // 3. Validate request body
    const parsed = AskRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    const { user, system, model, lessonSlug } = parsed.data;

    // 4. Per-user daily quota (5 successful calls per rolling 24h)
    const used = await quotaUsed(email);
    if (used >= PER_DAY_LIMIT) {
      const reset = await nextResetAt(email);
      await recordCall(email, 'denied');
      return reply.code(429).send({
        error: 'daily_quota_exceeded',
        resetAt: reset?.toISOString() ?? null,
        suggestion: 'BYOK',
      });
    }

    // 5. Per-app daily ceiling (platform-wide guard against cost spikes)
    const ceiling = await enforceCallLimits({
      userEmail: email,
      ipHash,
      isAdmin: isAdminEmail(email),
      appSlug: 'academy',
    });
    if (!ceiling.ok) {
      await recordCall(email, 'error');
      return reply.code(503).send({ error: 'platform_ceiling_exceeded' });
    }

    // 6. Fail-closed if key not configured
    const key = process.env.ANTHROPIC_API_KEY_ACADEMY;
    if (!key) {
      await recordCall(email, 'error');
      logInfo('academy.ask.not_configured', { lessonSlug: lessonSlug ?? null });
      return reply.code(503).send({ error: 'not_configured' });
    }

    // 7. Call Anthropic — never log prompt/response content
    let tokenIn = 0;
    let tokenOut = 0;
    try {
      const res = await fetch(ANTHROPIC_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          ...(system ? { system } : {}),
          messages: [{ role: 'user', content: user }],
        }),
      });

      if (!res.ok) {
        await recordCall(email, 'error');
        logInfo('academy.ask.upstream_error', { status: res.status, lessonSlug: lessonSlug ?? null });
        return reply.code(502).send({ error: 'upstream_error', upstream: res.status });
      }

      const data = await res.json() as {
        content?: Array<{ text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const text = data.content?.[0]?.text ?? '';
      tokenIn = data.usage?.input_tokens ?? 0;
      tokenOut = data.usage?.output_tokens ?? 0;

      await recordCall(email, 'ok', tokenIn, tokenOut);
      logInfo('academy.ask.ok', { lessonSlug: lessonSlug ?? null, model, tokenIn, tokenOut });

      return reply.send({ text, tokenIn, tokenOut, provider: 'anthropic' });
    } catch {
      await recordCall(email, 'error');
      logInfo('academy.ask.exception', { lessonSlug: lessonSlug ?? null });
      return reply.code(502).send({ error: 'upstream_unreachable' });
    }
  });
}
