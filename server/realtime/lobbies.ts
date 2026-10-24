// Lobby directory — a public, in-memory list of open relay rooms, so a player
// joins a game from a list instead of trading a room code. A host keeps its
// room listed with a PUT heartbeat (server/routes/realtime.ts). A listing shows
// only while its owner holds a seat in the relay room, and is gone 30 s after
// the last PUT, on the owner's DELETE, or as soon as the room empties.
// Game-agnostic: entries are namespaced by `app` and the host never interprets
// them beyond the bounds checked here. Contract: docs/host-contract.md →
// "Realtime relay".
import { MAX_ROOMS, MAX_SEATS, holdsSeat, onRoomClosed } from './relay.js';

export const LOBBY_TTL_MS = 30_000;
/** A listing needs a relay room, so the directory never needs more entries than the relay has rooms. */
export const MAX_LOBBIES = MAX_ROOMS;
export const LOBBY_APP_RE = /^[a-z0-9-]{1,32}$/;
const GAME_ID_RE = /^[a-z0-9-]{1,32}$/;
export const HOST_MAX_CHARS = 16;
// C0/C1 controls and bidi overrides: nothing a callsign needs, and they garble a list row.
const HOST_STRIP_RE = /[\p{Cc}؜‎‏‪-‮⁦-⁩]/gu;

export interface LobbyFields { gameId: string; host: string; humans: number; bots: number; capacity: number; }
export interface LobbyAnnounce extends LobbyFields { app: string; }
/** What GET returns. Never carries the owner. */
export interface LobbyListing extends LobbyFields { roomId: string; updatedAt: number; }
interface LobbyEntry extends LobbyListing { app: string; owner: string; }

const lobbies = new Map<string, LobbyEntry>(); // roomId → entry
const roomByOwner = new Map<string, string>(); // owner email → roomId (one listing per owner)

// A room with no peers has nobody left to join.
onRoomClosed((roomId) => drop(roomId));

function drop(roomId: string): void {
  const entry = lobbies.get(roomId);
  if (!entry) return;
  lobbies.delete(roomId);
  if (roomByOwner.get(entry.owner) === roomId) roomByOwner.delete(entry.owner);
}

const expired = (entry: LobbyEntry, now: number): boolean => now - entry.updatedAt >= LOBBY_TTL_MS;

/** The entry for `roomId` unless it has expired (an expired one is dropped on the way). */
function live(roomId: string, now: number): LobbyEntry | undefined {
  const entry = lobbies.get(roomId);
  if (entry && expired(entry, now)) { drop(roomId); return undefined; }
  return entry;
}

function cleanHost(raw: string): string {
  let host = raw.replace(HOST_STRIP_RE, '').trim();
  if (host.length > HOST_MAX_CHARS) {
    host = host.slice(0, HOST_MAX_CHARS);
    if (/[\uD800-\uDBFF]$/.test(host)) host = host.slice(0, -1); // don't split a surrogate pair
    host = host.trimEnd();
  }
  return host;
}

const isCount = (n: unknown, min: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= MAX_SEATS;

/**
 * Validates a PUT body. `host` is a display label, so it is cleaned and cut to
 * 16 chars rather than refused: Academy callsigns are display names, uncapped.
 */
export function parseLobbyBody(body: unknown): { lobby: LobbyAnnounce } | { error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'body must be a JSON object' };
  const { app, gameId, host, humans, bots, capacity } = body as Record<string, unknown>;
  if (typeof app !== 'string' || !LOBBY_APP_RE.test(app)) return { error: 'app must be 1-32 chars of [a-z0-9-]' };
  if (typeof gameId !== 'string' || !GAME_ID_RE.test(gameId)) return { error: 'gameId must be 1-32 chars of [a-z0-9-]' };
  const label = typeof host === 'string' ? cleanHost(host) : '';
  if (!label) return { error: 'host must be a non-empty string' };
  if (!isCount(humans, 1) || !isCount(bots, 0) || !isCount(capacity, 1)) {
    return { error: `humans (>= 1), bots (>= 0) and capacity must be integers up to ${MAX_SEATS}` };
  }
  if (humans + bots > capacity) return { error: 'humans + bots must not exceed capacity' };
  return { lobby: { app, gameId, host: label, humans, bots, capacity } };
}

export type UpsertResult =
  | { ok: true; expiresAt: number; listed: boolean }
  | { ok: false; error: 'not_owner' | 'directory_full' };

/** Creates or refreshes `roomId`'s listing. An owner has one listing: announcing a new room replaces the old one. */
export function upsertLobby(roomId: string, owner: string, lobby: LobbyAnnounce, now = Date.now()): UpsertResult {
  const existing = live(roomId, now);
  if (existing && existing.owner !== owner) return { ok: false, error: 'not_owner' };
  const previous = roomByOwner.get(owner);
  if (previous !== undefined && previous !== roomId) drop(previous);
  if (!existing && lobbies.size >= MAX_LOBBIES) {
    for (const entry of lobbies.values()) if (expired(entry, now)) drop(entry.roomId);
    if (lobbies.size >= MAX_LOBBIES) return { ok: false, error: 'directory_full' };
  }
  lobbies.set(roomId, { ...lobby, roomId, owner, updatedAt: now });
  roomByOwner.set(owner, roomId);
  return { ok: true, expiresAt: now + LOBBY_TTL_MS, listed: holdsSeat(roomId, owner) };
}

/** Owner only. An absent or expired listing is not an error, so DELETE stays idempotent. */
export function removeLobby(roomId: string, owner: string, now = Date.now()): 'removed' | 'absent' | 'not_owner' {
  const entry = live(roomId, now);
  if (!entry) return 'absent';
  if (entry.owner !== owner) return 'not_owner';
  drop(roomId);
  return 'removed';
}

/** Open lobbies for `app`, newest first: unexpired, and only while the owner holds a seat in the room. */
export function listLobbies(app: string, now = Date.now()): LobbyListing[] {
  const out: LobbyListing[] = [];
  for (const entry of lobbies.values()) {
    if (expired(entry, now)) { drop(entry.roomId); continue; }
    if (entry.app !== app || !holdsSeat(entry.roomId, entry.owner)) continue;
    const { roomId, gameId, host, humans, bots, capacity, updatedAt } = entry;
    out.push({ roomId, gameId, host, humans, bots, capacity, updatedAt });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Test introspection: entries held, listed or not. */
export function lobbyCount(): number {
  return lobbies.size;
}

export function resetLobbies(): void {
  lobbies.clear();
  roomByOwner.clear();
}
