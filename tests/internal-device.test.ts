import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';

// Real requireAdmin/requireAdminSession over a mocked Clerk backend: ADMIN_TOKEN is the owner's
// session, USER_TOKEN a signed-in stranger, and any other bearer (including bka_ keys) fails verifyToken.
const { verifyTokenMock, getUserMock, createClerkClientMock } = vi.hoisted(() => ({
  verifyTokenMock: vi.fn(),
  getUserMock: vi.fn(),
  createClerkClientMock: vi.fn(),
}));

vi.mock('@clerk/backend', () => ({
  verifyToken: verifyTokenMock,
  createClerkClient: createClerkClientMock,
}));

import { initDb, dbAll, dbRun } from '../server/db.js';
import { registerAdminInternalDeviceRoutes } from '../server/routes/admin-internal-device.js';
import { mintAdminApiKey } from '../server/services/admin-api-keys.js';
import { loadOwnerIds } from '../server/traffic-filters.js';

const ADMIN_EMAIL = 'bilkobibitkov2000@gmail.com';
const ADMIN_TOKEN = 'clerk-admin-session';
const USER_TOKEN = 'clerk-user-session';
const URL = '/api/admin/internal-device';
const VID = '3f2b8c1e-7d4a-4b9e-9c3f-1a2b3c4d5e6f';
const OTHER_VID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const SID = '0d1e2f3a-4b5c-4d6e-8f70-8192a3b4c5d6';
const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const app = Fastify({ logger: false });
registerAdminInternalDeviceRoutes(app);

beforeAll(async () => {
  process.env.CLERK_SECRET_KEY = 'test-secret';
  createClerkClientMock.mockReturnValue({ users: { getUser: getUserMock } });
  verifyTokenMock.mockImplementation(async (t: string) => {
    if (t === ADMIN_TOKEN) return { sub: 'user_admin' };
    if (t === USER_TOKEN) return { sub: 'user_stranger' };
    throw new Error('invalid token');
  });
  getUserMock.mockImplementation(async (sub: string) => ({
    primaryEmailAddress: { emailAddress: sub === 'user_admin' ? ADMIN_EMAIL : 'stranger@example.com' },
  }));
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM internal_devices');
  await dbRun('DELETE FROM admin_api_keys');
});

type Req = { token?: string; cookie?: string; ua?: string; payload?: unknown };

function headers(o: Req): Record<string, string> {
  const h: Record<string, string> = {};
  if (o.token) h.authorization = `Bearer ${o.token}`;
  if (o.cookie) h.cookie = o.cookie;
  if (o.ua) h['user-agent'] = o.ua;
  return h;
}

const vidCookie = (vid: string) => `theme=dark; bilko_sid=${SID}; bilko_vid=${vid}`;
const get = (o: Req = {}) => app.inject({ method: 'GET', url: URL, headers: headers(o) });
const post = (o: Req = {}) =>
  app.inject({ method: 'POST', url: URL, headers: headers(o), ...(o.payload === undefined ? {} : { payload: o.payload as object }) });
const del = (o: Req = {}) => app.inject({ method: 'DELETE', url: URL, headers: headers(o) });

const rows = () =>
  dbAll<{ visitor_id: string; label: string | null; marked_at_ms: number }>(
    'SELECT visitor_id, label, marked_at_ms FROM internal_devices ORDER BY visitor_id',
  );

async function seedMark(visitorId: string, label: string | null, markedAtMs: number) {
  await dbRun('INSERT INTO internal_devices (visitor_id, label, marked_at_ms) VALUES (?, ?, ?)', visitorId, label, markedAtMs);
}

describe('POST /api/admin/internal-device', () => {
  it('marks the bilko_vid cookie id, then GET shows this device marked', async () => {
    const before = await get({ token: ADMIN_TOKEN, cookie: vidCookie(VID) });
    expect(before.statusCode).toBe(200);
    expect(before.json()).toEqual({ current: { visitorId: VID, marked: false }, devices: [] });

    const t0 = Date.now();
    const res = await post({ token: ADMIN_TOKEN, cookie: vidCookie(VID), ua: MAC_CHROME });
    const t1 = Date.now();
    expect(res.statusCode).toBe(200);
    expect(res.json().current).toEqual({ visitorId: VID, marked: true });

    const after = await get({ token: ADMIN_TOKEN, cookie: vidCookie(VID) });
    expect(after.statusCode).toBe(200);
    const body = after.json() as { current: unknown; devices: Array<{ visitorId: string; label: string | null; markedAtMs: number }> };
    expect(body.current).toEqual({ visitorId: VID, marked: true });
    expect(body.devices).toHaveLength(1);
    expect(body.devices[0]).toEqual({ visitorId: VID, label: 'Chrome on Mac', markedAtMs: expect.any(Number) });
    expect(body.devices[0].markedAtMs).toBeGreaterThanOrEqual(t0);
    expect(body.devices[0].markedAtMs).toBeLessThanOrEqual(t1);

    // The mark reaches the owner filter's cookie ids.
    expect((await loadOwnerIds()).cookieIds).toContain(VID);
  });

  it('stores an explicit label trimmed to 80 characters, and refuses a non-string label', async () => {
    const res = await post({ token: ADMIN_TOKEN, cookie: vidCookie(VID), payload: { label: `  ${'x'.repeat(100)}  ` } });
    expect(res.statusCode).toBe(200);
    expect((await rows())[0].label).toBe('x'.repeat(80));

    const bad = await post({ token: ADMIN_TOKEN, cookie: vidCookie(OTHER_VID), payload: { label: 42 } });
    expect(bad.statusCode).toBe(400);
    expect((await rows()).map((r) => r.visitor_id)).toEqual([VID]);
  });

  it('marking an already-marked device keeps its first mark time and takes a new label only when given', async () => {
    await seedMark(VID, 'work laptop', 1_000);
    expect((await post({ token: ADMIN_TOKEN, cookie: vidCookie(VID), ua: MAC_CHROME })).statusCode).toBe(200);
    expect(await rows()).toEqual([{ visitor_id: VID, label: 'work laptop', marked_at_ms: 1_000 }]);

    expect((await post({ token: ADMIN_TOKEN, cookie: vidCookie(VID), payload: { label: 'home desktop' } })).statusCode).toBe(200);
    expect(await rows()).toEqual([{ visitor_id: VID, label: 'home desktop', marked_at_ms: 1_000 }]);
  });
});

