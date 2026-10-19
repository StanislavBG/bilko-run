import { describe, expect, it, vi } from 'vitest';
import {
  addPost,
  fetchThread,
  formatEntryNo,
  formatForumWhen,
  formatLogWhen,
} from '../src/lib/forumClient.js';

const NOW = new Date(2026, 9, 19, 12, 0, 0).getTime();
const md = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

describe('formatters', () => {
  it('formatForumWhen buckets by age', () => {
    expect(formatForumWhen(NOW - 30_000, NOW)).toBe('just now');
    expect(formatForumWhen(NOW - 5 * 60_000, NOW)).toBe('5 min ago');
    expect(formatForumWhen(NOW - 3 * 3_600_000, NOW)).toBe('3 h ago');
    expect(formatForumWhen(NOW - 30 * 3_600_000, NOW)).toBe('Yesterday');
    const old = NOW - 5 * 86_400_000;
    expect(formatForumWhen(old, NOW)).toBe(md(old));
  });

  it('formatLogWhen is month-day · HH:MM', () => {
    const t = new Date(2026, 9, 19, 9, 12).getTime();
    expect(formatLogWhen(t)).toBe(`${md(t)} · 09:12`);
  });

  it('formatEntryNo zero-pads to 4', () => {
    expect(formatEntryNo(1)).toBe('No. 0001');
    expect(formatEntryNo(12345)).toBe('No. 12345');
  });
});

function stubFetch(status: number, body: unknown) {
  return vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('forum requests', () => {
  it('sends the bearer header and JSON body on authed calls', async () => {
    const fetchImpl = stubFetch(201, { id: 'p_1' });
    const r = await addPost(async () => 'tok', 'th/1', { body: 'hi' }, { fetchImpl });
    expect(r).toEqual({ ok: true, id: 'p_1' });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/forum/threads/th%2F1/posts');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ body: 'hi' }));
  });

  it('maps 403 needs_handle to a typed error', async () => {
    const fetchImpl = stubFetch(403, { error: 'Pick a forum handle first.', code: 'needs_handle' });
    const r = await addPost(async () => 'tok', 't', { body: 'x' }, { fetchImpl });
    expect(r).toEqual({ ok: false, status: 403, code: 'needs_handle', error: 'Pick a forum handle first.' });
  });

  it('resolves network failures instead of throwing', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('down'); }) as unknown as typeof fetch;
    const r = await fetchThread('t', undefined, { fetchImpl });
    expect(r).toMatchObject({ ok: false, status: 0 });
  });
});
