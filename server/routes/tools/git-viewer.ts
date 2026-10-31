import type { FastifyInstance } from 'fastify';
import { dbAll, dbGet, dbRun } from '../../db.js';
import { verifyClerkGitHubUser } from '../../clerk.js';
import { getActiveSubscriptionLive } from '../../services/stripe.js';
import { getUsageCount, hashIp, incrementUsage } from './_shared.js';
import type { OgMeta } from '../../og-meta.js';

// Hosted Git Viewer portfolios — gateway for the git-viewer sibling
// (~/Projects/git-viewer). Contract: git-viewer docs/prds/10-hosted-portfolios.md.
//
//   GET  /api/git-viewer/u/:login   public → 200 ready | 202 generating | 404 not_found | 429 rate_limited
//   POST /api/git-viewer/claim      Clerk  → owner (GitHub login linked in Clerk) picks up to 12 repos
//
// Portfolios are generated in-process by the git-viewer library's
// buildPortfolio() with the server's GITHUB_TOKEN, at most 2 at a time, and
// cached in git_viewer_profiles. Free: 1 project, regenerated at most once per
// 24h when viewed; claimed free profiles are also refreshed weekly unviewed.
// Paid ($5/yr git_viewer subscription, or a legacy pro/business/team plan): up
// to 12 chosen repos + Writing, refreshed daily. Showcase logins build at the
// paid tier when GITHUB_TOKEN is set (free otherwise) and are kept cached by
// the refresh loop regardless of claim.
//
// Commit history is read newest first, 100 to a page, up to COMMIT_PAGE_LIMITS
// per repo. Free stops at 500 commits so an anonymous build has a fixed GitHub
// cost. Every commit stat comes from what was read, so a paid build's limit has
// to clear a busy repo's whole year or its 30-day numbers come out low too.
//
// New-build budget (only an uncached login costs GitHub calls):
//   - NEW_BUILDS_PER_IP distinct new builds per IP per UTC day, its own counter
//     (not the paid tools' FREE_TIER_LIMIT), so a visitor can try a few logins
//     and still reach their own.
//   - Exempt: showcase logins, claimed profiles, a signed-in user building a
//     GitHub login linked to their Clerk account, and paid subscribers.
//   - Global guard: after a GitHub rate-limit failure, every new build answers
//     503 until the budget resets (no point queueing jobs that will fail).

export const GIT_VIEWER_ENDPOINT = 'git-viewer';
export const LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const REPO_NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;
export const PLAN_LIMITS = { free: 1, paid: 12 } as const;
export const COMMIT_PAGE_LIMITS = { free: 5, paid: 200 } as const;

const STALE_SEC = 24 * 60 * 60;
const MAX_CONCURRENT = 2;
const MAX_QUEUED = 50;
const POLL_AFTER_SEC = 5;
const NOT_FOUND_TTL_MS = 60 * 60 * 1000;
const FAILED_TTL_MS = 5 * 60 * 1000;
const MAX_RATE_LIMITED_TTL_MS = 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const REFRESH_BATCH = 20;
export const NEW_BUILDS_PER_IP = 10;
export const CLAIMED_FREE_REFRESH_SEC = 7 * 24 * 60 * 60;
/** Always kept cached and refreshed daily, never subject to a visitor's quota. Lowercase. */
export const SHOWCASE_LOGINS: readonly string[] = ['stanislavbg'];

type Tier = 'free' | 'paid';

export type BuildPortfolio = (opts: {
  user: string;
  token?: string;
  maxProjects: number;
  maxCommitPagesPerRepo: number;
  allowlist?: string[];
  writing: 'none' | 'profile-repo';
}) => Promise<{ data: unknown; lockedCount: number }>;

interface ProfileRow {
  login: string;
  payload: string;
  tier: Tier;
  locked_count: number;
  owner_email: string | null;
  allowlist: string | null;
  updated_at: number;
}

interface Job { tier: Tier; allowlist?: string[] }

