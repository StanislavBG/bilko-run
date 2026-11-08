// GET /api/admin/git-viewer/profiles and the bilko-host git_viewer_report tool that reads it. Auth is the real
// requireAdmin: a minted read-only admin key (bka_) gets in with a GET; no credential or a bad key is refused.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { initDb, dbRun } from '../server/db.js';
import { ADMIN_EMAILS } from '../server/clerk.js';
import { mintAdminApiKey } from '../server/services/admin-api-keys.js';
import { GIT_VIEWER_TIER } from '../server/services/stripe.js';
import { SHOWCASE_LOGINS } from '../server/routes/tools/git-viewer.js';
import { registerAdminGitViewerRoutes } from '../server/routes/admin-git-viewer.js';
import { registerGitViewerReportTool } from '../mcp-host-server/src/git-viewer-report.js';

const app = Fastify({ logger: false });
registerAdminGitViewerRoutes(app);

const PATH = '/api/admin/git-viewer/profiles';
const T0 = 1_762_500_000; // unix seconds
const iso = (sec: number) => new Date(sec * 1000).toISOString();
const SHOWCASE = SHOWCASE_LOGINS[0];
let key = '';

const get = (headers: Record<string, string> = { authorization: `Bearer ${key}` }) =>
  app.inject({ method: 'GET', url: PATH, headers });

async function profile(p: {
  login: string;
  tier: 'free' | 'paid';
  ownerEmail?: string;
  allowlist?: string[];
  payload?: string;
  updatedAt: number;
  createdAt: number | null;
  builtBy: string | null;
}) {
  await dbRun(
    `INSERT INTO git_viewer_profiles (login, payload, tier, locked_count, owner_email, allowlist, updated_at, created_at, built_by)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    p.login, p.payload ?? JSON.stringify({ note: 'PAYLOAD_MARKER' }), p.tier, p.ownerEmail ?? null,
    p.allowlist ? JSON.stringify(p.allowlist) : null, p.updatedAt, p.createdAt, p.builtBy,
  );
}

async function subscription(id: string, email: string, tier: string, status: string) {
  await dbRun(
    `INSERT INTO stripe_subscriptions (email, stripe_customer_id, stripe_subscription_id, plan_tier, status)
     VALUES (?, ?, ?, ?, ?)`,
    email, `cus_${id}`, id, tier, status,
  );
}

/** Inserted out of order on purpose: the route's ORDER BY decides the rows' order, not the rowid. */
async function seed() {
  await profile({ login: 'bob', tier: 'free', updatedAt: T0 + 31, createdAt: T0 + 30, builtBy: 'visitor' });
  // Legacy rows, built before created_at and built_by existed (both NULL).
  await profile({ login: 'legacy-old', tier: 'free', updatedAt: T0 - 100, createdAt: null, builtBy: null });
  await profile({
    login: 'alice', tier: 'paid', ownerEmail: 'alice@example.com', allowlist: ['ALLOWLIST_REPO_A', 'ALLOWLIST_REPO_B'],
    updatedAt: T0 + 45, createdAt: T0 + 40, builtBy: 'owner',
  });
  await profile({ login: 'crawler-x', tier: 'free', updatedAt: T0 + 21, createdAt: T0 + 20, builtBy: 'automation' });
  // The showcase login is claimed, paid and stamped 'showcase', so leaving it out moves every total it could touch.
  await profile({
    login: SHOWCASE, tier: 'paid', ownerEmail: 'showcase@example.com', allowlist: ['ALLOWLIST_REPO_S'],
    updatedAt: T0 + 55, createdAt: T0 + 50, builtBy: 'showcase',
  });
  await profile({ login: 'legacy-paid', tier: 'paid', ownerEmail: 'lp@example.com', updatedAt: T0 + 5, createdAt: null, builtBy: null });
  // Stamped 'showcase' but no longer a showcase login: still counted, because the exclusion is by login.
  await profile({ login: 'former-showcase', tier: 'free', updatedAt: T0 + 11, createdAt: T0 + 10, builtBy: 'showcase' });
  // A claim placeholder: claimed before its first build, so payload is '' and updated_at is 0.
  await profile({
    login: 'carol', tier: 'free', ownerEmail: 'carol@example.com', payload: '', updatedAt: 0, createdAt: T0 + 35, builtBy: 'visitor',
  });

  await subscription('sub_gv_active', 'alice@example.com', GIT_VIEWER_TIER, 'active');
  await subscription('sub_gv_canceled', 'bob@example.com', GIT_VIEWER_TIER, 'canceled');
  await subscription('sub_gv_past_due', 'carol@example.com', GIT_VIEWER_TIER, 'past_due');
  await subscription('sub_pro_active', 'dave@example.com', 'pro', 'active');
}

const TOTALS = {
  all: 7,
  byTier: { free: 5, paid: 2 },
  claimed: 3,
  unclaimed: 4,
  byBuiltBy: { owner: 1, automation: 1, visitor: 2, showcase: 1, unknown: 2 },
};

const ROWS = [
  { login: SHOWCASE, tier: 'paid', claimed: true, showcase: true, builtBy: 'showcase', createdAt: iso(T0 + 50), updatedAt: iso(T0 + 55) },
  { login: 'alice', tier: 'paid', claimed: true, showcase: false, builtBy: 'owner', createdAt: iso(T0 + 40), updatedAt: iso(T0 + 45) },
  { login: 'carol', tier: 'free', claimed: true, showcase: false, builtBy: 'visitor', createdAt: iso(T0 + 35), updatedAt: null },
  { login: 'bob', tier: 'free', claimed: false, showcase: false, builtBy: 'visitor', createdAt: iso(T0 + 30), updatedAt: iso(T0 + 31) },
  { login: 'crawler-x', tier: 'free', claimed: false, showcase: false, builtBy: 'automation', createdAt: iso(T0 + 20), updatedAt: iso(T0 + 21) },
  { login: 'former-showcase', tier: 'free', claimed: false, showcase: false, builtBy: 'showcase', createdAt: iso(T0 + 10), updatedAt: iso(T0 + 11) },
  { login: 'legacy-paid', tier: 'paid', claimed: true, showcase: false, builtBy: null, createdAt: null, updatedAt: iso(T0 + 5) },
  { login: 'legacy-old', tier: 'free', claimed: false, showcase: false, builtBy: null, createdAt: null, updatedAt: iso(T0 - 100) },
];

beforeAll(async () => {
  await initDb();
  await app.ready();
  ({ key } = await mintAdminApiKey(ADMIN_EMAILS[0], 'git-viewer report test'));
});

beforeEach(async () => {
  for (const t of ['git_viewer_profiles', 'stripe_subscriptions']) await dbRun(`DELETE FROM ${t}`);
});

describe('GET /api/admin/git-viewer/profiles', () => {
  it('refuses a request with no admin credential or a bad admin key, and lets the read-only key in', async () => {
    await seed();
    for (const res of [await get({}), await get({ authorization: 'Bearer bka_garbage' })]) {
      expect(res.statusCode).toBe(403);
      expect(res.body).not.toContain('alice');
    }
    const res = await get();
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('counts totals without the showcase logins, and git_viewer subscriptions only', async () => {
    await seed();
    const body = (await get()).json();
    expect(Object.keys(body).sort()).toEqual(['rows', 'subscriptions', 'totals']);
    expect(body.totals).toEqual(TOTALS);
    expect(body.subscriptions).toEqual({ active: 1, total: 3 });
  });

  it('lists every row newest first, showcase flagged, with ISO dates and null for 0 or NULL', async () => {
    await seed();
    expect((await get()).json().rows).toEqual(ROWS);
  });

  it('never returns an owner email, payload, allowlist or any email', async () => {
    await seed();
    const res = await get();
    for (const banned of ['@', 'owner_email', 'payload', 'PAYLOAD_MARKER', 'allowlist', 'ALLOWLIST_REPO']) {
      expect(res.body).not.toContain(banned);
    }
    for (const row of res.json().rows) {
      expect(Object.keys(row).sort()).toEqual(['builtBy', 'claimed', 'createdAt', 'login', 'showcase', 'tier', 'updatedAt']);
    }
  });

  it('answers zeros, not nulls, on empty tables', async () => {
    expect((await get()).json()).toEqual({
      totals: {
        all: 0,
        byTier: { free: 0, paid: 0 },
        claimed: 0,
        unclaimed: 0,
        byBuiltBy: { owner: 0, automation: 0, visitor: 0, showcase: 0, unknown: 0 },
      },
      subscriptions: { active: 0, total: 0 },
      rows: [],
    });
  });

  it('caps rows at the newest 500 but counts every row', async () => {
    await dbRun(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 501)
       INSERT INTO git_viewer_profiles (login, payload, tier, locked_count, updated_at, created_at, built_by)
       SELECT 'user-' || i, '{}', 'free', 0, ? + i, ? + i, 'visitor' FROM n`,
      T0, T0,
    );
    const body = (await get()).json();
    expect(body.totals.all).toBe(501);
    expect(body.totals.byBuiltBy.visitor).toBe(501);
    expect(body.rows).toHaveLength(500);
    expect(body.rows[0].login).toBe('user-501');
    expect(body.rows[499].login).toBe('user-2');
  });
});

