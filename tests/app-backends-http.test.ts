import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import staticPlugin from '@fastify/static';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseAppBackends } from '../server/app-backends/config.js';
import { registerAppBackendRoutes, APP_BACKEND_BODY_LIMIT } from '../server/app-backends/http.js';

interface Seen {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

const seen: Seen[] = [];

const upstream = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    seen.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
    const path = (req.url ?? '').split('?')[0];
    if (path === '/api/cookie') {
      res.writeHead(200, {
        'content-type': 'application/json',
        'set-cookie': 'sid=abc; HttpOnly',
        'cache-control': 'public, max-age=60',
        etag: '"v1"',
        'x-internal': 'secret',
      });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (path === '/api/plain') {
      res.writeHead(201, { 'content-type': 'text/plain' });
      res.end('plain');
      return;
    }
    if (path === '/api/redirect') {
      res.writeHead(302, { location: '/elsewhere' });
      res.end();
      return;
    }
    // Echo: status 200, body = request body, content-type mirrors the request.
    res.writeHead(200, { 'content-type': req.headers['content-type'] ?? 'application/octet-stream' });
    res.end(body);
  });
});

const hung = http.createServer(() => {
  /* never answers */
});

let port = 0;
let deadPort = 0;
let hungPort = 0;
let staticRoot = '';

function listen(s: http.Server): Promise<number> {
  return new Promise((resolve) => s.listen(0, '127.0.0.1', () => resolve((s.address() as AddressInfo).port)));
}

async function buildApp(backendsRaw: string, timeoutMs?: number): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(staticPlugin, { root: staticRoot, prefix: '/' });
  registerAppBackendRoutes(app, parseAppBackends(backendsRaw, () => {}), timeoutMs ? { timeoutMs } : undefined);
  await app.ready();
  return app;
}

let app: FastifyInstance;

beforeAll(async () => {
  port = await listen(upstream);
  hungPort = await listen(hung);
  const dead = http.createServer();
  deadPort = await listen(dead);
  await new Promise<void>((r) => dead.close(() => r()));

  staticRoot = mkdtempSync(join(tmpdir(), 'app-backends-http-'));
  mkdirSync(join(staticRoot, 'projects/demo-app'), { recursive: true });
  mkdirSync(join(staticRoot, 'projects/other-app/api'), { recursive: true });
  writeFileSync(join(staticRoot, 'projects/demo-app/index.html'), '<h1>demo</h1>');
  writeFileSync(join(staticRoot, 'projects/other-app/api/data.json'), '{"static":true}');

  app = await buildApp(`demo-app=http://127.0.0.1:${port}`);
});

afterAll(async () => {
  await app.close();
  hung.closeAllConnections();
  upstream.closeAllConnections();
  await new Promise<void>((r) => hung.close(() => r()));
  await new Promise<void>((r) => upstream.close(() => r()));
});

beforeEach(() => {
  seen.length = 0;
});

