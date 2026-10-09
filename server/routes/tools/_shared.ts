import type { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import { dbGet, dbRun } from '../../db.js';
import { askGemini } from '../../gemini.js';
import { getActiveSubscriptionLive, hasPurchased } from '../../services/stripe.js';
import { verifyClerkToken, requireAuth, ADMIN_EMAILS } from '../../clerk.js';
import { getTokenBalance, grantFreeTokens, hasTokenAccount } from '../../services/tokens.js';
import { parseJsonResponse } from '../../utils.js';

// ── Tier limits ──────────────────────────────────────
export const FREE_TIER_LIMIT = 3;
export const PAID_TIER_LIMIT = 1_000_000; // serialises cleanly to JSON unlike Infinity
export const HEADLINE_GRADER_ENDPOINT = 'headline-grader';
export const UPGRADE_URL = 'https://bilko.run/pricing';

export const TIER_LIMITS: Record<string, number> = {
  free: FREE_TIER_LIMIT,
  pro: PAID_TIER_LIMIT,
  business: PAID_TIER_LIMIT,
  team: PAID_TIER_LIMIT,
};

/** `_legacyContext` is ignored; kept optional only so tool routes that still pass a label keep compiling until the wire PRDs adopt `freeTierGate`. */
export function freeGateMsg(_legacyContext?: string): string {
  return `Free limit reached (${FREE_TIER_LIMIT} per session). Upgrade to Pro for unlimited: ${UPGRADE_URL}`;
}
export function paidGateMsg(limit: number): string {
  return `Rate limit reached (${limit}/day). Upgrade for more at bilko.run/pricing. Resets at midnight UTC.`;
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getUsageCount(ipHash: string, endpoint: string): Promise<number> {
  const row = await dbGet<{ count: number }>(
    'SELECT count FROM usage_tracking WHERE ip_hash = ? AND endpoint = ? AND date = ?',
    ipHash, endpoint, todayUTC(),
  );
  return row?.count ?? 0;
}

export async function incrementUsage(ipHash: string, endpoint: string): Promise<number> {
  const row = await dbGet<{ count: number }>(
    `INSERT INTO usage_tracking (ip_hash, endpoint, date, count) VALUES (?, ?, ?, 1) ON CONFLICT(ip_hash, endpoint, date) DO UPDATE SET count = count + 1 RETURNING count`,
    ipHash, endpoint, todayUTC(),
  );
  return row?.count ?? 1;
}

export async function resetUsage(ipHash: string, endpoint: string): Promise<void> {
  await dbRun(
    'INSERT INTO usage_tracking (ip_hash, endpoint, date, count) VALUES (?, ?, ?, 0) ON CONFLICT(ip_hash, endpoint, date) DO UPDATE SET count = 0',
    ipHash, endpoint, todayUTC(),
  );
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  isPro: boolean;
}

export function recordFunnelEvent(event: string, ipHash: string, tool?: string, email?: string): void {
  dbRun('INSERT INTO funnel_events (event, ip_hash, tool, email) VALUES (?, ?, ?, ?)', event, ipHash, tool ?? null, email ?? null).catch(() => {});
}

export async function checkRateLimit(ipHash: string, endpoint: string, email?: string, productKey?: string): Promise<RateLimitResult> {
  if (email) {
    if (productKey && await hasPurchased(email, productKey)) {
      const count = await getUsageCount(ipHash, endpoint);
      const limit = PAID_TIER_LIMIT;
      if (count >= limit) return { allowed: false, remaining: 0, limit, isPro: true };
      return { allowed: true, remaining: limit - count, limit, isPro: true };
    }
    const sub = await getActiveSubscriptionLive(email);
    if (sub.isPro) {
      const limit = TIER_LIMITS[sub.tier] || PAID_TIER_LIMIT;
      const count = await getUsageCount(ipHash, endpoint);
      if (count >= limit) return { allowed: false, remaining: 0, limit, isPro: true };
      return { allowed: true, remaining: limit - count, limit, isPro: true };
    }
  }
  const count = await getUsageCount(ipHash, endpoint);
  if (count >= FREE_TIER_LIMIT) {
    recordFunnelEvent('free_limit_hit', ipHash, endpoint, email);
    return { allowed: false, remaining: 0, limit: FREE_TIER_LIMIT, isPro: false };
  }
  return { allowed: true, remaining: FREE_TIER_LIMIT - count, limit: FREE_TIER_LIMIT, isPro: false };
}

export const parseResult = parseJsonResponse;

/**
 * Resolves the entitlement email strictly from the verified Clerk token.
 * Never reads req.body — callers must not let the client self-report entitlement.
 */
export async function entitlementEmail(req: FastifyRequest): Promise<string | undefined> {
  const email = await verifyClerkToken(req.headers.authorization);
  return email ? email.toLowerCase() : undefined;
}

export async function checkRateLimitForRequest(
  req: FastifyRequest,
  ipHash: string,
  endpoint: string,
  productKey?: string,
): Promise<RateLimitResult> {
  const email = await entitlementEmail(req);
  return checkRateLimit(ipHash, endpoint, email, productKey);
}

// ── Platform-wide cost controls ──────────────────────────
export const USER_DAILY_DEFAULT = 100;
export const USER_DAILY_ADMIN   = 1000;

export interface CostCtx {
  userEmail: string | null;
  ipHash: string;
  isAdmin: boolean;
  appSlug: string;
}

const CEILING_TTL_MS = 60_000;
let ceilingTtlMs = process.env.VITEST ? 0 : CEILING_TTL_MS;
const ceilingCache = new Map<string, { value: number | null; expires: number }>();

/** Drops memoized spend-ceiling rows (call after editing app_spend_ceilings). */
export function clearCeilingCache(): void {
  ceilingCache.clear();
}

/** Test hook: override the ceiling memo TTL (0 disables it). Defaults to 60 s, and 0 under vitest. */
export function setCeilingCacheTtl(ms: number): void {
  ceilingTtlMs = ms;
  ceilingCache.clear();
}

async function getCeiling(appSlug: string): Promise<number | null> {
  const hit = ceilingCache.get(appSlug);
  if (hit && hit.expires > Date.now()) return hit.value;
  const row = await dbGet<{ max_calls_per_day: number }>(
    `SELECT max_calls_per_day FROM app_spend_ceilings WHERE app_slug = ?`, appSlug,
  );
  const value = row?.max_calls_per_day ?? null;
  if (ceilingTtlMs > 0) ceilingCache.set(appSlug, { value, expires: Date.now() + ceilingTtlMs });
  return value;
}

/** Counts `calls` (default 1) Gemini calls against the user cap and the app's daily ceiling. */
export async function enforceCallLimits(
  ctx: CostCtx,
  calls = 1,
): Promise<{ ok: true } | { ok: false; status: number; reason: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const userKey = ctx.userEmail ?? `anon:${ctx.ipHash}`;
  const userCap = ctx.isAdmin ? USER_DAILY_ADMIN : USER_DAILY_DEFAULT;

  const userRow = await dbGet<{ calls: number }>(
    `INSERT INTO usage_daily (user_email, app_slug, date, calls) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_email, app_slug, date) DO UPDATE SET calls = calls + excluded.calls RETURNING calls`,
    userKey, ctx.appSlug, today, calls,
  );
  const userCalls = userRow?.calls ?? calls;

  if (userCalls > userCap) {
    await dbRun(
      `INSERT INTO cost_alerts (alert_kind, app_slug, user_email, details_json, created_at)
       VALUES ('user_cap', ?, ?, ?, ?)`,
      ctx.appSlug, userKey, JSON.stringify({ calls: userCalls, cap: userCap, date: today }), Math.floor(Date.now() / 1000),
    );
    return { ok: false, status: 429, reason: `Daily limit reached (${userCap} calls/day). Resets at midnight UTC.` };
  }

  const ceiling = await getCeiling(ctx.appSlug);
  if (ceiling !== null) {
    const total = await dbGet<{ total: number }>(
      `SELECT SUM(calls) AS total FROM usage_daily WHERE app_slug = ? AND date = ?`,
      ctx.appSlug, today,
    );
    if ((total?.total ?? 0) > ceiling) {
      await dbRun(
        `INSERT INTO cost_alerts (alert_kind, app_slug, details_json, created_at)
         VALUES ('app_ceiling', ?, ?, ?)`,
        ctx.appSlug, JSON.stringify({ total: total?.total, ceiling, date: today }), Math.floor(Date.now() / 1000),
      );
      return { ok: false, status: 503, reason: `Tool temporarily unavailable — daily call ceiling reached. Try again tomorrow.` };
    }
  }

  return { ok: true };
}

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// ── Shared gateway helpers ───────────────────────────────

/**
 * Free-tier gate: hashIp → verified entitlement email → rate limit (429) → cost limits.
 * Replies itself and returns null when the request is blocked.
 * `calls` is how many Gemini calls the request will make (compare routes make 3).
 */
export async function freeTierGate(
  req: FastifyRequest,
  reply: FastifyReply,
  opts: { endpoint: string; calls?: number },
): Promise<{ ipHash: string; email?: string; rate: RateLimitResult } | null> {
  const ipHash = hashIp(req.ip);
  const email = await entitlementEmail(req);
  const rate = await checkRateLimit(ipHash, opts.endpoint, email);
  if (!rate.allowed) {
    reply.status(429).send({
      gated: true,
      isPro: rate.isPro,
      remaining: 0,
      limit: rate.limit,
      message: rate.isPro ? paidGateMsg(rate.limit) : freeGateMsg(),
    });
    return null;
  }
  const costLimit = await enforceCallLimits(
    { userEmail: email ?? null, ipHash, isAdmin: email ? isAdminEmail(email) : false, appSlug: opts.endpoint },
    opts.calls ?? 1,
  );
  if (!costLimit.ok) {
    reply.status(costLimit.status).send({ error: costLimit.reason });
    return null;
  }
  return { ipHash, email, rate };
}

/**
 * Credit gate: signed in → cost limits → token account → subscription → balance (402).
 * Replies itself and returns null when the request is blocked.
 */
export async function creditGate(
  req: FastifyRequest,
  reply: FastifyReply,
  opts: { endpoint: string; cost: number; calls?: number },
): Promise<{ email: string; ipHash: string; isPro: boolean } | null> {
  const email = await requireAuth(req, reply);
  if (!email) return null;
  const ipHash = hashIp(req.ip);

  const costLimit = await enforceCallLimits(
    { userEmail: email, ipHash, isAdmin: isAdminEmail(email), appSlug: opts.endpoint },
    opts.calls ?? 1,
  );
  if (!costLimit.ok) {
    reply.status(costLimit.status).send({ error: costLimit.reason });
    return null;
  }

  if (!(await hasTokenAccount(email))) await grantFreeTokens(email);
  const sub = await getActiveSubscriptionLive(email);
  if (!sub.isPro) {
    const balance = await getTokenBalance(email);
    if (balance < opts.cost) {
      reply.status(402).send({ error: 'No credits remaining.', requiresTokens: true, balance });
      return null;
    }
  }
  return { email, ipHash, isPro: sub.isPro };
}

/** Calls Gemini and parses the reply as JSON, falling back to the first {...} block in the text. */
export async function askGeminiJson<T = any>(
  prompt: string,
  opts?: { systemPrompt?: string },
): Promise<T> {
  const raw = await askGemini(prompt, opts);
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Could not parse scoring response.');
    return parseResult(match[0]) as T;
  }
}

/** Logs the real error server-side and replies a generic 500 — never leaks err.message. */
export function toolErrorReply(reply: FastifyReply, err: unknown, label: string): { error: string } {
  console.error(label, err);
  reply.status(500);
  return { error: `${label} failed. Please try again.` };
}

// Shared "generate" inverse-mode helper used by Headline/Ad/Thread generators.
export async function handleGenerateEndpoint(
  req: FastifyRequest,
  reply: FastifyReply,
  opts: {
    endpoint: string;
    inputField: string;
    inputText: string;
    systemPrompt: string;
    userPrompt: string;
    logTag: string;
    maxInputLen?: number;
  },
) {
  const input = opts.inputText;
  if (!input || input.length < 10) {
    reply.status(400);
    return { error: `Describe your ${opts.inputField} in at least 10 characters.` };
  }
  if (input.length > (opts.maxInputLen ?? 2000)) {
    reply.status(400);
    return { error: `Input must be under ${opts.maxInputLen ?? 2000} characters.` };
  }

  const email = await entitlementEmail(req);
  if (!email) {
    reply.status(401);
    return { error: 'Sign in required.', requiresEmail: true };
  }

  const ipHash = hashIp(req.ip);
  const rate = await checkRateLimit(ipHash, opts.endpoint, email);
  if (!rate.allowed) {
    reply.status(429);
    return {
      gated: true,
      remaining: 0,
      limit: rate.limit,
      isPro: rate.isPro,
      message: rate.isPro ? paidGateMsg(rate.limit) : freeGateMsg(),
    };
  }

  const costLimit = await enforceCallLimits({ userEmail: email, ipHash, isAdmin: isAdminEmail(email), appSlug: opts.endpoint });
  if (!costLimit.ok) {
    reply.status(costLimit.status);
    return { error: costLimit.reason };
  }

  try {
    const raw = await askGemini(opts.userPrompt, { systemPrompt: opts.systemPrompt });
    const parsed = parseResult(raw);
    await incrementUsage(ipHash, opts.endpoint);
    return { ...parsed, usage: { remaining: Math.max(0, rate.limit - 1), limit: rate.limit, isPro: rate.isPro } };
  } catch (err: any) {
    console.error(opts.logTag, err);
    reply.status(500);
    return { error: `Generation failed: ${err.message}` };
  }
}
