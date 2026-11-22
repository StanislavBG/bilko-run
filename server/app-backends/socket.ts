/**
 * WebSocket forwarder for app backends: claims upgrades under /projects/<slug>/api/ and pipes
 * them to <origin>/api/<rest>. The client's upgrade completes only once the upstream is open,
 * so a refused or dead upstream is answered with a plain HTTP status. Frames, ping/pong and
 * close codes pass through unchanged. App-agnostic; no module-level state.
 */
import { STATUS_CODES, type IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Socket } from 'node:net';
import WebSocket, { WebSocketServer, type RawData } from 'ws';
import { buildUpstreamUrl, forwardRequestHeaders, matchAppBackend, type AppBackend } from './config.js';

export const APP_SOCKET_MAX_PAYLOAD = 64 * 1024;
const DEFAULT_HANDSHAKE_TIMEOUT_MS = 30_000;

export interface AppBackendUpgrade {
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean;
  closeAll(): void;
  openCount(): number;
}

interface Pair {
  client: WebSocket;
  upstream: WebSocket;
  closing: boolean;
}

interface Pending {
  upstream: WebSocket;
  socket: Duplex;
  settled: boolean;
}

/** Close codes ws can send (mirrors ws/lib/validation.js isValidStatusCode). */
function isSendableCloseCode(code: number): boolean {
  return (
    (code >= 1000 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006) ||
    (code >= 3000 && code <= 4999)
  );
}

function writeStatus(socket: Duplex, status: number, body?: { type: string; text: string }): void {
  if (socket.destroyed) return;
  const reason = STATUS_CODES[status] ?? '';
  const lines = [`HTTP/1.1 ${status} ${reason}`.trimEnd(), 'Connection: close'];
  if (body) {
    lines.push(`Content-Type: ${body.type}`, `Content-Length: ${Buffer.byteLength(body.text)}`);
  } else {
    lines.push('Content-Length: 0');
  }
  socket.write(lines.join('\r\n') + '\r\n\r\n' + (body?.text ?? ''));
  socket.destroy();
}

function offeredProtocols(req: IncomingMessage): string[] {
  const raw = req.headers['sec-websocket-protocol'];
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createAppBackendUpgrade(
  backends: readonly AppBackend[],
  opts: { handshakeTimeoutMs?: number } = {},
): AppBackendUpgrade {
  const handshakeTimeout = opts.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS;
  const chosenProtocol = new WeakMap<IncomingMessage, string>();
  const pairs = new Set<Pair>();
  const pending = new Set<Pending>();

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: APP_SOCKET_MAX_PAYLOAD,
    perMessageDeflate: false,
    autoPong: false,
    clientTracking: false,
    handleProtocols: (_protocols: Set<string>, req: IncomingMessage) => chosenProtocol.get(req) ?? false,
  });

  function wire(pair: Pair): void {
    const legs: Array<[WebSocket, WebSocket]> = [
      [pair.client, pair.upstream],
      [pair.upstream, pair.client],
    ];
    for (const [from, to] of legs) {
      from.on('message', (data: RawData, isBinary: boolean) => {
        if (to.readyState === WebSocket.OPEN) to.send(data as Buffer, { binary: isBinary });
      });
      from.on('ping', (data: Buffer) => {
        if (to.readyState === WebSocket.OPEN) to.ping(data);
      });
      from.on('pong', (data: Buffer) => {
        if (to.readyState === WebSocket.OPEN) to.pong(data);
      });
      from.on('close', (code: number, reason: Buffer) => {
        if (
          pair.client.readyState === WebSocket.CLOSED &&
          pair.upstream.readyState === WebSocket.CLOSED
        ) {
          pairs.delete(pair);
        }
        if (pair.closing) return;
        if (to.readyState !== WebSocket.OPEN && to.readyState !== WebSocket.CONNECTING) return;
        if (isSendableCloseCode(code)) to.close(code, reason);
        else if (code === 1005) to.close();
        else to.terminate();
      });
      from.on('error', () => {
        to.terminate();
        // ws already closes a leg on its own receiver/socket errors (for example 1009 on an
        // oversized frame); terminating it here would drop that close frame.
        if (from.readyState === WebSocket.OPEN || from.readyState === WebSocket.CONNECTING) from.terminate();
      });
    }
  }

  function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
    if (backends.length === 0) return false;
    const match = matchAppBackend(backends, req.url ?? '');
    if (!match) return false;
    const { backend, rest } = match;

    socket.on('error', () => {
      /* an unhandled Duplex error would kill the process */
    });

    const url = buildUpstreamUrl(backend, rest, 'ws');
    if (!url) {
      writeStatus(socket, 400);
      return true;
    }

    const offered = offeredProtocols(req);
    const upstream = new WebSocket(url, offered.length ? offered : undefined, {
      headers: forwardRequestHeaders(req.headers, req.socket.remoteAddress),
      handshakeTimeout,
      perMessageDeflate: false,
      autoPong: false,
      followRedirects: false,
    });
    const entry: Pending = { upstream, socket, settled: false };
    pending.add(entry);
    const settle = (): boolean => {
      if (entry.settled) return false;
      entry.settled = true;
      pending.delete(entry);
      return true;
    };

    socket.once('close', () => {
      if (settle()) upstream.terminate();
    });

    upstream.once('open', () => {
      if (!settle()) return;
      if (socket.destroyed) {
        upstream.terminate();
        return;
      }
      if (upstream.protocol) chosenProtocol.set(req, upstream.protocol);
      let upgraded = false;
      wss.handleUpgrade(req, socket as Socket, head, (client) => {
        upgraded = true;
        const pair: Pair = { client, upstream, closing: false };
        pairs.add(pair);
        wire(pair);
      });
      // ws answered the client's handshake itself (bad upgrade headers); nothing to pair with.
      if (!upgraded) upstream.terminate();
    });

    upstream.on('unexpected-response', (upReq, res) => {
      const status = res.statusCode ?? 502;
      upReq.destroy();
      res.resume();
      if (!settle()) return;
      console.warn(`[app-backends] ${backend.slug} socket refused ${status}`);
      writeStatus(socket, status);
    });

    upstream.on('error', (err: NodeJS.ErrnoException) => {
      if (!settle()) return;
      const why = err.code ?? (/timed out/i.test(err.message) ? 'timeout' : 'error');
      console.warn(`[app-backends] ${backend.slug} socket unavailable (${why})`);
      writeStatus(socket, 502, { type: 'application/json', text: '{"error":"backend_unavailable"}' });
    });

    return true;
  }

  function closeAll(): void {
    for (const entry of [...pending]) {
      entry.settled = true;
      pending.delete(entry);
      entry.upstream.terminate();
      entry.socket.destroy();
    }
    for (const pair of [...pairs]) {
      pair.closing = true;
      pairs.delete(pair);
      pair.client.close(1012, 'server_restart');
      pair.upstream.close(1001, 'going_away');
    }
  }

  return { handleUpgrade, closeAll, openCount: () => pairs.size };
}
