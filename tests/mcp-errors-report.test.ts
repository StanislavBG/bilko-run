import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { errorsReport, errorDetail, adminGet, mapEgressToUsage, resolveAdminKey, trafficReport, mapTrafficToReport, funnelReport, flowsReport, sessionsReport, sessionDetail } from '../mcp-host-server/src/errors-report.js';

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

  it('defaults to mine=exclude&bots=include and never sends the legacy self alias', async () => {
    fetchMock.mockResolvedValue(res(200, BODY));
    const r = (await trafficReport({ days: 30, slug: 'demo' })) as Record<string, any>;
    const u = new URL(fetchMock.mock.calls[0][0] as string);
    expect(u.pathname).toBe('/api/admin/traffic');
    expect(Object.fromEntries(u.searchParams)).toEqual({ days: '30', slug: 'demo', mine: 'exclude', bots: 'include' });
    expect(r.window).toEqual({ requestedDays: 30, days: 30, excludeSelf: true, includeBots: true });
  });

  it('excludeSelf: false sends mine=include; includeBots: false sends bots=exclude', async () => {
    fetchMock.mockImplementation(async () => res(200, BODY));
    await trafficReport({ days: 7, excludeSelf: false });
    await trafficReport({ days: 7, includeBots: false });
    const q = fetchMock.mock.calls.map((c) => Object.fromEntries(new URL(c[0] as string).searchParams));
    expect(q).toEqual([
      { days: '7', mine: 'include', bots: 'include' },
      { days: '7', mine: 'exclude', bots: 'exclude' },
    ]);
  });

  it('returns the host filters echo (null from an older host) and notes what the host applied', () => {
    const echoed = mapTrafficToReport({ ...BODY, filters: { mine: 'include', bots: 'exclude', mineHits: 42 } }, 30) as Record<string, any>;
    expect(echoed.filters).toEqual({ mine: 'include', bots: 'exclude', mineHits: 42 });
    expect(echoed.notes.join(' ')).toContain('mine=include');
    expect(echoed.notes.join(' ')).toContain('bots=exclude');
    const older = mapTrafficToReport(BODY, 30) as Record<string, any>;
    expect(older.filters).toBeNull();
    expect(older.notes.join(' ')).toContain('mine=exclude');
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
    fetchMock.mockResolvedValue(res(200, { since: '2026-10-14', utm_source: 'burrow', visits: 9, sign_ins: 3, checkout_start: 2, paid: 1, booked: 'x', free_hours_booked: 2 }));
    const r = await funnelReport({ utmSource: 'burrow', since: '2026-10-14' });
    const u = new URL(fetchMock.mock.calls[0][0] as string);
    expect(u.pathname).toBe('/api/admin/funnel');
    expect(Object.fromEntries(u.searchParams)).toEqual({ utm_source: 'burrow', since: '2026-10-14' });
    expect(r).toMatchObject({ since: '2026-10-14', utm_source: 'burrow', visits: 9, sign_ins: 3, checkout_start: 2, paid: 1, booked: 0, free_hours_booked: 2 });
  });

  it('flowsReport sends mine=exclude&bots=exclude&env=prod by default and returns the filters echo', async () => {
    fetchMock.mockResolvedValue(res(200, { apps: [{ app: 'academy', sessions: 3 }], filters: { mine: 'exclude', bots: 'exclude', env: 'prod' } }));
    const r = await flowsReport({ days: 7, app: 'academy' });
    const u = new URL(fetchMock.mock.calls[0][0] as string);
    expect(u.pathname).toBe('/api/admin/flows');
    expect(Object.fromEntries(u.searchParams)).toEqual({ days: '7', app: 'academy', mine: 'exclude', bots: 'exclude', env: 'prod' });
    expect(r).toMatchObject({ apps: [{ app: 'academy', sessions: 3 }], filters: { mine: 'exclude', bots: 'exclude', env: 'prod' } });
    expect(typeof r.source).toBe('string');
  });

  it('flowsReport opt-outs send include, omit days/app that were not given, and report a missing echo as null', async () => {
    fetchMock.mockImplementation(async () => res(200, { apps: [] }));
    const r = await flowsReport({ includeMine: true });
    await flowsReport({ includeBots: true });
    const q = fetchMock.mock.calls.map((c) => Object.fromEntries(new URL(c[0] as string).searchParams));
    expect(q).toEqual([{ mine: 'include', bots: 'exclude', env: 'prod' }, { mine: 'exclude', bots: 'include', env: 'prod' }]);
    expect(r.filters).toBeNull();
  });

  it('flowsReport throws on a 404 null body', async () => {
    fetchMock.mockResolvedValue(res(404, 'nope'));
    await expect(flowsReport({})).rejects.toThrow('bilko.run returned 404 for /api/admin/flows');
  });
});

