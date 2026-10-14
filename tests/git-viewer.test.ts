import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

vi.mock('../server/clerk.js', () => ({
  verifyClerkToken: vi.fn().mockResolvedValue(null),
  verifyClerkGitHubUser: vi.fn().mockResolvedValue(null),
  requireAuth: vi.fn(),
  ADMIN_EMAILS: [],
}));

vi.mock('../server/services/stripe.js', () => ({
  hasPurchased: vi.fn().mockResolvedValue(false),
  getActiveSubscriptionLive: vi.fn().mockResolvedValue({ isPro: false, tier: 'free', gitViewer: false }),
}));

import Fastify from 'fastify';
import { initDb, dbGet, dbRun } from '../server/db.js';
import { verifyClerkGitHubUser } from '../server/clerk.js';
import { getActiveSubscriptionLive } from '../server/services/stripe.js';
import {
  registerGitViewerRoutes, setPortfolioBuilder, drainGitViewerQueue, resetGitViewerState,
  runGitViewerRefresh, failedTtlMs, isGitHubRateLimited, PLAN_LIMITS, NEW_BUILDS_PER_IP, SHOWCASE_LOGINS,
  type BuildPortfolio,
} from '../server/routes/tools/git-viewer.js';

const app = Fastify({ logger: false });
registerGitViewerRoutes(app);

const build = vi.fn<BuildPortfolio>();

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM git_viewer_profiles');
  await dbRun('DELETE FROM usage_tracking');
  resetGitViewerState();
  build.mockReset();
  build.mockImplementation(async opts => ({
    data: { projects: Array.from({ length: opts.maxProjects }, (_, i) => ({ id: `r${i}` })) },
    lockedCount: 7,
  }));
  setPortfolioBuilder(build);
  vi.mocked(verifyClerkGitHubUser).mockReset().mockResolvedValue(null);
  vi.mocked(getActiveSubscriptionLive).mockReset()
    .mockResolvedValue({ isPro: false, tier: 'free', gitViewer: false });
  vi.unstubAllEnvs();
});

const get = (login: string, ip = '10.0.0.1', authorization?: string) =>
  app.inject({
    method: 'GET', url: `/api/git-viewer/u/${encodeURIComponent(login)}`, remoteAddress: ip,
    headers: authorization ? { authorization } : {},
  });

/** Spends this IP's whole new-build budget on distinct uncached logins. */
async function exhaustIp(ip = '10.0.0.1'): Promise<void> {
  build.mockImplementation(() => new Promise(() => {})); // stay queued, never cached
  for (let i = 0; i < NEW_BUILDS_PER_IP; i++) expect((await get(`burn${i}`, ip)).statusCode).toBe(202);
  expect((await get('burn-extra', ip)).statusCode).toBe(429);
  resetGitViewerState();
  build.mockReset().mockResolvedValue({ data: { projects: [] }, lockedCount: 0 });
}

