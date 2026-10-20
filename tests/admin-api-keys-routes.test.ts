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
import { registerObservabilityRoutes } from '../server/routes/admin-observability.js';
import { registerAdminApiKeyRoutes } from '../server/routes/admin-api-keys.js';
import { mintAdminApiKey } from '../server/services/admin-api-keys.js';

const ADMIN_EMAIL = 'bilkobibitkov2000@gmail.com';
const CLERK_TOKEN = 'clerk-session-token';

const app = Fastify({ logger: false });
registerObservabilityRoutes(app);
registerAdminApiKeyRoutes(app);

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

describe('admin API keys on admin routes', () => {
  it('a valid key can GET admin endpoints', async () => {
    const { key } = await mintAdminApiKey(ADMIN_EMAIL, 'test');
    const res = await app.inject({ method: 'GET', url: '/api/admin/observability/errors', headers: bearer(key) });
    expect(res.statusCode).toBe(200);
  });

  it('a valid key cannot mint keys (403 read-only)', async () => {
    const { key } = await mintAdminApiKey(ADMIN_EMAIL, 'test');
    const res = await app.inject({ method: 'POST', url: '/api/admin/api-keys', headers: bearer(key), payload: {} });
    expect(res.statusCode).toBe(403);
  });

  it('a valid key cannot list keys either (session only)', async () => {
    const { key } = await mintAdminApiKey(ADMIN_EMAIL, 'test');
    const res = await app.inject({ method: 'GET', url: '/api/admin/api-keys', headers: bearer(key) });
    expect(res.statusCode).toBe(403);
  });

  it('a valid key on a non-GET admin route gets the read-only message', async () => {
    const { key } = await mintAdminApiKey(ADMIN_EMAIL, 'test');
    const res = await app.inject({ method: 'POST', url: '/api/admin/api-keys/1/revoke', headers: bearer(key) });
    expect(res.statusCode).toBe(403);
  });

  it('a revoked key is 403', async () => {
    const { key, id } = await mintAdminApiKey(ADMIN_EMAIL, 'test');
    await dbRun('UPDATE admin_api_keys SET revoked_at = ? WHERE id = ?', Math.floor(Date.now() / 1000), id);
    const res = await app.inject({ method: 'GET', url: '/api/admin/observability/errors', headers: bearer(key) });
    expect(res.statusCode).toBe(403);
  });

  it('a garbage bka_ key is 403', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/observability/errors', headers: bearer('bka_garbage') });
    expect(res.statusCode).toBe(403);
  });
});

describe('/api/admin/api-keys with a Clerk admin session', () => {
  it('mints a key that then works', async () => {
    const mint = await app.inject({
      method: 'POST', url: '/api/admin/api-keys', headers: bearer(CLERK_TOKEN),
      payload: { label: 'mcp', ttlDays: 30 },
    });
    expect(mint.statusCode).toBe(200);
    const body = mint.json();
    expect(body.key).toMatch(/^bka_/);
    expect(body.prefix).toBe(body.key.slice(0, 12));
    expect(typeof body.id).toBe('number');
    expect(typeof body.expiresAt).toBe('number');

    const read = await app.inject({ method: 'GET', url: '/api/admin/observability/errors', headers: bearer(body.key) });
    expect(read.statusCode).toBe(200);

    const list = await app.inject({ method: 'GET', url: '/api/admin/api-keys', headers: bearer(CLERK_TOKEN) });
    expect(list.statusCode).toBe(200);
    expect(JSON.stringify(list.json())).not.toContain(body.key);
    expect(list.json().some((k: any) => k.id === body.id)).toBe(true);
  });

  it('rejects a bad body', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/admin/api-keys', headers: bearer(CLERK_TOKEN), payload: { ttlDays: 'x' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('revoke works for the owner, then the key stops working', async () => {
    const { key, id } = await mintAdminApiKey(ADMIN_EMAIL, 'x');
    const res = await app.inject({ method: 'POST', url: `/api/admin/api-keys/${id}/revoke`, headers: bearer(CLERK_TOKEN) });
    expect(res.statusCode).toBe(200);
    const read = await app.inject({ method: 'GET', url: '/api/admin/observability/errors', headers: bearer(key) });
    expect(read.statusCode).toBe(403);
  });

  it("revoke of another email's key is 404", async () => {
    const { id } = await mintAdminApiKey('other@example.com', 'x');
    const res = await app.inject({ method: 'POST', url: `/api/admin/api-keys/${id}/revoke`, headers: bearer(CLERK_TOKEN) });
    expect(res.statusCode).toBe(404);
  });
});
