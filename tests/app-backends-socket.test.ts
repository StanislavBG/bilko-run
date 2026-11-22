import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http, { type IncomingMessage } from 'node:http';
import net, { type AddressInfo } from 'node:net';
import { Duplex } from 'node:stream';
import WebSocket, { WebSocketServer } from 'ws';
import type { AppBackend } from '../server/app-backends/config.js';
import { createAppBackendUpgrade, type AppBackendUpgrade } from '../server/app-backends/socket.js';

// ── fake upstream ───────────────────────────────────────────────────────────
let upServer: http.Server;
let upPort: number;
let upWss: WebSocketServer;
const upSockets: WebSocket[] = [];
const upRequests: IncomingMessage[] = [];

// ── forwarder ───────────────────────────────────────────────────────────────
let fwdServer: http.Server;
let fwdPort: number;
let forwarder: AppBackendUpgrade;
const clients: WebSocket[] = [];

// a TCP server that accepts and never answers (handshake timeout)
let silent: net.Server;
let silentPort: number;
const silentConns: net.Socket[] = [];

let closedPort: number;

function backend(slug: string, port: number): AppBackend {
  return { slug, origin: `http://127.0.0.1:${port}`, prefix: `/projects/${slug}/api/` };
}

async function waitFor(cond: () => boolean, ms = 3000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
}

function listen(server: http.Server | net.Server): Promise<number> {
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r((server.address() as AddressInfo).port)));
}

beforeAll(async () => {
  upServer = http.createServer((_req, res) => { res.statusCode = 404; res.end(); });
  upWss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => (protocols.has('v2.app') ? 'v2.app' : false),
  });
  upServer.on('upgrade', (req, socket, head) => {
    upRequests.push(req);
    if ((req.url ?? '').startsWith('/api/refuse')) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      socket.destroy();
      return;
    }
    upWss.handleUpgrade(req, socket, head, (ws) => {
      upSockets.push(ws);
      const path = req.url ?? '';
      if (path.startsWith('/api/hello')) ws.send('hello');
      if (path.startsWith('/api/not-ready')) { ws.close(4004, 'not_ready'); return; }
      if (path.startsWith('/api/echo') || path.startsWith('/api/rooms')) {
        ws.on('message', (data, isBinary) => ws.send(data, { binary: isBinary }));
      }
    });
  });
  upPort = await listen(upServer);

  silent = net.createServer((c) => { silentConns.push(c); c.on('error', () => {}); });
  silentPort = await listen(silent);

  const tmp = net.createServer();
  closedPort = await listen(tmp);
  await new Promise<void>((r) => tmp.close(() => r()));

  forwarder = createAppBackendUpgrade(
    [backend('demo-app', upPort), backend('slow-app', silentPort), backend('dead-app', closedPort)],
    { handshakeTimeoutMs: 300 },
  );
  fwdServer = http.createServer();
  fwdServer.on('upgrade', (req, socket, head) => {
    if (!forwarder.handleUpgrade(req, socket, head)) {
      socket.write('HTTP/1.1 418 Unclaimed\r\nConnection: close\r\n\r\n');
      socket.destroy();
    }
  });
  fwdPort = await listen(fwdServer);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(clients.splice(0).map((ws) => new Promise<void>((r) => {
    if (ws.readyState === WebSocket.CLOSED) return r();
    ws.once('close', () => r());
    ws.terminate();
  })));
  for (const ws of upSockets.splice(0)) ws.terminate();
  for (const c of silentConns.splice(0)) c.destroy();
  upRequests.length = 0;
  forwarder.closeAll();
});

afterAll(async () => {
  forwarder.closeAll();
  upWss.close();
  await Promise.all([upServer, fwdServer, silent].map((s) => new Promise<void>((r) => s.close(() => r()))));
});

function connect(path: string, opts: WebSocket.ClientOptions & { protocols?: string[] } = {}): WebSocket {
  const { protocols, ...rest } = opts;
  const ws = new WebSocket(`ws://127.0.0.1:${fwdPort}${path}`, protocols, rest);
  clients.push(ws);
  ws.on('error', () => {});
  return ws;
}

function opened(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('unexpected-response', (_q, res) => reject(new Error(`refused ${res.statusCode}`)));
    ws.once('error', reject);
  });
}

function closed(ws: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((r) => ws.once('close', (code, reason) => r({ code, reason: reason.toString() })));
}