/** Every object key in `v`, at any depth. */
function allKeys(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => allKeys(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); allKeys(x, out); }
  return out;
}
const ADDRESS = /[a-z0-9._%+-]+(?:@|%40)[a-z0-9.-]+\.[a-z]{2,}/i;

describe('mcp sessions_report', () => {
  const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const S1 = uuid(1);
  const LIST = {
    sessions: [
      {
        session_id: S1, visitor_id: 'v1', email: 'owner@example.com', started_at: 1000, ended_at: 9000, duration_ms: 8000,
        landing_path: '/projects/academy/?contact=owner@example.com', exit_path: '/projects/academy/', page_count: 2,
        source_bucket: 'social', referrer_host: 'linkedin.com', country: 'US', device: 'mobile', converted: 0, purchased: 0,
        click_count: 1, event_count: 2, error_count: 0, apps: ['academy'], mine: false, bot: false, ip_hash: 'secret-hash',
      },
    ],
    filters: { mine: 'exclude', bots: 'exclude' },
  };
  const DETAIL = {
    session: {
      session_id: S1, visitor_id: 'v1', email: 'owner@example.com', started_at: 1000, ended_at: 9000,
      utm_source: 'burrow', utm_medium: 'social', country: 'US', converted: 0,
    },
    apps: ['academy'],
    timeline: [
      { ts: 1000, kind: 'view', path: '/projects/academy/?ref=burrow', referrer: 'https://www.linkedin.com/feed/?x=1' },
      { ts: 2000, kind: 'click', path: '/projects/academy/', label: 'Start', href: 'mailto:owner@example.com', track_name: 'course-start', tag: 'a' },
      {
        ts: 3000, kind: 'event', name: 'quiz.start', app: 'academy', path: '/projects/academy/q',
        props: { flow: 'quiz', step: 'start', email: 'a@b.co', nested: [{ userEmail: 'x', e_mail: 'y', score: 1 }], note: 'reach a%40b.co' },
      },
      { ts: 4000, kind: 'error', app: 'academy', name: 'TypeError', msg: 'bad owner@example.com', url: 'https://bilko.run/projects/academy/?e=1' },
      { ts: 5000, kind: 'log', msg: 'unknown kind' },
    ],
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

  it('lists allowlisted sessions with mine/bots excluded by default, and no email key or address', async () => {
    fetchMock.mockResolvedValue(res(200, LIST));
    const r = (await sessionsReport({ days: 30, app: 'academy' })) as Record<string, any>;
    const u = new URL(fetchMock.mock.calls[0][0] as string);
    expect(u.pathname).toBe('/api/admin/sessions');
    expect(Object.fromEntries(u.searchParams)).toEqual({ days: '30', app: 'academy', mine: 'exclude', bots: 'exclude' });
    expect(r.filters).toEqual({ mine: 'exclude', bots: 'exclude' });
    expect(r.count).toBe(1);
    expect(Object.keys(r.sessions[0]).sort()).toEqual([
      'apps', 'bot', 'click_count', 'converted', 'country', 'device', 'duration_ms', 'ended_at', 'error_count', 'event_count',
      'exit_path', 'landing_path', 'mine', 'page_count', 'purchased', 'referrer_host', 'session_id', 'source_bucket',
      'started_at', 'visitor_id',
    ]);
    expect(r.sessions[0]).toMatchObject({ mine: false, bot: false, landing_path: '/projects/academy/?contact=[email]' });
    expect(allKeys(r).filter((k) => /mail/i.test(k))).toEqual([]);
    expect(JSON.stringify(r)).not.toMatch(ADDRESS);
  });

  it('includeMine / includeBots send include', async () => {
    fetchMock.mockImplementation(async () => res(200, LIST));
    await sessionsReport({ includeMine: true });
    await sessionsReport({ includeBots: true });
    const q = fetchMock.mock.calls.map((c) => Object.fromEntries(new URL(c[0] as string).searchParams));
    expect(q).toEqual([{ mine: 'include', bots: 'exclude' }, { mine: 'exclude', bots: 'include' }]);
  });

  it('timeline: true adds each session timeline with only its kind fields and no email', async () => {
    fetchMock.mockImplementation(async (url: string) => (new URL(url).pathname === '/api/admin/sessions' ? res(200, LIST) : res(200, DETAIL)));
    const r = (await sessionsReport({ timeline: true })) as Record<string, any>;
    expect(new URL(fetchMock.mock.calls[1][0] as string).pathname).toBe(`/api/admin/sessions/${S1}`);
    expect(r.sessions[0].timeline).toEqual([
      { ts: 1000, kind: 'view', path: '/projects/academy/?ref=burrow', referrer_host: 'www.linkedin.com' },
      { ts: 2000, kind: 'click', path: '/projects/academy/', label: 'Start', href: 'mailto:[email]', track_name: 'course-start' },
      { ts: 3000, kind: 'event', name: 'quiz.start', app: 'academy', path: '/projects/academy/q', props: { flow: 'quiz', step: 'start', nested: [{ score: 1 }], note: 'reach [email]' } },
      { ts: 4000, kind: 'error', app: 'academy', name: 'TypeError', msg: 'bad [email]' },
      { ts: 5000, kind: 'log' },
    ]);
    expect(allKeys(r).filter((k) => /mail/i.test(k))).toEqual([]);
    expect(JSON.stringify(r)).not.toMatch(ADDRESS);
  });

  it('timeline fetches at most 50 sessions, 5 at a time, and caps the requested limit at 50', async () => {
    let inFlight = 0;
    let peak = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (new URL(url).pathname === '/api/admin/sessions') {
        // A host that ignored limit: the cap still holds.
        return res(200, { sessions: Array.from({ length: 60 }, (_, i) => ({ session_id: uuid(i) })), filters: LIST.filters });
      }
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((done) => setTimeout(done, 2));
      inFlight--;
      return res(200, { session: null, apps: [], timeline: [] });
    });
    const r = (await sessionsReport({ limit: 200, timeline: true })) as Record<string, any>;
    expect(Object.fromEntries(new URL(fetchMock.mock.calls[0][0] as string).searchParams)).toEqual({ limit: '50', mine: 'exclude', bots: 'exclude' });
    expect(fetchMock.mock.calls.length - 1).toBe(50);
    expect(peak).toBe(5);
    expect(r.count).toBe(50);
    expect(r.sessions.every((s: { timeline: unknown }) => Array.isArray(s.timeline))).toBe(true);
  });

  it('sessionDetail allowlists the session (utm_* kept, duration derived), returns null on 404, and refuses a non-UUID id', async () => {
    fetchMock.mockResolvedValueOnce(res(200, DETAIL)).mockResolvedValueOnce(res(404, {}));
    const d = (await sessionDetail(S1)) as Record<string, any>;
    expect(d.session).toEqual({
      session_id: S1, visitor_id: 'v1', started_at: 1000, ended_at: 9000, duration_ms: 8000,
      utm_source: 'burrow', utm_medium: 'social', country: 'US', converted: 0,
    });
    expect(d.apps).toEqual(['academy']);
    expect(allKeys(d).filter((k) => /mail/i.test(k))).toEqual([]);
    expect(JSON.stringify(d)).not.toMatch(ADDRESS);
    expect(await sessionDetail(uuid(2))).toBeNull();
    await expect(sessionDetail('..')).rejects.toThrow(/session id/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws on a 404 list', async () => {
    fetchMock.mockResolvedValue(res(404, {}));
    await expect(sessionsReport({})).rejects.toThrow('bilko.run returned 404 for /api/admin/sessions');
  });
});
