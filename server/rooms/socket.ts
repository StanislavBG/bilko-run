// WebSocket transport for authoritative GameRooms (server/rooms/runtime.ts) at
// /api/rooms/socket/:roomId?ticket=. The room decides everything; this layer
// only authenticates (single-use ticket), routes each seat's messages to that
// seat's socket, validates/limits client frames, and drains on deploy.
// Unlike the realtime relay, a missing Origin is allowed in production: native
// apps send none. The ticket is the only credential; Origin is defence in
// depth against cross-site browser pages. Tickets are never logged.
import crypto from 'node:crypto';
import WebSocket, { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { GameRoom, GameRoomHooks, HandResult, RoomMessage } from './runtime.js';

export const ROOM_SOCKET_PREFIX = '/api/rooms/socket/';
export const ROOM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const ROOM_TICKET_TTL_MS = 30_000;
export const ROOM_TICKET_SWEEP_MS = 30_000;
export const ROOM_PING_INTERVAL_MS = 15_000;
/** Largest client text frame accepted, in bytes. */
export const ROOM_MAX_FRAME_BYTES = 2048;
export const ROOM_RATE_PER_SEC = 20;
/** ws refuses frames above this before buffering them (close 1009); 2049..this closes 4003. */
const WS_MAX_PAYLOAD = 16 * 1024;

export const ROOM_CLOSE = {
  /** The same seat opened a newer socket; this one is replaced. */
  SUPERSEDED: 4000,
  /** The ticket holder has no seat in this room. */
  NO_SEAT: 4001,
  RATE_LIMITED: 4002,
  /** Binary frame, text frame over ROOM_MAX_FRAME_BYTES, or not { type: 'action', seq, action }. */
  BAD_FRAME: 4003,
  /** Deploy drain. Reconnect with a fresh ticket. */
  SERVER_RESTART: 1012,
} as const;

const ALLOWED_ORIGINS = ['https://bilko.run', 'https://www.bilko.run'];

/** bilko.run pages and native clients (no Origin); outside production also localhost/127.0.0.1. */
export function isAllowedRoomOrigin(origin: string | undefined, isProd = process.env.NODE_ENV === 'production'): boolean {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (isProd) return false;
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

// ── Tickets ────────────────────────────────────────────────────────────────

interface TicketEntry { email: string; roomId: string; expiresAt: number }
const tickets = new Map<string, TicketEntry>();
let sweepTimer: ReturnType<typeof setInterval> | null = null;

function sweepTickets(now = Date.now()): void {
  for (const [t, e] of tickets) if (now > e.expiresAt) tickets.delete(t);
  if (tickets.size === 0 && sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
}

/** Single-use ticket bound to (email, roomId), valid for ROOM_TICKET_TTL_MS. */
export function issueRoomTicket(email: string, roomId: string, now = Date.now()): { ticket: string; expiresAt: number } {
  if (tickets.size > 5000) sweepTickets(now);
  const ticket = crypto.randomBytes(24).toString('base64url');
  const expiresAt = now + ROOM_TICKET_TTL_MS;
  tickets.set(ticket, { email, roomId, expiresAt });
  if (!sweepTimer) {
    sweepTimer = setInterval(() => sweepTickets(), ROOM_TICKET_SWEEP_MS);
    sweepTimer.unref?.();
  }
  return { ticket, expiresAt };
}

/** Deleted on first presentation, whatever the outcome. */
function consumeRoomTicket(ticket: string, roomId: string, now = Date.now()): string | null {
  const entry = tickets.get(ticket);
  if (!entry) return null;
  tickets.delete(ticket);
  if (now > entry.expiresAt || entry.roomId !== roomId) return null;
  return entry.email;
}

// ── Live rooms ─────────────────────────────────────────────────────────────

export interface LiveRoomBinding {
  room: Pick<GameRoom<unknown>, 'act' | 'resync'>;
  /** The ticket holder's seat, or undefined if they have none (close 4001). */
  seatFor(email: string): number | undefined;
  /** A seat's socket went away (close code given). The seat stays; the turn timer autoplays it until a reconnect. */
  onClose?(seat: number, code: number): void;
}

interface Conn {
  ws: WebSocket;
  seat: number;
  isAlive: boolean;
  tokens: number;
  lastRefill: number;
  dead: boolean;
}

interface Live { binding: LiveRoomBinding | null; sockets: Map<number, Conn> }

const live = new Map<string, Live>();

function liveEntry(roomId: string): Live {
  let entry = live.get(roomId);
  if (!entry) { entry = { binding: null, sockets: new Map() }; live.set(roomId, entry); }
  return entry;
}

export function registerLiveRoom(roomId: string, binding: LiveRoomBinding): void {
  liveEntry(roomId).binding = binding;
}

/** Forgets the room and closes its sockets (normal closure: the room is gone). */
export function unregisterLiveRoom(roomId: string): void {
  const entry = live.get(roomId);
  if (!entry) return;
  live.delete(roomId);
  for (const c of entry.sockets.values()) { c.dead = true; c.ws.close(1000, 'room_closed'); }
  if (live.size === 0) stopHeartbeat();
}

/** Closes and forgets a seat's live socket (e.g. 4001 once the seat is released). No onClose fires; later frames from it go nowhere. */
export function closeSeatSocket(roomId: string, seat: number, code: number, reason: string): void {
  const entry = live.get(roomId);
  const c = entry?.sockets.get(seat);
  if (!entry || !c) return;
  entry.sockets.delete(seat);
  c.dead = true;
  c.ws.close(code, reason);
}

/** Delivers a room message to the seat's live socket. False if that seat has none. */
export function sendToSeat(roomId: string, seat: number, msg: RoomMessage): boolean {
  const c = live.get(roomId)?.sockets.get(seat);
  if (!c || c.dead || c.ws.readyState !== WebSocket.OPEN) return false;
  c.ws.send(JSON.stringify(msg));
  return true;
}

/** GameRoom hooks whose send() goes to this transport. Pass to `new GameRoom(...)`. */
export function createRoomHooks(roomId: string, onHandOver: (r: HandResult) => void): GameRoomHooks {
  return { send: (seat, msg) => { sendToSeat(roomId, seat, msg); }, onHandOver };
}

function takeToken(c: Conn, now = Date.now()): boolean {
  c.tokens = Math.min(ROOM_RATE_PER_SEC, c.tokens + ((now - c.lastRefill) / 1000) * ROOM_RATE_PER_SEC);
  c.lastRefill = now;
  if (c.tokens < 1) return false;
  c.tokens -= 1;
  return true;
}

function kick(c: Conn, code: number, reason: string): void {
  c.dead = true;
  c.ws.close(code, reason);
}

type ClientAction = { type: 'action'; seq: number; action: unknown };

function parseAction(text: string): ClientAction | null {
  let msg: unknown;
  try { msg = JSON.parse(text); } catch { return null; }
  if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) return null;
  const m = msg as Record<string, unknown>;
  if (m.type !== 'action' || !Number.isInteger(m.seq) || !('action' in m)) return null;
  return { type: 'action', seq: m.seq as number, action: m.action };
}

function handleFrame(roomId: string, c: Conn, data: Buffer, isBinary: boolean): void {
  if (c.dead) return;
  if (!takeToken(c)) return kick(c, ROOM_CLOSE.RATE_LIMITED, 'rate_limited');
  if (isBinary) return kick(c, ROOM_CLOSE.BAD_FRAME, 'text_frames_only');
  if (data.byteLength > ROOM_MAX_FRAME_BYTES) return kick(c, ROOM_CLOSE.BAD_FRAME, 'frame_too_large');
  const action = parseAction(data.toString('utf8'));
  if (!action) return kick(c, ROOM_CLOSE.BAD_FRAME, 'bad_message');
  const entry = live.get(roomId);
  if (!entry?.binding || entry.sockets.get(c.seat) !== c) return;
  entry.binding.room.act(c.seat, action.seq, action.action);
}

function join(roomId: string, email: string, ws: WebSocket): void {
  const entry = live.get(roomId);
  const binding = entry?.binding;
  if (!entry || !binding) { ws.close(ROOM_CLOSE.SERVER_RESTART, 'room_gone'); return; }
  let seat: number | undefined;
  try { seat = binding.seatFor(email); } catch { seat = undefined; }
  if (seat === undefined) { ws.close(ROOM_CLOSE.NO_SEAT, 'no_seat'); return; }

  const previous = entry.sockets.get(seat);
  const c: Conn = { ws, seat, isAlive: true, tokens: ROOM_RATE_PER_SEC, lastRefill: Date.now(), dead: false };
  entry.sockets.set(seat, c);
  if (previous) { previous.dead = true; previous.ws.close(ROOM_CLOSE.SUPERSEDED, 'superseded'); }

  ws.on('pong', () => { c.isAlive = true; });
  ws.on('message', (data, isBinary) => handleFrame(roomId, c, data as Buffer, isBinary));
  ws.on('error', () => { c.dead = true; ws.terminate(); });
  ws.on('close', (code: number) => {
    c.dead = true;
    const current = live.get(roomId);
    if (current !== entry || entry.sockets.get(seat!) !== c) return; // superseded or drained
    entry.sockets.delete(seat!);
    try { binding.onClose?.(seat!, code); } catch { /* the room keeps the seat either way */ }
  });

  startHeartbeat();
  binding.room.resync(seat);
}

// ── Heartbeat ──────────────────────────────────────────────────────────────

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
function startHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    for (const entry of live.values()) {
      for (const c of entry.sockets.values()) {
        if (!c.isAlive) { c.ws.terminate(); continue; }
        c.isAlive = false;
        if (c.ws.readyState === WebSocket.OPEN) c.ws.ping();
      }
    }
  }, ROOM_PING_INTERVAL_MS);
  heartbeatTimer.unref?.();
}
function stopHeartbeat(): void {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

// ── Upgrade + shutdown ─────────────────────────────────────────────────────

let wss: WebSocketServer | null = null;
function getWss(): WebSocketServer {
  if (!wss) wss = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD });
  return wss;
}