// ── Portfolio builder (the git-viewer library) ──────────────────────────────
// Loaded lazily so the host boots, and tests run, without the package; tests
// inject a fake via setPortfolioBuilder. The specifier is a variable so the
// server typechecks before @bilkobibitkov/git-viewer is installed.
const LIB = '@bilkobibitkov/git-viewer';
let builder: BuildPortfolio | null | undefined;

export function setPortfolioBuilder(fn: BuildPortfolio | null | undefined): void {
  builder = fn;
}

async function loadBuilder(): Promise<BuildPortfolio | null> {
  if (builder !== undefined) return builder;
  try {
    const mod = await import(LIB) as { buildPortfolio?: BuildPortfolio };
    builder = mod.buildPortfolio ?? null;
  } catch (err: any) {
    console.error(`[git-viewer] ${LIB} not loadable — hosted portfolios disabled:`, err?.message);
    builder = null;
  }
  return builder;
}

// ── In-process generation queue ─────────────────────────────────────────────
const jobs = new Map<string, Job>();   // queued or running, keyed by login
const pending: string[] = [];
let running = 0;
const notFound = new Map<string, number>(); // login → expiry (ms)
const failed = new Map<string, number>();
let githubBudgetUntil = 0; // ms; set when GitHub rate-limits a generation
let lastBudgetCheck: GitHubBudgetCheck | null = null;

interface GitHubBudgetCheck {
  http: number | null;
  limit: number | null;
  remaining: number | null;
  checkedAt: string;
}

function budgetBlocked(): boolean {
  return githubBudgetUntil > Date.now();
}

/** Test hook: wait for the queue to drain. */
export async function drainGitViewerQueue(): Promise<void> {
  while (jobs.size > 0) await new Promise(r => setTimeout(r, 5));
}

/** Test hook: forget queue and negative-cache state. */
export function resetGitViewerState(): void {
  jobs.clear();
  pending.length = 0;
  running = 0;
  notFound.clear();
  failed.clear();
  githubBudgetUntil = 0;
  lastBudgetCheck = null;
}

function isFresh(map: Map<string, number>, login: string): boolean {
  const exp = map.get(login);
  if (exp === undefined) return false;
  if (exp > Date.now()) return true;
  map.delete(login);
  return false;
}

/** Queues a generation. A login already queued keeps one job (latest spec wins). */
function enqueue(login: string, job: Job): boolean {
  if (jobs.has(login)) {
    jobs.set(login, job);
    return true;
  }
  if (pending.length >= MAX_QUEUED) return false;
  jobs.set(login, job);
  pending.push(login);
  pump();
  return true;
}

function pump(): void {
  while (running < MAX_CONCURRENT && pending.length > 0) {
    const login = pending.shift()!;
    const job = jobs.get(login)!;
    running++;
    void generate(login, job).finally(() => {
      running--;
      // A claim/upgrade that landed mid-run replaced the spec: run it again.
      if (jobs.get(login) === job) jobs.delete(login);
      else pending.push(login);
      pump();
    });
  }
}

/** True for an Octokit RequestError caused by GitHub's rate limit (not a plain 403). */
export function isGitHubRateLimited(err: any): boolean {
  if (err?.status !== 403 && err?.status !== 429) return false;
  const headers = err?.response?.headers ?? {};
  const retryAfter = Number(headers['retry-after']);
  return (Number.isFinite(retryAfter) && retryAfter > 0) || String(headers['x-ratelimit-remaining']) === '0';
}

/**
 * How long to remember a failed generation. A GitHub rate-limit error (Octokit
 * RequestError: 403/429 with x-ratelimit-remaining 0 or retry-after) waits until
 * the budget resets, capped at an hour; anything else retries after 5 minutes.
 */
