import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun } from '../server/db.js';

// Tests act as different users via `authorization: Bearer user:<email>`.
vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  const admins = ['admin@test'];
  const who = (h: string | undefined) => (h?.startsWith('Bearer user:') ? h.slice(12).toLowerCase() : null);
  return {
    ...original,
    ADMIN_EMAILS: admins,
    verifyClerkToken: vi.fn(async (h: string | undefined) => who(h)),
    requireAuth: vi.fn(async (req: any, reply: any) => {
      const e = who(req.headers.authorization);
      if (!e) reply.status(401).send({ error: 'Sign in required.' });
      return e;
    }),
    requireAdmin: vi.fn(async (req: any, reply: any) => {
      const e = who(req.headers.authorization);
      if (!e || !admins.includes(e)) {
        reply.status(403).send({ error: 'Admin access required.' });
        return null;
      }
      return e;
    }),
  };
});

import { registerForumRoutes } from '../server/routes/forum.js';
import { ensureForumSeed } from '../server/services/forum.js';

const app = Fastify({ logger: false });
registerForumRoutes(app);

const as = (email: string) => ({ authorization: `Bearer user:${email}` });
const ALICE = as('alice@example.com');
const ADMIN = as('admin@test');

let clock = Date.now();
const bodies: string[] = [];
async function call(method: 'GET' | 'POST', url: string, headers: Record<string, string> = {}, payload?: unknown) {
  const res = await app.inject({ method, url, headers, payload: payload as any });
  bodies.push(res.body);
  return res;
}

