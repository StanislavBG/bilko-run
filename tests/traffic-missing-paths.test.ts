import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun } from '../server/db.js';
import { registerObservabilityRoutes } from '../server/routes/admin-observability.js';

// notFoundPaths lists the top 404 paths in the window (bots included) so the admin
// can see which files scanners asked for, not just how many 404s there were.

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return { ...original, requireAdmin: vi.fn().mockImplementation(async () => 'bilkobibitkov2000@gmail.com') };
});

const app = Fastify({ logger: false });
registerObservabilityRoutes(app);

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM page_hits');
  await dbRun('DELETE FROM page_views');
  await dbRun('DELETE FROM click_events');
});

const day = (ts: number) => new Date(ts).toISOString().slice(0, 10);

async function hit(o: { path: string; status?: number; vid: string; bot?: number; isAdmin?: number; ago?: number }) {
  const ts = Date.now() - (o.ago ?? 60_000);
  await dbRun(
    `INSERT INTO page_hits (ts_ms, date, path, slug, status, referrer_host, visitor_hash, country, device, browser, os, is_bot, visitor_id, is_admin)
     VALUES (?, ?, ?, NULL, ?, NULL, ?, 'US', 'desktop', 'Chrome', 'Linux', ?, ?, ?)`,
    ts, day(ts), o.path, o.status ?? 404, `hash-${o.vid}`, o.bot ?? 0, o.vid, o.isAdmin ?? 0,
  );
}

type Row = { path: string; hits: number; botHits: number; visitors: number };

async function traffic(qs = '') {
  const res = await app.inject({ method: 'GET', url: `/api/admin/traffic${qs}` });
  expect(res.statusCode).toBe(200);
  return JSON.parse(res.body) as { notFoundPaths: Row[]; totals: { notFound: number; botHits: number } };
}

async function seed() {
  // /.env: 3 bot hits from one scanner + 1 human hit from another visitor.
  await hit({ path: '/.env', vid: 'scanner', bot: 1 });
  await hit({ path: '/.env', vid: 'scanner', bot: 1 });
  await hit({ path: '/.env', vid: 'scanner', bot: 1 });
  await hit({ path: '/.env', vid: 'human' });
  // /backup.sql and /.ssh/id_rsa tie on 2 hits; ordered by path asc.
  await hit({ path: '/backup.sql', vid: 'scanner', bot: 1 });
  await hit({ path: '/backup.sql', vid: 'human' });
  await hit({ path: '/.ssh/id_rsa', vid: 'scanner', bot: 1 });
  await hit({ path: '/.ssh/id_rsa', vid: 'scanner', bot: 1 });
  // Owner 404.
  await hit({ path: '/old-link', vid: 'owner', isAdmin: 1 });
  // 200s never appear.
  await hit({ path: '/', status: 200, vid: 'human' });
  await hit({ path: '/', status: 200, vid: 'scanner', bot: 1 });
  // Older than the 7-day window.
  await hit({ path: '/wp-admin/install.php', vid: 'scanner', bot: 1, ago: 8 * 86_400_000 });
}

describe('/api/admin/traffic notFoundPaths', () => {
  it('lists only in-window 404 paths with hits, botHits and visitors, ordered by hits then path', async () => {
    await seed();
    const body = await traffic();
    expect(body.notFoundPaths).toEqual([
      { path: '/.env', hits: 4, botHits: 3, visitors: 2 },
      { path: '/.ssh/id_rsa', hits: 2, botHits: 2, visitors: 1 },
      { path: '/backup.sql', hits: 2, botHits: 1, visitors: 2 },
      { path: '/old-link', hits: 1, botHits: 0, visitors: 1 },
    ]);
  });

  it('mine=exclude drops the owner row; bots=exclude keeps bot rows', async () => {
    await seed();
    const mine = await traffic('?mine=exclude');
    expect(mine.notFoundPaths.map(r => r.path)).not.toContain('/old-link');
    expect(mine.notFoundPaths).toHaveLength(3);

    const noBots = await traffic('?bots=exclude');
    expect(noBots.notFoundPaths.find(r => r.path === '/.env')).toEqual({ path: '/.env', hits: 4, botHits: 3, visitors: 2 });
  });

  it('caps the list at 25 rows', async () => {
    for (let i = 0; i < 30; i++) await hit({ path: `/scan-${String(i).padStart(2, '0')}`, vid: 'scanner', bot: 1 });
    await hit({ path: '/scan-29', vid: 'scanner', bot: 1 });
    const body = await traffic();
    expect(body.notFoundPaths).toHaveLength(25);
    expect(body.notFoundPaths[0]).toEqual({ path: '/scan-29', hits: 2, botHits: 2, visitors: 1 });
    expect(body.notFoundPaths[1].path).toBe('/scan-00');
    expect(body.notFoundPaths[24].path).toBe('/scan-23');
  });

  it('returns [] when there are no 404s', async () => {
    await hit({ path: '/', status: 200, vid: 'human' });
    expect((await traffic()).notFoundPaths).toEqual([]);
  });
});