export function failedTtlMs(err: any, now = Date.now()): number {
  const status = err?.status;
  const headers = err?.response?.headers ?? {};
  if (status !== 403 && status !== 429) return FAILED_TTL_MS;
  const retryAfter = Number(headers['retry-after']);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, MAX_RATE_LIMITED_TTL_MS);
  }
  if (String(headers['x-ratelimit-remaining']) !== '0') return FAILED_TTL_MS;
  const resetMs = Number(headers['x-ratelimit-reset']) * 1000 - now;
  if (!Number.isFinite(resetMs)) return FAILED_TTL_MS;
  return Math.min(Math.max(resetMs, 60_000), MAX_RATE_LIMITED_TTL_MS);
}

async function generate(login: string, job: Job): Promise<void> {
  const build = await loadBuilder();
  if (!build) return;
  const paid = job.tier === 'paid';
  try {
    const { data, lockedCount } = await build({
      user: login,
      token: process.env.GITHUB_TOKEN || undefined,
      maxProjects: paid ? PLAN_LIMITS.paid : PLAN_LIMITS.free,
      maxCommitPagesPerRepo: paid ? COMMIT_PAGE_LIMITS.paid : COMMIT_PAGE_LIMITS.free,
      allowlist: paid && job.allowlist?.length ? job.allowlist : undefined,
      writing: paid ? 'profile-repo' : 'none',
    });
    await dbRun(
      `INSERT INTO git_viewer_profiles (login, payload, tier, locked_count, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(login) DO UPDATE SET payload = excluded.payload, tier = excluded.tier,
         locked_count = excluded.locked_count, updated_at = excluded.updated_at`,
      login, JSON.stringify(data), job.tier, lockedCount, Math.floor(Date.now() / 1000),
    );
    failed.delete(login);
  } catch (err: any) {
    if (err?.status === 404) {
      notFound.set(login, Date.now() + NOT_FOUND_TTL_MS);
    } else {
      const headers = err?.response?.headers ?? {};
      const ttl = failedTtlMs(err);
      console.error(
        `[git-viewer] generation failed for ${login}: status=${err?.status ?? 'n/a'}` +
        ` ratelimit-remaining=${headers['x-ratelimit-remaining'] ?? 'n/a'}` +
        ` ratelimit-limit=${headers['x-ratelimit-limit'] ?? 'n/a'}` +
        ` token=${process.env.GITHUB_TOKEN ? 'set' : 'unset'} retry-in=${Math.ceil(ttl / 1000)}s:`,
        err?.message ?? err,
      );
      failed.set(login, Date.now() + ttl);
      if (isGitHubRateLimited(err)) githubBudgetUntil = Math.max(githubBudgetUntil, Date.now() + ttl);
    }
  }
}

const numOrNull = (v: string | null): number | null => (v === null || v === '' ? null : Number(v));

/**
 * Checks the core GitHub budget (5000/h with a working GITHUB_TOKEN, 60 per
 * egress IP without) and records it for /api/health. /rate_limit itself costs
 * nothing. With `log`, prints the result and WARNs when production builds will
 * run unauthenticated or the token is rejected.
 */
