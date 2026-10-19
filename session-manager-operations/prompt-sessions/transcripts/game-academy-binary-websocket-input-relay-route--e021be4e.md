# Transcript — game-academy-binary-websocket-input-relay-route--e021be4e

## User — 2026-10-19T02:04:41.304Z

This session is INBOUND FEEDBACK from another project: Bilko-Game-Academy (/home/bilko/Projects/Bilko-Game-Academy, session networking-prepare-the-foundation-for-the-academ-d582e8fc). It was raised while working on: Networking  Prepare the foundation for the academy to be able to support up to 5v5 players we don't have that now but I have a feeling that the however we've implemented the site we need to make sure that supporting 10 players can currently.  Research how that is done before you implement research i. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: Game Academy: binary WebSocket input-relay route for online team games (up to 10 players per room)

## Why
Game Academy (static-path app at /projects/game-academy/) is getting online multiplayer for its 2v2 arena games, sized for up to 5v5 (10 players per room). Its games are deterministic (60 Hz fixed tick, integer math, seeded RNG), so the server never has to run a game: it only relays tiny input frames (one u16 per player per tick, ~28-byte packets). Research compared WebRTC mesh (45 links at 10 players, TURN effectively mandatory), WebTransport (no stable Node server; Render has no UDP or HTTP/3) and Cloudflare Durable Objects (a second backend outside bilko.run, with Clerk and CORS duplicated). The best fit is a thin WebSocket relay on the existing bilko.run Fastify server: same origin, Clerk auth, no extra vendor. Academy is building the client side now (transport interface, wire codec, rollback session tested on an in-memory loopback) and needs this host route to go live.

## Proposed plan
1. Add @fastify/websocket (ws) and a route at wss://bilko.run/api/realtime/rooms/:roomId that accepts binary frames only and checks the Origin against bilko.run origins
2. Add POST /api/realtime/ticket (requireAuth, Clerk Bearer JWT) that returns a single-use ticket valid for about 30 s, bound to user email and roomId; the socket connects with ?ticket= because browsers cannot set an Authorization header on WebSocket
3. Room model: up to 10 seats, seat ids 0..9 assigned by the server; send a JSON or binary welcome with the assigned seat
4. Relay: forward each client frame to all other seats in the room, or to one seat if a target byte is set, prefixed with the sender's seat; the server never parses the game payload beyond a 64-byte size cap
5. Join, leave and reconnect events to the room; hold a dropped seat for about 10 s for reconnect with the same ticket subject
6. Rate limit about 120 messages/s per socket and close abusive sockets; ping/pong every 15-20 s; on SIGTERM send a closing frame to every socket (deploy drain)
7. Keep each room on a single instance (or document room-to-instance routing); confirm the service is on a non-sleeping tier and say which Render region it runs in
8. Tests: ticket auth (missing, expired, reused, wrong room), fan-out to N-1 peers, 64-byte cap, rate limit, seat hold on reconnect

## Acceptance criteria
- [ ] A signed-in client can POST /api/realtime/ticket with a Clerk Bearer token and open wss://bilko.run/api/realtime/rooms/<id>?ticket=<t>; the request is refused without a valid ticket
- [ ] With 10 sockets in one room, a binary frame from one seat reaches the other 9 prefixed with the sender's seat, and is never echoed back to the sender
- [ ] Frames over 64 bytes and sockets above the message rate are rejected
- [ ] Leave and reconnect events reach the rest of the room; a reconnect within about 10 s keeps the same seat
- [ ] Host contract doc gains a 'Realtime relay' section with the endpoints, frame format and limits

## Out of scope
- Running game simulations on the server
- Matchmaking and MMR (Academy keeps these client-side for now)
- WebRTC, TURN or WebTransport

## Details
Requested by the Game Academy networking Epic (repo /home/bilko/Projects/Bilko-Game-Academy). Client-side work being built there: packages/arena-kit/src/net/transport.ts (Transport interface: send(bytes,{reliable,to?}), onMessage(from,bytes), onPeer, rtt, close), codec.ts (fixed DataView layout: u8 version, u8 kind, u8 seat, u32 firstTick, u32 ack, u8 count, up to 8 x u16 input frames = 28 bytes max), input-ring.ts and session.ts (lockstep with input delay plus up to 8 ticks of rollback). The design is written up in docs/20-networking-foundation.md in that repo once it lands.

Load estimate: a 10-player room at 60 Hz is ~600 frames/s in and ~600 out (~85 KB/s per room); one Node core with ws should carry roughly 50-80 such rooms. Render WebSockets: no max connection length; deploys close sockets after the 30 s shutdown window (can be raised to 300 s); free tier sleeps after 15 min idle.

The server deliberately stays game-agnostic (no sim, no payload parsing), so one relay serves every Academy game. Later asks (not this proposal): optional server-side input log per room for replay or result verification, and TURN credentials if a UDP transport is added on another host.