const claim = (body: unknown) =>
  app.inject({
    method: 'POST', url: '/api/git-viewer/claim',
    headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('GET /api/git-viewer/u/:login', () => {
  it.each(['-bad', 'a--b', '<script>', 'bad-', 'x'.repeat(40)])('rejects invalid login %s as not_found without generating', async login => {
    const res = await get(login);
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ status: 'not_found' });
    expect(build).not.toHaveBeenCalled();
  });

  it('202 on a miss, then 200 free from the DB with no further generation', async () => {
    const first = await get('Octocat');
    expect(first.statusCode).toBe(202);
    expect(first.json()).toEqual({ status: 'generating', retryAfterSec: 5 });
    await drainGitViewerQueue();
    expect(build).toHaveBeenCalledWith(expect.objectContaining({
      user: 'octocat', maxProjects: PLAN_LIMITS.free, allowlist: undefined, writing: 'none',
    }));

    const ready = await get('octocat');
    expect(ready.statusCode).toBe(200);
    expect(ready.headers['cache-control']).toBe('public, max-age=300');
    const body = ready.json();
    expect(body).toMatchObject({ status: 'ready', login: 'octocat', tier: 'free', lockedCount: 7 });
    expect(body.data.projects).toHaveLength(1);
    expect(new Date(body.updatedAt).toISOString()).toBe(body.updatedAt);

    await get('octocat');
    await drainGitViewerQueue();
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('nonexistent GitHub user → 404 not_found', async () => {
    build.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));
    expect((await get('ghost-user')).statusCode).toBe(202);
    await drainGitViewerQueue();
    const res = await get('ghost-user');
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ status: 'not_found' });
  });

  it('GitHub rate-limit failure → 503 error until the budget resets', async () => {
    const reset = Math.floor(Date.now() / 1000) + 1800;
    build.mockRejectedValue(Object.assign(new Error('API rate limit exceeded'), {
      status: 403,
      response: { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) } },
    }));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await get('busy-user')).statusCode).toBe(202);
    await drainGitViewerQueue();
    expect(errSpy.mock.calls[0][0]).toContain('status=403 ratelimit-remaining=0');
    errSpy.mockRestore();
    const res = await get('busy-user');
    expect(res.statusCode).toBe(503);
    expect(res.json().status).toBe('error');
    expect(res.json().retryAfterSec).toBeGreaterThan(1700);
    expect(res.json().retryAfterSec).toBeLessThanOrEqual(1800);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('failedTtlMs: rate limits wait for reset/retry-after (capped 1h), other errors 5 min', () => {
    const now = 1_000_000_000_000;
    const rl = (status: number, headers: Record<string, string>) => ({ status, response: { headers } });
    expect(failedTtlMs(new Error('boom'), now)).toBe(5 * 60_000);
    expect(failedTtlMs(rl(500, {}), now)).toBe(5 * 60_000);
    expect(failedTtlMs(rl(403, { 'x-ratelimit-remaining': '12' }), now)).toBe(5 * 60_000);
    expect(failedTtlMs(rl(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(now / 1000 + 600) }), now)).toBe(600_000);
    expect(failedTtlMs(rl(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(now / 1000 + 99999) }), now)).toBe(3_600_000);
    expect(failedTtlMs(rl(403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(now / 1000 - 5) }), now)).toBe(60_000);
    expect(failedTtlMs(rl(429, { 'retry-after': '90' }), now)).toBe(90_000);
  });

  it('isGitHubRateLimited: only rate-limit 403/429s count', () => {
    const rl = (status: number, headers: Record<string, string>) => ({ status, response: { headers } });
    expect(isGitHubRateLimited(new Error('boom'))).toBe(false);
    expect(isGitHubRateLimited(rl(403, { 'x-ratelimit-remaining': '12' }))).toBe(false);
    expect(isGitHubRateLimited(rl(403, { 'x-ratelimit-remaining': '0' }))).toBe(true);
    expect(isGitHubRateLimited(rl(429, { 'retry-after': '30' }))).toBe(true);
  });

  it('a GitHub rate limit blocks every new build (any login, any IP) until it resets', async () => {
    build.mockRejectedValue(Object.assign(new Error('API rate limit exceeded'), {
      status: 403,
      response: { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 900) } },
    }));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await get('first');
    await drainGitViewerQueue();
    errSpy.mockRestore();
    const res = await get('second', '10.9.9.9');
    expect(res.statusCode).toBe(503);
    expect(res.json().retryAfterSec).toBeGreaterThan(800);
    expect(build).toHaveBeenCalledTimes(1);
    expect(await dbGet('SELECT count FROM usage_tracking')).toMatchObject({ count: 1 }); // 'second' not charged
  });

  it(`per-IP limit allows ${NEW_BUILDS_PER_IP} new builds/day, then 429 with retryAfterSec`, async () => {
    expect(NEW_BUILDS_PER_IP).toBeGreaterThanOrEqual(10);
    for (let i = 0; i < NEW_BUILDS_PER_IP; i++) expect((await get(`user${i}`)).statusCode).toBe(202);
    const res = await get('one-more');
    expect(res.statusCode).toBe(429);
    expect(res.json().status).toBe('rate_limited');
    expect(res.json().retryAfterSec).toBeGreaterThan(0);
    // another IP is unaffected
    expect((await get('one-more', '10.0.0.2')).statusCode).toBe(202);
  });

  it('polling a queued login does not spend the IP budget', async () => {
    build.mockImplementation(() => new Promise(() => {}));
    for (let i = 0; i < NEW_BUILDS_PER_IP + 3; i++) expect((await get('slow')).statusCode).toBe(202);
  });

  it('the showcase login builds from an IP with no budget left, and serves 200 once cached', async () => {
    const showcase = SHOWCASE_LOGINS[0];
    await exhaustIp();
    expect((await get(showcase)).statusCode).toBe(202);
    await drainGitViewerQueue();
    const res = await get(showcase);
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ready');
  });

  it('a signed-in owner building their own login skips the per-IP limit and spends nothing', async () => {
    await exhaustIp();
    vi.mocked(verifyClerkGitHubUser).mockResolvedValue({ email: 'o@x.com', githubLogins: ['octocat'] });
    expect((await get('OctoCat', '10.0.0.1', 'Bearer t')).statusCode).toBe(202);
    // a different login is still limited for a free signed-in user
    expect((await get('someone', '10.0.0.1', 'Bearer t')).statusCode).toBe(429);
  });

  it('a paid subscriber skips the per-IP limit', async () => {
    await exhaustIp();
    vi.mocked(verifyClerkGitHubUser).mockResolvedValue({ email: 'p@x.com', githubLogins: [] });
    vi.mocked(getActiveSubscriptionLive).mockResolvedValue({ isPro: false, tier: 'free', gitViewer: true });
    expect((await get('anyone', '10.0.0.1', 'Bearer t')).statusCode).toBe(202);
  });

  it('a claimed profile with no cached payload yet rebuilds without the per-IP limit', async () => {
    await exhaustIp();
    await dbRun(
      `INSERT INTO git_viewer_profiles (login, payload, tier, locked_count, owner_email, updated_at)
       VALUES ('claimed', '', 'free', 0, 'c@x.com', 0)`,
    );
    expect((await get('claimed')).statusCode).toBe(202);
  });

  it('regenerates a free profile only once it is older than 24h', async () => {
    await dbRun(
      `INSERT INTO git_viewer_profiles (login, payload, tier, locked_count, updated_at) VALUES (?, ?, 'free', 2, ?)`,
      'old', '{"projects":[]}', Math.floor(Date.now() / 1000) - 25 * 3600,
    );
    const res = await get('old');
    expect(res.statusCode).toBe(200); // stale copy served while regenerating
    await drainGitViewerQueue();
    expect(build).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/git-viewer/claim', () => {
  it('401 without a verified Clerk user', async () => {
    expect((await claim({ login: 'octocat' })).statusCode).toBe(401);
  });

  it('403 when the linked GitHub login does not match', async () => {
    vi.mocked(verifyClerkGitHubUser).mockResolvedValue({ email: 'a@x.com', githubLogins: ['someone-else'] });
    const res = await claim({ login: 'octocat' });
    expect(res.statusCode).toBe(403);
    expect(await dbGet('SELECT login FROM git_viewer_profiles WHERE login = ?', 'octocat')).toBeUndefined();
  });

  it('400 for more than 12 repos', async () => {
    vi.mocked(verifyClerkGitHubUser).mockResolvedValue({ email: 'a@x.com', githubLogins: ['octocat'] });
    const res = await claim({ login: 'octocat', allowlist: Array.from({ length: 13 }, (_, i) => `r${i}`) });
    expect(res.statusCode).toBe(400);
  });

  it('a git_viewer subscriber gets paid: 12 chosen repos + Writing', async () => {
    vi.mocked(verifyClerkGitHubUser).mockResolvedValue({ email: 'a@x.com', githubLogins: ['octocat'] });
    vi.mocked(getActiveSubscriptionLive).mockResolvedValue({ isPro: false, tier: 'free', gitViewer: true });
    const res = await claim({ login: 'OctoCat', allowlist: ['hello-world', 'Spoon-Knife'] });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, login: 'octocat', tier: 'paid' });
    await drainGitViewerQueue();
    expect(build).toHaveBeenCalledWith(expect.objectContaining({
      user: 'octocat', maxProjects: PLAN_LIMITS.paid, allowlist: ['hello-world', 'Spoon-Knife'], writing: 'profile-repo',
    }));
    const ready = (await get('octocat')).json();
    expect(ready.tier).toBe('paid');
    expect(ready.data.projects).toHaveLength(12);
  });

  it('a legacy pro subscriber gets paid included', async () => {
    vi.mocked(verifyClerkGitHubUser).mockResolvedValue({ email: 'p@x.com', githubLogins: ['octocat'] });
    vi.mocked(getActiveSubscriptionLive).mockResolvedValue({ isPro: true, tier: 'pro', gitViewer: false });
    expect((await claim({ login: 'octocat' })).json().tier).toBe('paid');
  });

  it('a claimed free profile without a subscription stays free', async () => {
    vi.mocked(verifyClerkGitHubUser).mockResolvedValue({ email: 'a@x.com', githubLogins: ['octocat'] });
    expect((await claim({ login: 'octocat', allowlist: ['a'] })).json().tier).toBe('free');
    await drainGitViewerQueue();
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ maxProjects: PLAN_LIMITS.free, allowlist: undefined }));
  });
});

