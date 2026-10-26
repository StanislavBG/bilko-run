import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { errorsReport, errorDetail, adminGet, mapEgressToUsage, resolveAdminKey, trafficReport, mapTrafficToReport, funnelReport, flowsReport } from '../mcp-host-server/src/errors-report.js';

const KEY = 'bka_supersecretkeyvalue';
let fetchMock: ReturnType<typeof vi.fn>;

function res(status: number, body: unknown): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
}

describe('mcp errors-report (admin API client)', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env.BILKO_ADMIN_KEY = KEY;
    // Never fall through to a real key file on the dev machine.
    process.env.BILKO_ADMIN_KEY_FILE = join(tmpdir(), 'bilko-host-no-such-key-file');
    delete process.env.BILKO_BASE_URL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BILKO_ADMIN_KEY;
    delete process.env.BILKO_ADMIN_KEY_FILE;
    delete process.env.BILKO_BASE_URL;
  });

  it('builds URL and query, sends Bearer header', async () => {
    fetchMock.mockResolvedValue(res(200, { totals: { errors: 1, groups: 1 }, groups: [] }));
    const r = await errorsReport({ days: 3, app: 'alpha', env: 'dev', limit: 10 });
    expect(r).toEqual({ totals: { errors: 1, groups: 1 }, groups: [] });
    const [url, init] = fetchMock.mock.calls[0];
    const u = new URL(url as string);
    expect(u.origin).toBe('https://bilko.run');
    expect(u.pathname).toBe('/api/admin/observability/errors');
    expect(Object.fromEntries(u.searchParams)).toEqual({ days: '3', app: 'alpha', env: 'dev', limit: '10' });
    expect((init as RequestInit).headers).toMatchObject({ Authorization: `Bearer ${KEY}` });
    expect((init as RequestInit).signal).toBeDefined();
  });

  it('honors BILKO_BASE_URL and strips trailing slash; omits unset params', async () => {
    process.env.BILKO_BASE_URL = 'http://localhost:3000/';
    fetchMock.mockResolvedValue(res(200, {}));
    await errorsReport({ days: 1 });
    const u = new URL(fetchMock.mock.calls[0][0] as string);
    expect(u.origin).toBe('http://localhost:3000');
    expect(u.searchParams.has('app')).toBe(false);
    expect(u.searchParams.has('limit')).toBe(false);
  });

  it('errorDetail calls /errors/<id>', async () => {
    fetchMock.mockResolvedValue(res(200, { id: 7, msg: 'boom' }));
    expect(await errorDetail(7)).toEqual({ id: 7, msg: 'boom' });
    expect(new URL(fetchMock.mock.calls[0][0] as string).pathname).toBe('/api/admin/observability/errors/7');
  });

  it('throws a clear error when the key is missing, without fetching', async () => {
    delete process.env.BILKO_ADMIN_KEY;
    await expect(errorsReport({ days: 1 })).rejects.toThrow(/BILKO_ADMIN_KEY is not set and no key file at .*bilko-host-no-such-key-file/);
    await expect(errorDetail(1)).rejects.toThrow(/https:\/\/bilko\.run\/admin\/secrets/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('403 message names status and never contains the key', async () => {
    fetchMock.mockResolvedValue(res(403, `forbidden ${KEY}`));
    const e = await errorsReport({ days: 1 }).catch((x: Error) => x);
    expect((e as Error).message).toMatch(/403/);
    expect((e as Error).message).toMatch(/invalid, expired or revoked/);
    expect((e as Error).message).not.toContain(KEY);
  });

  it('errorDetail returns null on 404', async () => {
    fetchMock.mockResolvedValue(res(404, { error: 'nope' }));
    expect(await errorDetail(99)).toBeNull();
  });

  it('500 throws with status and truncated body', async () => {
    fetchMock.mockResolvedValue(res(500, 'x'.repeat(500)));
    const e = (await errorsReport({ days: 1 }).catch((x: Error) => x)) as Error;
    expect(e.message).toMatch(/500/);
    expect(e.message.length).toBeLessThan(400);
    expect(e.message).not.toContain(KEY);
  });
  it('adminGet joins base URL and path as given', async () => {
    process.env.BILKO_BASE_URL = 'http://localhost:3000/';
    fetchMock.mockResolvedValue(res(200, { ok: 1 }));
    expect(await adminGet('/api/admin/egress?days=3')).toEqual({ ok: 1 });
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/api/admin/egress?days=3');
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: `Bearer ${KEY}` });
  });

  it('adminGet returns null on 404', async () => {
    fetchMock.mockResolvedValue(res(404, {}));
    expect(await adminGet('/api/admin/egress?days=1')).toBeNull();
  });
});

