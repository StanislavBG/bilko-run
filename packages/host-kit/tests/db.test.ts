import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const auth = vi.hoisted(() => ({ signedIn: true }));

vi.mock('../src/auth', () => ({
  authFetch: async (input: string, init: RequestInit = {}) => {
    if (!auth.signedIn) return null;
    const headers = new Headers(init.headers);
    headers.set('authorization', 'Bearer jwt-test');
    return fetch(input, { ...init, headers });
  },
}));

import { bilkoDb, bilkoTeam, useDoc, BilkoDbError } from '../src/db';

type Call = { url: string; method: string; headers: Headers; body: unknown };
let calls: Call[];
let responder: (c: Call) => Response;

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });

beforeEach(() => {
  auth.signedIn = true;
  calls = [];
  responder = () => json(200, {});
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const c: Call = { url, method: init.method ?? 'GET', headers: new Headers(init.headers), body: init.body };
    calls.push(c);
    return responder(c);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const BASE = 'https://bilko.run/api/db/notes';

describe('bilkoDb documents', () => {
  it('list: GET /docs with optional prefix, Bearer attached', async () => {
    responder = () => json(200, { docs: [{ key: 'a', type: 'json', bytes: 2, version: 1, updatedAt: 'x' }] });
    const db = bilkoDb('notes');
    expect(await db.list()).toHaveLength(1);
    await db.list('draft.');
    expect(calls[0]).toMatchObject({ url: `${BASE}/docs`, method: 'GET' });
    expect(calls[0].headers.get('authorization')).toBe('Bearer jwt-test');
    expect(calls[1].url).toBe(`${BASE}/docs?prefix=draft.`);
  });

  it('get: parses JSON, reads the version from the ETag, null on 404', async () => {
    responder = () => json(200, { n: 1 }, { etag: '"7"' });
    expect(await bilkoDb('notes').get('doc-1')).toEqual({ value: { n: 1 }, version: 7, type: 'json' });
    expect(calls[0]).toMatchObject({ url: `${BASE}/docs/doc-1`, method: 'GET' });

    responder = () => new Response('hello', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', etag: '"2"' } });
    expect(await bilkoDb('notes').get('t')).toEqual({ value: 'hello', version: 2, type: 'text' });

    responder = () => json(404, { error: 'not_found' });
    expect(await bilkoDb('notes').get('missing')).toBeNull();
  });

  it('put: objects as application/json, { text: true } as text/plain, If-Match / If-None-Match', async () => {
    responder = () => json(200, { key: 'k', type: 'json', version: 3, bytes: 7, updatedAt: 'x' });
    const db = bilkoDb('notes');
    expect((await db.put('k', { a: 1 }, { ifVersion: 2 })).version).toBe(3);
    expect(calls[0]).toMatchObject({ url: `${BASE}/docs/k`, method: 'PUT', body: '{"a":1}' });
    expect(calls[0].headers.get('content-type')).toBe('application/json');
    expect(calls[0].headers.get('if-match')).toBe('"2"');
    expect(calls[0].headers.get('if-none-match')).toBeNull();

    await db.put('k', '# hi', { text: true, createOnly: true });
    expect(calls[1].body).toBe('# hi');
    expect(calls[1].headers.get('content-type')).toMatch(/^text\/plain/);
    expect(calls[1].headers.get('if-none-match')).toBe('*');
    expect(calls[1].headers.get('if-match')).toBeNull();

    await db.put('k', 'a string without text flag');
    expect(calls[2].headers.get('content-type')).toBe('application/json');
    expect(calls[2].body).toBe('"a string without text flag"');
  });

  it('remove: DELETE with If-Match; false on 404', async () => {
    const db = bilkoDb('notes');
    expect(await db.remove('k', { ifVersion: 4 })).toBe(true);
    expect(calls[0]).toMatchObject({ url: `${BASE}/docs/k`, method: 'DELETE' });
    expect(calls[0].headers.get('if-match')).toBe('"4"');
    responder = () => json(404, { error: 'not_found' });
    expect(await db.remove('k')).toBe(false);
    expect(calls[1].headers.get('if-match')).toBeNull();
  });

  it('maps failures to BilkoDbError with status, code and version', async () => {
    const db = bilkoDb('notes');
    responder = () => json(412, { error: 'version_mismatch', version: 9 });
    const e = await db.put('k', {}, { ifVersion: 1 }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(BilkoDbError);
    expect(e).toMatchObject({ status: 412, code: 'version_mismatch', version: 9 });

    responder = () => json(507, { error: 'quota_exceeded' });
    await expect(db.put('k', {})).rejects.toMatchObject({ status: 507, code: 'quota_exceeded' });

    responder = () => json(429, { error: 'rate_limited', retryAfterSec: 3 });
    await expect(db.remove('k')).rejects.toMatchObject({ status: 429, code: 'rate_limited' });

    responder = () => new Response('<html>oops</html>', { status: 502 });
    await expect(db.list()).rejects.toMatchObject({ status: 502, code: 'http_502' });

    auth.signedIn = false;
    await expect(db.get('k')).rejects.toMatchObject({ status: 401, code: 'signed_out' });
    expect(calls).toHaveLength(4);
  });
});

describe('bilkoDb images', () => {
  it('upload, list, remove and url', async () => {
    const view = { id: 'abc_123', url: '/api/db/notes/images/abc_123', type: 'image/png', bytes: 3, createdAt: 'x' };
    responder = (c) => (c.method === 'POST' ? json(201, view) : json(200, { images: [view] }));
    const db = bilkoDb('notes');
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });

    const img = await db.images.upload(blob);
    expect(calls[0]).toMatchObject({ url: `${BASE}/images`, method: 'POST', body: blob });
    expect(calls[0].headers.get('content-type')).toBe('image/png');
    expect(img.url).toBe(`${BASE}/images/abc_123`);

    expect((await db.images.list())[0].url).toBe(`${BASE}/images/abc_123`);
    expect(calls[1]).toMatchObject({ url: `${BASE}/images`, method: 'GET' });

    responder = () => json(200, { ok: true });
    expect(await db.images.remove('abc_123')).toBe(true);
    expect(calls[2]).toMatchObject({ url: `${BASE}/images/abc_123`, method: 'DELETE' });

    expect(db.images.url('abc_123')).toBe(`${BASE}/images/abc_123`);

    responder = () => json(415, { error: 'unsupported_media_type' });
    await expect(db.images.upload(new Blob(['x'], { type: 'image/svg+xml' }))).rejects.toMatchObject({
      status: 415,
      code: 'unsupported_media_type',
    });
  });
});

const TEAM = `${BASE}/team`;

describe('bilkoDb team storage', () => {
  it('docs: list, get, put, remove go to /team/docs', async () => {
    responder = (c) => {
      if (c.url.startsWith(`${TEAM}/docs?`) || c.url === `${TEAM}/docs`) return json(200, { docs: [] });
      if (c.method === 'GET') return json(200, { n: 1 }, { etag: '"3"' });
      if (c.method === 'PUT') return json(200, { key: 'k', type: 'json', version: 4, bytes: 7, updatedAt: 'x' });
      return json(404, { error: 'not_found' });
    };
    const db = bilkoDb('notes', { team: true });
    await db.list();
    await db.list('draft.');
    expect(await db.get('doc 1')).toEqual({ value: { n: 1 }, version: 3, type: 'json' });
    await db.put('k', { a: 1 }, { ifVersion: 3 });
    expect(await db.remove('k')).toBe(false);
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['GET', `${TEAM}/docs`],
      ['GET', `${TEAM}/docs?prefix=draft.`],
      ['GET', `${TEAM}/docs/doc%201`],
      ['PUT', `${TEAM}/docs/k`],
      ['DELETE', `${TEAM}/docs/k`],
    ]);
    expect(calls[3].headers.get('if-match')).toBe('"3"');
  });

  it('images: upload, list, remove go to /team/images; urls stay public', async () => {
    const view = { id: 'img_1', url: '/api/db/notes/images/img_1', type: 'image/png', bytes: 3, createdAt: 'x' };
    responder = (c) => (c.method === 'POST' ? json(201, view) : c.method === 'GET' ? json(200, { images: [view] }) : json(200, { ok: true }));
    const db = bilkoDb('notes', { team: true });
    const img = await db.images.upload(new Blob([new Uint8Array([1])], { type: 'image/png' }));
    const listed = await db.images.list();
    expect(await db.images.remove('img_1')).toBe(true);
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['POST', `${TEAM}/images`],
      ['GET', `${TEAM}/images`],
      ['DELETE', `${TEAM}/images/img_1`],
    ]);
    expect(img.url).toBe(`${BASE}/images/img_1`);
    expect(listed[0].url).toBe(`${BASE}/images/img_1`);
    expect(db.images.url('img_1')).toBe(`${BASE}/images/img_1`);
  });

  it('team: false and no opts keep the personal URLs', async () => {
    responder = (c) => (c.method === 'GET' && c.url.includes('/docs/') ? json(404, { error: 'not_found' }) : json(200, { docs: [], images: [] }));
    for (const db of [bilkoDb('notes'), bilkoDb('notes', {}), bilkoDb('notes', { team: false })]) {
      await db.list();
      await db.get('k');
      await db.images.list();
      expect(db.images.url('i')).toBe(`${BASE}/images/i`);
    }
    expect(calls.every((c) => !c.url.includes('/team'))).toBe(true);
    expect(calls.slice(0, 3).map((c) => c.url)).toEqual([`${BASE}/docs`, `${BASE}/docs/k`, `${BASE}/images`]);
  });
});