describe('registerAppBackendRoutes', () => {
  it('strips the prefix and keeps the query string', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/demo-app/api/items/7?x=1&y=two' });
    expect(res.statusCode).toBe(200);
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe('/api/items/7?x=1&y=two');
    expect(seen[0].method).toBe('GET');
  });

  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const) {
    it(`${method} forwards the method`, async () => {
      const res = await app.inject({ method, url: '/projects/demo-app/api/echo' });
      expect(res.statusCode).toBe(200);
      expect(seen[0].method).toBe(method);
    });
    if (method === 'GET') continue;
    it(`${method} passes JSON and octet-stream bodies byte-identical`, async () => {
      const json = Buffer.from('{ "a":1,  "b":[true,null], "s":"\\u00e9" }');
      let res = await app.inject({
        method,
        url: '/projects/demo-app/api/echo',
        headers: { 'content-type': 'application/json' },
        payload: json,
      });
      expect(res.statusCode).toBe(200);
      expect(seen[0].body.equals(json)).toBe(true);
      expect(res.rawPayload.equals(json)).toBe(true);

      const bin = Buffer.from([0, 1, 2, 255, 254, 10, 13, 0, 128]);
      res = await app.inject({
        method,
        url: '/projects/demo-app/api/echo',
        headers: { 'content-type': 'application/octet-stream' },
        payload: bin,
      });
      expect(res.statusCode).toBe(200);
      expect(seen[1].body.equals(bin)).toBe(true);
      expect(res.rawPayload.equals(bin)).toBe(true);
    });
  }

  it('drops Cookie, keeps Authorization going in', async () => {
    await app.inject({
      method: 'GET',
      url: '/projects/demo-app/api/echo',
      headers: { cookie: 'session=xyz', authorization: 'Bearer t0k' },
    });
    expect(seen[0].headers.cookie).toBeUndefined();
    expect(seen[0].headers.authorization).toBe('Bearer t0k');
  });

  it('drops Set-Cookie and non-allowlisted headers coming out, keeps allowlisted ones', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/demo-app/api/cookie' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.headers['x-internal']).toBeUndefined();
    expect(res.headers['cache-control']).toBe('public, max-age=60');
    expect(res.headers.etag).toBe('"v1"');
    expect(res.json()).toEqual({ ok: true });
  });

  it('passes status through and defaults cache-control to no-store', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/demo-app/api/plain' });
    expect(res.statusCode).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.body).toBe('plain');
  });

  it('passes redirects through without following them', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects/demo-app/api/redirect' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/elsewhere');
    expect(seen).toHaveLength(1);
  });

  it('answers 400 bad_path for a traversal without contacting the backend', async () => {
    // app.inject normalizes dot segments, so send the raw path over a real socket.
    const live = await buildApp(`demo-app=http://127.0.0.1:${port}`);
    try {
      await live.listen({ port: 0, host: '127.0.0.1' });
      const livePort = (live.server.address() as AddressInfo).port;
      for (const path of ['/projects/demo-app/api/%2e%2e/secret', '/projects/demo-app/api/../../secret']) {
        const { status, body } = await new Promise<{ status: number; body: string }>((resolve, reject) => {
          const r = http.request({ host: '127.0.0.1', port: livePort, path, method: 'GET' }, (res) => {
            let b = '';
            res.setEncoding('utf8');
            res.on('data', (c: string) => (b += c));
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body: b }));
          });
          r.on('error', reject);
          r.end();
        });
        expect(status, path).toBe(400);
        expect(JSON.parse(body)).toEqual({ error: 'bad_path' });
      }
      expect(seen).toHaveLength(0);
    } finally {
      await live.close();
    }
  });

  it('rejects a 70 KiB body with 413 and never reaches the upstream', async () => {
    expect(APP_BACKEND_BODY_LIMIT).toBe(65536);
    const res = await app.inject({
      method: 'POST',
      url: '/projects/demo-app/api/echo',
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.alloc(70 * 1024, 7),
    });
    expect(res.statusCode).toBe(413);
    expect(seen).toHaveLength(0);
  });

  it('answers 502 backend_unavailable for a closed port', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const dead = await buildApp(`demo-app=http://127.0.0.1:${deadPort}`);
    try {
      const res = await dead.inject({
        method: 'GET',
        url: '/projects/demo-app/api/health?token=hidden',
        headers: { authorization: 'Bearer secret-auth', cookie: 'c=secret-cookie' },
      });
      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual({ error: 'backend_unavailable' });
      expect(res.headers['cache-control']).toBe('no-store');
      expect(warn).toHaveBeenCalledTimes(1);
      const msg = String(warn.mock.calls[0][0]);
      expect(msg).toContain('demo-app');
      expect(msg).toContain('GET');
      expect(msg).toContain('/projects/demo-app/api/health');
      expect(msg).not.toContain('hidden');
      expect(msg).not.toContain('secret-auth');
      expect(msg).not.toContain('secret-cookie');
    } finally {
      warn.mockRestore();
      await dead.close();
    }
  });

  it('answers 502 backend_unavailable when the upstream hangs past timeoutMs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const slow = await buildApp(`demo-app=http://127.0.0.1:${hungPort}`, 200);
    try {
      const started = Date.now();
      const res = await slow.inject({ method: 'GET', url: '/projects/demo-app/api/slow' });
      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual({ error: 'backend_unavailable' });
      expect(res.headers['cache-control']).toBe('no-store');
      expect(Date.now() - started).toBeLessThan(5000);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
      await slow.close();
    }
  });

  it('leaves static files under /projects/ to @fastify/static', async () => {
    let res = await app.inject({ method: 'GET', url: '/projects/demo-app/index.html' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('<h1>demo</h1>');
    res = await app.inject({ method: 'GET', url: '/projects/other-app/api/data.json' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ static: true });
    expect(seen).toHaveLength(0);
  });

  it('registers nothing with an empty backend list', async () => {
    const empty = Fastify({ logger: false });
    await empty.register(staticPlugin, { root: staticRoot, prefix: '/' });
    registerAppBackendRoutes(empty, []);
    await empty.ready();
    try {
      expect(empty.printRoutes()).not.toContain('projects');
      const res = await empty.inject({ method: 'GET', url: '/projects/demo-app/api/health' });
      expect(res.statusCode).toBe(404);
      expect(seen).toHaveLength(0);
    } finally {
      await empty.close();
    }
  });
});