function refusedWith(path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const ws = connect(path);
    ws.on('unexpected-response', (_req, res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    ws.on('open', () => reject(new Error('handshake accepted')));
  });
}

function nextMessage(ws: WebSocket): Promise<{ data: Buffer; isBinary: boolean }> {
  return new Promise((r) => ws.once('message', (data, isBinary) => r({ data: data as Buffer, isBinary })));
}

describe('claiming', () => {
  it('returns false and leaves the socket alone off-prefix, for unknown slugs and empty lists', () => {
    const fake = (url: string) => {
      const socket = new Duplex({ read() {}, write(_c, _e, cb) { cb(); } });
      const write = vi.spyOn(socket, 'write');
      const destroy = vi.spyOn(socket, 'destroy');
      const on = vi.spyOn(socket, 'on');
      return { req: { url, headers: {}, socket: {} } as unknown as IncomingMessage, socket, write, destroy, on };
    };
    const empty = createAppBackendUpgrade([]);
    for (const [fwd, url] of [
      [empty, '/projects/demo-app/api/echo'],
      [forwarder, '/projects/other-app/api/echo'],
      [forwarder, '/projects/demo-app/index.html'],
      [forwarder, '/api/rooms/socket/t1'],
      [forwarder, '/projects/demo-app/apix'],
    ] as const) {
      const f = fake(url);
      expect(fwd.handleUpgrade(f.req, f.socket, Buffer.alloc(0))).toBe(false);
      expect(f.write).not.toHaveBeenCalled();
      expect(f.destroy).not.toHaveBeenCalled();
      expect(f.on).not.toHaveBeenCalled();
    }
  });

  it('answers 400 for a rest that buildUpstreamUrl refuses', async () => {
    // a raw request: the ws client would fold the dot segments before sending
    const status = await new Promise<string>((resolve, reject) => {
      const c = net.connect(fwdPort, '127.0.0.1', () => {
        c.write(
          'GET /projects/demo-app/api/%2e%2e/%2e%2e/secret HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\n' +
            'Connection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n',
        );
      });
      let buf = '';
      c.on('data', (d) => { buf += d; });
      c.on('close', () => resolve(buf.split('\r\n')[0] ?? ''));
      c.on('error', reject);
    });
    expect(status).toBe('HTTP/1.1 400 Bad Request');
    expect(upRequests).toHaveLength(0);
  });
});

describe('handshake', () => {
  it('forwards path, query and only the safe headers', async () => {
    const ws = connect('/projects/demo-app/api/rooms/socket/t1?ticket=abc', {
      headers: { cookie: 'session=secret', authorization: 'Bearer tok', origin: 'https://bilko.run' },
    });
    await opened(ws);
    expect(upRequests).toHaveLength(1);
    const req = upRequests[0]!;
    expect(req.url).toBe('/api/rooms/socket/t1?ticket=abc');
    expect(req.headers.cookie).toBeUndefined();
    expect(req.headers.authorization).toBe('Bearer tok');
    expect(req.headers.origin).toBe('https://bilko.run');
    expect(req.headers['x-forwarded-for']).toContain('127.0.0.1');
    expect(forwarder.openCount()).toBe(1);
  });

  it('completes with the subprotocol the upstream chose', async () => {
    const ws = connect('/projects/demo-app/api/echo', { protocols: ['v1.app', 'v2.app'] });
    await opened(ws);
    expect(ws.protocol).toBe('v2.app');
    expect(upRequests[0]!.headers['sec-websocket-protocol']).toBe('v1.app,v2.app');
  });

  it('relays an upstream refusal status', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await refusedWith('/projects/demo-app/api/refuse?ticket=sekrit');
    expect(r.status).toBe(401);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toMatch(/^\[app-backends\] demo-app socket /);
    expect(String(warn.mock.calls[0]![0])).not.toContain('sekrit');
  });

  it('answers 502 for a closed port', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await refusedWith('/projects/dead-app/api/rooms?ticket=sekrit');
    expect(r.status).toBe(502);
    expect(JSON.parse(r.body)).toEqual({ error: 'backend_unavailable' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).not.toContain('sekrit');
  });

  it('answers 502 past the handshake timeout', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await refusedWith('/projects/slow-app/api/rooms?ticket=sekrit');
    expect(r.status).toBe(502);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).not.toContain('sekrit');
  });
});