beforeAll(async () => {
  await initDb();
  await app.ready();
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(async () => {
  // Each test lives a day apart so per-member write limits (keyed by reusable row ids) never leak.
  clock += 25 * 60 * 60_000;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(clock);
  for (const t of ['forum_posts', 'forum_logbook', 'forum_threads', 'forum_members']) {
    await dbRun(`DELETE FROM ${t}`);
  }
  await ensureForumSeed('admin@test');
});

async function giveHandle(headers: Record<string, string>, handle: string) {
  const r = await call('POST', '/api/forum/handle', headers, { handle });
  expect(r.statusCode).toBe(200);
}

describe('forum routes', () => {
  it('serves index, thread and logbook to signed-out visitors', async () => {
    const idx = await call('GET', '/api/forum/index');
    expect(idx.statusCode).toBe(200);
    const j = idx.json();
    expect(j.threads.map((t: any) => t.id)).toContain('sm');
    expect(j.online).toEqual({ handles: expect.any(Array), lurkers: expect.any(Number) });

    const th = await call('GET', '/api/forum/threads/sm');
    expect(th.statusCode).toBe(200);
    expect(th.json().posts.length).toBe(1);
    expect((await call('GET', '/api/forum/threads/nope')).statusCode).toBe(404);

    const lb = await call('GET', '/api/forum/logbook');
    expect(lb.statusCode).toBe(200);
    expect(lb.json().entries).toEqual([]);
  });

  it('counts a thread view once per IP per hour', async () => {
    const v = async () => (await call('GET', '/api/forum/threads/sm')).json().views;
    const first = await v();
    expect(await v()).toBe(first + 1);
    expect(await v()).toBe(first + 1);
    vi.setSystemTime(Date.now() + 61 * 60_000);
    await v();
    expect(await v()).toBe(first + 2);
  });

  it('rejects signed-out writes with 401', async () => {
    expect((await call('POST', '/api/forum/logbook', {}, { msg: 'hi', from: 'x' })).statusCode).toBe(401);
    expect((await call('POST', '/api/forum/threads', {}, { board: 'porch', title: 'Hello there', body: 'x' })).statusCode).toBe(401);
    expect((await call('POST', '/api/forum/handle', {}, { handle: 'alice' })).statusCode).toBe(401);
  });

  it('reports signed-out and signed-in state on /me', async () => {
    expect((await call('GET', '/api/forum/me')).json()).toEqual({ member: null, signedIn: false });
    const anon = (await call('GET', '/api/forum/me', ALICE)).json();
    expect(anon).toEqual({ signedIn: true, member: null, isHost: false });
    await giveHandle(ALICE, 'alice');
    const me = (await call('GET', '/api/forum/me', ALICE)).json();
    expect(me.member.handle).toBe('alice');
    expect(me.isHost).toBe(false);
    expect((await call('GET', '/api/forum/me', ADMIN)).json().isHost).toBe(true);
  });

  it('limits renames to 3 per day; first claim and failed renames do not count', async () => {
    const bob = as('bob@example.com');
    await giveHandle(ALICE, 'alice');
    await giveHandle(bob, 'bobby');
    // taken rename fails with 409 and does not count
    for (let i = 0; i < 4; i++) {
      expect((await call('POST', '/api/forum/handle', ALICE, { handle: 'bobby' })).statusCode).toBe(409);
    }
    // case-only change is not a rename
    await giveHandle(ALICE, 'Alice');
    for (const h of ['alice_1', 'alice_2', 'alice_3']) await giveHandle(ALICE, h);
    const over = await call('POST', '/api/forum/handle', ALICE, { handle: 'alice_4' });
    expect(over.statusCode).toBe(429);
    expect(over.json().error).toBe('You can change your handle 3 times a day. Try again tomorrow.');
    // another member is unaffected
    await giveHandle(bob, 'bobby2');
  });

  it('403 needs_handle for a signed-in user without a handle', async () => {
    const r = await call('POST', '/api/forum/logbook', ALICE, { msg: 'hi', from: 'x' });
    expect(r.statusCode).toBe(403);
    expect(r.json().code).toBe('needs_handle');
  });

  it('creates a handle, rejects invalid and taken ones', async () => {
    expect((await call('POST', '/api/forum/handle', ALICE, { handle: 'a b' })).statusCode).toBe(400);
    await giveHandle(ALICE, 'alice');
    const taken = await call('POST', '/api/forum/handle', as('bob@example.com'), { handle: 'Alice' });
    expect(taken.statusCode).toBe(409);
    expect(taken.json().error).toMatch(/taken.*Try @/);
    const chk = (await call('GET', '/api/forum/handle-check?handle=alice')).json();
    expect(chk).toMatchObject({ ok: false, tone: 'bad' });
    expect((await call('GET', '/api/forum/handle-check?handle=fresh_one')).json()).toMatchObject({ ok: true, tone: 'good' });
  });

  it('posts a reply and signs the log-book', async () => {
    await giveHandle(ALICE, 'alice');
    const post = await call('POST', '/api/forum/threads/sm/posts', ALICE, { body: 'hello from alice' });
    expect(post.statusCode).toBe(201);
    const th = (await call('GET', '/api/forum/threads/sm')).json();
    expect(th.posts.at(-1).body).toBe('hello from alice');

    const made = await call('POST', '/api/forum/threads', ALICE, { board: 'tools', title: 'A fresh thread', body: 'body' });
    expect(made.statusCode).toBe(201);
    expect((await call('GET', `/api/forum/threads/${made.json().id}`)).statusCode).toBe(200);
    expect((await call('POST', '/api/forum/threads', ALICE, { board: 'nope', title: 'A fresh thread', body: 'b' })).statusCode).toBe(400);

    const sign = await call('POST', '/api/forum/logbook', ALICE, { msg: 'was here', from: 'Earth' });
    expect(sign.statusCode).toBe(201);
    const lb = (await call('GET', '/api/forum/logbook')).json().entries;
    expect(lb[0]).toMatchObject({ handle: 'alice', msg: 'was here', from: 'Earth' });
  });

  it('requires came on the brought thread', async () => {
    await giveHandle(ALICE, 'alice');
    const bad = await call('POST', '/api/forum/threads/brought/posts', ALICE, { body: 'hi' });
    expect(bad.statusCode).toBe(400);
    const ok = await call('POST', '/api/forum/threads/brought/posts', ALICE, { body: 'hi', came: 'GitHub' });
    expect(ok.statusCode).toBe(201);
  });

  it('429s after 6 writes in a minute', async () => {
    await giveHandle(ALICE, 'alice');
    for (let i = 0; i < 6; i++) {
      expect((await call('POST', '/api/forum/logbook', ALICE, { msg: `n${i}`, from: '' })).statusCode).toBe(201);
    }
    expect((await call('POST', '/api/forum/logbook', ALICE, { msg: 'n7', from: '' })).statusCode).toBe(429);
  });

  it('limits moderation to admins and hides content', async () => {
    await giveHandle(ALICE, 'alice');
    const postId = (await call('POST', '/api/forum/threads/sm/posts', ALICE, { body: 'spam' })).json().id;
    const body = { kind: 'post', id: postId, hidden: true };
    expect((await call('POST', '/api/forum/moderate', ALICE, body)).statusCode).toBe(403);
    expect((await call('POST', '/api/forum/moderate', {}, body)).statusCode).toBe(403);
    expect((await call('POST', '/api/forum/moderate', ADMIN, body)).statusCode).toBe(200);
    const th = (await call('GET', '/api/forum/threads/sm')).json();
    expect(th.posts.map((p: any) => p.body)).not.toContain('spam');
    expect((await call('POST', '/api/forum/moderate', ADMIN, { kind: 'nope', id: 'x', hidden: true })).statusCode).toBe(400);
  });

  it('never leaks an email in any response body', () => {
    expect(bodies.length).toBeGreaterThan(0);
    for (const b of bodies) expect(b).not.toContain('@example.com');
    for (const b of bodies) expect(b).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });
});

describe('forum seed health + lazy retry', () => {
  it('reports a failed seed, then heals on a forum GET after the retry window', async () => {
    vi.resetModules();
    const real = await vi.importActual<typeof import('../server/services/forum.js')>('../server/services/forum.js');
    const seed = vi.fn(real.ensureForumSeed).mockRejectedValueOnce(new Error('turso exploded'));
    vi.doMock('../server/services/forum.js', () => ({ ...real, ensureForumSeed: seed }));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const routes = await import('../server/routes/forum.js');
      const app2 = Fastify({ logger: false });
      routes.registerForumRoutes(app2);
      await app2.ready();

      expect(routes.getForumSeedHealth()).toMatchObject({ seeded: false, error: 'turso exploded', attempts: 1 });
      expect(errSpy).toHaveBeenCalledWith('[forum] seed failed:', expect.any(Error));

      // Inside the window: no retry.
      await app2.inject({ method: 'GET', url: '/api/forum/index' });
      expect(seed).toHaveBeenCalledTimes(1);

      // After the window: one retry fires and succeeds.
      vi.setSystemTime(Date.now() + 61_000);
      await dbRun('DELETE FROM forum_posts');
      await dbRun('DELETE FROM forum_threads');
      await dbRun('DELETE FROM forum_members');
      await app2.inject({ method: 'GET', url: '/api/forum/index' });
      await vi.waitFor(() => expect(routes.getForumSeedHealth().seeded).toBe(true));
      expect(seed).toHaveBeenCalledTimes(2);
      expect(routes.getForumSeedHealth()).toMatchObject({ seeded: true, error: null, attempts: 2 });

      for (const id of ['log', 'brought', 'sm']) {
        expect((await app2.inject({ method: 'GET', url: `/api/forum/threads/${id}` })).statusCode).toBe(200);
      }
      await app2.close();
    } finally {
      errSpy.mockRestore();
      vi.doUnmock('../server/services/forum.js');
    }
  });
});
