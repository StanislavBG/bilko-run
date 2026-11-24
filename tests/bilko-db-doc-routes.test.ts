import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import { initDb, dbRun } from '../server/db.js';
import { DOC_MAX_BYTES, USER_QUOTA_BYTES } from '../server/services/bilko-db.js';

// Bearer "a" → user A, "b" → user B, anything else → 401.
vi.mock('../server/clerk.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../server/clerk.js')>();
  const users: Record<string, string> = { 'Bearer a': 'a@t.dev', 'Bearer b': 'b@t.dev' };
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
// Mirror server/index.ts's global JSON parser so the route scope is proven to override it.
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
  (req as any).rawBody = body;
  try { done(null, JSON.parse((body as Buffer).toString())); } catch (err) { done(err as Error, undefined); }
});
registerBilkoDbRoutes(app);

const A = { authorization: 'Bearer a' };
const B = { authorization: 'Bearer b' };
const URL_ = (key = 'note-1', appName = 'notes') => `/api/db/${appName}/docs/${key}`;

function put(key: string, payload: string, contentType: string, headers: Record<string, string> = A) {
  return app.inject({ method: 'PUT', url: URL_(key), payload, headers: { 'content-type': contentType, ...headers } });
}
const get = (key: string, headers: Record<string, string> = A) => app.inject({ method: 'GET', url: URL_(key), headers });
const del = (key: string, headers: Record<string, string> = A) => app.inject({ method: 'DELETE', url: URL_(key), headers });

beforeAll(async () => {
  await initDb();
  await app.ready();
});

beforeEach(async () => {
  await dbRun('DELETE FROM bilko_db_docs');
  bilkoDbWriteLimiter.reset();
});

describe('auth and names', () => {
  it('401s every route without a valid Bearer', async () => {
    for (const r of [
      { method: 'GET' as const, url: '/api/db/notes/docs' },
      { method: 'GET' as const, url: URL_() },
      { method: 'PUT' as const, url: URL_(), payload: '{}', headers: { 'content-type': 'application/json' } },
      { method: 'DELETE' as const, url: URL_() },
    ]) {
      const res = await app.inject(r);
      expect(res.statusCode, `${r.method} ${r.url}`).toBe(401);
    }
    expect((await get('x', { authorization: 'Bearer nope' })).statusCode).toBe(401);
  });

  it('answers 400 bad_app / bad_key before auth', async () => {
    const badApp = await app.inject({ method: 'GET', url: '/api/db/Bad_App/docs' });
    expect(badApp.statusCode).toBe(400);
    expect(badApp.json()).toEqual({ error: 'bad_app' });
    const badKey = await app.inject({ method: 'PUT', url: URL_('UPPER'), payload: 'x', headers: { 'content-type': 'text/plain' } });
    expect(badKey.statusCode).toBe(400);
    expect(badKey.json()).toEqual({ error: 'bad_key' });
    expect((await app.inject({ method: 'DELETE', url: URL_('-lead') })).json()).toEqual({ error: 'bad_key' });
    expect((await app.inject({ method: 'GET', url: URL_('a'.repeat(129)) })).json()).toEqual({ error: 'bad_key' });
    expect((await app.inject({ method: 'GET', url: URL_('a/b') })).json()).toEqual({ error: 'bad_key' });
    expect((await app.inject({ method: 'GET', url: '/api/db/notes/docs/' })).json()).toEqual({ error: 'bad_key' });
  });

  it('accepts the longest valid key (128 chars)', async () => {
    const key = 'k'.repeat(128);
    expect((await put(key, 'x', 'text/plain')).statusCode).toBe(200);
    expect((await get(key)).body).toBe('x');
  });
});

