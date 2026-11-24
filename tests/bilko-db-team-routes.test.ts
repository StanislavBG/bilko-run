import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun } from '../server/db.js';
import { usedBytes } from '../server/services/bilko-db.js';
import { setTeamMember, removeTeamMember, teamPrincipal } from '../server/services/bilko-db-team.js';

// Bearer "a" → A, "b" → B, "c" → C (never a member), anything else → 401.
vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  const users: Record<string, string> = { 'Bearer a': 'a@t.dev', 'Bearer b': 'b@t.dev', 'Bearer c': 'c@t.dev' };
  return {
    ...original,
    requireAuth: vi.fn().mockImplementation(async (req: any, reply: any) => {
      const email = users[req.headers.authorization ?? ''];
      if (email) return email;
      reply.status(401).send({ error: 'Sign in required.' });
      return null;
    }),
  };
});

import { registerBilkoDbRoutes, bilkoDbWriteLimiter } from '../server/routes/bilko-db.js';

const app = Fastify({ logger: false });
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
  try { done(null, JSON.parse((body as Buffer).toString())); } catch (err) { done(err as Error, undefined); }
});
registerBilkoDbRoutes(app);

const APP = 'notes';
const A = { authorization: 'Bearer a' };
const B = { authorization: 'Bearer b' };
const C = { authorization: 'Bearer c' };
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const teamDoc = (key: string, appName = APP) => `/api/db/${appName}/team/docs/${key}`;
const personalDoc = (key: string, appName = APP) => `/api/db/${appName}/docs/${key}`;
const put = (url: string, payload: string, headers: Record<string, string>, extra: Record<string, string> = {}) =>
  app.inject({ method: 'PUT', url, payload, headers: { 'content-type': 'application/json', ...headers, ...extra } });
const get = (url: string, headers: Record<string, string>) => app.inject({ method: 'GET', url, headers });
const uploadTeam = (headers: Record<string, string>, appName = APP) =>
  app.inject({ method: 'POST', url: `/api/db/${appName}/team/images`, payload: GIF, headers: { 'content-type': 'image/gif', ...headers } });

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM bilko_db_docs');
  await dbRun('DELETE FROM bilko_db_images');
  await dbRun('DELETE FROM bilko_db_team_members');
  bilkoDbWriteLimiter.reset();
  await setTeamMember({ app: APP, email: 'a@t.dev', role: 'owner', by: 'admin@t.dev' });
  await setTeamMember({ app: APP, email: 'b@t.dev', role: 'member', by: 'a@t.dev' });
});

describe('team documents', () => {
  it('member A writes and member B reads the same doc and ETag', async () => {
    const w = await put(teamDoc('board'), '{"cards":[1]}', A);
    expect(w.statusCode).toBe(200);
    expect(w.json()).toMatchObject({ key: 'board', type: 'json', version: 1 });
    const r = await get(teamDoc('board'), B);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ cards: [1] });
    expect(r.headers.etag).toBe(w.headers.etag);
    const l = await get(`/api/db/${APP}/team/docs?prefix=bo`, B);
    expect(l.json().docs.map((d: any) => d.key)).toEqual(['board']);
  });

  it("B's stale If-Match gets 412 version_mismatch", async () => {
    await put(teamDoc('board'), '{"v":1}', A);
    expect((await put(teamDoc('board'), '{"v":2}', A, { 'if-match': '"1"' })).statusCode).toBe(200);
    const stale = await put(teamDoc('board'), '{"v":3}', B, { 'if-match': '"1"' });
    expect(stale.statusCode).toBe(412);
    expect(stale.json()).toEqual({ error: 'version_mismatch', version: 2 });
    const staleDel = await app.inject({ method: 'DELETE', url: teamDoc('board'), headers: { ...B, 'if-match': '"1"' } });
    expect(staleDel.statusCode).toBe(412);
    expect((await app.inject({ method: 'DELETE', url: teamDoc('board'), headers: { ...B, 'if-match': '"2"' } })).statusCode).toBe(200);
    expect((await get(teamDoc('board'), A)).statusCode).toBe(404);
  });

  it('same-named personal and team keys are independent', async () => {
    await put(personalDoc('settings'), '{"who":"a-personal"}', A);
    await put(teamDoc('settings'), '{"who":"team"}', A);
    expect((await get(personalDoc('settings'), A)).json()).toEqual({ who: 'a-personal' });
    expect((await get(teamDoc('settings'), A)).json()).toEqual({ who: 'team' });
    expect((await get(personalDoc('settings'), B)).statusCode).toBe(404);
    expect((await get(`/api/db/${APP}/docs`, A)).json().docs).toHaveLength(1);
    expect((await get(`/api/db/${APP}/team/docs`, B)).json().docs).toHaveLength(1);
    await app.inject({ method: 'DELETE', url: teamDoc('settings'), headers: A });
    expect((await get(personalDoc('settings'), A)).statusCode).toBe(200);
  });

  it("a team write leaves the writer's usedBytes unchanged", async () => {
    const before = await usedBytes('a@t.dev');
    await put(teamDoc('big'), JSON.stringify({ s: 'x'.repeat(1000) }), A);
    expect(await usedBytes('a@t.dev')).toBe(before);
    expect(await usedBytes(teamPrincipal(APP))).toBeGreaterThan(1000);
  });

  it('keeps bad_app / bad_key 400 before auth', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/db/Bad_App/team/docs' })).json()).toEqual({ error: 'bad_app' });
    expect((await app.inject({ method: 'GET', url: teamDoc('UPPER') })).json()).toEqual({ error: 'bad_key' });
    expect((await app.inject({ method: 'GET', url: `/api/db/${APP}/team/docs` })).statusCode).toBe(401);
  });
});

