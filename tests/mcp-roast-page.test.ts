// @vitest-environment node
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest';

vi.mock('../server/clerk.js', () => ({
  verifyClerkToken: vi.fn(),
  requireAuth: vi.fn(),
  ADMIN_EMAILS: [],
}));

vi.mock('../server/services/stripe.js', () => ({
  hasPurchased: vi.fn().mockResolvedValue(false),
  getActiveSubscriptionLive: vi.fn().mockResolvedValue({ isPro: false, tier: 'free' }),
}));

vi.mock('../server/gemini.js', () => ({ askGemini: vi.fn() }));

vi.mock('@bilkobibitkov/page-roast', () => ({ roastPage: vi.fn() }));

import Fastify from 'fastify';
import { roastPage } from '@bilkobibitkov/page-roast';
import { initDb, dbRun } from '../server/db.js';
import { getTokenBalance } from '../server/services/tokens.js';
import { mintAgentApiKey } from '../server/services/agent-api-keys.js';
import { registerProjectCatalogRoutes } from '../server/routes/project-catalog.js';

const BUY = 'https://bilko.run/buy/pageroast-credits-7';
const app = Fastify({ logger: false });

beforeAll(async () => {
  await initDb();
  registerProjectCatalogRoutes(app);
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM usage_daily');
  vi.mocked(roastPage).mockReset().mockResolvedValue({
    scores: { total_score: 71, grade: 'C', roast: 'meh' },
  } as any);
});

async function call(url: string, key?: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'roast_page', arguments: { url } } },
  });
  expect(res.statusCode).toBe(200);
  return res.json().result as { isError?: boolean; content: { text: string }[] };
}

async function keyWithBalance(email: string, balance: number) {
  const minted = await mintAgentApiKey(email, 'test');
  if (!('key' in minted)) throw new Error('mint failed');
  await dbRun('INSERT OR REPLACE INTO token_balances (email, balance) VALUES (?, ?)', email, balance);
  return minted.key;
}

describe('roast_page over POST /mcp', () => {
  it('is listed by tools/list', async () => {
    const res = await app.inject({
      method: 'POST', url: '/mcp',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    });
    const tool = (res.json().result.tools as { name: string; description: string }[]).find(t => t.name === 'roast_page');
    expect(tool).toBeTruthy();
    expect(tool!.description).toContain(BUY);
  });

  it('without a key returns the buy instruction and spends nothing', async () => {
    const r = await call('example.com');
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain(BUY);
    expect(roastPage).not.toHaveBeenCalled();
  });

  it('reports an invalid key without failing the MCP request', async () => {
    const r = await call('example.com', 'bkk_not-a-real-key');
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('Invalid API key');
    expect(roastPage).not.toHaveBeenCalled();
  });

  it('valid key with balance 2 succeeds and leaves 1', async () => {
    const email = 'mcp-ok@test.com';
    const key = await keyWithBalance(email, 2);
    const r = await call('example.com', key);
    expect(r.isError).toBeFalsy();
    const body = JSON.parse(r.content[0].text);
    expect(body.total_score).toBe(71);
    expect(body.usage.balance).toBe(1);
    expect(await getTokenBalance(email)).toBe(1);
  });

  it('zero balance returns no credits and never calls roastPage', async () => {
    const email = 'mcp-zero@test.com';
    const key = await keyWithBalance(email, 0);
    const r = await call('example.com', key);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('No credits remaining');
    expect(r.content[0].text).toContain(BUY);
    expect(roastPage).not.toHaveBeenCalled();
  });

  it('refunds when roastPage throws', async () => {
    const email = 'mcp-refund@test.com';
    const key = await keyWithBalance(email, 2);
    vi.mocked(roastPage).mockRejectedValue(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await call('example.com', key);
    expect(r.isError).toBe(true);
    expect(await getTokenBalance(email)).toBe(2);
  });
});
