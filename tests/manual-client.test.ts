/**
 * The browser client for the free Field Manual (src/lib/manualClient.ts).
 *
 * The regression this guards: Clerk's `getToken` waits for Clerk to finish
 * loading and never rejects. When Clerk is blocked, failing or slow (a privacy
 * extension, an outage, any origin its production keys refuse), a chapter
 * request that awaited the token never went out, and every chapter of the free
 * manual sat on "Loading chapter…" forever. Sign-in may add a token; it must
 * never gate reading.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchManualChapter, manualDownloadUrl, TOKEN_WAIT_MS } from '../src/lib/manualClient.js';

const BODY = { version: '2.0.1', slug: 'welcome', title: 'Welcome', html: '<p>hi</p>' };

function okFetch() {
  return vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    json: async () => BODY,
  })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

function headersOf(f: ReturnType<typeof vi.fn>): Record<string, string> {
  return ((f.mock.calls[0]?.[1] as RequestInit | undefined)?.headers ?? {}) as Record<string, string>;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchManualChapter', () => {
  it('still fetches the chapter when getToken never settles', async () => {
    vi.useFakeTimers();
    const fetchImpl = okFetch();
    const never = () => new Promise<string | null>(() => {});

    const pending = fetchManualChapter('welcome', never, { fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(TOKEN_WAIT_MS);

    await expect(pending).resolves.toEqual(BODY);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(String(fetchImpl.mock.calls[0][0])).toContain('/manual/chapter/welcome');
    expect(headersOf(fetchImpl)).not.toHaveProperty('Authorization');
  });

  it('waits no longer than the token timeout', () => {
    expect(TOKEN_WAIT_MS).toBeLessThanOrEqual(2000);
  });

  it('forwards the bearer token when sign-in answers in time', async () => {
    const fetchImpl = okFetch();
    await fetchManualChapter('welcome', async () => 'tok_123', { fetchImpl });
    expect(headersOf(fetchImpl)).toEqual({ Authorization: 'Bearer tok_123' });
  });

  it('reads signed out (null token), a rejecting getToken and a throwing one alike', async () => {
    for (const getToken of [
      async () => null,
      () => Promise.reject(new Error('clerk down')),
      () => { throw new Error('no provider'); },
    ]) {
      const fetchImpl = okFetch();
      await expect(fetchManualChapter('welcome', getToken as () => Promise<string | null>, { fetchImpl })).resolves.toEqual(BODY);
      expect(headersOf(fetchImpl)).toEqual({});
    }
  });

  it('keeps a 402 distinct from a failure, and a failure is null', async () => {
    const locked = { locked: true, title: 'Scheduler', blurb: 'Queue work.' };
    const f402 = vi.fn(async () => ({ ok: false, status: 402, json: async () => locked })) as unknown as typeof fetch;
    await expect(fetchManualChapter('scheduler', async () => null, { fetchImpl: f402 })).resolves.toEqual(locked);

    const f500 = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: 'x' }) })) as unknown as typeof fetch;
    await expect(fetchManualChapter('scheduler', async () => null, { fetchImpl: f500 })).resolves.toBeNull();
  });
});

describe('manualDownloadUrl', () => {
  it('is a plain, account-free link to the download route', () => {
    expect(manualDownloadUrl('offline-html')).toMatch(/\/manual\/download\/offline-html$/);
  });
});
