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
import { requireAdmin } from '../server/clerk.js';
import { registerAdminApiKeyRoutes } from '../server/routes/admin-api-keys.js';
import { mintAdminApiKey, requireRegistryWriter } from '../server/services/admin-api-keys.js';

const ADMIN_EMAIL = 'bilkobibitkov2000@gmail.com';
const CLERK_TOKEN = 'clerk-session-token';

const app = Fastify({ logger: false });
registerAdminApiKeyRoutes(app);
// Probe routes: one guarded by requireRegistryWriter, one by requireAdmin.
app.route({
  method: ['GET', 'PUT', 'POST', 'DELETE'],
  url: '/test/registry-write',
  handler: async (req, reply) => {
    const actor = await requireRegistryWriter(req, reply);
    if (!actor) return;
    return { actor };
  },
});
app.route({
  method: ['GET', 'PUT'],
  url: '/test/admin',
  handler: async (req, reply) => {
    const email = await requireAdmin(req, reply);
    if (!email) return;
    return { email };
  },
});

beforeAll(async () => {
  process.env.CLERK_SECRET_KEY = 'test-secret';
  createClerkClientMock.mockReturnValue({ users: { getUser: getUserMock } });
  verifyTokenMock.mockImplementation(async (t: string) => {
    if (t === CLERK_TOKEN) return { sub: 'user_admin' };
    throw new Error('invalid token');
  });
  getUserMock.mockResolvedValue({ primaryEmailAddress: { emailAddress: ADMIN_EMAIL } });
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM admin_api_keys');
});

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

describe('admin API key scopes', () => {
  it('mint route defaults to read scope and the list shows each scope', async () => {
    const a = await app.inject({ method: 'POST', url: '/api/admin/api-keys', headers: bearer(CLERK_TOKEN), payload: {} });
    expect(a.statusCode).toBe(200);
    expect(a.json().scope).toBe('read');
    const b = await app.inject({
      method: 'POST', url: '/api/admin/api-keys', headers: bearer(CLERK_TOKEN), payload: { scope: 'registry' },
    });
    expect(b.statusCode).toBe(200);
    expect(b.json().scope).toBe('registry');
    const list = await app.inject({ method: 'GET', url: '/api/admin/api-keys', headers: bearer(CLERK_TOKEN) });
    const scopes = (list.json() as Array<{ id: number; scope: string }>).map(k => [k.id, k.scope]);
    expect(scopes).toEqual(expect.arrayContaining([[a.json().id, 'read'], [b.json().id, 'registry']]));
  });

  it('mint route rejects an unknown scope', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/api-keys', headers: bearer(CLERK_TOKEN), payload: { scope: 'write' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('a registry key cannot mint keys (session only)', async () => {
    const { key } = await mintAdminApiKey(ADMIN_EMAIL, 'mcp', 90, 'registry');
    const res = await app.inject({
      method: 'POST', url: '/api/admin/api-keys', headers: bearer(key), payload: { scope: 'registry' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('requireRegistryWriter', () => {
  it('accepts an admin Clerk session and returns the email as actor', async () => {
    const res = await app.inject({ method: 'PUT', url: '/test/registry-write', headers: bearer(CLERK_TOKEN) });
    expect(res.statusCode).toBe(200);
    expect(res.json().actor).toBe(ADMIN_EMAIL);
  });

  it('accepts a registry key for any method and returns key:<id>', async () => {
    const { key, id } = await mintAdminApiKey(ADMIN_EMAIL, 'mcp', 90, 'registry');
    for (const method of ['GET', 'PUT', 'POST', 'DELETE'] as const) {
      const res = await app.inject({ method, url: '/test/registry-write', headers: bearer(key) });
      expect(res.statusCode, method).toBe(200);
      expect(res.json().actor).toBe(`key:${id}`);
    }
  });

  it('refuses a read key on PUT', async () => {
    const { key } = await mintAdminApiKey(ADMIN_EMAIL, 'ro');
    const res = await app.inject({ method: 'PUT', url: '/test/registry-write', headers: bearer(key) });
    expect(res.statusCode).toBe(403);
  });

  it('refuses a revoked registry key', async () => {
    const { key, id } = await mintAdminApiKey(ADMIN_EMAIL, 'mcp', 90, 'registry');
    await dbRun('UPDATE admin_api_keys SET revoked_at = ? WHERE id = ?', Math.floor(Date.now() / 1000), id);
    const res = await app.inject({ method: 'PUT', url: '/test/registry-write', headers: bearer(key) });
    expect(res.statusCode).toBe(403);
  });

  it('refuses no credentials and garbage keys', async () => {
    expect((await app.inject({ method: 'PUT', url: '/test/registry-write' })).statusCode).toBe(403);
    const res = await app.inject({ method: 'PUT', url: '/test/registry-write', headers: bearer('bka_garbage') });
    expect(res.statusCode).toBe(403);
  });
});

describe('requireAdmin stays read-only for keys', () => {
  it('a read key is refused on PUT', async () => {
    const { key } = await mintAdminApiKey(ADMIN_EMAIL, 'ro');
    expect((await app.inject({ method: 'GET', url: '/test/admin', headers: bearer(key) })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url: '/test/admin', headers: bearer(key) })).statusCode).toBe(403);
  });

  it('a registry key is also refused on PUT outside the registry guard', async () => {
    const { key } = await mintAdminApiKey(ADMIN_EMAIL, 'mcp', 90, 'registry');
    expect((await app.inject({ method: 'PUT', url: '/test/admin', headers: bearer(key) })).statusCode).toBe(403);
  });
});