describe('team images', () => {
  it('another member lists and deletes a team image; url is the public route', async () => {
    const up = await uploadTeam(A);
    expect(up.statusCode).toBe(201);
    const { id, url } = up.json();
    expect(url).toBe(`/api/db/${APP}/images/${id}`);
    const pub = await app.inject({ method: 'GET', url });
    expect(pub.statusCode).toBe(200);
    const l = await get(`/api/db/${APP}/team/images`, B);
    expect(l.json().images.map((m: any) => m.id)).toEqual([id]);
    // Personal list does not show team images.
    expect((await get(`/api/db/${APP}/images`, A)).json().images).toEqual([]);
    expect((await app.inject({ method: 'DELETE', url: `/api/db/${APP}/images/${id}`, headers: A })).statusCode).toBe(404);
    const d = await app.inject({ method: 'DELETE', url: `/api/db/${APP}/team/images/${id}`, headers: B });
    expect(d.statusCode).toBe(200);
    expect((await get(`/api/db/${APP}/team/images`, A)).json().images).toEqual([]);
  });
});

describe('membership', () => {
  const routes = () => [
    { method: 'GET' as const, url: `/api/db/${APP}/team/docs` },
    { method: 'GET' as const, url: teamDoc('board') },
    { method: 'PUT' as const, url: teamDoc('board'), payload: '{}', headers: { 'content-type': 'application/json' } },
    { method: 'DELETE' as const, url: teamDoc('board') },
    { method: 'POST' as const, url: `/api/db/${APP}/team/images`, payload: GIF, headers: { 'content-type': 'image/gif' } },
    { method: 'GET' as const, url: `/api/db/${APP}/team/images` },
    { method: 'DELETE' as const, url: `/api/db/${APP}/team/images/abc` },
  ];

  it('a non-member gets 403 not_member on every team route', async () => {
    for (const r of routes()) {
      const res = await app.inject({ ...r, headers: { ...(r.headers ?? {}), ...C } });
      expect(res.statusCode, `${r.method} ${r.url}`).toBe(403);
      expect(res.json()).toEqual({ error: 'not_member' });
    }
  });

  it('an app with no team answers 403 not_member', async () => {
    const res = await get(`/api/db/other-app/team/docs`, A);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'not_member' });
  });

  it('a removed member gets 403 on the next request', async () => {
    await put(teamDoc('board'), '{}', A);
    expect((await get(teamDoc('board'), B)).statusCode).toBe(200);
    expect(await removeTeamMember({ app: APP, email: 'b@t.dev' })).toEqual({ removed: true });
    const res = await get(teamDoc('board'), B);
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'not_member' });
  });
});