describe('DELETE /api/admin/internal-device', () => {
  it('unmarks only the requesting device', async () => {
    await seedMark(VID, 'laptop', 2_000);
    await seedMark(OTHER_VID, 'phone', 1_000);

    const res = await del({ token: ADMIN_TOKEN, cookie: vidCookie(VID) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      current: { visitorId: VID, marked: false },
      devices: [{ visitorId: OTHER_VID, label: 'phone', markedAtMs: 1_000 }],
    });
    expect((await get({ token: ADMIN_TOKEN, cookie: vidCookie(VID) })).json().current).toEqual({ visitorId: VID, marked: false });
    expect((await rows()).map((r) => r.visitor_id)).toEqual([OTHER_VID]);
  });
});

describe('GET /api/admin/internal-device', () => {
  it('lists every marked device, newest mark first, and reports a browser with no cookie as unmarked', async () => {
    await seedMark(OTHER_VID, null, 1_000);
    await seedMark(VID, 'laptop', 5_000);
    const res = await get({ token: ADMIN_TOKEN });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      current: { visitorId: null, marked: false },
      devices: [
        { visitorId: VID, label: 'laptop', markedAtMs: 5_000 },
        { visitorId: OTHER_VID, label: null, markedAtMs: 1_000 },
      ],
    });
  });
});

describe('a request without a valid bilko_vid', () => {
  for (const cookie of [undefined, 'bilko_vid=not-a-uuid', `bilko_sid=${SID}`, 'bilko_vid=']) {
    it(`gets 400 on POST and DELETE (cookie: ${cookie ?? 'none'})`, async () => {
      await seedMark(VID, 'laptop', 1_000);
      const p = await post({ token: ADMIN_TOKEN, cookie });
      expect(p.statusCode).toBe(400);
      expect(p.json().error).toMatch(/bilko_vid/);
      const d = await del({ token: ADMIN_TOKEN, cookie });
      expect(d.statusCode).toBe(400);
      expect(d.json().error).toMatch(/bilko_vid/);
      expect((await rows()).map((r) => r.visitor_id)).toEqual([VID]);
    });
  }
});

describe('auth', () => {
  it('refuses unauthenticated, invalid and non-admin requests on every method', async () => {
    await seedMark(OTHER_VID, 'phone', 1_000);
    for (const token of [undefined, 'not-a-real-session', USER_TOKEN]) {
      const p = await post({ token, cookie: vidCookie(VID) });
      expect(p.statusCode, `POST ${token}`).toBe(403);
      const d = await del({ token, cookie: vidCookie(OTHER_VID) });
      expect(d.statusCode, `DELETE ${token}`).toBe(403);
      const g = await get({ token, cookie: vidCookie(VID) });
      expect(g.statusCode, `GET ${token}`).toBe(403);
      expect(g.body).not.toContain(OTHER_VID);
    }
    expect((await rows()).map((r) => r.visitor_id)).toEqual([OTHER_VID]);
  });

  it('refuses a personal admin API key on POST and DELETE, but lets it read', async () => {
    const { key } = await mintAdminApiKey(ADMIN_EMAIL, 'test');
    await seedMark(OTHER_VID, 'phone', 1_000);

    const p = await post({ token: key, cookie: vidCookie(VID) });
    expect(p.statusCode).toBe(403);
    const d = await del({ token: key, cookie: vidCookie(OTHER_VID) });
    expect(d.statusCode).toBe(403);
    expect((await rows()).map((r) => r.visitor_id)).toEqual([OTHER_VID]);

    // The key itself is valid: the same key reads the list.
    const g = await get({ token: key, cookie: vidCookie(OTHER_VID) });
    expect(g.statusCode).toBe(200);
    expect(g.json().current).toEqual({ visitorId: OTHER_VID, marked: true });
  });
});