describe('write and read', () => {
  it('stores any JSON value and reads it back with ETag and private headers', async () => {
    const w = await put('settings', '{ "theme": "dark", "n": [1, 2] }', 'application/json; charset=utf-8');
    expect(w.statusCode).toBe(200);
    const meta = w.json();
    expect(meta).toMatchObject({ key: 'settings', type: 'json', version: 1 });
    expect(meta.bytes).toBe(Buffer.byteLength('{"theme":"dark","n":[1,2]}'));
    expect(new Date(meta.updatedAt).toISOString()).toBe(meta.updatedAt);

    const r = await get('settings');
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(r.headers.etag).toBe('"1"');
    expect(r.headers['cache-control']).toBe('private, no-store');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.body).toBe('{"theme":"dark","n":[1,2]}');

    for (const v of ['42', '"str"', 'null', 'true', '[]']) {
      const res = await put('scalar', v, 'application/json');
      expect(res.statusCode, v).toBe(200);
      expect((await get('scalar')).body).toBe(v);
    }
  });

  it('400 bad_json for invalid JSON', async () => {
    for (const bad of ['{not json', '']) {
      const res = await put('k', bad, 'application/json');
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'bad_json' });
    }
  });

  it('stores text/plain and text/markdown as sent and reads them as text/plain', async () => {
    expect((await put('readme.md', '# Hi\n\n  *there*  ', 'text/markdown')).json()).toMatchObject({ type: 'text', version: 1 });
    const r = await get('readme.md');
    expect(r.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.body).toBe('# Hi\n\n  *there*  ');
    expect((await put('plain', 'héllo', 'text/plain')).json()).toMatchObject({ type: 'text', bytes: 6 });
    expect((await get('plain')).body).toBe('héllo');
  });

  it('415 for any other content type', async () => {
    for (const ct of ['text/html', 'application/x-www-form-urlencoded', 'application/octet-stream']) {
      const res = await put('k', 'x', ct);
      expect(res.statusCode, ct).toBe(415);
    }
  });

  it('404 not_found for a missing doc', async () => {
    const r = await get('nope');
    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({ error: 'not_found' });
  });

  it('lists docs with metadata and prefix filter', async () => {
    await put('day.1', '{}', 'application/json');
    await put('day.2', 'two', 'text/plain');
    await put('other', '1', 'application/json');
    const all = await app.inject({ method: 'GET', url: '/api/db/notes/docs', headers: A });
    expect(all.statusCode).toBe(200);
    const docs = all.json().docs;
    expect(docs.map((d: any) => d.key)).toEqual(['day.1', 'day.2', 'other']);
    expect(docs[1]).toEqual({ key: 'day.2', type: 'text', bytes: 3, version: 1, updatedAt: expect.any(String) });
    expect(new Date(docs[1].updatedAt).toISOString()).toBe(docs[1].updatedAt);
    const pre = await app.inject({ method: 'GET', url: '/api/db/notes/docs?prefix=day.', headers: A });
    expect(pre.json().docs.map((d: any) => d.key)).toEqual(['day.1', 'day.2']);
    const otherApp = await app.inject({ method: 'GET', url: '/api/db/elsewhere/docs', headers: A });
    expect(otherApp.json()).toEqual({ docs: [] });
  });
});

