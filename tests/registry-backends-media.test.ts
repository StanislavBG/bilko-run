// @vitest-environment node
// The app-backend forwarding map and the listing-media declaration check read the registry
// snapshot, so a registry write followed by refreshRegistry() takes effect with no restart.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { Duplex } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { dbRun, initDb } from '../server/db.js';
import { putProject, deleteProject } from '../server/services/registry-db.js';
import { refreshRegistry } from '../server/registry-runtime.js';
import { createLiveAppBackends, type LiveAppBackends } from '../server/app-backends/live.js';
import { appBackendSlugOf, registerAppBackendRoutes } from '../server/app-backends/http.js';
import { createAppBackendUpgrade } from '../server/app-backends/socket.js';
import { isListingMediaDeclared } from '../server/services/listing-media-declared.js';

function entry(slug: string, host: Record<string, unknown> = {}, listing?: Record<string, unknown>) {
  return {
    slug,
    name: slug.toUpperCase(),
    tagline: `${slug} tagline`,
    category: 'Test',
    status: 'live',
    year: 2026,
    host: { kind: 'static-path', path: `/projects/${slug}/`, ...host },
    ...(listing ? { listing } : {}),
  };
}

async function put(e: unknown): Promise<void> {
  const res = await putProject(e, 'test');
  expect(res).not.toHaveProperty('error');
  await refreshRegistry();
}

const quiet = { warn: () => {}, log: () => {} };

let fetchSpy: ReturnType<typeof vi.spyOn>;
let live: LiveAppBackends | undefined;
let app: FastifyInstance | undefined;
const metered: Array<string | undefined> = [];

beforeAll(async () => {
  await initDb();
});

beforeEach(async () => {
  await dbRun('DELETE FROM bilko_db_projects');
  await dbRun('DELETE FROM bilko_db_project_log');
  await dbRun('DELETE FROM bilko_db_meta');
  await refreshRegistry();
  metered.length = 0;
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }),
  );
});

afterEach(async () => {
  fetchSpy.mockRestore();
  live?.stop();
  live = undefined;
  await app?.close();
  app = undefined;
});

async function buildApp(l: LiveAppBackends): Promise<FastifyInstance> {
  const a = Fastify({ logger: false });
  // Egress metering reads the per-request slug tag (server/egress.ts).
  a.addHook('onResponse', async (req) => {
    metered.push(appBackendSlugOf(req));
  });
  a.get('/*', async () => 'fallthrough');
  registerAppBackendRoutes(a, l.current);
  await a.ready();
  return a;
}

function forwardedTo(): string[] {
  return fetchSpy.mock.calls.map((c) => String(c[0]));
}

