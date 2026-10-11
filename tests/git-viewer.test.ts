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
  runGitViewerRefresh, PLAN_LIMITS, type BuildPortfolio,
} from '../server/routes/tools/git-viewer.js';
import { FREE_TIER_LIMIT } from '../server/routes/tools/_shared.js';

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
});

const get = (login: string, ip = '10.0.0.1') =>
  app.inject({ method: 'GET', url: `/api/git-viewer/u/${encodeURIComponent(login)}`, remoteAddress: ip });

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
    expect(body.data.projects).toHaveLength(3);
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

  it('per-IP generation limit → 429 with retryAfterSec', async () => {
    for (let i = 0; i < FREE_TIER_LIMIT; i++) expect((await get(`user${i}`)).statusCode).toBe(202);
    const res = await get('one-more');
    expect(res.statusCode).toBe(429);
    expect(res.json().status).toBe('rate_limited');
    expect(res.json().retryAfterSec).toBeGreaterThan(0);
    // another IP is unaffected
    expect((await get('one-more', '10.0.0.2')).statusCode).toBe(202);
  });

  it('polling a queued login does not spend the IP budget', async () => {
    build.mockImplementation(() => new Promise(() => {}));
    for (let i = 0; i < FREE_TIER_LIMIT + 3; i++) expect((await get('slow')).statusCode).toBe(202);
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

  it('refreshes paid profiles and leaves free ones alone', async () => {
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
});
