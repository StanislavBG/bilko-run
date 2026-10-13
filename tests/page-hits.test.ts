import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun, dbAll } from '../server/db.js';
import { registerPageHitRecorder, flushPageHits, slugFromPath } from '../server/page-hits.js';

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

  it('shares one hashed visitor per IP+UA per day and stores no IP', async () => {
    const opts = { method: 'GET' as const, url: '/projects/outdoor-hours/', headers: { 'user-agent': CHROME }, remoteAddress: '203.0.113.7' };
    await app.inject(opts);
    await app.inject(opts);
    await settle();
    await flushPageHits();
    const r = await rows();
    expect(r).toHaveLength(2);
    expect(r[0].visitor_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(r[0].visitor_hash).toBe(r[1].visitor_hash);
    expect(JSON.stringify(r)).not.toContain('203.0.113.7');
    expect(JSON.stringify(r)).not.toContain('Windows NT');
  });
});
