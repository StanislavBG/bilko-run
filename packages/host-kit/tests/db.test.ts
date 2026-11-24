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

import { bilkoDb, useDoc, BilkoDbError } from '../src/db';

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

describe('useDoc', () => {
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
