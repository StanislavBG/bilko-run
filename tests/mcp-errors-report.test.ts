import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { errorsReport, errorDetail } from '../mcp-host-server/src/errors-report.js';

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
});