export async function checkGitHubRateBudget(log = false): Promise<GitHubBudgetCheck | null> {
  const token = process.env.GITHUB_TOKEN;
  try {
    const res = await fetch('https://api.github.com/rate_limit', {
      headers: { 'user-agent': 'bilko-run', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(10_000),
    });
    lastBudgetCheck = {
      http: res.status,
      limit: numOrNull(res.headers.get('x-ratelimit-limit')),
      remaining: numOrNull(res.headers.get('x-ratelimit-remaining')),
      checkedAt: new Date().toISOString(),
    };
    if (log) {
      console.log(
        `[git-viewer] GitHub rate budget: http=${res.status} token=${token ? 'set' : 'unset'}` +
        ` limit=${lastBudgetCheck.limit} remaining=${lastBudgetCheck.remaining}`,
      );
    }
  } catch (err: any) {
    lastBudgetCheck = { http: null, limit: null, remaining: null, checkedAt: new Date().toISOString() };
    if (log) console.error('[git-viewer] GitHub rate budget check failed:', err?.message ?? err);
  }
  if (log && process.env.NODE_ENV === 'production') {
    if (!token) {
      console.warn('[git-viewer] WARN GITHUB_TOKEN is unset: hosted builds share 60 GitHub calls/h and new logins will 503. Set it in Render.');
    } else if (lastBudgetCheck.http === 401) {
      console.warn('[git-viewer] WARN GITHUB_TOKEN was rejected by GitHub (401): hosted builds will fail. Rotate it in Render.');
    }
  }
  return lastBudgetCheck;
}

/** Public, secret-free build-health snapshot for /api/health. */
export function getGitViewerHealth() {
  const tokenSet = Boolean(process.env.GITHUB_TOKEN);
  const blocked = budgetBlocked();
  return {
    githubToken: tokenSet ? 'set' : 'unset',
    githubBudget: lastBudgetCheck,
    newBuildsBlockedUntil: blocked ? new Date(githubBudgetUntil).toISOString() : null,
    failedLogins: [...failed.values()].filter(exp => exp > Date.now()).length,
    queued: jobs.size,
    ok: tokenSet && lastBudgetCheck?.http === 200 && !blocked,
  };
}

// ── Entitlement ─────────────────────────────────────────────────────────────
async function tierFor(login: string, row: Pick<ProfileRow, 'owner_email'> | undefined): Promise<Tier> {
  // A paid build needs ~70+ GitHub calls; unauthenticated (60/h per IP) it can
  // never finish and starves every other build, so showcase goes paid only with a token.
  if (SHOWCASE_LOGINS.includes(login)) return process.env.GITHUB_TOKEN ? 'paid' : 'free';
  if (!row?.owner_email) return 'free';
  const sub = await getActiveSubscriptionLive(row.owner_email);
  return sub.gitViewer || sub.isPro ? 'paid' : 'free';
}

function jobFor(row: Pick<ProfileRow, 'allowlist'> | undefined, tier: Tier): Job {
  return { tier, allowlist: row?.allowlist ? JSON.parse(row.allowlist) as string[] : undefined };
}

function secondsToUtcMidnight(): number {
  const now = new Date();
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((midnight - now.getTime()) / 1000));
}

/**
 * Hourly sweep. Showcase logins: generated if missing, regenerated after 24h.
 * Claimed paid profiles: regenerated after 24h (lapsed ones drop to free).
 * Claimed free profiles: regenerated after 7 days. A free profile that turned
 * paid is picked up sooner by claim or by its next view.
 */
export async function runGitViewerRefresh(): Promise<number> {
  // Every refresh would fail until GitHub's budget resets; the next sweep picks them up.
  if (budgetBlocked()) return 0;
  const now = Math.floor(Date.now() / 1000);
  const dailyCutoff = now - STALE_SEC;
  let queued = 0;

  for (const login of SHOWCASE_LOGINS) {
    const row = await dbGet<ProfileRow>(
      'SELECT login, payload, tier, owner_email, allowlist, updated_at FROM git_viewer_profiles WHERE login = ?', login,
    );
    if (row?.payload && row.updated_at >= dailyCutoff) continue;
    if (jobs.has(login) || isFresh(failed, login) || isFresh(notFound, login)) continue;
    if (enqueue(login, jobFor(row, await tierFor(login, row)))) queued++;
  }

  const rows = await dbAll<ProfileRow>(
    `SELECT login, tier, owner_email, allowlist FROM git_viewer_profiles
     WHERE owner_email IS NOT NULL AND updated_at < CASE tier WHEN 'paid' THEN ? ELSE ? END
     ORDER BY updated_at ASC LIMIT ?`,
    dailyCutoff, now - CLAIMED_FREE_REFRESH_SEC, REFRESH_BATCH,
  );
  for (const row of rows) {
    if (jobs.has(row.login) || isFresh(failed, row.login)) continue;
    if (enqueue(row.login, jobFor(row, await tierFor(row.login, row)))) queued++;
  }
  return queued;
}

