import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

const ORIGINAL_SECRET = process.env.CLERK_SECRET_KEY;

describe('clerk.ts (real functions, @clerk/backend mocked)', () => {
  beforeEach(() => {
    vi.resetModules();
    verifyTokenMock.mockReset();
    getUserMock.mockReset();
    createClerkClientMock.mockReset();
    createClerkClientMock.mockReturnValue({ users: { getUser: getUserMock } });
    process.env.CLERK_SECRET_KEY = 'test-secret';
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.CLERK_SECRET_KEY;
    } else {
      process.env.CLERK_SECRET_KEY = ORIGINAL_SECRET;
    }
  });

  describe('verifyClerkToken', () => {
    it('returns null when the authorization header is missing', async () => {
      const { verifyClerkToken } = await import('../server/clerk.js');
      expect(await verifyClerkToken(undefined)).toBeNull();
      expect(verifyTokenMock).not.toHaveBeenCalled();
    });

    it('returns null when the header is not a Bearer token', async () => {
      const { verifyClerkToken } = await import('../server/clerk.js');
      expect(await verifyClerkToken('Basic abc123')).toBeNull();
      expect(verifyTokenMock).not.toHaveBeenCalled();
    });

    it('returns null without calling Clerk when CLERK_SECRET_KEY is missing', async () => {
      delete process.env.CLERK_SECRET_KEY;
      const { verifyClerkToken } = await import('../server/clerk.js');
      expect(await verifyClerkToken('Bearer sometoken')).toBeNull();
      expect(verifyTokenMock).not.toHaveBeenCalled();
    });

    it('returns null when verifyToken throws', async () => {
      verifyTokenMock.mockRejectedValue(new Error('invalid token'));
      const { verifyClerkToken } = await import('../server/clerk.js');
      expect(await verifyClerkToken('Bearer badtoken')).toBeNull();
    });

    it('returns the lowercased email for a valid token', async () => {
      verifyTokenMock.mockResolvedValue({ sub: 'user_123' });
      getUserMock.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'User@Example.com' } });
      const { verifyClerkToken } = await import('../server/clerk.js');
      expect(await verifyClerkToken('Bearer goodtoken')).toBe('user@example.com');
      expect(getUserMock).toHaveBeenCalledWith('user_123');
    });

    it('serves subsequent lookups for the same token from cache without calling Clerk again', async () => {
      verifyTokenMock.mockResolvedValue({ sub: 'user_123' });
      getUserMock.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'cached@example.com' } });
      const { verifyClerkToken } = await import('../server/clerk.js');

      expect(await verifyClerkToken('Bearer cachedtoken')).toBe('cached@example.com');
      expect(verifyTokenMock).toHaveBeenCalledTimes(1);

      expect(await verifyClerkToken('Bearer cachedtoken')).toBe('cached@example.com');
      expect(verifyTokenMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('requireAuth', () => {
    function buildApp(handler: (req: any, reply: any) => Promise<unknown>) {
      const app = Fastify({ logger: false });
      app.get('/protected', async (req, reply) => {
        const email = await handler(req, reply);
        if (!email) return;
        return { email };
      });
      return app;
    }

    it('replies 401 when no token is provided', async () => {
      const { requireAuth } = await import('../server/clerk.js');
      const app = buildApp(requireAuth);
      const res = await app.inject({ method: 'GET', url: '/protected' });
      expect(res.statusCode).toBe(401);
    });

    it('replies 401 when the token is invalid', async () => {
      verifyTokenMock.mockRejectedValue(new Error('invalid'));
      const { requireAuth } = await import('../server/clerk.js');
      const app = buildApp(requireAuth);
      const res = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Bearer badtoken' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('real onSend hooks (ERR_HTTP_HEADERS_SENT regression)', () => {
    async function buildHookedApp(
      guard: (req: any, reply: any) => Promise<string | null>,
      path: string,
    ) {
      const { registerSecurityHeaders } = await import('../server/security-headers.js');
      const { registerEgressMeter } = await import('../server/egress.js');
      const { registerStaticCorsTrim } = await import('../server/static-cache.js');
      const app = Fastify({ logger: false });
      registerSecurityHeaders(app);
      registerStaticCorsTrim(app);
      registerEgressMeter(app);
      // Bare `return;` after the guard, exactly like the ~45 production call sites.
      app.get(path, async (req, reply) => {
        const email = await guard(req, reply);
        if (!email) return;
        return { email };
      });
      await app.ready();
      return app;
    }

    async function fireAndWatch(app: Awaited<ReturnType<typeof buildHookedApp>>, url: string, headers?: Record<string, string>) {
      const errors: unknown[] = [];
      const onErr = (e: unknown) => errors.push(e);
      process.on('unhandledRejection', onErr);
      process.on('uncaughtException', onErr);
      try {
        const results = await Promise.all(
          Array.from({ length: 50 }, () => app.inject({ method: 'GET', url, headers })),
        );
        // Let any late async hook rejections surface.
        await new Promise((r) => setTimeout(r, 50));
        return { results, errors };
      } finally {
        process.off('unhandledRejection', onErr);
        process.off('uncaughtException', onErr);
        await app.close();
      }
    }

    it('requireAuth: 50 unauthenticated requests each get exactly one 401, no crash', async () => {
      const { requireAuth } = await import('../server/clerk.js');
      const app = await buildHookedApp(requireAuth, '/protected');
      const { results, errors } = await fireAndWatch(app, '/protected');
      expect(results).toHaveLength(50);
      for (const res of results) {
        expect(res.statusCode).toBe(401);
        expect(res.json()).toEqual({ error: 'Sign in required.' });
      }
      expect(errors.map(String).join('\n')).not.toContain('ERR_HTTP_HEADERS_SENT');
      expect(errors).toEqual([]);
    });

    it('requireAdmin: 50 non-admin requests each get exactly one 403, no crash', async () => {
      verifyTokenMock.mockResolvedValue({ sub: 'user_456' });
      getUserMock.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'nobody@example.com' } });
      const { requireAdmin } = await import('../server/clerk.js');
      const app = await buildHookedApp(requireAdmin, '/admin');
      const { results, errors } = await fireAndWatch(app, '/admin', { authorization: 'Bearer nonadmintoken' });
      expect(results).toHaveLength(50);
      for (const res of results) {
        expect(res.statusCode).toBe(403);
        expect(res.json()).toEqual({ error: 'Admin access required.' });
      }
      expect(errors.map(String).join('\n')).not.toContain('ERR_HTTP_HEADERS_SENT');
      expect(errors).toEqual([]);
    });
  });

  describe('requireAdmin', () => {
    function buildApp(handler: (req: any, reply: any) => Promise<unknown>) {
      const app = Fastify({ logger: false });
      app.get('/admin', async (req, reply) => {
        const email = await handler(req, reply);
        if (!email) return;
        return { email };
      });
      return app;
    }

    it('replies 403 for a valid non-admin token', async () => {
      verifyTokenMock.mockResolvedValue({ sub: 'user_456' });
      getUserMock.mockResolvedValue({ primaryEmailAddress: { emailAddress: 'nobody@example.com' } });
      const { requireAdmin } = await import('../server/clerk.js');
      const app = buildApp(requireAdmin);
      const res = await app.inject({
        method: 'GET',
        url: '/admin',
        headers: { authorization: 'Bearer nonadmintoken' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('passes for an ADMIN_EMAILS member regardless of email case', async () => {
      verifyTokenMock.mockResolvedValue({ sub: 'user_admin' });
      getUserMock.mockResolvedValue({
        primaryEmailAddress: { emailAddress: 'BilkoBibitkov2000@Gmail.com' },
      });
      const { requireAdmin } = await import('../server/clerk.js');
      const app = buildApp(requireAdmin);
      const res = await app.inject({
        method: 'GET',
        url: '/admin',
        headers: { authorization: 'Bearer admintoken' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ email: 'bilkobibitkov2000@gmail.com' });
    });
  });
});