describe('mapEgressToUsage', () => {
  it('maps bySlug to static and non-static rows to api, with bytesPerRequest', () => {
    const out = mapEgressToUsage(
      {
        earliestDate: '2026-10-01',
        bySlug: [{ slug: 'alpha', requests: 4, bytes: 1000, bytesPerRequest: 250 }, { slug: 'beta', requests: 0, bytes: 0 }],
        rows: [
          { method: 'GET', route: 'static:alpha', requests: 4, bytes: 1000, bytesPerRequest: 250 },
          { method: 'GET', route: '/api/projects', requests: 3, bytes: 10, bytesPerRequest: 3 },
        ],
      },
      7,
    ) as Record<string, any>;
    expect(out.window).toEqual({ requestedDays: 7 });
    expect(out.earliestDateInTable).toBe('2026-10-01');
    expect(out.static).toEqual([
      { slug: 'alpha', requests: 4, bytes: 1000, bytesPerRequest: 250 },
      { slug: 'beta', requests: 0, bytes: 0, bytesPerRequest: 0 },
    ]);
    expect(out.api).toEqual([{ method: 'GET', route: '/api/projects', requests: 3, bytes: 10, bytesPerRequest: 3 }]);
    expect(Array.isArray(out.notes)).toBe(true);
  });

  it('tolerates a missing/garbage body', () => {
    const out = mapEgressToUsage(null, 2) as Record<string, any>;
    expect(out.static).toEqual([]);
    expect(out.api).toEqual([]);
    expect(out.earliestDateInTable).toBeNull();
  });
});

describe('mcp admin key resolution', () => {
  let dir: string;
  let file: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bilko-key-'));
    file = join(dir, 'admin-key');
    process.env.BILKO_ADMIN_KEY_FILE = file;
    delete process.env.BILKO_ADMIN_KEY;
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.BILKO_ADMIN_KEY;
    delete process.env.BILKO_ADMIN_KEY_FILE;
  });

  it('reads a 0600 key file when the env var is unset, trimming whitespace', () => {
    writeFileSync(file, `${KEY}\n`, { mode: 0o600 });
    expect(resolveAdminKey()).toBe(KEY);
  });

  it('env var wins over the key file', () => {
    writeFileSync(file, 'bka_fromfile', { mode: 0o600 });
    process.env.BILKO_ADMIN_KEY = KEY;
    expect(resolveAdminKey()).toBe(KEY);
  });

  it('refuses a key file readable by group/other, without echoing the key', () => {
    writeFileSync(file, KEY, { mode: 0o644 });
    expect(() => resolveAdminKey()).toThrow(/chmod 600/);
    try { resolveAdminKey(); } catch (e) { expect((e as Error).message).not.toContain(KEY); }
  });

  it('names both options when neither is present (missing or empty file)', () => {
    expect(() => resolveAdminKey()).toThrow(/BILKO_ADMIN_KEY.*admin\/secrets.*mode 0600/);
    writeFileSync(file, '  \n', { mode: 0o600 });
    expect(() => resolveAdminKey()).toThrow(/no key file/);
  });
});