Reference: /home/bilko/Projects/Bilko-Game-Academy/docs/14-arena-game-rules.md

## Agent — 2026-10-19T02:29:46.482Z

The relay is live on bilko.run, commit `1d6f0eb5` pushed to `origin/main`. Render redeployed at about 7:29 PM PDT.

The Academy report was accurate. The host is Fastify with Clerk `requireAuth`, `ws` was already a dependency, and the Session Manager relay already handles WebSocket upgrades the same way. So I used plain `ws` instead of adding `@fastify/websocket`.

**What shipped**
- **`server/routes/realtime.ts`**: `POST /api/realtime/ticket` (needs a Clerk sign-in) returns a ticket that works once, lasts 30 s, and is tied to the user's email and the room. It refuses with 400 for a bad room id, 409 when the room is full, 503 above 500 rooms, and 429 above 30 tickets a minute per user. When the server shuts down for a deploy, every socket is closed with code 1012.
- **`server/realtime/relay.ts`**: the socket at `/api/realtime/rooms/:roomId?ticket=`.
  - **Handshake:** refused for any Origin other than bilko.run or www.bilko.run.
  - **Seats:** up to 10, assigned by the server, one per user per room.
  - **Frames:** a client sends `[target byte][payload]`, at most 64 bytes in total:
    - `0xFF` goes to every other seat.
    - `0..9` goes to that one seat.
    - `0xFE` echoes back to the sender, so the client can measure round-trip time.

    Peers receive `[sender's seat][payload]`, and a sender never gets its own broadcast back.
  - **Room events:** text messages announce `welcome`, `join`, `drop`, `reconnect` and `leave`.
  - **Limits:** 120 messages a second per socket, and a ping every 15 s.
  - **Reconnects:** a dropped seat is held for 10 s, and reconnecting in that window gets the same seat back.
- **Server startup** (`server/index.ts`) now passes WebSocket upgrades to both relays.
- **Docs:** `docs/host-contract.md` has a new "Realtime relay" section with the endpoints, frame format, limits, close codes and single-instance constraint. `CLAUDE.md` now lists the relay as allowed app-specific host code and has the updated test count.
- **Tests:** `tests/realtime-relay.test.ts` has 18 tests covering:
  - rejected tickets (missing, expired, reused, wrong room), bad origin and bad room id
  - a 10-socket room where one frame reaches the other 9 and never the sender
  - the 64-byte cap and the rate limit
  - holding, returning and releasing a seat
  - shutdown and the ticket route itself

  The full suite passes (111 files, 1255 tests) and so does the typecheck.

**Checked on the live site:** a ticket request without sign-in gets 401, a socket without a ticket gets 401, and a foreign Origin gets 403.

**Differences from Academy's proposal:**
- Seats belong to users, so a second socket from the same user takes over that seat. Testing locally needs two accounts, not two tabs.
- A client must close with code 1000 to leave right away. Any other close holds the seat for 10 s.
- Rooms live in one server's memory, so they only work while bilko.run runs a single instance.

I've sent these details to Bilko-Game-Academy as a proposed session about connecting their client to the relay; it runs only if someone there approves it.

**Not confirmed:** whether the Render service is on a tier that never sleeps, and which region it runs in. Neither is recorded in the repo, and I have no access to the Render dashboard or API. The live server had been up for over 3 hours before the deploy, which suggests it doesn't sleep, but that doesn't prove it.

## User — 2026-10-19T02:35:51.649Z

I don't know, I thin kwe are free and probaly is fixed at one

## Agent — 2026-10-19T03:12:43.127Z

I wrote that into the host contract and pushed it (`b56abdf1` on `origin/main`). The "Realtime relay" section now says the service is believed to be on Render's Free tier with one fixed instance, region unknown.

- **One instance is fine.** The relay keeps each game room in one server's memory, so a single instance is what it needs.
- **Free tier is the risk.** Render puts a Free service to sleep after 15 minutes with no traffic. Waking it takes tens of seconds, so the first player to start a game after a quiet spell waits. If it ever sleeps mid-game, everyone in that room is disconnected. That's fine for casual testing. Before real players use online play, move it to a paid plan that doesn't sleep (Starter or higher). The doc says this.
- **Not checked:** the plan and region are still your best guess. Nobody has looked at the Render dashboard. I also saved this as a memory note for future sessions.

**Something went wrong:** while syncing to the latest `origin/main`, I ran `git checkout origin/main -- .` in this worktree. That threw away uncommitted changes that were sitting in the worktree before I started:
- the edited `public/outdoor-hours/hourly/*.json` data files
- some `session-manager-operations/*` state files

They had never been committed, so git can't bring them back. The main checkout at `~/Projects/Bilko` was not touched and still has its own uncommitted `session-manager-operations` changes (611 files), so the scheduler's state there is intact.

If the worktree's Outdoor-Hours data mattered, it has to be regenerated from the Outdoor-Hours sibling repo. Nothing I committed includes or depends on those files.