describe('frames', () => {
  it('passes text and binary both ways with the type kept', async () => {
    const ws = connect('/projects/demo-app/api/echo');
    await opened(ws);
    let m = nextMessage(ws);
    ws.send('hi there');
    let got = await m;
    expect(got.isBinary).toBe(false);
    expect(got.data.toString()).toBe('hi there');

    m = nextMessage(ws);
    ws.send(Buffer.from([1, 2, 3, 255]));
    got = await m;
    expect(got.isBinary).toBe(true);
    expect([...got.data]).toEqual([1, 2, 3, 255]);
  });

  it('delivers a frame the upstream sends the moment it opens', async () => {
    const ws = connect('/projects/demo-app/api/hello');
    const m = nextMessage(ws);
    await opened(ws);
    expect((await m).data.toString()).toBe('hello');
  });

  it('passes ping and pong end to end', async () => {
    const ws = connect('/projects/demo-app/api/echo');
    await opened(ws);
    await waitFor(() => upSockets.length === 1);
    const up = upSockets[0]!;
    const clientPing = new Promise<Buffer>((r) => ws.once('ping', (d) => r(d)));
    const upPong = new Promise<Buffer>((r) => up.once('pong', (d) => r(d)));
    up.ping(Buffer.from('p-123'));
    expect((await clientPing).toString()).toBe('p-123');
    expect((await upPong).toString()).toBe('p-123');
  });

  it('closes a client that sends a frame above 64 KiB with 1009', async () => {
    const ws = connect('/projects/demo-app/api/echo');
    await opened(ws);
    const c = closed(ws);
    ws.send(Buffer.alloc(64 * 1024 + 1));
    expect((await c).code).toBe(1009);
  });
});

describe('close', () => {
  it('relays an upstream 4004 not_ready close', async () => {
    const ws = connect('/projects/demo-app/api/not-ready');
    const c = closed(ws);
    await opened(ws);
    expect(await c).toEqual({ code: 4004, reason: 'not_ready' });
    await waitFor(() => forwarder.openCount() === 0);
  });

  it.each([
    [1000, 'bye'],
    [1012, 'restart'],
    [4000, 'left'],
    [4999, ''],
  ])('relays a client %i close to the upstream', async (code, reason) => {
    const ws = connect('/projects/demo-app/api/echo');
    await opened(ws);
    await waitFor(() => upSockets.length === 1);
    const up = closed(upSockets[0]!);
    ws.close(code, reason);
    expect(await up).toEqual({ code, reason });
    await waitFor(() => forwarder.openCount() === 0);
  });

  it('turns a client close with no code into an upstream close with no code', async () => {
    const ws = connect('/projects/demo-app/api/echo');
    await opened(ws);
    await waitFor(() => upSockets.length === 1);
    const up = closed(upSockets[0]!);
    ws.close();
    expect((await up).code).toBe(1005);
  });

  it('turns a client 1006 into an upstream terminate', async () => {
    const ws = connect('/projects/demo-app/api/echo');
    await opened(ws);
    await waitFor(() => upSockets.length === 1);
    const up = closed(upSockets[0]!);
    ws.terminate();
    expect((await up).code).toBe(1006);
  });

  it('closeAll closes clients with 1012 and upstreams with 1001', async () => {
    const a = connect('/projects/demo-app/api/echo');
    const b = connect('/projects/demo-app/api/echo');
    await Promise.all([opened(a), opened(b)]);
    await waitFor(() => upSockets.length === 2);
    expect(forwarder.openCount()).toBe(2);
    const cs = [closed(a), closed(b)];
    const us = upSockets.map(closed);
    forwarder.closeAll();
    expect(forwarder.openCount()).toBe(0);
    for (const r of await Promise.all(cs)) expect(r).toEqual({ code: 1012, reason: 'server_restart' });
    for (const r of await Promise.all(us)) expect(r).toEqual({ code: 1001, reason: 'going_away' });
  });

  it('closeAll aborts a pending handshake', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ws = connect('/projects/slow-app/api/rooms');
    const failed = new Promise<void>((r) => { ws.once('error', () => r()); ws.once('close', () => r()); });
    await waitFor(() => silentConns.length === 1);
    forwarder.closeAll();
    await failed;
    expect(ws.readyState).not.toBe(WebSocket.OPEN);
    expect(forwarder.openCount()).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });
});