function refuse(socket: Duplex, status: string): true {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
  return true;
}

/** Claims upgrades under /api/rooms/socket/; returns false for any other path. */
export function handleRoomUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
  let pathname: string;
  let ticket: string | null;
  try {
    const u = new URL(req.url ?? '', 'http://localhost');
    pathname = u.pathname;
    ticket = u.searchParams.get('ticket');
  } catch {
    return false;
  }
  if (!pathname.startsWith(ROOM_SOCKET_PREFIX)) return false;

  const roomId = pathname.slice(ROOM_SOCKET_PREFIX.length);
  if (!ROOM_ID_RE.test(roomId)) return refuse(socket, '404 Not Found');
  if (!isAllowedRoomOrigin(req.headers.origin)) return refuse(socket, '403 Forbidden');
  if (!ticket) return refuse(socket, '401 Unauthorized');
  const email = consumeRoomTicket(ticket, roomId);
  if (email === null) return refuse(socket, '401 Unauthorized');
  if (!live.get(roomId)?.binding) return refuse(socket, '404 Not Found');

  getWss().handleUpgrade(req, socket as import('node:net').Socket, head, (ws) => join(roomId, email, ws));
  return true;
}

/** Deploy drain: close every room socket with 1012 so clients reconnect to the new instance. */
export function closeAllGameRooms(): void {
  const all = [...live.values()];
  live.clear();
  tickets.clear();
  if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
  stopHeartbeat();
  for (const entry of all) {
    for (const c of entry.sockets.values()) { c.dead = true; c.ws.close(ROOM_CLOSE.SERVER_RESTART, 'server_restart'); }
    entry.sockets.clear();
  }
}
