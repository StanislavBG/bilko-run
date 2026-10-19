import Fastify from 'fastify';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  VID_COOKIE,
  SID_COOKIE,
  VID_MAX_AGE_S,
  SID_IDLE_S,
  isValidId,
  readSessionIds,
  registerSessionIdentity,
} from '../server/session-identity.js';

const HTML = '<html><head></head></html>';
const V = '11111111-2222-4333-8444-555555555555';
const S = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const app = Fastify({ logger: false });

function setCookies(res: { headers: Record<string, any> }): string[] {
  const v = res.headers['set-cookie'];
  return v === undefined ? [] : Array.isArray(v) ? v : [String(v)];
}
function find(cookies: string[], name: string): string | undefined {
  return cookies.find(c => c.startsWith(`${name}=`));
}
function valueOf(cookie: string): string {
  return cookie.split(';')[0].split('=')[1];
}

beforeAll(async () => {
  registerSessionIdentity(app);
  app.get('/page', async (_req, reply) => reply.type('text/html').send(HTML));
  app.get('/api/page', async (_req, reply) => reply.type('text/html').send(HTML));
  app.get('/apiary', async (_req, reply) => reply.type('text/html').send(HTML));
  app.get('/api', async (_req, reply) => reply.type('text/html').send(HTML));
  app.get('/json', async () => ({ ok: true }));
  app.get('/with-cookie', async (_req, reply) =>
    reply.type('text/html').header('set-cookie', 'other=1; Path=/').send(HTML));
  app.get('/ids', async (req) => req.bilkoIds);
  app.post('/post', async (_req, reply) => reply.type('text/html').send(HTML));
  await app.ready();
});
afterAll(() => app.close());

describe('session identity', () => {
  it('exports the contract constants', () => {
    expect(VID_COOKIE).toBe('bilko_vid');
    expect(SID_COOKIE).toBe('bilko_sid');
    expect(VID_MAX_AGE_S).toBe(31536000);
    expect(SID_IDLE_S).toBe(1800);
  });

  it('mints both cookies on first HTML GET', async () => {
    const res = await app.inject({ method: 'GET', url: '/page' });
    const cookies = setCookies(res);
    const vid = find(cookies, VID_COOKIE)!;
    const sid = find(cookies, SID_COOKIE)!;
    expect(isValidId(valueOf(vid))).toBe(true);
    expect(isValidId(valueOf(sid))).toBe(true);
    expect(vid).toContain('Max-Age=31536000');
    expect(sid).toContain('Max-Age=1800');
    for (const c of [vid, sid]) {
      expect(c).toContain('Path=/');
      expect(c).toContain('SameSite=Lax');
      expect(c).not.toMatch(/HttpOnly/i);
      expect(c).not.toContain('Secure');
    }
  });

  it('adds Secure when forwarded as https', async () => {
    const res = await app.inject({ method: 'GET', url: '/page', headers: { 'x-forwarded-proto': 'https' } });
    for (const c of setCookies(res)) expect(c).toContain('Secure');
  });

  it('reuses valid cookies and refreshes the sliding window', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/page',
      headers: { cookie: `${VID_COOKIE}=${V}; ${SID_COOKIE}=${S}` },
    });
    const cookies = setCookies(res);
    expect(valueOf(find(cookies, VID_COOKIE)!)).toBe(V);
    expect(valueOf(find(cookies, SID_COOKIE)!)).toBe(S);
    expect(find(cookies, SID_COOKIE)).toContain('Max-Age=1800');
  });

  it('exposes bilkoIds on the request', async () => {
    const minted = (await app.inject({ method: 'GET', url: '/ids' })).json();
    expect(minted.mintedVisitor).toBe(true);
    expect(minted.mintedSession).toBe(true);
    const kept = (await app.inject({
      method: 'GET',
      url: '/ids',
      headers: { cookie: `${VID_COOKIE}=${V}; ${SID_COOKIE}=${S}` },
    })).json();
    expect(kept).toEqual({ visitorId: V, sessionId: S, mintedVisitor: false, mintedSession: false });
  });

  it('replaces a malformed cookie value with a fresh UUID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/page',
      headers: { cookie: `${VID_COOKIE}=<script>; ${SID_COOKIE}=${S}` },
    });
    const cookies = setCookies(res);
    const v = valueOf(find(cookies, VID_COOKIE)!);
    expect(v).not.toContain('<');
    expect(isValidId(v)).toBe(true);
    expect(valueOf(find(cookies, SID_COOKIE)!)).toBe(S);
  });

  it('sets no cookies on /api/*, non-HTML, 404 or non-GET responses', async () => {
    expect(setCookies(await app.inject({ method: 'GET', url: '/api/page' }))).toEqual([]);
    expect(setCookies(await app.inject({ method: 'GET', url: '/json' }))).toEqual([]);
    const nf = await app.inject({ method: 'GET', url: '/missing' });
    expect(nf.statusCode).toBe(404);
    expect(setCookies(nf)).toEqual([]);
    expect(setCookies(await app.inject({ method: 'POST', url: '/post' }))).toEqual([]);
  });

  it('excludes exactly /api and /api/*, not look-alike paths', async () => {
    expect(setCookies(await app.inject({ method: 'GET', url: '/api' }))).toEqual([]);
    expect(setCookies(await app.inject({ method: 'GET', url: '/api?x=1' }))).toEqual([]);
    expect(find(setCookies(await app.inject({ method: 'GET', url: '/apiary' })), VID_COOKIE)).toBeDefined();
  });

  it('preserves a Set-Cookie already set by the route', async () => {
    const cookies = setCookies(await app.inject({ method: 'GET', url: '/with-cookie' }));
    expect(cookies).toContain('other=1; Path=/');
    expect(find(cookies, VID_COOKIE)).toBeDefined();
    expect(find(cookies, SID_COOKIE)).toBeDefined();
  });
});

describe('readSessionIds', () => {
  it('parses a multi-cookie header', () => {
    expect(readSessionIds(`a=1; ${VID_COOKIE}=${V}; b=2; ${SID_COOKIE}=${S}`)).toEqual({ visitorId: V, sessionId: S });
  });
  it('returns null for absent or invalid values', () => {
    expect(readSessionIds(undefined)).toEqual({ visitorId: null, sessionId: null });
    expect(readSessionIds(`${VID_COOKIE}=<script>; ${SID_COOKIE}=nope`)).toEqual({ visitorId: null, sessionId: null });
  });
  it('isValidId rejects non-strings and bad shapes', () => {
    expect(isValidId(42)).toBe(false);
    expect(isValidId(`${V}x`)).toBe(false);
    expect(isValidId(V)).toBe(true);
  });
});
