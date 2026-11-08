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

  describe('mine and bots filters', () => {
    const OWNER_SID = '77777777-7777-4777-8777-777777777777';
    const BOT_SID = '88888888-8888-4888-8888-888888888888';
    const STRANGER_SID = '99999999-9999-4999-8999-999999999999';
    const OWNER_VID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const BOT_VID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const STRANGER_VID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    type Listed = { session_id: string; mine: boolean; bot: boolean };
    type ListBody = { sessions: Listed[]; filters: { mine: string; bots: string } };

    const session = (sid: string, vid: string, ms: number, email: string | null = null) => dbRun(
      `INSERT INTO sessions (session_id, visitor_id, started_at, ended_at, page_count, email) VALUES (?, ?, ?, ?, 1, ?)`,
      sid, vid, ms, ms + 1000, email);
    // date is the view's UTC day, as /api/analytics/pageview writes it.
    const view = (sid: string | null, vid: string | null, ms: number, isAdmin = 0, isBot = 0) => dbRun(
      `INSERT INTO page_views (path, date, visitor_id, session_id, is_admin, is_bot, created_at_ms)
       VALUES ('/projects/sudoku/', ?, ?, ?, ?, ?, ?)`,
      new Date(ms).toISOString().slice(0, 10), vid, sid, isAdmin, isBot, ms);
    const list = async (qs = ''): Promise<ListBody> => {
      const res = await app.inject({ method: 'GET', url: `/api/admin/sessions${qs}` });
      expect(res.statusCode).toBe(200);
      return res.json();
    };
    const ids = (body: ListBody) => body.sessions.map((s) => s.session_id);

    beforeEach(async () => {
      for (const t of ['sessions', 'page_views', 'click_events', 'funnel_events', 'app_errors']) {
        await dbRun(`DELETE FROM ${t}`);
      }
      const now = Date.now();
      await session(OWNER_SID, OWNER_VID, now - 30_000);
      await view(OWNER_SID, OWNER_VID, now - 30_000, 1, 0);
      await session(BOT_SID, BOT_VID, now - 40_000);
      await view(BOT_SID, BOT_VID, now - 40_000, 0, 1);
      await session(STRANGER_SID, STRANGER_VID, now - 50_000, 's@x.co');
      await view(STRANGER_SID, STRANGER_VID, now - 50_000);
    });

    it('lists the owner, bot and stranger sessions by default with their flags', async () => {
      const body = await list();
      expect(body.sessions.map((s) => [s.session_id, s.mine, s.bot])).toEqual([
        [OWNER_SID, true, false],
        [BOT_SID, false, true],
        [STRANGER_SID, false, false],
      ]);
      expect(body.filters).toEqual({ mine: 'include', bots: 'include' });
    });

    it('mine=exclude drops the owner session', async () => {
      const body = await list('?mine=exclude');
      expect(ids(body)).toEqual([BOT_SID, STRANGER_SID]);
      expect(body.filters).toEqual({ mine: 'exclude', bots: 'include' });
    });

    it('bots=exclude drops the bot session', async () => {
      const body = await list('?bots=exclude');
      expect(ids(body)).toEqual([OWNER_SID, STRANGER_SID]);
      expect(body.filters).toEqual({ mine: 'include', bots: 'exclude' });
    });

    it('mine=exclude and bots=exclude together leave only the stranger', async () => {
      const body = await list('?mine=exclude&bots=exclude');
      expect(ids(body)).toEqual([STRANGER_SID]);
      expect(body.sessions[0]).toMatchObject({ mine: false, bot: false });
      expect(body.filters).toEqual({ mine: 'exclude', bots: 'exclude' });
    });

    it('marks and drops a signed-out owner session by its cookie id alone', async () => {
      const SID_OUT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
      const t = Date.now() - 20_000;
      await session(SID_OUT, OWNER_VID, t);
      await view(SID_OUT, OWNER_VID, t); // is_admin 0: the owner browsing signed out
      expect((await list()).sessions[0]).toMatchObject({ session_id: SID_OUT, mine: true, bot: false });
      expect(ids(await list('?mine=exclude'))).toEqual([BOT_SID, STRANGER_SID]);
    });

    it('marks and drops a session by its admin page view alone', async () => {
      const SID_ADMIN = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      const VID_X = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
      const t = Date.now() - 20_000;
      await session(SID_ADMIN, VID_X, t);
      // No visitor id on the admin view, so VID_X never joins the owner cookie ids.
      await view(SID_ADMIN, null, t, 1, 0);
      expect((await list()).sessions[0]).toMatchObject({ session_id: SID_ADMIN, mine: true, bot: false });
      expect(ids(await list('?mine=exclude'))).toEqual([BOT_SID, STRANGER_SID]);
    });

    it('keeps every session when admin and bot views have no session id', async () => {
      // A NULL in a NOT IN list would turn the predicate NULL and empty the list.
      await view(null, null, Date.now() - 10_000, 1, 1);
      expect(ids(await list('?mine=exclude&bots=exclude'))).toEqual([STRANGER_SID]);
    });

    it('combines with the email, visitor and app filters', async () => {
      expect(ids(await list('?app=sudoku&bots=exclude'))).toEqual([OWNER_SID, STRANGER_SID]);
      expect(ids(await list(
        `?email=s%40x.co&visitor=${STRANGER_VID}&app=sudoku&mine=exclude&bots=exclude`,
      ))).toEqual([STRANGER_SID]);
      expect(ids(await list(`?visitor=${OWNER_VID}&mine=exclude`))).toEqual([]);
      expect(ids(await list(`?visitor=${BOT_VID}&mine=exclude`))).toEqual([BOT_SID]);
      expect(ids(await list('?app=nope&mine=exclude&bots=exclude'))).toEqual([]);
    });
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
      expect(none).toEqual({ apps: [], flows: [], filters: { mine: 'include', bots: 'include' } });
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

    describe('mine and bots filters', () => {
      const APP = 'filterapp';
      const PATH = `/projects/${APP}/`;
      const OWNER_SID = '77777777-7777-4777-8777-777777777777';
      const BOT_SID = '88888888-8888-4888-8888-888888888888';
      const STRANGER_SID = '99999999-9999-4999-8999-999999999999';
      const OWNER_VID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const BOT_VID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const STRANGER_VID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      const OWNER_HASH = 'owner-ip-ua-hash';

      type Health = {
        app: string; sessions: number; views: number; clicks: number; events: number; errors: number; error_sessions: number;
      };
      type FlowsBody = {
        apps: Health[];
        flows: { app: string; flow: string; steps: { step: string; sessions: number }[]; total_sessions: number }[];
        filters: { mine: string; bots: string };
      };

      const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
      // page_views, funnel_events and app_errors.visitor_id hold the bilko_vid cookie id.
      const view = (sid: string | null, vid: string | null, ms: number, isAdmin = 0, isBot = 0) => dbRun(
        `INSERT INTO page_views (path, date, visitor_id, session_id, is_admin, is_bot, created_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        PATH, day(ms), vid, sid, isAdmin, isBot, ms);
      // click_events.visitor_id is the ip+ua hash and client_vid the cookie id.
      const click = (sid: string | null, hash: string | null, vid: string | null, ms: number, isAdmin = 0, isBot = 0) => dbRun(
        `INSERT INTO click_events (ts_ms, date, path, session_id, visitor_id, client_vid, is_admin, is_bot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ms, day(ms), PATH, sid, hash, vid, isAdmin, isBot);
      const event = (sid: string | null, vid: string | null, ms: number, isAdmin = 0) => dbRun(
        `INSERT INTO funnel_events (event, tool, metadata, created_at, session_id, visitor_id, is_admin)
         VALUES ('main.open', ?, ?, ?, ?, ?, ?)`,
        APP, JSON.stringify({ flow: 'main', step: 'open' }), new Date(ms).toISOString().slice(0, 19).replace('T', ' '),
        sid, vid, isAdmin);
      const error = (sid: string | null, vid: string | null, ms: number) => dbRun(
        `INSERT INTO app_errors (app, name, msg, session_id, visitor_id, created_at) VALUES (?, 'TypeError', 'boom', ?, ?, ?)`,
        APP, sid, vid, Math.floor(ms / 1000));
      // n page views, clicks, funnel events and app errors, all in one session.
      const activity = async (n: number, sid: string, vid: string, hash: string, isAdmin = 0, isBot = 0) => {
        const t = Date.now() - 60_000;
        for (let i = 0; i < n; i++) {
          await view(sid, vid, t + i, isAdmin, isBot);
          await click(sid, hash, vid, t + i, isAdmin, isBot);
          await event(sid, vid, t + i);
          await error(sid, vid, t + i);
        }
      };

      const getFlows = async (qs = ''): Promise<FlowsBody> => {
        const res = await app.inject({ method: 'GET', url: `/api/admin/flows${qs}` });
        expect(res.statusCode).toBe(200);
        return res.json();
      };
      const health = (body: FlowsBody) => body.apps.find((a) => a.app === APP);
      // `rows` of every kind across `sessions` sessions, in the app row and its one flow.
      const expectCounts = (body: FlowsBody, sessions: number, rows: number) => {
        expect(health(body)).toMatchObject({
          sessions, views: rows, clicks: rows, events: rows, errors: rows, error_sessions: sessions,
        });
        const flow = body.flows.find((f) => f.app === APP);
        expect(flow?.total_sessions).toBe(sessions);
        expect(flow?.steps.map((s) => [s.step, s.sessions])).toEqual([['open', sessions]]);
      };

      beforeEach(async () => {
        for (const t of ['sessions', 'page_views', 'click_events', 'funnel_events', 'app_errors']) {
          await dbRun(`DELETE FROM ${t}`);
        }
        // 1 owner, 2 bot and 4 stranger rows of each kind, so every total shows whose rows are left. The owner is
        // signed in: the admin view and click make OWNER_VID an owner cookie id, OWNER_HASH an owner hash and
        // OWNER_SID an owner session.
        await activity(1, OWNER_SID, OWNER_VID, OWNER_HASH, 1, 0);
        // Only the bot's views and clicks carry is_bot; its events and errors just share its session.
        await activity(2, BOT_SID, BOT_VID, 'bot-hash', 0, 1);
        await activity(4, STRANGER_SID, STRANGER_VID, 'stranger-hash');
      });

      it('counts the owner, bot and stranger by default and echoes the filters', async () => {
        const body = await getFlows();
        expect(body.apps.map((a) => a.app)).toEqual([APP]);
        expectCounts(body, 3, 7);
        expect(body.filters).toEqual({ mine: 'include', bots: 'include' });
      });

      it('mine=exclude drops the owner rows from every table', async () => {
        const body = await getFlows('?mine=exclude');
        expectCounts(body, 2, 6);
        expect(body.filters).toEqual({ mine: 'exclude', bots: 'include' });
      });

      it('bots=exclude drops the bot rows from every table', async () => {
        const body = await getFlows('?bots=exclude');
        expectCounts(body, 2, 5);
        expect(body.filters).toEqual({ mine: 'include', bots: 'exclude' });
      });

      it('mine=exclude and bots=exclude together leave only the stranger, with or without the app filter', async () => {
        const body = await getFlows('?mine=exclude&bots=exclude');
        expectCounts(body, 1, 4);
        expect(body.filters).toEqual({ mine: 'exclude', bots: 'exclude' });
        const one = await getFlows(`?app=${APP}&mine=exclude&bots=exclude`);
        expect(one.apps.map((a) => a.app)).toEqual([APP]);
        expectCounts(one, 1, 4);
      });

      it('mine=exclude drops owner rows that carry a single owner signal', async () => {
        const t = Date.now() - 30_000;
        const OUT_SID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
        // Signed out, so no is_admin: only the owner cookie id or hash gives these away.
        await view(OUT_SID, OWNER_VID, t);
        await click(OUT_SID, OWNER_HASH, null, t);
        await click(OUT_SID, 'other-device-hash', OWNER_VID, t);
        await event(OUT_SID, OWNER_VID, t);
        await error(null, OWNER_VID, t);
        // No visitor id: only the owner's admin session gives these away.
        await event(OWNER_SID, null, t);
        await error(OWNER_SID, null, t);
        // An owner checkout_start: is_admin with neither id.
        await event(null, null, t, 1);
        expect(health(await getFlows())).toMatchObject({ sessions: 4, views: 8, clicks: 9, events: 10, errors: 9 });
        expectCounts(await getFlows('?mine=exclude'), 2, 6);
      });

      it('keeps events and errors with no session id, and a flagged view with none drops nothing', async () => {
        const t = Date.now() - 30_000;
        // A NULL in either NOT IN subquery would turn the predicate NULL and drop every event and error.
        await view(null, null, t, 1, 1);
        await event(null, null, t);
        await error(null, null, t);
        expect(health(await getFlows('?mine=exclude&bots=exclude'))).toMatchObject({
          sessions: 1, views: 4, clicks: 4, events: 5, errors: 5, error_sessions: 1,
        });
      });

      it('bounds the owner sessions by the UTC day of the window start', async () => {
        const OLD_SID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
        // An admin view three days back, with no visitor id so it adds no owner cookie id.
        await view(OLD_SID, null, Date.now() - 3 * 86_400_000, 1, 0);
        await event(OLD_SID, null, Date.now() - 30_000);
        expect(health(await getFlows('?days=1&mine=exclude'))?.events).toBe(7);
        expect(health(await getFlows('?days=7&mine=exclude'))?.events).toBe(6);
      });
    });
  });

  it('400s on a malformed id and 404s on an unknown one', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/admin/sessions/not-an-id' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/admin/sessions/44444444-4444-4444-8444-444444444444' })).statusCode).toBe(404);
  });
});
