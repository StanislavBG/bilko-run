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
import { registerPageHitRecorder, flushPageHits, slugFromPath, stableVisitorId, sessionCookie, recordPageHit, backfillVisitorClass, resetProbeVisitorCache, BURST_HITS, BURST_WINDOW_MS } from '../server/page-hits.js';

const app = Fastify({ logger: false });
registerPageHitRecorder(app, { flush: false });

app.get('/projects/outdoor-hours/', async (_req, reply) => reply.type('text/html').send('<html></html>'));
app.get('/app.js', async (_req, reply) => reply.type('application/javascript').send('1'));
app.get('/api/thing', async () => ({ ok: true }));
app.get('/api/other', async () => ({ ok: true }));
app.post('/mcp', async () => ({ ok: true }));
app.get('/llms.txt', async (_req, reply) => reply.type('text/plain').send('hi'));
app.get('/coffee', async (_req, reply) => reply.redirect('https://buy.stripe.com/test_link', 302));
app.get('/other-redirect', async (_req, reply) => reply.redirect('/', 302));

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
    for (const p of ['/bilko', '/hire', '/human-for-hire', '/bilko/']) {
      expect(slugFromPath(p)).toBe('human-for-hire');
    }
    expect(slugFromPath('/bilkos')).toBeNull();
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

describe('visitor class', () => {
  const cls = () => dbAll<{ path: string; visitor_class: string | null; is_bot: number }>('SELECT path, visitor_class, is_bot FROM page_hits ORDER BY id');

  it('stores ai_user_agent for a ChatGPT-User HTML hit', async () => {
    await app.inject({ method: 'GET', url: '/projects/outdoor-hours/', headers: { 'user-agent': 'Mozilla/5.0 ChatGPT-User/1.0' } });
    await settle();
    await flushPageHits();
    expect(await cls()).toEqual([{ path: '/projects/outdoor-hours/', visitor_class: 'ai_user_agent', is_bot: 1 }]);
  });

  it('records POST /mcp as api_client', async () => {
    await app.inject({ method: 'POST', url: '/mcp', headers: { 'user-agent': CHROME }, payload: {} });
    await settle();
    await flushPageHits();
    expect(await cls()).toEqual([{ path: '/mcp', visitor_class: 'api_client', is_bot: 1 }]);
  });

  it('records /llms.txt but not other JSON api requests', async () => {
    await app.inject({ method: 'GET', url: '/llms.txt', headers: { 'user-agent': CHROME } });
    await app.inject({ method: 'GET', url: '/api/other', headers: { 'user-agent': CHROME } });
    await settle();
    await flushPageHits();
    const r = await cls();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ path: '/llms.txt', visitor_class: 'human', is_bot: 0 });
  });

  it('records the /coffee tip redirect (no content-type) with its visitor class, but not other redirects', async () => {
    await app.inject({ method: 'GET', url: '/coffee', headers: { 'user-agent': CHROME, referer: 'https://github.com/x/y' } });
    await app.inject({ method: 'GET', url: '/coffee', headers: { 'user-agent': 'curl/8.5.0' } });
    await app.inject({ method: 'GET', url: '/other-redirect', headers: { 'user-agent': CHROME } });
    await settle();
    await flushPageHits();
    const r = await dbAll<{ path: string; status: number; visitor_class: string; referrer_host: string | null }>(
      'SELECT path, status, visitor_class, referrer_host FROM page_hits ORDER BY id');
    expect(r).toEqual([
      { path: '/coffee', status: 302, visitor_class: 'human', referrer_host: 'github.com' },
      { path: '/coffee', status: 302, visitor_class: 'script', referrer_host: null },
    ]);
  });

  it('uses x-bot-id as api_client', async () => {
    await app.inject({ method: 'GET', url: '/llms.txt', headers: { 'user-agent': CHROME, 'x-bot-id': 'agent-1' } });
    await settle();
    await flushPageHits();
    expect((await cls())[0].visitor_class).toBe('api_client');
  });

  it('backfillVisitorClass fills NULL rows from ua', async () => {
    const ins = (ua: string) => dbRun(
      "INSERT INTO page_hits (ts_ms, date, path, status, visitor_hash, device, browser, os, ua) VALUES (1, '2026-01-01', '/', 200, 'h', 'd', 'b', 'o', ?)", ua);
    await ins('Mozilla/5.0 ChatGPT-User/1.0');
    await ins(CHROME);
    expect(await backfillVisitorClass()).toBe(2);
    const r = await dbAll<{ visitor_class: string }>('SELECT visitor_class FROM page_hits ORDER BY id');
    expect(r.map((x) => x.visitor_class)).toEqual(['ai_user_agent', 'human']);
    expect(await backfillVisitorClass()).toBe(0);
  });
});

