// @vitest-environment node
// Bilko-DB team membership API: who may read and change an app's team (owners, members leaving,
// admin sessions and registry keys), the store's last_owner guard, and email normalization.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import Fastify from 'fastify';

const { verifyTokenMock, getUserMock, createClerkClientMock } = vi.hoisted(() => ({
  verifyTokenMock: vi.fn(),
  getUserMock: vi.fn(),
  createClerkClientMock: vi.fn(),
}));

vi.mock('@clerk/backend', () => ({
  verifyToken: verifyTokenMock,
  createClerkClient: createClerkClientMock,
}));

import { initDb, dbGet, dbRun } from '../server/db.js';
import { mintAdminApiKey } from '../server/services/admin-api-keys.js';
import { bilkoDbWriteLimiter } from '../server/routes/bilko-db.js';
import { registerBilkoDbTeamRoutes } from '../server/routes/bilko-db-team.js';

const ADMIN_EMAIL = 'bilkobibitkov2000@gmail.com';
// Clerk token -> user email. Tokens not listed are invalid.
const USERS: Record<string, string> = {
  'tok-admin': ADMIN_EMAIL,
  'tok-owner': 'owner@t.dev',
  'tok-member': 'member@t.dev',
  'tok-stranger': 'stranger@t.dev',
};

const app = Fastify({ logger: false });
registerBilkoDbTeamRoutes(app);

const APP = 'notes';
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
let registryKey = '';
let registryKeyId = 0;
let readKey = '';

const team = (t: string, appName = APP) => app.inject({ method: 'GET', url: `/api/db/${appName}/team`, headers: bearer(t) });
const putMember = (t: string, email: string, role: unknown, appName = APP) =>
  app.inject({
    method: 'PUT',
    url: `/api/db/${appName}/team/members/${encodeURIComponent(email)}`,
    headers: { ...bearer(t), 'content-type': 'application/json' },
    payload: JSON.stringify({ role }),
  });
const delMember = (t: string, email: string, appName = APP) =>
  app.inject({ method: 'DELETE', url: `/api/db/${appName}/team/members/${encodeURIComponent(email)}`, headers: bearer(t) });

async function seedTeam(): Promise<void> {
  expect((await putMember('tok-admin', 'owner@t.dev', 'owner')).statusCode).toBe(200);
  expect((await putMember('tok-owner', 'member@t.dev', 'member')).statusCode).toBe(200);
}

beforeAll(async () => {
  process.env.CLERK_SECRET_KEY = 'test-secret';
  createClerkClientMock.mockReturnValue({ users: { getUser: getUserMock } });
  verifyTokenMock.mockImplementation(async (t: string) => {
    if (USERS[t]) return { sub: t };
    throw new Error('invalid token');
  });
  getUserMock.mockImplementation(async (sub: string) => ({ primaryEmailAddress: { emailAddress: USERS[sub] } }));
  await initDb();
  await dbRun('DELETE FROM admin_api_keys');
  const reg = await mintAdminApiKey(ADMIN_EMAIL, 'mcp', 90, 'registry');
  registryKey = reg.key;
  registryKeyId = reg.id;
  readKey = (await mintAdminApiKey(ADMIN_EMAIL, 'ro', 90, 'read')).key;
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM bilko_db_team_members');
  bilkoDbWriteLimiter.reset();
});

afterAll(async () => {
  await dbRun('DELETE FROM bilko_db_team_members');
  await dbRun('DELETE FROM admin_api_keys');
});

