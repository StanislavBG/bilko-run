// Realtime input relay — a game-agnostic binary WebSocket fan-out for online
// team games (Game Academy's deterministic lockstep/rollback arenas).
// The relay never runs or parses a game: a client frame is [u8 target][payload],
// the relay forwards [u8 senderSeat][payload] to the room. Only auth (single-use
// ticket), seat bookkeeping, size/rate limits and the Origin check live here.
// Contract: docs/host-contract.md → "Realtime relay".
import crypto from 'node:crypto';
import WebSocket, { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

export const REALTIME_PATH_PREFIX = '/api/realtime/rooms/';
export const ROOM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const MAX_SEATS = 10;
/** Whole client frame, target byte included. */
export const MAX_FRAME_BYTES = 64;
export const RATE_PER_SEC = 120;
export const TICKET_TTL_MS = 30_000;
export const SEAT_HOLD_MS = 10_000;
export const PING_INTERVAL_MS = 15_000;
export const MAX_ROOMS = 500;

/** Client target byte: fan out to every other live seat. */
export const TARGET_BROADCAST = 0xff;
/** Client target byte: echo back to the sender (RTT probe; browsers can't send WS pings). */
export const TARGET_ECHO = 0xfe;

export const CLOSE = {
  /** Same user opened a newer socket in this room; the seat moved to it. */
  SUPERSEDED: 4000,
  ROOM_FULL: 4001,
  RATE_LIMITED: 4002,
  /** Text frame, empty frame, or a target byte that is not a seat/0xFE/0xFF. */
  BAD_FRAME: 4003,
  FRAME_TOO_LARGE: 1009,
  /** Standard "Service Restart": deploy drain on SIGTERM. Reconnect with a fresh ticket. */
  SERVER_RESTART: 1012,
} as const;

const PRODUCTION_ORIGINS = ['https://bilko.run', 'https://www.bilko.run'];

/** Browsers always send Origin on a WebSocket handshake; only bilko.run pages may open the relay. */
export function isAllowedOrigin(origin: string | undefined, isProd = process.env.NODE_ENV === 'production'): boolean {
  if (origin && PRODUCTION_ORIGINS.includes(origin)) return true;
  if (isProd) return false;
  if (!origin) return true; // dev/test tooling (node ws clients) sends none
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

// ── Tickets ────────────────────────────────────────────────────────────────
// Browsers can't set Authorization on a WebSocket, so a Clerk-authenticated
// POST mints a short-lived single-use ticket bound to (email, roomId).

interface TicketEntry { email: string; roomId: string; expiresAt: number; }
const tickets = new Map<string, TicketEntry>();

export function issueTicket(email: string, roomId: string, now = Date.now()): { ticket: string; expiresAt: number } {
  if (tickets.size > 5000) purgeExpiredTickets(now);
  const ticket = crypto.randomBytes(24).toString('base64url');
  const expiresAt = now + TICKET_TTL_MS;
  tickets.set(ticket, { email, roomId, expiresAt });
  return { ticket, expiresAt };
}

export type TicketResult = { ok: true; email: string } | { ok: false; reason: 'unknown' | 'expired' | 'wrong_room' };

/** Single use: a ticket is deleted on first presentation, whatever the outcome. */
export function consumeTicket(ticket: string, roomId: string, now = Date.now()): TicketResult {
  const entry = tickets.get(ticket);
  if (!entry) return { ok: false, reason: 'unknown' };
  tickets.delete(ticket);
  if (now > entry.expiresAt) return { ok: false, reason: 'expired' };
  if (entry.roomId !== roomId) return { ok: false, reason: 'wrong_room' };
  return { ok: true, email: entry.email };
}

function purgeExpiredTickets(now: number): void {
  for (const [t, e] of tickets) if (now > e.expiresAt) tickets.delete(t);
}

// ── Rooms ──────────────────────────────────────────────────────────────────

interface Seat {
  seat: number;
  email: string;
  ws: WebSocket | null;
  /** Set while the socket is gone and the seat is held for a reconnect. */
  holdTimer: ReturnType<typeof setTimeout> | null;
  isAlive: boolean;
  tokens: number;
  lastRefill: number;
}

interface Room { id: string; seats: Map<number, Seat>; }

const rooms = new Map<string, Room>();

function seatOf(room: Room, email: string): Seat | undefined {
  for (const s of room.seats.values()) if (s.email === email) return s;
  return undefined;
}

/** Would `email` get (or keep) a seat in `roomId` right now? Used to refuse tickets early. */
export function canJoin(roomId: string, email: string): 'ok' | 'room_full' | 'server_full' {
  const room = rooms.get(roomId);
  if (!room) return rooms.size >= MAX_ROOMS ? 'server_full' : 'ok';
  if (seatOf(room, email)) return 'ok';
  return room.seats.size >= MAX_SEATS ? 'room_full' : 'ok';
}

function sendJson(ws: WebSocket | null, msg: Record<string, unknown>): void {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function announce(room: Room, except: number, event: 'join' | 'drop' | 'reconnect' | 'leave', seat: number): void {
  for (const s of room.seats.values()) {
    if (s.seat !== except) sendJson(s.ws, { type: 'peer', event, seat });
  }
}

function releaseSeat(room: Room, seat: Seat): void {
  if (seat.holdTimer) clearTimeout(seat.holdTimer);
  room.seats.delete(seat.seat);
  announce(room, seat.seat, 'leave', seat.seat);
  if (room.seats.size === 0) rooms.delete(room.id);
  if (rooms.size === 0) stopHeartbeat();
}

/** Token bucket: RATE_PER_SEC capacity, refilled continuously. */
function takeToken(seat: Seat, now = Date.now()): boolean {
  seat.tokens = Math.min(RATE_PER_SEC, seat.tokens + ((now - seat.lastRefill) / 1000) * RATE_PER_SEC);
  seat.lastRefill = now;
  if (seat.tokens < 1) return false;
  seat.tokens -= 1;
  return true;
}

/** Sockets the relay closed for abuse: their seat is released, not held. */
const kicked = new WeakSet<WebSocket>();
function kick(ws: WebSocket, code: number, reason: string): void {
  kicked.add(ws);
  ws.close(code, reason);
}

function handleFrame(room: Room, seat: Seat, ws: WebSocket, data: Buffer, isBinary: boolean): void {
  // Superseded or kicked socket still draining frames that were already in flight.
  if (seat.ws !== ws || kicked.has(ws)) return;
  if (!takeToken(seat)) { kick(ws, CLOSE.RATE_LIMITED, 'rate_limited'); return; }
  if (!isBinary || data.byteLength < 1) { kick(ws, CLOSE.BAD_FRAME, 'binary_frames_only'); return; }
  if (data.byteLength > MAX_FRAME_BYTES) { kick(ws, CLOSE.FRAME_TOO_LARGE, 'frame_too_large'); return; }

  const target = data[0];
  const out = Buffer.from(data); // copy; byte 0 becomes the sender seat
  out[0] = seat.seat;

  if (target === TARGET_BROADCAST) {
    for (const s of room.seats.values()) {
      if (s.seat !== seat.seat && s.ws?.readyState === WebSocket.OPEN) s.ws.send(out, { binary: true });
    }
  } else if (target === TARGET_ECHO) {
    ws.send(out, { binary: true });
  } else if (target < MAX_SEATS) {
    // Unicast to an empty, held or own seat is dropped silently (join/leave races).
    const to = room.seats.get(target);
    if (to && to.seat !== seat.seat && to.ws?.readyState === WebSocket.OPEN) to.ws.send(out, { binary: true });
  } else {
    kick(ws, CLOSE.BAD_FRAME, 'bad_target');
  }
}

function attach(room: Room, seat: Seat, ws: WebSocket): void {
  seat.ws = ws;
  seat.isAlive = true;
  ws.on('pong', () => { seat.isAlive = true; });
  ws.on('message', (data, isBinary) => handleFrame(room, seat, ws, data as Buffer, isBinary));
  // Protocol errors (incl. a frame over ws maxPayload) count as abuse: release, don't hold.
  ws.on('error', () => { kicked.add(ws); ws.terminate(); });
  ws.on('close', (code) => {
    if (seat.ws !== ws) return; // superseded: the seat already belongs to the newer socket
    seat.ws = null;
    // Code 1000 from the client is an intentional leave, and an abuse kick
    // releases the seat too. Anything else — tab reload, network drop,
    // heartbeat timeout, 1001 navigation, 1005 bare close() — holds the seat.
    const releases = code === 1000 || kicked.has(ws);
    if (rooms.get(room.id) !== room) return; // drained by closeAllRooms
    if (releases) { releaseSeat(room, seat); return; }
    announce(room, seat.seat, 'drop', seat.seat);
    seat.holdTimer = setTimeout(() => {
      seat.holdTimer = null;
      if (!seat.ws && room.seats.get(seat.seat) === seat) releaseSeat(room, seat);
    }, SEAT_HOLD_MS);
    seat.holdTimer.unref?.();
  });
}

function join(roomId: string, email: string, ws: WebSocket): void {
  let room = rooms.get(roomId);
  if (!room) {
    if (rooms.size >= MAX_ROOMS) { ws.close(CLOSE.ROOM_FULL, 'server_full'); return; }
    room = { id: roomId, seats: new Map() };
    rooms.set(roomId, room);
  }

  let seat = seatOf(room, email);
  let event: 'join' | 'reconnect';
  if (seat) {
    // Same user again: reclaim the held seat, or take over a live one whose
    // socket may be half-open (reconnect raced the relay noticing the drop).
    event = 'reconnect';
    if (seat.holdTimer) { clearTimeout(seat.holdTimer); seat.holdTimer = null; }
    const previous = seat.ws;
    seat.ws = null;
    if (previous) previous.close(CLOSE.SUPERSEDED, 'superseded');
  } else {
    let free = -1;
    for (let i = 0; i < MAX_SEATS; i++) if (!room.seats.has(i)) { free = i; break; }
    if (free < 0) {
      ws.close(CLOSE.ROOM_FULL, 'room_full');
      return;
    }
    event = 'join';
    seat = { seat: free, email, ws: null, holdTimer: null, isAlive: true, tokens: RATE_PER_SEC, lastRefill: Date.now() };
    room.seats.set(free, seat);
  }

  attach(room, seat, ws);
  const peers = [...room.seats.values()]
    .filter((s) => s.seat !== seat!.seat)
    .map((s) => ({ seat: s.seat, connected: s.ws !== null }));
  sendJson(ws, {
    type: 'welcome',
    roomId,
    seat: seat.seat,
    peers,
    maxSeats: MAX_SEATS,
    maxFrameBytes: MAX_FRAME_BYTES,
    ratePerSec: RATE_PER_SEC,
    seatHoldMs: SEAT_HOLD_MS,
  });
  announce(room, seat.seat, event, seat.seat);
  startHeartbeat();
}

// ── Heartbeat ──────────────────────────────────────────────────────────────

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
function startHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    for (const room of rooms.values()) {
      for (const seat of room.seats.values()) {
        if (!seat.ws) continue;
        if (!seat.isAlive) { seat.ws.terminate(); continue; } // close handler holds the seat
        seat.isAlive = false;
        if (seat.ws.readyState === WebSocket.OPEN) seat.ws.ping();
      }
    }
  }, PING_INTERVAL_MS);
  heartbeatTimer.unref?.();
}
function stopHeartbeat(): void {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

// ── Upgrade + shutdown ─────────────────────────────────────────────────────

let wss: WebSocketServer | null = null;
function getWss(): WebSocketServer {
  // maxPayload just above the frame cap: ws rejects anything larger before buffering it.
  if (!wss) wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  return wss;
}

function refuse(socket: Duplex, status: string): true {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
  return true;
}

/** Claims upgrades under /api/realtime/rooms/; returns false for any other path. */
export function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
  let pathname: string;
  let ticket: string | null;
  try {
    const u = new URL(req.url ?? '', 'http://localhost');
    pathname = u.pathname;
    ticket = u.searchParams.get('ticket');
  } catch {
    return false;
  }
  if (!pathname.startsWith(REALTIME_PATH_PREFIX)) return false;

  const roomId = pathname.slice(REALTIME_PATH_PREFIX.length);
  if (!ROOM_ID_RE.test(roomId)) return refuse(socket, '404 Not Found');
  if (!isAllowedOrigin(req.headers.origin)) return refuse(socket, '403 Forbidden');
  if (!ticket) return refuse(socket, '401 Unauthorized');
  const result = consumeTicket(ticket, roomId);
  if (!result.ok) return refuse(socket, '401 Unauthorized');

  getWss().handleUpgrade(req, socket as import('node:net').Socket, head, (ws) => join(roomId, result.email, ws));
  return true;
}

/** Deploy drain: tell every socket to reconnect elsewhere, then forget all rooms. */
export function closeAllRooms(): void {
  const all = [...rooms.values()];
  rooms.clear();
  for (const room of all) {
    for (const seat of room.seats.values()) {
      if (seat.holdTimer) clearTimeout(seat.holdTimer);
      seat.ws?.close(CLOSE.SERVER_RESTART, 'server_restart');
    }
  }
  stopHeartbeat();
}

/** Test/admin introspection: live and held seats per room. */
export function roomSnapshot(roomId: string): Array<{ seat: number; email: string; connected: boolean }> | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  return [...room.seats.values()].map((s) => ({ seat: s.seat, email: s.email, connected: s.ws !== null }));
}

export function roomCount(): number {
  return rooms.size;
}
