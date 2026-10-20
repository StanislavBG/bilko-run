import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { errorsReport, errorDetail, adminGet, mapEgressToUsage } from '../mcp-host-server/src/errors-report.js';

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
    delete process.env.BILKO_BASE_URL;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BILKO_ADMIN_KEY;
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
    await expect(errorsReport({ days: 1 })).rejects.toThrow(/BILKO_ADMIN_KEY is not set/);
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
