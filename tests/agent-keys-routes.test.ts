import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';

const { verifyTokenMock, getUserMock, createClerkClientMock } = vi.hoisted(() => ({
  verifyTokenMock: vi.fn(),
  getUserMock: vi.fn(),
  createClerkClientMock: vi.fn(),
}));

vi.mock('@clerk/backend', () => ({
  verifyToken: verifyTokenMock,
  createClerkClient: createClerkClientMock,
}));

import { initDb, dbRun } from '../server/db.js';
import { registerAgentKeyRoutes } from '../server/routes/agent-keys.js';
import { mintAgentApiKey } from '../server/services/agent-api-keys.js';

const TOKENS: Record<string, { sub: string; email: string }> = {
  'tok-a': { sub: 'user_a', email: 'a@example.com' },
  'tok-b': { sub: 'user_b', email: 'b@example.com' },
};

const app = Fastify({ logger: false });
registerAgentKeyRoutes(app);

beforeAll(async () => {
  process.env.CLERK_SECRET_KEY = 'test-secret';
  createClerkClientMock.mockReturnValue({ users: { getUser: getUserMock } });
  verifyTokenMock.mockImplementation(async (t: string) => {
    if (TOKENS[t]) return { sub: TOKENS[t].sub };
    throw new Error('invalid token');
  });
  getUserMock.mockImplementation(async (sub: string) => {
    const t = Object.values(TOKENS).find((x) => x.sub === sub)!;
    return { primaryEmailAddress: { emailAddress: t.email } };
  });
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM agent_api_keys');
});

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
let ipCounter = 0;
const freshIp = () => `10.1.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;
const post = (token: string | null, payload: unknown = {}, remoteAddress = freshIp()) =>
  app.inject({ method: 'POST', url: '/api/agent-keys', headers: token ? bearer(token) : {}, payload: payload as any, remoteAddress });

describe('agent key routes', () => {
  it('mints, lists, and revokes', async () => {
    const res = await post('tok-a', { label: '  my agent  ' });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.key).toMatch(/^bkk_/);
    expect(body.prefix).toBe(body.key.slice(0, 12));

    const list = await app.inject({ method: 'GET', url: '/api/agent-keys', headers: bearer('tok-a') });
    expect(list.statusCode).toBe(200);
    expect(list.headers['cache-control']).toBe('private, no-store');
    const rows = list.json();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: body.id, label: 'my agent', prefix: body.prefix, revoked_at: null });
    expect(Object.keys(rows[0]).sort()).toEqual(['created_at', 'id', 'label', 'last_used_at', 'prefix', 'revoked_at']);
    expect(list.body).not.toContain(body.key);

    const del = await app.inject({ method: 'DELETE', url: `/api/agent-keys/${body.id}`, headers: bearer('tok-a') });
    expect(del.statusCode).toBe(200);
    const after = (await app.inject({ method: 'GET', url: '/api/agent-keys', headers: bearer('tok-a') })).json();
    expect(after[0].revoked_at).not.toBeNull();
  });

  it('truncates long labels to 80 chars', async () => {
    await post('tok-a', { label: 'x'.repeat(200) });
    const rows = (await app.inject({ method: 'GET', url: '/api/agent-keys', headers: bearer('tok-a') })).json();
    expect(rows[0].label).toHaveLength(80);
  });

  it("another user's id is a 404 and the key stays active", async () => {
    const { id } = (await post('tok-a')).json();
    const del = await app.inject({ method: 'DELETE', url: `/api/agent-keys/${id}`, headers: bearer('tok-b') });
    expect(del.statusCode).toBe(404);
    const rows = (await app.inject({ method: 'GET', url: '/api/agent-keys', headers: bearer('tok-a') })).json();
    expect(rows[0].revoked_at).toBeNull();
    const other = (await app.inject({ method: 'GET', url: '/api/agent-keys', headers: bearer('tok-b') })).json();
    expect(other).toEqual([]);
  });

  it('returns 409 at the 10-key cap', async () => {
    for (let i = 0; i < 10; i++) expect((await post('tok-a')).statusCode).toBe(201);
    const res = await post('tok-a');
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toMatch(/10/);
  });

  it('401 without auth', async () => {
    expect((await post(null)).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/agent-keys' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'DELETE', url: '/api/agent-keys/1' })).statusCode).toBe(401);
  });

  it('401 when authenticated only with a bkk_ key', async () => {
    const minted = await mintAgentApiKey('a@example.com', 'agent');
    if ('alreadyMinted' in minted) throw new Error('unexpected');
    expect((await post(minted.key)).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/agent-keys', headers: bearer(minted.key) })).statusCode).toBe(401);
    expect((await app.inject({ method: 'DELETE', url: `/api/agent-keys/${minted.id}`, headers: bearer(minted.key) })).statusCode).toBe(401);
  });

  it('rate limits POST to 10/minute per IP', async () => {
    const ip = freshIp();
    for (let i = 0; i < 10; i++) expect((await post(null, {}, ip)).statusCode).toBe(401);
    expect((await post('tok-a', {}, ip)).statusCode).toBe(429);
  });
});
