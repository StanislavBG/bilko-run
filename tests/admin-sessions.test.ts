import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun } from '../server/db.js';
import { registerAdminSessionRoutes } from '../server/routes/admin-sessions.js';

vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  return {
    ...original,
    requireAdmin: vi.fn().mockImplementation(async (_req: any, reply: any) => {
      reply.status(403).send({ error: 'Admin access required.' });
      return null;
    }),
  };
});

import { requireAdmin } from '../server/clerk.js';
const mockAdmin = requireAdmin as ReturnType<typeof vi.fn>;
const asAdmin = () => mockAdmin.mockImplementation(async () => 'admin@example.com');

const SID = '11111111-1111-4111-8111-111111111111';
const SID2 = '22222222-2222-4222-8222-222222222222';
const VID = '33333333-3333-4333-8333-333333333333';

const app = Fastify({ logger: false });
registerAdminSessionRoutes(app);

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  for (const t of ['sessions', 'page_views', 'click_events', 'funnel_events', 'app_errors']) {
    await dbRun(`DELETE FROM ${t}`);
  }
  asAdmin();
  const now = Date.now();
  const t0 = now - 60_000;
  await dbRun(
    `INSERT INTO sessions (session_id, visitor_id, started_at, ended_at, landing_path, exit_path, page_count, email)
     VALUES (?, ?, ?, ?, '/', '/projects/sudoku/', 2, 'a@b.co')`,
    SID, VID, t0, t0 + 50_000,
  );
  await dbRun(
    `INSERT INTO sessions (session_id, visitor_id, started_at, ended_at, landing_path, exit_path, page_count)
     VALUES (?, ?, ?, ?, '/blog', '/blog', 1)`,
    SID2, VID, now - 120_000, now - 110_000,
  );
  const pv = (p: string, ms: number, sid = SID) => dbRun(
    `INSERT INTO page_views (path, referrer, date, session_id, created_at_ms) VALUES (?, 'ref', '2026-10-18', ?, ?)`, p, sid, ms);
  await pv('/', t0);
  await pv('/projects/sudoku/', t0 + 10_000);
  await pv('/products/session-manager', t0 + 20_000);
  await pv('/blog', now - 120_000, SID2);
  await dbRun(
    `INSERT INTO click_events (ts_ms, date, path, label, href, session_id, track_name)
     VALUES (?, '2026-10-18', '/', 'Go', '/projects/sudoku/', ?, 'hero_cta')`, t0 + 5_000, SID);
  // funnel_events.created_at is UTC text; pick t0+15s
  const iso = new Date(Math.floor((t0 + 15_000) / 1000) * 1000).toISOString().slice(0, 19).replace('T', ' ');
  await dbRun(
    `INSERT INTO funnel_events (event, tool, metadata, created_at, session_id, path) VALUES ('game_start', 'sudoku', '{"level":3}', ?, ?, '/projects/sudoku/')`,
    iso, SID);
  await dbRun(
    `INSERT INTO app_errors (app, name, msg, url, session_id, created_at) VALUES ('sudoku', 'TypeError', 'boom', '/projects/sudoku/', ?, ?)`,
    SID, Math.floor((t0 + 25_000) / 1000));
});