describe('bilkoTeam', () => {
  it('get: GET /team returns app, role and members', async () => {
    const body = { app: 'notes', role: 'owner', members: [{ email: 'a@x.io', role: 'owner', addedAt: '2026-11-23T00:00:00.000Z' }] };
    responder = () => json(200, body);
    expect(await bilkoTeam('notes').get()).toEqual(body);
    expect(calls[0]).toMatchObject({ url: TEAM, method: 'GET' });
    expect(calls[0].headers.get('authorization')).toBe('Bearer jwt-test');
  });

  it('set: PUT /team/members/<encoded email> with JSON { role }', async () => {
    responder = () => json(200, { email: 'b+1@x.io', role: 'member', created: true });
    expect(await bilkoTeam('notes').set('b+1@x.io', 'member')).toEqual({ email: 'b+1@x.io', role: 'member', created: true });
    expect(calls[0]).toMatchObject({ url: `${TEAM}/members/b%2B1%40x.io`, method: 'PUT', body: '{"role":"member"}' });
    expect(calls[0].headers.get('content-type')).toBe('application/json');
  });

  it('remove: DELETE /team/members/<encoded email>; false on 404', async () => {
    responder = () => json(200, { ok: true });
    const team = bilkoTeam('notes');
    expect(await team.remove('b+1@x.io')).toBe(true);
    expect(calls[0]).toMatchObject({ url: `${TEAM}/members/b%2B1%40x.io`, method: 'DELETE' });
    responder = () => json(404, { error: 'not_found' });
    expect(await team.remove('gone@x.io')).toBe(false);
  });

  it('maps failures to BilkoDbError with the API code', async () => {
    const team = bilkoTeam('notes');
    responder = () => json(403, { error: 'not_member' });
    const e = await team.get().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(BilkoDbError);
    expect(e).toMatchObject({ status: 403, code: 'not_member' });

    responder = () => json(409, { error: 'last_owner' });
    await expect(team.remove('a@x.io')).rejects.toMatchObject({ status: 409, code: 'last_owner' });

    responder = () => json(409, { error: 'team_full' });
    await expect(team.set('c@x.io', 'member')).rejects.toMatchObject({ status: 409, code: 'team_full' });

    auth.signedIn = false;
    await expect(team.get()).rejects.toMatchObject({ status: 401, code: 'signed_out' });
  });
});