describe('mcp traffic_report', () => {
  const BODY = {
    days: 30,
    totals: { hits: 900, visitors: 400, botHits: 100, notFound: 12, clicks: 30 },
    byDay: [{ date: '2026-10-19', hits: 50, visitors: 20 }],
    topPages: [{ path: '/', hits: 300, visitors: 200 }],
    topReferrers: [{ host: 'x.com', hits: 40 }],
    bySlug: [{ slug: 'session-manager', hits: 100, visitors: 60 }],
    byCountry: [{ country: 'US', hits: 500 }],
    byDevice: [], byBrowser: [], topClicks: [],
    recent: [{ ip: '9.9.9.9', ua: 'secret-ua', userEmail: 'a@b.c' }],
    visitors: [{ visitorId: 'v', ip: '9.9.9.9' }],
    quality: { botVisitors: 100, singleHitVisitors: 300, cookieVisitors: 350, cookieSince: '2026-10-18' },
    earliestDate: '2026-10-12',
  };
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env.BILKO_ADMIN_KEY = KEY;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BILKO_ADMIN_KEY;
  });

  it('queries /api/admin/traffic with days, slug and self=exclude', async () => {
    fetchMock.mockResolvedValue(res(200, BODY));
    await trafficReport({ days: 30, slug: 'demo', excludeSelf: true });
    const u = new URL(fetchMock.mock.calls[0][0] as string);
    expect(u.pathname).toBe('/api/admin/traffic');
    expect(Object.fromEntries(u.searchParams)).toEqual({ days: '30', slug: 'demo', self: 'exclude' });
  });

  it('maps visitors, bot/human split, pages, referrers and metric dates; drops PII rows', () => {
    const r = mapTrafficToReport(BODY, 30) as Record<string, any>;
    expect(r.visitors).toEqual({ human: 400, bot: 100, humanSingleHit: 300, humanMultiHit: 100, bilkoVidCookie: 350 });
    expect(r.hits).toEqual({ human: 900, bot: 100, notFound: 12, clicks: 30 });
    expect(r.split).toEqual({ botHitPct: 10, botVisitorPct: 20, humanSingleHitPct: 75 });
    expect(r.topPages[0]).toEqual({ path: '/', hits: 300, visitors: 200 });
    expect(r.byProject[0].slug).toBe('session-manager');
    expect(r.topReferrers[0]).toEqual({ host: 'x.com', hits: 40 });
    expect(r.metricValidSince).toEqual({ visitors: '2026-10-12', bilkoVidCookie: '2026-10-18' });
    const json = JSON.stringify(r);
    expect(json).not.toContain('9.9.9.9');
    expect(json).not.toContain('secret-ua');
    expect(json).not.toContain('a@b.c');
  });

  it('passes through byClass and topPagesByClass', () => {
    const byClass = [{ class: 'human', hits: 900, visitors: 400 }, { class: 'ai_crawler', hits: 60, visitors: 5 }];
    const topPagesByClass = [{ path: '/', class: 'ai_crawler', hits: 30, visitors: 3 }];
    const r = mapTrafficToReport({ ...BODY, byClass, topPagesByClass }, 30) as Record<string, any>;
    expect(r.byClass).toEqual(byClass);
    expect(r.topPagesByClass).toEqual(topPagesByClass);
    expect(r.notes.join(' ')).toContain('ai_user_agent');
    expect(r.notes.join(' ')).not.toContain('UA-flagged only');
  });

  it('yields [] for byClass/topPagesByClass from an older host', () => {
    const r = mapTrafficToReport(BODY, 30) as Record<string, any>;
    expect(r.byClass).toEqual([]);
    expect(r.topPagesByClass).toEqual([]);
  });

  it('tolerates an empty body without NaN', () => {
    const r = mapTrafficToReport({}, 7) as Record<string, any>;
    expect(r.split).toEqual({ botHitPct: 0, botVisitorPct: 0, humanSingleHitPct: 0 });
    expect(r.metricValidSince).toEqual({ visitors: null, bilkoVidCookie: null });
  });

  it('throws on 404', async () => {
    fetchMock.mockResolvedValue(res(404, {}));
    await expect(trafficReport({ days: 30 })).rejects.toThrow(/404/);
  });
});

describe('mcp funnel_report', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    process.env.BILKO_ADMIN_KEY = KEY;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BILKO_ADMIN_KEY;
  });

  it('queries /api/admin/funnel with utm_source and since, and returns integer stages', async () => {
    fetchMock.mockResolvedValue(res(200, { since: '2026-10-14', utm_source: 'burrow', visits: 9, sign_ins: 3, checkout_start: 2, paid: 1, booked: 'x' }));
    const r = await funnelReport({ utmSource: 'burrow', since: '2026-10-14' });
    const u = new URL(fetchMock.mock.calls[0][0] as string);
    expect(u.pathname).toBe('/api/admin/funnel');
    expect(Object.fromEntries(u.searchParams)).toEqual({ utm_source: 'burrow', since: '2026-10-14' });
    expect(r).toMatchObject({ since: '2026-10-14', utm_source: 'burrow', visits: 9, sign_ins: 3, checkout_start: 2, paid: 1, booked: 0 });
  });

  it('flowsReport builds query from days and app and spreads the body with source', async () => {
    fetchMock.mockResolvedValue(res(200, { apps: [{ app: 'academy', sessions: 3 }] }));
    const r = await flowsReport({ days: 7, app: 'academy' });
    const u = new URL(fetchMock.mock.calls[0][0] as string);
    expect(u.pathname).toBe('/api/admin/flows');
    expect(Object.fromEntries(u.searchParams)).toEqual({ days: '7', app: 'academy' });
    expect(r).toMatchObject({ apps: [{ app: 'academy', sessions: 3 }] });
    expect(typeof r.source).toBe('string');
  });

  it('flowsReport omits params that were not given', async () => {
    fetchMock.mockResolvedValue(res(200, { apps: [] }));
    await flowsReport({});
    const u = new URL(fetchMock.mock.calls[0][0] as string);
    expect(u.search).toBe('');
  });

  it('flowsReport throws on a 404 null body', async () => {
    fetchMock.mockResolvedValue(res(404, 'nope'));
    await expect(flowsReport({})).rejects.toThrow('bilko.run returned 404 for /api/admin/flows');
  });
});