describe('team membership routes', () => {
  it('an admin session adds the first owner of an app with no team', async () => {
    const empty = await team('tok-admin');
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual({ app: APP, role: 'admin', members: [] });

    const r = await putMember('tok-admin', 'owner@t.dev', 'owner');
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ email: 'owner@t.dev', role: 'owner', created: true });

    const row = await dbGet<{ added_by: string }>(
      'SELECT added_by FROM bilko_db_team_members WHERE app = ? AND email = ?', APP, 'owner@t.dev');
    expect(row?.added_by).toBe(ADMIN_EMAIL);

    const g = await team('tok-admin');
    expect(g.headers['cache-control']).toBe('private, no-store');
    const body = g.json();
    expect(body.role).toBe('admin');
    expect(body.members).toHaveLength(1);
    expect(body.members[0]).toMatchObject({ email: 'owner@t.dev', role: 'owner' });
    expect(new Date(body.members[0].addedAt).toISOString()).toBe(body.members[0].addedAt);
    // The admin does not become a member.
    expect(body.members.some((m: { email: string }) => m.email === ADMIN_EMAIL)).toBe(false);
  });

  it('an owner adds a member, and both see the team with their own role', async () => {
    await seedTeam();
    const row = await dbGet<{ added_by: string }>(
      'SELECT added_by FROM bilko_db_team_members WHERE app = ? AND email = ?', APP, 'member@t.dev');
    expect(row?.added_by).toBe('owner@t.dev');

    const o = await team('tok-owner');
    expect(o.statusCode).toBe(200);
    expect(o.json().role).toBe('owner');
    expect(o.json().members.map((m: { email: string }) => m.email)).toEqual(['member@t.dev', 'owner@t.dev']);
    const m = await team('tok-member');
    expect(m.statusCode).toBe(200);
    expect(m.json().role).toBe('member');
  });

  it("a member's PUT gets 403 but their own DELETE (leave) succeeds", async () => {
    await seedTeam();
    const p = await putMember('tok-member', 'friend@t.dev', 'member');
    expect(p.statusCode).toBe(403);
    expect(p.json()).toEqual({ error: 'not_member' });
    expect((await delMember('tok-member', 'owner@t.dev')).statusCode).toBe(403);

    const d = await delMember('tok-member', 'MEMBER@t.dev');
    expect(d.statusCode).toBe(200);
    expect(d.json()).toEqual({ ok: true });
    expect((await team('tok-member')).statusCode).toBe(403);
  });

  it('a non-member gets 403 not_member, also when the app has no team; no token gets 401', async () => {
    await seedTeam();
    const g = await team('tok-stranger');
    expect(g.statusCode).toBe(403);
    expect(g.json()).toEqual({ error: 'not_member' });
    const none = await team('tok-owner', 'other-app');
    expect(none.statusCode).toBe(403);
    expect(none.json()).toEqual({ error: 'not_member' });
    expect((await putMember('tok-stranger', 'stranger@t.dev', 'owner', 'other-app')).statusCode).toBe(403);
    const anon = await app.inject({ method: 'GET', url: `/api/db/${APP}/team` });
    expect(anon.statusCode).toBe(401);
    expect((await team('bogus')).statusCode).toBe(401);
  });

  it('a registry key adds an owner while a read key gets 403', async () => {
    const r = await putMember(registryKey, 'owner@t.dev', 'owner');
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ email: 'owner@t.dev', role: 'owner', created: true });
    const row = await dbGet<{ added_by: string }>(
      'SELECT added_by FROM bilko_db_team_members WHERE app = ? AND email = ?', APP, 'owner@t.dev');
    expect(row?.added_by).toBe(`key:${registryKeyId}`);
    const g = await team(registryKey);
    expect(g.statusCode).toBe(200);
    expect(g.json().role).toBe('admin');

    expect((await putMember(readKey, 'x@t.dev', 'owner')).statusCode).toBe(403);
    expect((await team(readKey)).statusCode).toBe(403);
    expect((await delMember(readKey, 'owner@t.dev')).statusCode).toBe(403);
  });

  it('refuses to demote or remove the last owner with 409 last_owner', async () => {
    await seedTeam();
    const demote = await putMember('tok-owner', 'owner@t.dev', 'member');
    expect(demote.statusCode).toBe(409);
    expect(demote.json()).toEqual({ error: 'last_owner' });
    const remove = await delMember('tok-admin', 'owner@t.dev');
    expect(remove.statusCode).toBe(409);
    expect(remove.json()).toEqual({ error: 'last_owner' });
    const leave = await delMember('tok-owner', 'owner@t.dev');
    expect(leave.statusCode).toBe(409);
  });

  it('answers 400 for a bad email, role or app, and 404 for a missing member', async () => {
    await seedTeam();
    const e = await putMember('tok-owner', 'not-an-email', 'member');
    expect(e.statusCode).toBe(400);
    expect(e.json()).toEqual({ error: 'bad_email' });
    expect((await delMember('tok-owner', 'not-an-email')).json()).toEqual({ error: 'bad_email' });
    const r = await putMember('tok-owner', 'x@t.dev', 'admin');
    expect(r.statusCode).toBe(400);
    expect(r.json()).toEqual({ error: 'bad_role' });
    const a = await team('tok-owner', 'Bad App!');
    expect(a.statusCode).toBe(400);
    expect(a.json()).toEqual({ error: 'bad_app' });
    const missing = await delMember('tok-owner', 'ghost@t.dev');
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: 'not_found' });
  });

  it('maps a mixed-case email to one member', async () => {
    await seedTeam();
    const r = await putMember('tok-owner', 'Friend@T.Dev', 'member');
    expect(r.json()).toEqual({ email: 'friend@t.dev', role: 'member', created: true });
    const again = await putMember('tok-owner', 'FRIEND@t.dev', 'owner');
    expect(again.json()).toEqual({ email: 'friend@t.dev', role: 'owner', created: false });
    const members = (await team('tok-owner')).json().members;
    expect(members.filter((m: { email: string }) => m.email === 'friend@t.dev')).toHaveLength(1);
    expect(members).toHaveLength(3);
  });
});