describe('versioning', () => {
  it('If-Match must equal the current version, else 412 with the current version', async () => {
    await put('k', '1', 'application/json');
    const stale = await put('k', '2', 'application/json', { ...A, 'if-match': '"0"' });
    expect(stale.statusCode).toBe(412);
    expect(stale.json()).toEqual({ error: 'version_mismatch', version: 1 });
    const ok = await put('k', '2', 'application/json', { ...A, 'if-match': '"1"' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().version).toBe(2);
    expect((await get('k')).headers.etag).toBe('"2"');
  });

  it('If-None-Match: * only creates', async () => {
    expect((await put('k', 'a', 'text/plain', { ...A, 'if-none-match': '*' })).statusCode).toBe(200);
    const again = await put('k', 'b', 'text/plain', { ...A, 'if-none-match': '*' });
    expect(again.statusCode).toBe(412);
    expect(again.json()).toEqual({ error: 'version_mismatch', version: 1 });
    expect((await get('k')).body).toBe('a');
  });

  it('DELETE answers ok, honours If-Match, and 404s when missing', async () => {
    await put('k', 'a', 'text/plain');
    const stale = await app.inject({ method: 'DELETE', url: URL_('k'), headers: { ...A, 'if-match': '"7"' } });
    expect(stale.statusCode).toBe(412);
    expect(stale.json()).toEqual({ error: 'version_mismatch', version: 1 });
    const ok = await app.inject({ method: 'DELETE', url: URL_('k'), headers: { ...A, 'if-match': '"1"' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ ok: true });
    const gone = await del('k');
    expect(gone.statusCode).toBe(404);
    expect(gone.json()).toEqual({ error: 'not_found' });
    expect((await get('k')).statusCode).toBe(404);
  });
});

describe('limits', () => {
  it('413 too_large for a body over 1 MiB', async () => {
    const res = await put('big', 'x'.repeat(DOC_MAX_BYTES + 1), 'text/plain');
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({ error: 'too_large' });
    const huge = await put('big', 'x'.repeat(DOC_MAX_BYTES + 5000), 'text/plain');
    expect(huge.statusCode).toBe(413);
    expect(huge.json()).toEqual({ error: 'too_large' });
    expect((await put('fits', 'x'.repeat(DOC_MAX_BYTES), 'text/plain')).statusCode).toBe(200);
  });

  it('507 quota_exceeded when the user is out of storage', async () => {
    await dbRun(
      `INSERT INTO bilko_db_docs (app, user_email, key, kind, body, bytes, version, updated_at) VALUES (?, ?, ?, 'text', '', ?, 1, ?)`,
      'other-app', 'a@t.dev', 'filler', USER_QUOTA_BYTES - 2, Date.now(),
    );
    const res = await put('k', 'abc', 'text/plain');
    expect(res.statusCode).toBe(507);
    expect(res.json()).toEqual({ error: 'quota_exceeded' });
    expect((await put('k', 'ab', 'text/plain')).statusCode).toBe(200);
    expect((await put('k', 'abc', 'text/plain', B)).statusCode).toBe(200);
  });

  it('429 rate_limited with Retry-After after 300 writes a minute per user', async () => {
    for (let i = 0; i < 300; i++) expect(bilkoDbWriteLimiter.hit('a@t.dev').ok).toBe(true);
    const res = await put('k', 'a', 'text/plain');
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe('rate_limited');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect((await del('k')).statusCode).toBe(429);
    // Reads stay open and other users have their own budget.
    expect((await get('k')).statusCode).toBe(404);
    expect((await put('k', 'b', 'text/plain', B)).statusCode).toBe(200);
  });

  it('counts real route writes and resets after the window', async () => {
    const now = Date.now();
    for (let i = 0; i < 299; i++) bilkoDbWriteLimiter.hit('a@t.dev', now);
    expect((await put('k', 'a', 'text/plain')).statusCode).toBe(200);
    expect((await put('k', 'b', 'text/plain')).statusCode).toBe(429);
    expect(bilkoDbWriteLimiter.hit('a@t.dev', now + 60_001).ok).toBe(true);
  });
});

describe('user isolation', () => {
  it('user A never reads, lists, overwrites or deletes user B documents', async () => {
    await put('secret', '{"b":1}', 'application/json', B);
    expect((await get('secret', A)).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/db/notes/docs', headers: A })).json()).toEqual({ docs: [] });
    expect((await del('secret', A)).statusCode).toBe(404);
    // A's write to the same key creates A's own doc (version 1), leaving B's untouched.
    const aw = await put('secret', '{"a":1}', 'application/json', A);
    expect(aw.json().version).toBe(1);
    const aCond = await put('secret', '{"a":2}', 'application/json', { ...A, 'if-match': '"1"' });
    expect(aCond.json().version).toBe(2);
    const bRead = await get('secret', B);
    expect(bRead.body).toBe('{"b":1}');
    expect(bRead.headers.etag).toBe('"1"');
    expect((await del('secret', A)).statusCode).toBe(200);
    expect((await get('secret', B)).statusCode).toBe(200);
  });
});