describe('probe visitors', () => {
  const DAY = 86_400_000;
  const T0 = Date.UTC(2026, 0, 10, 12);
  const SCANNER = { ip: '192.0.2.50', ua: CHROME, status: 404 };
  const OTHER = { ip: '192.0.2.51', ua: CHROME, status: 200 };
  const hits = () => dbAll<{ path: string; ts_ms: number; ip: string; is_bot: number; visitor_class: string }>(
    'SELECT path, ts_ms, ip, is_bot, visitor_class FROM page_hits ORDER BY ts_ms, id');

  beforeEach(() => { resetProbeVisitorCache(); });

  it('stores a probe hit as script whatever its user agent', async () => {
    recordPageHit({ ...SCANNER, ts: T0, path: '/.env' });
    recordPageHit({ ...SCANNER, ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)', ts: T0, path: '/wp-config.php' });
    await flushPageHits();
    const r = await hits();
    expect(r.map((x) => [x.is_bot, x.visitor_class])).toEqual([[1, 'script'], [1, 'script']]);
  });

  it('flags the earlier same-visitor hits (flushed and buffered) and later ones within 24h', async () => {
    recordPageHit({ ...SCANNER, ts: T0 - 2 * 3600_000, path: '/' });
    recordPageHit({ ...SCANNER, ts: T0 - 2 * DAY, path: '/old' });
    await flushPageHits();
    expect((await hits()).every((x) => x.is_bot === 0)).toBe(true);

    recordPageHit({ ...SCANNER, ts: T0 - 60_000, path: '/blog' });
    recordPageHit({ ...OTHER, ts: T0 - 30_000, path: '/' });
    recordPageHit({ ...SCANNER, ts: T0, path: '/.git/HEAD' });
    recordPageHit({ ...SCANNER, ts: T0 + 3600_000, path: '/projects' });
    recordPageHit({ ...OTHER, ts: T0 + 3600_000, path: '/projects' });
    await flushPageHits();
    const r = await hits();
    const byKey = (path: string, ip: string) => r.find((x) => x.path === path && x.ip === ip);
    expect(byKey('/old', SCANNER.ip)).toMatchObject({ is_bot: 0, visitor_class: 'human' });
    expect(byKey('/', SCANNER.ip)).toMatchObject({ is_bot: 1, visitor_class: 'script' });
    expect(byKey('/blog', SCANNER.ip)).toMatchObject({ is_bot: 1, visitor_class: 'script' });
    expect(byKey('/.git/HEAD', SCANNER.ip)).toMatchObject({ is_bot: 1, visitor_class: 'script' });
    expect(byKey('/projects', SCANNER.ip)).toMatchObject({ is_bot: 1, visitor_class: 'script' });
    expect(byKey('/', OTHER.ip)).toMatchObject({ is_bot: 0, visitor_class: 'human' });
    expect(byKey('/projects', OTHER.ip)).toMatchObject({ is_bot: 0, visitor_class: 'human' });
  });

  it('flags a later hit in a later flush and keeps an already-bot row class', async () => {
    recordPageHit({ ...SCANNER, ua: 'Mozilla/5.0 ChatGPT-User/1.0', ts: T0 - 1000, path: '/' });
    await flushPageHits();
    recordPageHit({ ...SCANNER, ua: 'Mozilla/5.0 ChatGPT-User/1.0', ts: T0, path: '/.env' });
    await flushPageHits();
    recordPageHit({ ...SCANNER, ts: T0 - 5000, path: '/x' }); // different UA: different visitor
    await flushPageHits();
    const r = await hits();
    expect(r.find((x) => x.path === '/')).toMatchObject({ is_bot: 1, visitor_class: 'ai_user_agent' });
    expect(r.find((x) => x.path === '/x')).toMatchObject({ is_bot: 0, visitor_class: 'human' });
    recordPageHit({ ...SCANNER, ua: 'Mozilla/5.0 ChatGPT-User/1.0', ts: T0 + 1000, path: '/later' });
    await flushPageHits();
    expect((await hits()).find((x) => x.path === '/later')).toMatchObject({ is_bot: 1, visitor_class: 'ai_user_agent' });
  });

  it('marks later human-UA hits as script in a later flush, and the mark expires after 24h', async () => {
    recordPageHit({ ...SCANNER, ts: T0, path: '/.env' });
    await flushPageHits();
    recordPageHit({ ...SCANNER, ts: T0 + DAY - 1000, path: '/in' });
    recordPageHit({ ...SCANNER, ts: T0 + DAY + 3600_000, path: '/out' });
    await flushPageHits();
    const r = await hits();
    expect(r.find((x) => x.path === '/in')).toMatchObject({ is_bot: 1, visitor_class: 'script' });
    expect(r.find((x) => x.path === '/out')).toMatchObject({ is_bot: 0, visitor_class: 'human' });
  });
});

describe('burst visitors', () => {
  const T0 = Date.UTC(2026, 0, 20, 12);
  const CRAWLER = { ip: '192.0.2.60', ua: CHROME, status: 200 };
  const OTHER = { ip: '192.0.2.61', ua: CHROME, status: 200 };
  const hits = () => dbAll<{ path: string; ip: string; is_bot: number; visitor_class: string }>(
    'SELECT path, ip, is_bot, visitor_class FROM page_hits ORDER BY ts_ms, id');

  beforeEach(() => { resetProbeVisitorCache(); });

  it('exports the burst threshold', () => {
    expect(BURST_HITS).toBe(20);
    expect(BURST_WINDOW_MS).toBe(60_000);
  });

  it('flags every hit of a visitor with 20 hits inside 60s, including an earlier flushed one', async () => {
    recordPageHit({ ...CRAWLER, ts: T0 - 3600_000, path: '/earlier' });
    await flushPageHits();
    expect((await hits())[0]).toMatchObject({ is_bot: 0, visitor_class: 'human' });
    for (let i = 0; i < BURST_HITS; i++) recordPageHit({ ...CRAWLER, ts: T0 + i * 1000, path: `/p${i}` });
    recordPageHit({ ...OTHER, ts: T0 + 5000, path: '/other' });
    recordPageHit({ ...CRAWLER, ts: T0 + 3600_000, path: '/after' });
    await flushPageHits();
    const r = await hits();
    const mine = r.filter((x) => x.ip === CRAWLER.ip);
    expect(mine).toHaveLength(BURST_HITS + 2);
    expect(mine.every((x) => x.is_bot === 1 && x.visitor_class === 'script')).toBe(true);
    expect(r.find((x) => x.ip === OTHER.ip)).toMatchObject({ is_bot: 0, visitor_class: 'human' });
  });

  it('keeps 19 hits inside 60s human', async () => {
    for (let i = 0; i < BURST_HITS - 1; i++) recordPageHit({ ...CRAWLER, ts: T0 + i * 1000, path: `/p${i}` });
    await flushPageHits();
    const r = await hits();
    expect(r).toHaveLength(BURST_HITS - 1);
    expect(r.every((x) => x.is_bot === 0 && x.visitor_class === 'human')).toBe(true);
  });

  it('keeps 20 hits spread over 10 minutes human', async () => {
    for (let i = 0; i < BURST_HITS; i++) recordPageHit({ ...CRAWLER, ts: T0 + i * 30_000, path: `/p${i}` });
    await flushPageHits();
    const r = await hits();
    expect(r).toHaveLength(BURST_HITS);
    expect(r.every((x) => x.is_bot === 0 && x.visitor_class === 'human')).toBe(true);
  });

  it('does not count another visitor toward the burst', async () => {
    for (let i = 0; i < BURST_HITS / 2; i++) {
      recordPageHit({ ...CRAWLER, ts: T0 + i * 1000, path: `/c${i}` });
      recordPageHit({ ...OTHER, ts: T0 + i * 1000 + 500, path: `/o${i}` });
    }
    await flushPageHits();
    const r = await hits();
    expect(r).toHaveLength(BURST_HITS);
    expect(r.every((x) => x.is_bot === 0 && x.visitor_class === 'human')).toBe(true);
  });

  it('resetProbeVisitorCache clears the burst tracking', async () => {
    for (let i = 0; i < BURST_HITS - 1; i++) recordPageHit({ ...CRAWLER, ts: T0 + i * 1000, path: `/p${i}` });
    resetProbeVisitorCache();
    recordPageHit({ ...CRAWLER, ts: T0 + 20_000, path: '/next' });
    await flushPageHits();
    expect((await hits()).every((x) => x.is_bot === 0)).toBe(true);
  });
});
