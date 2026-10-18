import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const { verifyMock } = vi.hoisted(() => ({ verifyMock: vi.fn() }));
vi.mock('../server/clerk.js', async (orig) => ({
  ...(await orig<typeof import('../server/clerk.js')>()),
  verifyClerkToken: verifyMock,
}));

import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { initDb, dbRun, dbAll } from '../server/db.js';
import { registerPageHitRecorder, flushPageHits, slugFromPath, stableVisitorId, sessionCookie, recordPageHit } from '../server/page-hits.js';

const app = Fastify({ logger: false });
registerPageHitRecorder(app, { flush: false });

app.get('/projects/outdoor-hours/', async (_req, reply) => reply.type('text/html').send('<html></html>'));
app.get('/app.js', async (_req, reply) => reply.type('application/javascript').send('1'));
app.get('/api/thing', async () => ({ ok: true }));

interface Row {
  path: string; slug: string | null; status: number; visitor_hash: string | null;
  device: string | null; is_bot: number; referrer_host: string | null;
}
// onResponse hooks fire just after inject() resolves; yield before flushing.
const settle = () => new Promise((r) => setTimeout(r, 20));
const rows = () => dbAll<Row>('SELECT * FROM page_hits ORDER BY id');

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM page_hits');
  verifyMock.mockReset();
  verifyMock.mockResolvedValue(null);
});

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

describe('slugFromPath', () => {
  it('extracts project slugs only', () => {
    expect(slugFromPath('/projects/outdoor-hours/')).toBe('outdoor-hours');
    expect(slugFromPath('/projects/outdoor-hours/x.html')).toBe('outdoor-hours');
    expect(slugFromPath('/')).toBeNull();
    expect(slugFromPath('/blog/x')).toBeNull();
    expect(slugFromPath('/projects')).toBeNull();
  });
});

describe('page hit recorder', () => {
  it('records an HTML GET with slug, status, device and bot flag', async () => {
    await app.inject({
      method: 'GET', url: '/projects/outdoor-hours/?x=1',
      headers: { 'user-agent': CHROME, referer: 'https://www.Google.com/search' },
    });
    await settle();
    await flushPageHits();
    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      path: '/projects/outdoor-hours/', slug: 'outdoor-hours', status: 200,
      device: 'desktop', is_bot: 0, referrer_host: 'google.com',
    });
  });

  it('skips assets, /api/ responses and HEAD requests', async () => {
    await app.inject({ method: 'GET', url: '/app.js' });
    await app.inject({ method: 'GET', url: '/api/thing' });
    await app.inject({ method: 'HEAD', url: '/projects/outdoor-hours/' });
    await settle();
    await flushPageHits();
    expect(await rows()).toHaveLength(0);
  });

  it('flags Googlebot', async () => {
    await app.inject({
      method: 'GET', url: '/projects/outdoor-hours/',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
    });
    await settle();
    await flushPageHits();
    expect((await rows())[0].is_bot).toBe(1);
  });

  it('shares one hashed visitor per IP+UA per day', async () => {
    const opts = { method: 'GET' as const, url: '/projects/outdoor-hours/', headers: { 'user-agent': CHROME }, remoteAddress: '203.0.113.7' };
    await app.inject(opts);
    await app.inject(opts);
    await settle();
    await flushPageHits();
    const r = await rows();
    expect(r).toHaveLength(2);
    expect(r[0].visitor_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(r[0].visitor_hash).toBe(r[1].visitor_hash);
  });
});

describe('page hit recorder over @fastify/static', () => {
  it('records the static app HTML document but not its assets', async () => {
    const root = mkdtempSync(join(tmpdir(), 'page-hits-static-'));
    mkdirSync(join(root, 'projects', 'demo'), { recursive: true });
    writeFileSync(join(root, 'projects', 'demo', 'index.html'), '<html>demo</html>');
    writeFileSync(join(root, 'projects', 'demo', 'app.js'), 'console.log(1)');

    const app2 = Fastify({ logger: false });
    registerPageHitRecorder(app2, { flush: false });
    await app2.register(staticPlugin, { root });
    await app2.ready();

    const page = await app2.inject({ method: 'GET', url: '/projects/demo/' });
    const asset = await app2.inject({ method: 'GET', url: '/projects/demo/app.js' });
    expect(page.statusCode).toBe(200);
    expect(asset.statusCode).toBe(200);
    await settle();
    await flushPageHits();
    await app2.close();

    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ slug: 'demo', status: 200, path: '/projects/demo/' });
  });
});