describe('admin sessions', () => {
  it('rejects non-admins on both routes', async () => {
    mockAdmin.mockImplementation(async (_r: any, reply: any) => { reply.status(401).send({ error: 'no' }); return null; });
    expect((await app.inject({ method: 'GET', url: '/api/admin/sessions' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: `/api/admin/sessions/${SID}` })).statusCode).toBe(401);
  });

  it('lists sessions with counts and apps, newest first', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/sessions' });
    expect(res.statusCode).toBe(200);
    const { sessions } = res.json();
    expect(sessions.map((s: any) => s.session_id)).toEqual([SID, SID2]);
    expect(sessions[0]).toMatchObject({
      click_count: 1, event_count: 1, error_count: 1, duration_ms: 50_000,
      apps: ['session-manager', 'sudoku'], email: 'a@b.co',
    });
    expect(sessions[1].apps).toEqual([]);
  });

  it('filters by app', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/sessions?app=sudoku' });
    expect(res.json().sessions.map((s: any) => s.session_id)).toEqual([SID]);
    const none = await app.inject({ method: 'GET', url: '/api/admin/sessions?app=nope' });
    expect(none.json().sessions).toEqual([]);
  });

  it('400s on an invalid app value', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/admin/sessions?app=bad%20slug' })).statusCode).toBe(400);
  });

  it('matches % and _ in the app filter literally', async () => {
    const t = Date.now() - 30_000;
    const S3 = '55555555-5555-4555-8555-555555555555';
    const S4 = '66666666-6666-4666-8666-666666666666';
    for (const [sid, p] of [[S3, '/projects/my_app/'], [S4, '/projects/myXapp/']]) {
      await dbRun(
        `INSERT INTO sessions (session_id, visitor_id, started_at, ended_at, page_count) VALUES (?, ?, ?, ?, 1)`,
        sid, VID, t, t + 1000);
      await dbRun(
        `INSERT INTO page_views (path, referrer, date, session_id, created_at_ms) VALUES (?, 'ref', '2026-10-18', ?, ?)`,
        p, sid, t);
    }
    const res = await app.inject({ method: 'GET', url: '/api/admin/sessions?app=my_app' });
    expect(res.json().sessions.map((s: any) => s.session_id)).toEqual([S3]);
    const pct = await app.inject({ method: 'GET', url: '/api/admin/sessions?app=my%25app' });
    expect(pct.statusCode).toBe(400);
  });

  it('returns apps on the session detail from page views only', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/admin/sessions/${SID}` });
    expect(res.json().apps).toEqual(['session-manager', 'sudoku']);
    const none = await app.inject({ method: 'GET', url: `/api/admin/sessions/${SID2}` });
    expect(none.json().apps).toEqual([]);
  });

  it('returns a merged ascending timeline', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/admin/sessions/${SID}` });
    expect(res.statusCode).toBe(200);
    const { session, timeline } = res.json();
    expect(session.session_id).toBe(SID);
    expect(timeline.map((t: any) => t.kind)).toEqual(['view', 'click', 'view', 'event', 'view', 'error']);
    const ts = timeline.map((t: any) => t.ts);
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);
    expect(timeline[1]).toMatchObject({ label: 'Go', track_name: 'hero_cta' });
    expect(timeline[3]).toMatchObject({ name: 'game_start', app: 'sudoku', props: { level: 3 } });
    expect(timeline[5]).toMatchObject({ app: 'sudoku', msg: 'boom' });
  });

  describe('flows', () => {
    const seedFlow = async () => {
      const iso = (offset: number) =>
        new Date(Math.floor((Date.now() - 600_000 + offset) / 1000) * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const steps: [string, number, number][] = [['open', 10, 0], ['play', 6, 1000], ['win', 2, 2000]];
      for (const [step, n, off] of steps) {
        for (let i = 0; i < n; i++) {
          await dbRun(
            `INSERT INTO funnel_events (event, tool, metadata, created_at, session_id) VALUES (?, 'flowapp', ?, ?, ?)`,
            `main.${step}`, JSON.stringify({ flow: 'main', step }), iso(off), `flow-sess-${i}`);
        }
      }
    };

    it('returns a seeded funnel ordered by sessions', async () => {
      await seedFlow();
      const res = await app.inject({ method: 'GET', url: '/api/admin/flows' });
      expect(res.statusCode).toBe(200);
      const { flows } = res.json();
      const f = flows.find((x: any) => x.app === 'flowapp');
      expect(f.flow).toBe('main');
      expect(f.steps.map((s: any) => [s.step, s.sessions])).toEqual([['open', 10], ['play', 6], ['win', 2]]);
      expect(f.total_sessions).toBe(10);
      expect(flows.some((x: any) => x.app === 'sudoku')).toBe(false);
    });

    it('filters by app', async () => {
      await seedFlow();
      const { apps, flows } = (await app.inject({ method: 'GET', url: '/api/admin/flows?app=flowapp' })).json();
      expect(apps.map((a: any) => a.app)).toEqual(['flowapp']);
      expect(flows.map((f: any) => f.app)).toEqual(['flowapp']);
      const none = (await app.inject({ method: 'GET', url: '/api/admin/flows?app=nope' })).json();
      expect(none).toEqual({ apps: [], flows: [] });
    });

    it('counts per-app errors and sessions', async () => {
      const { apps } = (await app.inject({ method: 'GET', url: '/api/admin/flows' })).json();
      const sudoku = apps.find((a: any) => a.app === 'sudoku');
      expect(sudoku).toMatchObject({ sessions: 1, views: 1, clicks: 0, events: 1, errors: 1, error_sessions: 1 });
      expect(sudoku.last_seen_ms).toBeGreaterThan(0);
      const sm = apps.find((a: any) => a.app === 'session-manager');
      expect(sm).toMatchObject({ views: 1, errors: 0, error_sessions: 0 });
    });

    it('400s on a bad app value and rejects non-admins', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/admin/flows?app=bad%20app!' })).statusCode).toBe(400);
      mockAdmin.mockImplementation(async (_r: any, reply: any) => { reply.status(401).send({ error: 'no' }); return null; });
      expect((await app.inject({ method: 'GET', url: '/api/admin/flows' })).statusCode).toBe(401);
    });
  });

  it('400s on a malformed id and 404s on an unknown one', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/admin/sessions/not-an-id' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/admin/sessions/44444444-4444-4444-8444-444444444444' })).statusCode).toBe(404);
  });
});