describe('useDoc', () => {
  it('team: true reads, saves and removes through /team/docs and reloads when team changes', async () => {
    responder = (c) => {
      if (c.method === 'GET') return json(200, { scope: c.url.includes('/team/') ? 'team' : 'personal' }, { etag: '"1"' });
      if (c.method === 'PUT') return json(200, { key: 'k', type: 'json', version: 2, bytes: 1, updatedAt: 'x' });
      return json(200, { ok: true });
    };
    const { result, rerender } = renderHook(({ team }) => useDoc<{ scope: string }>('notes', 'k', { team }), {
      initialProps: { team: true },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.value).toEqual({ scope: 'team' });
    expect(calls[0].url).toBe(`${TEAM}/docs/k`);

    await act(async () => { await result.current.save({ scope: 'team' }); });
    expect(calls[1]).toMatchObject({ url: `${TEAM}/docs/k`, method: 'PUT' });
    await act(async () => { await result.current.remove(); });
    expect(calls[2]).toMatchObject({ url: `${TEAM}/docs/k`, method: 'DELETE' });

    // A fresh options object with the same flag does not refetch.
    rerender({ team: true });
    expect(calls).toHaveLength(3);

    rerender({ team: false });
    await waitFor(() => expect(result.current.value).toEqual({ scope: 'personal' }));
    expect(calls[3]).toMatchObject({ url: `${BASE}/docs/k`, method: 'GET' });
  });


  it('loads, saves with the version it read, and surfaces version_mismatch without overwriting', async () => {
    let stored = { value: { n: 1 }, version: 5 };
    responder = (c) => {
      if (c.method === 'GET') return json(200, stored.value, { etag: `"${stored.version}"` });
      const want = Number(/\d+/.exec(c.headers.get('if-match') ?? '')?.[0]);
      if (want !== stored.version) return json(412, { error: 'version_mismatch', version: stored.version });
      stored = { value: JSON.parse(c.body as string), version: stored.version + 1 };
      return json(200, { key: 'k', type: 'json', version: stored.version, bytes: 1, updatedAt: 'x' });
    };

    const { result } = renderHook(() => useDoc<{ n: number }>('notes', 'k'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ value: { n: 1 }, version: 5, error: null });

    let ok = false;
    await act(async () => { ok = await result.current.save({ n: 2 }); });
    expect(ok).toBe(true);
    expect(calls[1].headers.get('if-match')).toBe('"5"');
    expect(result.current).toMatchObject({ value: { n: 2 }, version: 6 });

    // Another tab writes; our next save still carries version 6 and must not overwrite.
    stored = { value: { n: 99 }, version: 7 };
    await act(async () => { ok = await result.current.save({ n: 3 }); });
    expect(ok).toBe(false);
    expect(calls[2].headers.get('if-match')).toBe('"6"');
    expect(result.current.error).toBeInstanceOf(BilkoDbError);
    expect(result.current.error).toMatchObject({ code: 'version_mismatch', status: 412 });
    expect(stored.value).toEqual({ n: 99 });
    expect(result.current).toMatchObject({ value: { n: 2 }, version: 6 });
  });

  it('a missing doc saves create-only, then remove sends the new version', async () => {
    responder = (c) => {
      if (c.method === 'GET') return json(404, { error: 'not_found' });
      if (c.method === 'PUT') return json(200, { key: 'k', type: 'text', version: 1, bytes: 2, updatedAt: 'x' });
      return json(200, { ok: true });
    };
    const { result } = renderHook(() => useDoc<string>('notes', 'k'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ value: null, version: null, error: null });

    await act(async () => { await result.current.save('hi'); });
    expect(calls[1].headers.get('if-none-match')).toBe('*');
    expect(calls[1].headers.get('if-match')).toBeNull();
    expect(calls[1].headers.get('content-type')).toMatch(/^text\/plain/);
    expect(result.current.version).toBe(1);

    await act(async () => { await result.current.remove(); });
    expect(calls[2]).toMatchObject({ method: 'DELETE' });
    expect(calls[2].headers.get('if-match')).toBe('"1"');
    expect(result.current).toMatchObject({ value: null, version: null });
  });

  it('reports signed_out as an error', async () => {
    auth.signedIn = false;
    const { result } = renderHook(() => useDoc('notes', 'k'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatchObject({ code: 'signed_out', status: 401 });
  });
});