describe('daily refresh', () => {
  const dayOld = () => Math.floor(Date.now() / 1000) - 25 * 3600;

  beforeEach(async () => {
    // A fresh showcase copy, so the sweep only queues what each test inserts.
    for (const login of SHOWCASE_LOGINS) {
      await dbRun(
        `INSERT INTO git_viewer_profiles (login, payload, tier, locked_count, updated_at) VALUES (?, '{}', 'free', 0, ?)`,
        login, Math.floor(Date.now() / 1000),
      );
    }
  });

  it('refreshes paid profiles and leaves day-old free ones alone', async () => {
    await dbRun(
      `INSERT INTO git_viewer_profiles (login, payload, tier, locked_count, owner_email, allowlist, updated_at)
       VALUES ('paiduser', '{}', 'paid', 0, 'p@x.com', '["a"]', ?), ('freeuser', '{}', 'free', 3, NULL, NULL, ?),
              ('claimedfree', '{}', 'free', 3, 'f@x.com', NULL, ?)`,
      dayOld(), dayOld(), dayOld(),
    );
    vi.mocked(getActiveSubscriptionLive).mockImplementation(async email =>
      ({ isPro: false, tier: 'free', gitViewer: email === 'p@x.com' }));
    expect(await runGitViewerRefresh()).toBe(1);
    await drainGitViewerQueue();
    expect(build).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ user: 'paiduser', allowlist: ['a'], writing: 'profile-repo' }));
  });

  it('downgrades a paid profile whose subscription lapsed', async () => {
    await dbRun(
      `INSERT INTO git_viewer_profiles (login, payload, tier, locked_count, owner_email, updated_at)
       VALUES ('lapsed', '{}', 'paid', 0, 'l@x.com', ?)`, dayOld(),
    );
    await runGitViewerRefresh();
    await drainGitViewerQueue();
    const row = await dbGet<{ tier: string }>('SELECT tier FROM git_viewer_profiles WHERE login = ?', 'lapsed');
    expect(row?.tier).toBe('free');
  });

  it('refreshes claimed free profiles weekly; unclaimed ones never', async () => {
    const weekOld = Math.floor(Date.now() / 1000) - 8 * 86400;
    await dbRun(
      `INSERT INTO git_viewer_profiles (login, payload, tier, locked_count, owner_email, updated_at)
       VALUES ('weekly', '{}', 'free', 3, 'w@x.com', ?), ('anon', '{}', 'free', 3, NULL, ?)`,
      weekOld, weekOld,
    );
    await runGitViewerRefresh();
    await drainGitViewerQueue();
    expect(build).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ user: 'weekly', maxProjects: PLAN_LIMITS.free }));
  });

  it('seeds a missing showcase profile and refreshes it after 24h, unviewed', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'ghp_test');
    const showcase = SHOWCASE_LOGINS[0];
    await dbRun('DELETE FROM git_viewer_profiles WHERE login = ?', showcase);
    await runGitViewerRefresh();
    await drainGitViewerQueue();
    expect(build).toHaveBeenCalledWith(expect.objectContaining({
      user: showcase, maxProjects: PLAN_LIMITS.paid, writing: 'profile-repo',
    }));
    expect((await get(showcase)).statusCode).toBe(200);

    await runGitViewerRefresh(); // fresh → no rebuild
    await drainGitViewerQueue();
    expect(build).toHaveBeenCalledTimes(1);

    await dbRun('UPDATE git_viewer_profiles SET updated_at = ? WHERE login = ?', dayOld(), showcase);
    await runGitViewerRefresh();
    await drainGitViewerQueue();
    expect(build).toHaveBeenCalledTimes(2);
  });
});

