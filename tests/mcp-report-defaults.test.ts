// @vitest-environment node
// The bilko-host report tools as a sibling session calls them: the zod defaults in the tool schemas decide what the
// admin API is asked for, so these go through an MCP client, not the errors-report helpers.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerReportTools } from '../mcp-host-server/src/report-tools.js';

const KEY = 'bka_supersecretkeyvalue';
const SID = '00000000-0000-4000-8000-000000000001';
let fetchMock: ReturnType<typeof vi.fn>;

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

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    if (path === '/api/admin/flows') return res(200, { apps: [], flows: [], filters: { mine: 'exclude', bots: 'exclude', env: 'prod' } });
    if (path === '/api/admin/traffic') return res(200, { days: 30, totals: {}, filters: { mine: 'exclude', bots: 'include', mineHits: 7 } });
    if (path === '/api/admin/funnel') return res(200, { since: '2026-11-01', utm_source: 'burrow', visits: 1 });
    if (path === '/api/admin/sessions') {
      return res(200, {
        sessions: [{ session_id: SID, visitor_id: 'v1', email: 'owner@example.com', landing_path: '/projects/academy/', mine: false, bot: false }],
        filters: { mine: 'exclude', bots: 'exclude' },
      });
    }
    if (path === `/api/admin/sessions/${SID}`) {
      return res(200, {
        session: { session_id: SID, email: 'owner@example.com', utm_source: 'burrow' },
        apps: ['academy'],
        timeline: [{ ts: 1, kind: 'event', name: 'lesson.start', app: 'academy', path: null, props: { email: 'owner@example.com', step: 'start' } }],
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

describe('flows_report defaults to real visitors', () => {
  it('sends mine=exclude&bots=exclude&env=prod by default and returns the filters echo', async () => {
    const out = await call('flows_report', { days: 30, app: 'academy' });
    expect(out.isError).toBeFalsy();
    expect(sent()).toEqual(['/api/admin/flows?days=30&app=academy&mine=exclude&bots=exclude&env=prod']);
    expect(JSON.parse(out.content[0].text).filters).toEqual({ mine: 'exclude', bots: 'exclude', env: 'prod' });
  });

  it('includeMine / includeBots are the raw opt-outs', async () => {
    await call('flows_report', { includeMine: true });
    await call('flows_report', { includeBots: true });
    await call('flows_report', { includeMine: true, includeBots: true });
    expect(sent()).toEqual([
      '/api/admin/flows?mine=include&bots=exclude&env=prod',
      '/api/admin/flows?mine=exclude&bots=include&env=prod',
      '/api/admin/flows?mine=include&bots=include&env=prod',
    ]);
  });
});

describe('flows_report reads prod telemetry by default', () => {
  it("sends env=prod when env is not given; env: 'all' sends env=all, dev and test pick that env", async () => {
    await call('flows_report');
    await call('flows_report', { env: 'all' });
    await call('flows_report', { env: 'dev' });
    await call('flows_report', { env: 'test', includeBots: true });
    expect(sent()).toEqual([
      '/api/admin/flows?mine=exclude&bots=exclude&env=prod',
      '/api/admin/flows?mine=exclude&bots=exclude&env=all',
      '/api/admin/flows?mine=exclude&bots=exclude&env=dev',
      '/api/admin/flows?mine=exclude&bots=include&env=test',
    ]);
  });

  it('refuses an env other than prod, dev, test or all before any request', async () => {
    const out = await call('flows_report', { env: 'staging' });
    expect(out.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('sessions_report defaults to real visitors and never returns an email', () => {
  it('sends mine=exclude&bots=exclude by default; includeMine / includeBots opt out', async () => {
    await call('sessions_report');
    await call('sessions_report', { days: 30, app: 'academy', limit: 20, includeMine: true });
    await call('sessions_report', { includeBots: true });
    expect(sent()).toEqual([
      '/api/admin/sessions?mine=exclude&bots=exclude',
      '/api/admin/sessions?days=30&app=academy&limit=20&mine=include&bots=exclude',
      '/api/admin/sessions?mine=exclude&bots=include',
    ]);
  });

  it('returns sessions with their mine/bot flags, timelines on request, and no email key or address', async () => {
    const out = await call('sessions_report', { timeline: true });
    expect(out.isError).toBeFalsy();
    expect(sent()).toEqual(['/api/admin/sessions?limit=50&mine=exclude&bots=exclude', `/api/admin/sessions/${SID}?`]);
    const body = JSON.parse(out.content[0].text);
    expect(body.sessions[0]).toMatchObject({ session_id: SID, mine: false, bot: false });
    expect(body.sessions[0].timeline[0].props).toEqual({ step: 'start' });
    expect(out.content[0].text).not.toMatch(/"[^"]*mail[^"]*"\s*:/i);
    expect(out.content[0].text).not.toMatch(/@/);
  });

  it('timeline: true keeps every listed session; a legacy non-UUID id gets an empty timeline and a note', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const path = new URL(url).pathname;
      if (path === '/api/admin/sessions') {
        return res(200, {
          sessions: [
            { session_id: 'legacy-abc', visitor_id: 'v0', utm_source: 'burrow', utm_medium: 'post', utm_campaign: 'launch' },
            { session_id: SID, visitor_id: 'v1' },
          ],
          filters: { mine: 'exclude', bots: 'exclude' },
        });
      }
      if (path === `/api/admin/sessions/${SID}`) {
        return res(200, {
          session: { session_id: SID },
          apps: [],
          timeline: [{ ts: 1, kind: 'view', path: '/', referrer: 'https://ignored.example/x', referrer_host: 'news.example' }],
        });
      }
      return res(404, {});
    });
    const out = await call('sessions_report', { timeline: true });
    expect(out.isError).toBeFalsy();
    expect(sent()).toEqual(['/api/admin/sessions?limit=50&mine=exclude&bots=exclude', `/api/admin/sessions/${SID}?`]);
    const body = JSON.parse(out.content[0].text);
    expect(body.count).toBe(2);
    expect(body.sessions[0]).toMatchObject({
      session_id: 'legacy-abc', timeline: [], utm_source: 'burrow', utm_medium: 'post', utm_campaign: 'launch',
    });
    expect(body.sessions[0].timeline_note).toMatch(/not a UUID/);
    expect(body.sessions[1].timeline).toEqual([{ ts: 1, kind: 'view', path: '/', referrer_host: 'news.example' }]);
    expect(body.sessions[1].timeline_note).toBeUndefined();
  });

  it('drops object keys that are email addresses', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const path = new URL(url).pathname;
      if (path === `/api/admin/sessions/${SID}`) {
        return res(200, {
          session: { session_id: SID },
          apps: [],
          timeline: [{ ts: 1, kind: 'event', name: 'x', app: 'a', path: null, props: { 'someone@example.com': 1, 'a%40b.co': 2, ok: 3 } }],
        });
      }
      return res(404, {});
    });
    const out = await call('sessions_report', { sessionId: SID });
    expect(JSON.parse(out.content[0].text).timeline[0].props).toEqual({ ok: 3 });
  });

  it('sessionId reads one session and its timeline; a non-UUID id is refused before any request', async () => {
    const out = await call('sessions_report', { sessionId: SID });
    expect(sent()).toEqual([`/api/admin/sessions/${SID}?`]);
    const body = JSON.parse(out.content[0].text);
    expect(body.session).toEqual({ session_id: SID, utm_source: 'burrow' });
    expect(body.timeline).toHaveLength(1);
    expect(out.content[0].text).not.toMatch(/@/);

    const bad = await call('sessions_report', { sessionId: '..' });
    expect(bad.isError).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('traffic_report excludes the owner by default', () => {
  it('sends mine=exclude&bots=include by default, never the legacy self alias', async () => {
    const out = await call('traffic_report');
    expect(sent()).toEqual(['/api/admin/traffic?days=30&mine=exclude&bots=include']);
    const body = JSON.parse(out.content[0].text);
    expect(body.window).toMatchObject({ excludeSelf: true, includeBots: true });
    expect(body.filters).toEqual({ mine: 'exclude', bots: 'include', mineHits: 7 });
  });

  it('excludeSelf: false and includeBots: false are the raw opt-outs', async () => {
    await call('traffic_report', { days: 7, excludeSelf: false });
    await call('traffic_report', { days: 7, includeBots: false });
    expect(sent()).toEqual([
      '/api/admin/traffic?days=7&mine=include&bots=include',
      '/api/admin/traffic?days=7&mine=exclude&bots=exclude',
    ]);
  });
});

describe('funnel_report keeps the host defaults', () => {
  it('sends neither exclude_self=0 nor include_bots=1, so the host excludes the owner and bots', async () => {
    const out = await call('funnel_report', { utmSource: 'burrow' });
    expect(out.isError).toBeFalsy();
    expect(sent()).toEqual(['/api/admin/funnel?utm_source=burrow']);
  });
});