describe('bilko-host git_viewer_report', () => {
  type ToolResult = { isError?: boolean; content: { text: string }[] };
  let fetchMock: ReturnType<typeof vi.fn>;

  async function callTool(): Promise<ToolResult> {
    const server = new McpServer({ name: 'bilko-host', version: 'test' });
    registerGitViewerReportTool(server);
    const client = new Client({ name: 't', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    try {
      return (await client.callTool({ name: 'git_viewer_report', arguments: {} })) as ToolResult;
    } finally {
      await client.close();
    }
  }

  beforeEach(() => {
    process.env.BILKO_ADMIN_KEY = key;
    process.env.BILKO_BASE_URL = 'http://host.test';
    // Hand the tool's request to the real route, so the minted key goes through the real requireAdmin.
    fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const headers = Object.fromEntries(new Headers(init?.headers).entries());
      const res = await app.inject({ method: 'GET', url: url.pathname + url.search, headers });
      return new Response(res.body, { status: res.statusCode, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BILKO_ADMIN_KEY;
    delete process.env.BILKO_BASE_URL;
  });

  it('reads the endpoint with the admin key and returns its body with the source', async () => {
    await seed();
    const result = await callTool();
    expect(result.isError).toBeFalsy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://host.test${PATH}`);
    expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${key}`);
    const out = JSON.parse(result.content[0].text);
    expect(out.source).toBe('http://host.test');
    expect(out.totals).toEqual(TOTALS);
    expect(out.subscriptions).toEqual({ active: 1, total: 3 });
    expect(out.rows).toEqual(ROWS);
  });

  it('reports an error when the host has no such endpoint', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"error":"Not Found"}', { status: 404 }));
    const result = await callTool();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(PATH);
  });
});
