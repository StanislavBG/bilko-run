// Session Manager web-remote relay — WebSocket pipe.
// Ported from session-manager web-remote/relay/src/router.ts.
// The relay is a DUMB PIPE: it forwards any envelope type between a browser and
// its own device (canRoute by userId). The command allowlist is enforced
// AGENT-SIDE (webRemote.cjs), so new cmd:session:* / event:session:* types need
// no change here. Only auth (ticket consumption) and isolation live here.
import crypto from 'node:crypto';
import { z } from 'zod';
import WebSocket, { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { consumeWsTicket } from './tokens.js';

// Path the phone/agent connect to (same-origin under bilko.run).
export const RELAY_WS_PATH = '/projects/session-manager/relay';

interface Envelope {
  type: string;
  id: string;
  deviceId?: string;
  payload?: unknown;
  ts: number;
  relay_ts?: number;
}

interface LeakyBucket {
  tokens: number;
  lastCheck: number;
  capacity: number;
  drainRateMs: number;
}

interface BaseConn {
  ws: WebSocket;
  userId: string;
  email: string;
  connectedAt: number;
  isAlive: boolean;
  missedPings: number;
  rateLimit: LeakyBucket;
}
interface BrowserConn extends BaseConn { id: string; }
interface DeviceConn extends BaseConn { deviceId: string; }

const MAX_MSG_BYTES = 256 * 1024;
const PING_INTERVAL_MS = 30_000;
const MAX_MISSED_PINGS = 3;
const BROWSER_RATE_CAPACITY = 60;
const BROWSER_RATE_DRAIN_MS = 1000;
const DEVICE_RATE_CAPACITY = 100;
const DEVICE_RATE_DRAIN_MS = 600;
const MAX_BROWSER_CONNS_PER_USER = 5;

const envelopeSchema = z.object({
  type: z.string().min(1).max(256),
  id: z.string().uuid(),
  deviceId: z.string().max(128).optional(),
  payload: z.unknown().optional(),
  ts: z.number().int().positive(),
});

const browserConns = new Map<string, BrowserConn>();
const deviceConns = new Map<string, DeviceConn>();

function makeBucket(capacity: number, drainRateMs: number): LeakyBucket {
  return { tokens: 0, lastCheck: Date.now(), capacity, drainRateMs };
}

function consumeRateLimit(bucket: LeakyBucket, now = Date.now()): boolean {
  const elapsed = now - bucket.lastCheck;
  bucket.tokens = Math.max(0, bucket.tokens - elapsed / bucket.drainRateMs);
  bucket.lastCheck = now;
  if (bucket.tokens >= bucket.capacity) return false;
  bucket.tokens++;
  return true;
}

function retryAfterMs(bucket: LeakyBucket, now = Date.now()): number {
  const excessTokens = bucket.tokens + 1 - bucket.capacity;
  return Math.ceil(Math.max(0, excessTokens) * bucket.drainRateMs);
}

/** SECURITY INVARIANT: userId is from the authenticated ticket, never the envelope. */
export function canRoute(browser: { userId: string }, device: { userId: string }): boolean {
  return browser.userId === device.userId;
}

function safeSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function sendError(ws: WebSocket, code: string, retry?: number): void {
  const msg: Record<string, unknown> = { type: 'error', id: crypto.randomUUID(), code, ts: Date.now() };
  if (retry !== undefined) msg.retryAfterMs = retry;
  safeSend(ws, msg);
}

function routeFromBrowser(browser: BrowserConn, envelope: Envelope): void {
  const { type, deviceId } = envelope;
  if (type === 'ping' || type === 'pong') return;
  if (!deviceId) { sendError(browser.ws, 'missing_device_id'); return; }

  const device = deviceConns.get(deviceId);
  if (!device) { sendError(browser.ws, 'device_offline'); return; }
  if (!canRoute(browser, device)) { sendError(browser.ws, 'not_your_device'); return; }
  if (!consumeRateLimit(browser.rateLimit)) { sendError(browser.ws, 'rate_limited', retryAfterMs(browser.rateLimit)); return; }
  if (!consumeRateLimit(device.rateLimit)) { sendError(browser.ws, 'rate_limited', retryAfterMs(device.rateLimit)); return; }

  safeSend(device.ws, { ...envelope, relay_ts: Date.now() });
}

function routeFromDevice(device: DeviceConn, envelope: Envelope): void {
  if (envelope.type === 'pong') return;
  for (const browser of browserConns.values()) {
    if (browser.userId === device.userId) {
      safeSend(browser.ws, { ...envelope, deviceId: device.deviceId, relay_ts: Date.now() });
    }
  }
}

function handleMessage(conn: BrowserConn | DeviceConn, role: 'browser' | 'agent', raw: Buffer | ArrayBuffer | Buffer[]): void {
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
  if (buf.byteLength > MAX_MSG_BYTES) { conn.ws.close(1009, 'message_too_large'); return; }

  let parsed: unknown;
  try { parsed = JSON.parse(buf.toString('utf8')); }
  catch { sendError(conn.ws, 'invalid_json'); return; }

  const result = envelopeSchema.safeParse(parsed);
  if (!result.success) { sendError(conn.ws, 'invalid_envelope'); return; }

  const envelope = result.data as Envelope;
  if (role === 'browser') routeFromBrowser(conn as BrowserConn, envelope);
  else routeFromDevice(conn as DeviceConn, envelope);
}

function setupHeartbeat(ws: WebSocket, conn: BrowserConn | DeviceConn): void {
  ws.on('pong', () => { conn.isAlive = true; conn.missedPings = 0; });
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
function startHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    const all: Array<BrowserConn | DeviceConn> = [...browserConns.values(), ...deviceConns.values()];
    for (const conn of all) {
      if (!conn.isAlive) {
        conn.missedPings++;
        if (conn.missedPings >= MAX_MISSED_PINGS) { conn.ws.close(1001, 'heartbeat_timeout'); continue; }
      }
      conn.isAlive = false;
      if (conn.ws.readyState === WebSocket.OPEN) conn.ws.ping();
    }
  }, PING_INTERVAL_MS);
}
function stopHeartbeat(): void {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

function registerBrowser(ws: WebSocket, t: { userId: string; email: string }): void {
  let existing = 0;
  for (const c of browserConns.values()) if (c.userId === t.userId) existing++;
  if (existing >= MAX_BROWSER_CONNS_PER_USER) { ws.close(1008, 'too_many_connections'); return; }

  const id = crypto.randomUUID();
  const conn: BrowserConn = {
    ws, id, userId: t.userId, email: t.email, connectedAt: Date.now(),
    isAlive: true, missedPings: 0, rateLimit: makeBucket(BROWSER_RATE_CAPACITY, BROWSER_RATE_DRAIN_MS),
  };
  browserConns.set(id, conn);
  setupHeartbeat(ws, conn);
  safeSend(ws, { type: 'auth:ok', id: crypto.randomUUID(), ts: Date.now() });

  // Tell the new browser which of its devices are already online.
  for (const device of deviceConns.values()) {
    if (device.userId === t.userId) {
      safeSend(ws, { type: 'event:device:status', id: crypto.randomUUID(), deviceId: device.deviceId, status: 'connected', ts: Date.now() });
    }
  }

  ws.on('message', (data) => handleMessage(conn, 'browser', data as Buffer));
  ws.on('close', () => { browserConns.delete(id); if (!browserConns.size && !deviceConns.size) stopHeartbeat(); });
  ws.on('error', () => ws.close());
  startHeartbeat();
}

function registerDevice(ws: WebSocket, t: { userId: string; email: string; deviceId: string }): void {
  const conn: DeviceConn = {
    ws, deviceId: t.deviceId, userId: t.userId, email: t.email, connectedAt: Date.now(),
    isAlive: true, missedPings: 0, rateLimit: makeBucket(DEVICE_RATE_CAPACITY, DEVICE_RATE_DRAIN_MS),
  };
  deviceConns.set(t.deviceId, conn);
  setupHeartbeat(ws, conn);
  safeSend(ws, { type: 'auth:ok', id: crypto.randomUUID(), deviceId: t.deviceId, ts: Date.now() });

  for (const browser of browserConns.values()) {
    if (browser.userId === t.userId) {
      safeSend(browser.ws, { type: 'event:device:status', id: crypto.randomUUID(), deviceId: t.deviceId, status: 'connected', ts: Date.now() });
    }
  }

  ws.on('message', (data) => handleMessage(conn, 'agent', data as Buffer));
  ws.on('close', () => {
    deviceConns.delete(t.deviceId);
    for (const browser of browserConns.values()) {
      if (browser.userId === t.userId) {
        safeSend(browser.ws, { type: 'event:device:status', id: crypto.randomUUID(), deviceId: t.deviceId, status: 'disconnected', ts: Date.now() });
      }
    }
    if (!browserConns.size && !deviceConns.size) stopHeartbeat();
  });
  ws.on('error', () => ws.close());
  startHeartbeat();
}

export function closeSessionsForUser(userId: string): void {
  for (const [id, conn] of browserConns) {
    if (conn.userId === userId && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.close(1000, 'logged_out');
      browserConns.delete(id);
    }
  }
}

export function isDeviceOnline(deviceId: string): boolean {
  const conn = deviceConns.get(deviceId);
  return conn !== undefined && conn.ws.readyState === WebSocket.OPEN;
}

export function notifyDeviceRevoked(deviceId: string): void {
  const conn = deviceConns.get(deviceId);
  if (conn && conn.ws.readyState === WebSocket.OPEN) conn.ws.close(4001, 'token_revoked');
}

let wss: WebSocketServer | null = null;
function getWss(): WebSocketServer {
  if (!wss) wss = new WebSocketServer({ noServer: true });
  return wss;
}

/**
 * HTTP upgrade handler. Mount on the host's http.Server `upgrade` event.
 * Only claims the relay path; leaves other upgrade requests (if any) untouched.
 * Returns true if it handled the request.
 */
export function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
  const reqUrl = req.url ?? '';
  let pathname: string;
  let ticket: string | null;
  try {
    const u = new URL(reqUrl, 'http://localhost');
    pathname = u.pathname;
    ticket = u.searchParams.get('ticket');
  } catch {
    return false;
  }

  if (pathname !== RELAY_WS_PATH) return false; // not ours — let other handlers run

  if (!ticket) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return true;
  }

  const ticketData = consumeWsTicket(ticket);
  if (!ticketData) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return true;
  }

  getWss().handleUpgrade(req, socket as import('node:net').Socket, head, (ws) => {
    if (ticketData.role === 'browser') {
      registerBrowser(ws, ticketData);
    } else {
      if (!ticketData.deviceId) { ws.close(1011, 'missing_device_id'); return; }
      registerDevice(ws, { ...ticketData, deviceId: ticketData.deviceId });
    }
  });
  return true;
}

export { browserConns, deviceConns };