/** Whether a new build of `login` skips the per-IP budget (see header comment). */
async function exemptFromIpLimit(login: string, row: ProfileRow | undefined, authHeader: string | undefined): Promise<boolean> {
  if (SHOWCASE_LOGINS.includes(login) || row?.owner_email) return true;
  if (!authHeader) return false;
  const user = await verifyClerkGitHubUser(authHeader);
  if (!user) return false;
  if (user.githubLogins.includes(login)) return true;
  const sub = await getActiveSubscriptionLive(user.email);
  return sub.gitViewer || sub.isPro;
}

const OG_PATH_RE = /^\/projects\/git-viewer\/(?:index\.html)?$/;
const AVATAR_RE = /^https:\/\/avatars\.githubusercontent\.com\/[^\s"'<>]+$/;
const OG_PITCH = 'Your Git, your Résumé';

/**
 * Per-user share card for `/projects/git-viewer/?u=<login>`. Reads the cached
 * portfolio only (never queues a generation); an uncached login gets its own
 * name with the static card image, an invalid one falls through to static meta.
 */
export async function gitViewerOg(path: string, query: URLSearchParams): Promise<OgMeta | null> {
  if (!OG_PATH_RE.test(path)) return null;
  const raw = query.get('u') ?? '';
  if (!LOGIN_RE.test(raw)) return null;
  const login = raw.toLowerCase();
  const row = await dbGet<Pick<ProfileRow, 'payload'>>('SELECT payload FROM git_viewer_profiles WHERE login = ?', login);
  let name = raw;
  let avatar: string | undefined;
  try {
    const dev = row?.payload ? (JSON.parse(row.payload) as { developer?: { name?: unknown; avatarUrl?: unknown } }).developer : undefined;
    if (typeof dev?.name === 'string' && dev.name.trim()) name = dev.name.trim().slice(0, 80);
    if (typeof dev?.avatarUrl === 'string' && AVATAR_RE.test(dev.avatarUrl)) avatar = dev.avatarUrl;
  } catch { /* corrupt payload → login-only card */ }
  return {
    title: `${name} — ${OG_PITCH}`,
    description: `${name}'s GitHub as a portfolio and printable résumé. Make yours free in seconds on bilko.run.`,
    url: `https://bilko.run/projects/git-viewer/?u=${encodeURIComponent(raw)}`,
    image: avatar ?? 'https://bilko.run/og/git-viewer.png',
    ...(avatar ? { card: 'summary' as const } : {}),
  };
}

export function registerGitViewerRoutes(app: FastifyInstance): void {
  app.get('/api/git-viewer/u/:login', async (req, reply) => {
    const raw = (req.params as { login: string }).login;
    if (!LOGIN_RE.test(raw)) return reply.code(404).send({ status: 'not_found' });
    const login = raw.toLowerCase();
    reply.header('cache-control', 'no-store');

    const row = await dbGet<ProfileRow>('SELECT * FROM git_viewer_profiles WHERE login = ?', login);

    if (row?.payload) {
      const stale = row.updated_at < Math.floor(Date.now() / 1000) - STALE_SEC;
      // Claimed free profiles can turn paid between daily refreshes (checkout just
      // completed); the subscription lookup is cached for 5 minutes. Unclaimed
      // free rows resolve without a lookup (free, or paid for a showcase login).
      const tier = row.tier === 'free' ? await tierFor(login, row) : row.tier;
      // While GitHub's budget is spent a regeneration would just fail, so keep serving the cached copy.
      if ((stale || tier !== row.tier) && !budgetBlocked() && !jobs.has(login) && !isFresh(failed, login)) {
        enqueue(login, jobFor(row, tier));
      }
      reply.header('cache-control', 'public, max-age=300');
      reply.header('content-type', 'application/json; charset=utf-8');
      // payload is stored JSON — splice it in verbatim rather than re-parsing it.
      return reply.send(
        `{"status":"ready","login":${JSON.stringify(login)},"tier":${JSON.stringify(row.tier)},` +
        `"lockedCount":${Number(row.locked_count)},"updatedAt":${JSON.stringify(new Date(row.updated_at * 1000).toISOString())},` +
        `"data":${row.payload}}`,
      );
    }

    if (isFresh(notFound, login)) return reply.code(404).send({ status: 'not_found' });
    if (jobs.has(login)) return reply.code(202).send({ status: 'generating', retryAfterSec: POLL_AFTER_SEC });
    if (isFresh(failed, login)) {
      const retryAfterSec = Math.max(1, Math.ceil((failed.get(login)! - Date.now()) / 1000));
      return reply.code(503).send({ status: 'error', retryAfterSec });
    }
    if (!(await loadBuilder())) return reply.code(503).send({ status: 'unavailable' });

    if (budgetBlocked()) {
      return reply.code(503).send({ status: 'error', retryAfterSec: Math.ceil((githubBudgetUntil - Date.now()) / 1000) });
    }

    // Only a NEW generation costs GitHub calls, so only that counts against the IP.
    const exempt = await exemptFromIpLimit(login, row, req.headers.authorization);
    const ipHash = hashIp(req.ip);
    if (!exempt && await getUsageCount(ipHash, GIT_VIEWER_ENDPOINT) >= NEW_BUILDS_PER_IP) {
      return reply.code(429).send({ status: 'rate_limited', retryAfterSec: secondsToUtcMidnight() });
    }
    if (!enqueue(login, jobFor(row, await tierFor(login, row)))) {
      return reply.code(429).send({ status: 'rate_limited', retryAfterSec: 60 });
    }
    if (!exempt) await incrementUsage(ipHash, GIT_VIEWER_ENDPOINT);
    return reply.code(202).send({ status: 'generating', retryAfterSec: POLL_AFTER_SEC });
  });

  app.post('/api/git-viewer/claim', async (req, reply) => {
    const body = req.body as { login?: unknown; allowlist?: unknown } | null;
    const raw = typeof body?.login === 'string' ? body.login : '';
    if (!LOGIN_RE.test(raw)) return reply.code(400).send({ error: 'Invalid GitHub login.' });
    const login = raw.toLowerCase();

    const allowlist = body?.allowlist ?? [];
    if (
      !Array.isArray(allowlist) || allowlist.length > PLAN_LIMITS.paid ||
      !allowlist.every(n => typeof n === 'string' && REPO_NAME_RE.test(n))
    ) {
      return reply.code(400).send({ error: `allowlist must be up to ${PLAN_LIMITS.paid} repo names.` });
    }

    const user = await verifyClerkGitHubUser(req.headers.authorization);
    if (!user) return reply.code(401).send({ error: 'Sign in required.' });
    if (!user.githubLogins.includes(login)) {
      return reply.code(403).send({ error: 'Your signed-in account is not linked to this GitHub login.' });
    }

    const allowlistJson = allowlist.length ? JSON.stringify(allowlist) : null;
    await dbRun(
      `INSERT INTO git_viewer_profiles (login, payload, tier, locked_count, owner_email, allowlist, updated_at)
       VALUES (?, '', 'free', 0, ?, ?, 0)
       ON CONFLICT(login) DO UPDATE SET owner_email = excluded.owner_email, allowlist = excluded.allowlist`,
      login, user.email, allowlistJson,
    );
    const tier = await tierFor(login, { owner_email: user.email });
    enqueue(login, jobFor({ allowlist: allowlistJson }, tier));
    return reply.send({ ok: true, login, tier, allowlist });
  });

  if (!process.env.VITEST) {
    void checkGitHubRateBudget(true);
    const refresh = () => {
      void checkGitHubRateBudget();
      runGitViewerRefresh().catch(err => console.error('[git-viewer] refresh failed:', err));
    };
    // First sweep shortly after boot so showcase profiles exist without waiting an hour.
    app.addHook('onReady', async () => { setTimeout(refresh, 30_000).unref(); });
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    timer.unref();
    app.addHook('onClose', async () => clearInterval(timer));
  }
}