interface Detail { ip: string | null; ua: string | null; referrer: string | null; visitor_id: string | null; user_email: string | null; is_admin: number }
const detail = () => dbAll<Detail>('SELECT * FROM page_hits ORDER BY id');
const ADMIN = 'bilkobibitkov2000@gmail.com';

describe('full request detail', () => {
  it('stores ip, ua, referrer and a stable visitor_id', async () => {
    await app.inject({
      method: 'GET', url: '/projects/outdoor-hours/', remoteAddress: '203.0.113.7',
      headers: { 'user-agent': CHROME, referer: 'https://www.google.com/search?q=x' },
    });
    await settle();
    await flushPageHits();
    const [r] = await detail();
    expect(r.ip).toBe('203.0.113.7');
    expect(r.ua).toBe(CHROME);
    expect(r.referrer).toBe('https://www.google.com/search?q=x');
    expect(r.visitor_id).toBe(stableVisitorId('203.0.113.7', CHROME));
    expect(r.visitor_id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('gives the same visitor_id on different dates but different daily hashes', async () => {
    const base = { path: '/', status: 200, ip: '198.51.100.2', ua: CHROME };
    recordPageHit({ ...base, ts: Date.UTC(2026, 0, 1, 12) });
    recordPageHit({ ...base, ts: Date.UTC(2026, 0, 2, 12) });
    await flushPageHits();
    const r = await dbAll<{ visitor_id: string; visitor_hash: string }>('SELECT * FROM page_hits ORDER BY id');
    expect(r).toHaveLength(2);
    expect(r[0].visitor_id).toBe(r[1].visitor_id);
    expect(r[0].visitor_hash).not.toBe(r[1].visitor_hash);
  });

  it('sessionCookie extracts __session', () => {
    expect(sessionCookie('a=1; __session=tok; b=2')).toBe('tok');
    expect(sessionCookie('a=1')).toBeNull();
    expect(sessionCookie(undefined)).toBeNull();
  });

  it('identifies an admin from the __session cookie', async () => {
    verifyMock.mockResolvedValue(ADMIN);
    await app.inject({
      method: 'GET', url: '/projects/outdoor-hours/',
      headers: { 'user-agent': CHROME, cookie: '__session=tok' },
    });
    await settle();
    await flushPageHits();
    expect(verifyMock).toHaveBeenCalledWith('Bearer tok');
    const [r] = await detail();
    expect(r.user_email).toBe(ADMIN);
    expect(r.is_admin).toBe(1);
  });

  it('leaves identity empty without a cookie or when lookup throws', async () => {
    await app.inject({ method: 'GET', url: '/projects/outdoor-hours/', headers: { 'user-agent': CHROME } });
    verifyMock.mockRejectedValue(new Error('boom'));
    await app.inject({ method: 'GET', url: '/projects/outdoor-hours/', headers: { 'user-agent': CHROME, cookie: '__session=bad' } });
    await settle();
    await flushPageHits();
    const r = await detail();
    expect(r).toHaveLength(2);
    for (const x of r) { expect(x.user_email).toBeNull(); expect(x.is_admin).toBe(0); }
  });

  it('never verifies tokens for bots', async () => {
    await app.inject({
      method: 'GET', url: '/projects/outdoor-hours/',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)', cookie: '__session=tok' },
    });
    await settle();
    await flushPageHits();
    expect(verifyMock).not.toHaveBeenCalled();
    expect(await detail()).toHaveLength(1);
  });
});

describe('session identity columns', () => {
  const SID = '11111111-1111-4111-8111-111111111111';
  const VID = '22222222-2222-4222-8222-222222222222';

  it('stores session_id and client_vid from the cookies', async () => {
    await app.inject({
      method: 'GET', url: '/projects/outdoor-hours/',
      headers: { 'user-agent': CHROME, cookie: `bilko_sid=${SID}; bilko_vid=${VID}` },
    });
    await settle();
    await flushPageHits();
    const r = await dbAll<{ session_id: string | null; client_vid: string | null }>('SELECT session_id, client_vid FROM page_hits');
    expect(r).toEqual([{ session_id: SID, client_vid: VID }]);
  });

  it('stores NULL for both with no cookie and no hook', async () => {
    await app.inject({ method: 'GET', url: '/projects/outdoor-hours/', headers: { 'user-agent': CHROME } });
    await settle();
    await flushPageHits();
    const r = await dbAll<{ session_id: string | null; client_vid: string | null }>('SELECT session_id, client_vid FROM page_hits');
    expect(r).toEqual([{ session_id: null, client_vid: null }]);
  });

  it('initDb is idempotent', async () => {
    await initDb();
    await initDb();
  });
});