describe('live app-backend map', () => {
  it('follows a backend set, changed and cleared through refreshRegistry() with no restart', async () => {
    await put(entry('demo-app'));
    live = createLiveAppBackends({ ...quiet });
    app = await buildApp(live);
    expect(live.sources()).toEqual({});

    // No backend yet: the route does not claim the path, the next route answers.
    let res = await app.inject({ method: 'GET', url: '/projects/demo-app/api/items?x=1' });
    expect(res.body).toBe('fallthrough');
    expect(fetchSpy).not.toHaveBeenCalled();

    // Set.
    await put(entry('demo-app', { backend: 'https://one.example.com' }));
    expect(live.sources()).toEqual({ 'demo-app': 'registry' });
    res = await app.inject({ method: 'GET', url: '/projects/demo-app/api/items?x=1' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(forwardedTo()).toEqual(['https://one.example.com/api/items?x=1']);

    // Changed.
    await put(entry('demo-app', { backend: 'https://two.example.com' }));
    res = await app.inject({ method: 'POST', url: '/projects/demo-app/api/save', payload: 'hi', headers: { 'content-type': 'text/plain' } });
    expect(res.statusCode).toBe(200);
    expect(forwardedTo()[1]).toBe('https://two.example.com/api/save');

    // Cleared (backend removed, then the entry deleted).
    await put(entry('demo-app'));
    expect(live.sources()).toEqual({});
    res = await app.inject({ method: 'GET', url: '/projects/demo-app/api/items' });
    expect(res.body).toBe('fallthrough');
    await put(entry('demo-app', { backend: 'https://three.example.com' }));
    expect(live.current().map((b) => b.origin)).toEqual(['https://three.example.com']);
    await deleteProject('demo-app', 'test');
    await refreshRegistry();
    expect(live.current()).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(metered).toEqual([undefined, 'demo-app', 'demo-app', undefined]);
  });

  it('keeps an APP_BACKENDS override winning over the registry across changes', async () => {
    await put(entry('demo-app', { backend: 'https://reg.example.com' }));
    live = createLiveAppBackends({ envRaw: 'demo-app=https://env.example.com', ...quiet });
    app = await buildApp(live);
    expect(live.sources()).toEqual({ 'demo-app': 'env' });

    await put(entry('demo-app', { backend: 'https://reg2.example.com' }));
    await put(entry('other-app', { backend: 'https://other.example.com' }));
    expect(live.sources()).toEqual({ 'demo-app': 'env', 'other-app': 'registry' });

    await app.inject({ method: 'GET', url: '/projects/demo-app/api/a' });
    await app.inject({ method: 'GET', url: '/projects/other-app/api/b' });
    expect(forwardedTo()).toEqual(['https://env.example.com/api/a', 'https://other.example.com/api/b']);

    // The env entry survives the registry clearing its backend.
    await put(entry('demo-app'));
    expect(live.sources()).toEqual({ 'demo-app': 'env', 'other-app': 'registry' });
  });

  it('claims WebSocket upgrades only for slugs in the current map', async () => {
    live = createLiveAppBackends({ ...quiet });
    const upgrade = createAppBackendUpgrade(live.current, { handshakeTimeoutMs: 300 });
    const fake = (url: string) => {
      const socket = new Duplex({ read() {}, write(_c, _e, cb) { cb(); } });
      const req = { url, headers: {}, socket: {} } as unknown as IncomingMessage;
      return { req, socket };
    };
    try {
      let f = fake('/projects/demo-app/api/socket');
      expect(upgrade.handleUpgrade(f.req, f.socket, Buffer.alloc(0))).toBe(false);

      // Port 1 refuses at once: the claimed upgrade answers 502 and the socket closes.
      await put(entry('demo-app', { backend: 'https://127.0.0.1:1' }));
      f = fake('/projects/demo-app/api/socket');
      const closed = new Promise<void>((r) => f.socket.once('close', () => r()));
      expect(upgrade.handleUpgrade(f.req, f.socket, Buffer.alloc(0))).toBe(true);
      await closed;

      await put(entry('demo-app'));
      f = fake('/projects/demo-app/api/socket');
      expect(upgrade.handleUpgrade(f.req, f.socket, Buffer.alloc(0))).toBe(false);
    } finally {
      upgrade.closeAll();
    }
  });
});

describe('listing media declared by the registry snapshot', () => {
  const file = `${'c'.repeat(64)}.png`;
  const path = `/projects/media-app/_media/${file}`;

  it('accepts a path once declared and refuses it once removed; a declared path never fetches', async () => {
    const noGithub = vi.fn(async () => new Response('[]', { status: 200 }));
    await put(entry('media-app'));
    expect(await isListingMediaDeclared('media-app', file, { fetch: noGithub })).toBeUndefined();

    await put(entry('media-app', {}, { icon: path }));
    expect(await isListingMediaDeclared('media-app', file)).toBe('icon');
    // Another slug's declaration never counts.
    expect(await isListingMediaDeclared('other-app', file, { fetch: noGithub })).toBeUndefined();

    await put(entry('media-app'));
    expect(await isListingMediaDeclared('media-app', file, { fetch: noGithub })).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
