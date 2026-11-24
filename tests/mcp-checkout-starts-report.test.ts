// @vitest-environment node
// checkout_starts_report as a sibling session calls it: every checkout start comes back (owner-flagged and automated
// rows marked, never dropped), with no email, and timelines fetched once per session.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerReportTools } from '../mcp-host-server/src/report-tools.js';

const KEY = 'bka_supersecretkeyvalue';
const SID_A = '00000000-0000-4000-8000-00000000000a';
const SID_B = '00000000-0000-4000-8000-00000000000b';
const SID_GONE = '00000000-0000-4000-8000-00000000000c';
let fetchMock: ReturnType<typeof vi.fn>;
let startsStatus = 200;

function res(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

type ToolResult = { isError?: boolean; content: { text: string }[] };

async function call(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  const server = new McpServer({ name: 'bilko-host', version: 'test' });
  registerReportTools(server);
  const client = new Client({ name: 't', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  try {
    return (await client.callTool({ name, arguments: args })) as ToolResult;
  } finally {
    await client.close();
    await server.close();
  }
}

/** Each admin API request as `path?query`. */
const sent = (): string[] =>
  fetchMock.mock.calls.map((c) => {
    const u = new URL(c[0] as string);
    return `${u.pathname}?${u.searchParams.toString()}`;
  });

const session = (landingPath: string) => ({
  startedAt: 1, landingPath, referrerHost: null, sourceBucket: 'direct', utmSource: null, utmMedium: null,
  utmCampaign: null, country: 'US', device: 'desktop', email: 'leak@example.com',
});

const start = (over: Record<string, unknown>) => ({
  id: 0, createdAt: '2026-11-23 10:00:00', ts: 1, tool: 'launch-kit', source: 'web-product', checkoutSessionId: 'cs_1',
  stripeMode: 'live', path: '/products/launch-kit', label: 'human', labelReasons: [], counted: true, mine: false,
  mineReasons: [], visitorId: 'v1', sessionId: null, session: null, sessionNote: null, visitorClasses: [],
  metadata: null, secretExtra: 'drop me', ...over,
});

const STARTS = [
  start({ id: 1, sessionId: SID_A, session: session('/'), metadata: { email: 'a@b.co', note: 'mail a@b.co' } }),
  start({ id: 2, counted: false, mine: true, mineReasons: ['owner_ip'], sessionId: SID_B, session: session('/admin') }),
  start({ id: 3, label: 'automated', labelReasons: ['ua'], sessionId: SID_A, session: session('/') }),
  start({ id: 4, source: 'agent-buy', path: '/buy/launch-kit', sessionId: null, sessionNote: 'agent-buy links carry no session' }),
  start({ id: 5, sessionId: 'legacy-id' }),
  start({ id: 6, sessionId: SID_GONE }),
];

beforeEach(() => {
  startsStatus = 200;
  fetchMock = vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    if (path === '/api/admin/checkout-starts') {
      if (startsStatus !== 200) return res(startsStatus, {});
      return res(200, {
        days: 7, since: '2026-11-17', labelsSince: '2026-11-20 08:00:00',
        totals: { counted: { human: 3, automated: 1, unlabeled: 0 }, all: { human: 4, automated: 1, unlabeled: 0 }, starts: 6, ownerFlagged: 1 },
        listed: 6, truncated: false, starts: STARTS,
      });
    }
    if (path === `/api/admin/sessions/${SID_A}` || path === `/api/admin/sessions/${SID_B}`) {
      return res(200, {
        session: { session_id: path.slice(-36), email: 'owner@example.com' },
        apps: [],
        timeline: [{ ts: 1, kind: 'view', path: '/?email=x@y.co', referrer_host: null }],
      });
    }
    return res(404, {});
  });
  vi.stubGlobal('fetch', fetchMock);
  process.env.BILKO_ADMIN_KEY = KEY;
  process.env.BILKO_ADMIN_KEY_FILE = join(tmpdir(), 'bilko-host-no-such-key-file');
  delete process.env.BILKO_BASE_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BILKO_ADMIN_KEY;
  delete process.env.BILKO_ADMIN_KEY_FILE;
});

describe('checkout_starts_report', () => {
  it('sends days=7 by default and limit only when given', async () => {
    await call('checkout_starts_report');
    await call('checkout_starts_report', { days: 30, limit: 200 });
    expect(sent()).toEqual(['/api/admin/checkout-starts?days=7', '/api/admin/checkout-starts?days=30&limit=200']);
  });

  it('returns every start, owner-flagged and automated included, allowlisted and with no email', async () => {
    const out = await call('checkout_starts_report');
    expect(out.isError).toBeFalsy();
    expect(out.content[0].text).not.toMatch(/@/);
    const r = JSON.parse(out.content[0].text);
    expect(r.source).toBe('https://bilko.run');
    expect(r.window).toEqual({ days: 7, since: '2026-11-17', labelsSince: '2026-11-20 08:00:00' });
    expect(r.totals.counted).toEqual({ human: 3, automated: 1, unlabeled: 0 });
    expect(r.totals.ownerFlagged).toBe(1);
    expect(r.listed).toBe(6);
    expect(r.truncated).toBe(false);
    expect(r.starts.map((s: { id: number }) => s.id)).toEqual([1, 2, 3, 4, 5, 6]);
    const [human, owner, automated, agentBuy] = r.starts;
    expect(owner).toMatchObject({ counted: false, mine: true, mineReasons: ['owner_ip'] });
    expect(automated).toMatchObject({ label: 'automated', labelReasons: ['ua'], counted: true });
    expect(agentBuy).toMatchObject({ source: 'agent-buy', sessionId: null, sessionNote: 'agent-buy links carry no session' });
    expect(human.metadata).toEqual({ note: 'mail [email]' });
    expect(human.secretExtra).toBeUndefined();
    expect(Object.keys(human.session).sort()).toEqual(
      ['country', 'device', 'landingPath', 'referrerHost', 'sourceBucket', 'startedAt', 'utmCampaign', 'utmMedium', 'utmSource'],
    );
    expect(human.timeline).toBeUndefined();
    expect(sent()).toHaveLength(1);
  });

  it('timeline: true fetches each distinct UUID session once and notes the rest', async () => {
    const out = await call('checkout_starts_report', { timeline: true });
    expect(out.isError).toBeFalsy();
    expect(out.content[0].text).not.toMatch(/@/);
    const calls = sent();
    expect(calls[0]).toBe('/api/admin/checkout-starts?days=7');
    expect(calls.slice(1).sort()).toEqual(
      [`/api/admin/sessions/${SID_A}?`, `/api/admin/sessions/${SID_B}?`, `/api/admin/sessions/${SID_GONE}?`].sort(),
    );
    const byId = Object.fromEntries(JSON.parse(out.content[0].text).starts.map((s: { id: number }) => [s.id, s]));
    expect(byId[1].timeline).toEqual([{ ts: 1, kind: 'view', path: '/?email=[email]', referrer_host: null }]);
    expect(byId[3].timeline).toEqual(byId[1].timeline);
    expect(byId[1].timeline_note).toBeUndefined();
    expect(byId[4]).toMatchObject({ timeline: [], timeline_note: 'no session id recorded on this start' });
    expect(byId[5]).toMatchObject({ timeline: [], timeline_note: 'timeline unavailable: legacy session id is not a UUID' });
    expect(byId[6]).toMatchObject({ timeline: [], timeline_note: 'timeline unavailable: host returned 404' });
  });

  it('caps timelines at 50 distinct sessions', async () => {
    const many = Array.from({ length: 52 }, (_, i) =>
      start({ id: i + 1, sessionId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` }),
    );
    fetchMock.mockImplementation(async (url: string) => {
      const path = new URL(url).pathname;
      if (path === '/api/admin/checkout-starts') return res(200, { days: 7, listed: 52, truncated: false, starts: many });
      return res(200, { session: {}, apps: [], timeline: [] });
    });
    const r = JSON.parse((await call('checkout_starts_report', { timeline: true })).content[0].text);
    expect(sent()).toHaveLength(51);
    expect(r.totals).toBeNull();
    expect(r.starts[49]).toEqual(expect.objectContaining({ timeline: [] }));
    expect(r.starts[49].timeline_note).toBeUndefined();
    expect(r.starts[50]).toMatchObject({ timeline: [], timeline_note: 'timeline unavailable: more than 50 sessions listed' });
  });

  it('passes the agent-buy /buy hit through with only its nine keys, and null when the host sends none', async () => {
    const hit = {
      ts: 2, path: '/buy/launch-kit', status: 302, referrerHost: 'news.example', country: 'DE', device: 'mobile',
      browser: 'Safari', os: 'iOS', visitorClass: 'human', ip: '203.0.113.9', ua: 'Mozilla/5.0 (iPhone)',
    };
    const rowsIn = [
      start({ id: 1, source: 'agent-buy', path: '/buy/launch-kit', hit }),
      start({ id: 2 }),
      start({ id: 3, hit: 'not-an-object' }),
    ];
    fetchMock.mockImplementation(async () => res(200, { days: 7, listed: 3, truncated: false, starts: rowsIn }));
    const out = await call('checkout_starts_report');
    expect(out.isError).toBeFalsy();
    expect(out.content[0].text).not.toContain('203.0.113.9');
    expect(out.content[0].text).not.toContain('iPhone');
    const [withHit, noHit, badHit] = JSON.parse(out.content[0].text).starts;
    expect(withHit.hit).toEqual({
      ts: 2, path: '/buy/launch-kit', status: 302, referrerHost: 'news.example', country: 'DE', device: 'mobile',
      browser: 'Safari', os: 'iOS', visitorClass: 'human',
    });
    expect(noHit.hit).toBeNull();
    expect(badHit.hit).toBeNull();
  });

  it('names the deploy step on a 404', async () => {
    startsStatus = 404;
    const out = await call('checkout_starts_report');
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain(
      'bilko.run returned 404 for /api/admin/checkout-starts (the host predates checkout_starts_report; deploy the host first)',
    );
  });
});