describe('free tier cut to 1 project (2026-10-14)', () => {
  const MIGRATION = '2026-10-14-git-viewer-free-1-project';
  const fresh = () => Math.floor(Date.now() / 1000);

  it('marks cached free profiles stale once; paid rows keep their timestamp', async () => {
    const now = fresh();
    await dbRun(
      `INSERT INTO git_viewer_profiles (login, payload, tier, locked_count, owner_email, updated_at)
       VALUES ('anonfree', '{}', 'free', 9, NULL, ?), ('claimedfree', '{}', 'free', 9, 'f@x.com', ?),
              ('paiduser', '{}', 'paid', 0, 'p@x.com', ?)`,
      now, now, now,
    );
    await dbRun('DELETE FROM data_migrations WHERE id = ?', MIGRATION);
    await initDb();
    const at = async (login: string) =>
      (await dbGet<{ updated_at: number }>('SELECT updated_at FROM git_viewer_profiles WHERE login = ?', login))?.updated_at;
    expect(await at('anonfree')).toBe(0);
    expect(await at('claimedfree')).toBe(0);
    expect(await at('paiduser')).toBe(now);

    // An unclaimed free row rebuilds at the new cap on its next view.
    expect((await get('anonfree')).statusCode).toBe(200);
    await drainGitViewerQueue();
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ user: 'anonfree', maxProjects: 1 }));
    expect((await get('anonfree')).json().data.projects).toHaveLength(1);

    // A claimed free row rebuilds in the sweep without being viewed.
    await runGitViewerRefresh();
    await drainGitViewerQueue();
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ user: 'claimedfree', maxProjects: 1 }));
  });

  it('without GITHUB_TOKEN the showcase builds free (a paid build cannot fit 60 calls/h)', async () => {
    vi.stubEnv('GITHUB_TOKEN', '');
    const showcase = SHOWCASE_LOGINS[0];
    expect((await get(showcase)).statusCode).toBe(202);
    await drainGitViewerQueue();
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ user: showcase, maxProjects: PLAN_LIMITS.free, writing: 'none' }));
  });

  it('a showcase profile cached at the free tier upgrades to paid on its next view once a token is set', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'ghp_test');
    const showcase = SHOWCASE_LOGINS[0];
    await dbRun(
      `INSERT INTO git_viewer_profiles (login, payload, tier, locked_count, updated_at) VALUES (?, '{}', 'free', 9, ?)`,
      showcase, fresh(),
    );
    expect((await get(showcase)).statusCode).toBe(200);
    await drainGitViewerQueue();
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ user: showcase, maxProjects: PLAN_LIMITS.paid }));
    expect((await get(showcase)).json()).toMatchObject({ tier: 'paid' });
  });
});
