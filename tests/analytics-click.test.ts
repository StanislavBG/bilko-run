import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun, dbGet, dbAll } from '../server/db.js';
import { registerAnalyticsRoutes } from '../server/routes/analytics.js';

const app = Fastify({ logger: false });
registerAnalyticsRoutes(app);

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM click_events');
});

const postJson = (payload: unknown) =>
  app.inject({ method: 'POST', url: '/api/analytics/click', payload: payload as Record<string, unknown> });

describe('POST /api/analytics/click', () => {
  it('stores a valid JSON click with slug and visitor_hash', async () => {
    const res = await postJson({
      path: '/projects/sudoku/play', tag: 'A', id: 'cta', label: '  Start   the\n game ', href: 'https://example.com/x',
      extra: 'ignored',
    });
    expect(res.statusCode).toBe(204);
    const row = await dbGet<Record<string, any>>('SELECT * FROM click_events');
    expect(row?.path).toBe('/projects/sudoku/play');
    expect(row?.slug).toBe('sudoku');
    expect(row?.tag).toBe('a');
    expect(row?.el_id).toBe('cta');
    expect(row?.label).toBe('Start the game');
    expect(row?.href).toBe('https://example.com/x');
    expect(row?.visitor_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(row?.is_bot).toBe(0);
  });

  it('computes slug for static-path pages', async () => {
    await postJson({ path: '/projects/sudoku/', tag: 'button' });
    const row = await dbGet<{ slug: string }>('SELECT slug FROM click_events');
    expect(row?.slug).toBe('sudoku');
  });

  it('accepts a text/plain JSON body (sendBeacon)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analytics/click',
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
      payload: JSON.stringify({ path: '/blog', tag: 'a', href: '/blog/x' }),
    });
    expect(res.statusCode).toBe(204);
    const row = await dbGet<{ path: string; href: string }>('SELECT path, href FROM click_events');
    expect(row?.path).toBe('/blog');
    expect(row?.href).toBe('/blog/x');
  });

  it('nulls non-http(s) hrefs', async () => {
    await postJson({ path: '/a', tag: 'a', href: 'javascript:alert(1)' });
    await postJson({ path: '/a', tag: 'a', href: 'data:text/html,x' });
    const rows = await dbAll<{ href: string | null }>('SELECT href FROM click_events');
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.href === null)).toBe(true);
  });

  it('returns 400 when path is missing or not root-relative', async () => {
    expect((await postJson({ tag: 'a' })).statusCode).toBe(400);
    expect((await postJson({ path: 'nope', tag: 'a' })).statusCode).toBe(400);
    const row = await dbGet<{ n: number }>('SELECT COUNT(*) AS n FROM click_events');
    expect(row?.n).toBe(0);
  });

  it('stops inserting once the per-IP limit is exceeded', async () => {
    for (let i = 0; i < 650; i++) {
      const res = await postJson({ path: '/flood', tag: 'a' });
      expect(res.statusCode).toBe(204);
    }
    const row = await dbGet<{ n: number }>('SELECT COUNT(*) AS n FROM click_events');
    expect(row!.n).toBeGreaterThan(0);
    expect(row!.n).toBeLessThan(650);
  });
});
