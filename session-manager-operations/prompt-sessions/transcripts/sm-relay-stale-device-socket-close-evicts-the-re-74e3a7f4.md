# Transcript — sm-relay-stale-device-socket-close-evicts-the-re-74e3a7f4

## User — 2026-10-17T15:38:08.104Z

This session is INBOUND FEEDBACK from another project: session-manager (/home/bilko/Projects/session-manager, session your-desktop-is-offline-it-seems-we-can-t-keep-t-1322520e). It was raised while working on: Your Desktop is offline  It seems we can't keep the trust between this macnine and the Bilko.run mobile-remote open. Currentl I get the "your desktop is offline" while typing the mesasage on the live Desktop.   Can you find out why when I;m logged in online shows that the desktop is not?. Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: sm-relay: stale device-socket close evicts the reconnected live desktop (phone shows "desktop offline")

## Why
The user's phone at bilko.run/projects/session-manager shows "Your desktop is offline" while the desktop Session Manager is running, connected, and authenticated to the relay. The cause is a reconnect race in the relay's device registry: when a desktop's socket drops abnormally (1006, seen every 1–2h in desktop logs) and it reconnects within ~2s, the relay's close handler for the OLD socket fires afterwards and deletes the NEW live conn from deviceConns. From then on the relay tells every phone the desktop is offline and routes nothing, until the desktop happens to drop again.

## Proposed plan
1. In server/sm-relay/router.ts registerDevice, make the ws 'close' handler identity-checked: only delete deviceConns and broadcast event:device:status 'disconnected' when deviceConns.get(t.deviceId) === conn (the closing conn).
2. When registerDevice replaces an existing conn for the same deviceId, close the old socket (e.g. ws.close(4000,'superseded') or terminate()) so it cannot linger half-open.
3. Apply the same identity check to the browser close path if useful (browserConns is keyed by random id, so it is already safe — confirm).
4. Add a router unit test: open device socket A, open device socket B for the same deviceId, close A; assert isDeviceOnline(deviceId) is true and no 'disconnected' status was sent to a same-user browser.

## Acceptance criteria
- [ ] Closing a superseded device socket no longer removes the live replacement from deviceConns
- [ ] isDeviceOnline(deviceId) stays true after the stale close; /api/sm-relay/devices reports isOnline: true
- [ ] No spurious event:device:status 'disconnected' is broadcast for a superseded socket
- [ ] A replacement registration closes the previous socket for that deviceId
- [ ] Unit test covering the A-then-B-then-close-A sequence passes

## Details
Reproduced against the real server/sm-relay/router.ts (HEAD 25e7179) with a vitest scratch test that mocks ./tokens.js consumeWsTicket and opens two device sockets for deviceId D1 on a local http server:
  after reconnect online= true
  after stale close online= false   (fresh socket readyState = 1, i.e. still OPEN)

Offending code — registerDevice:
  deviceConns.set(t.deviceId, conn);            // new conn overwrites old
  ...
  ws.on('close', () => {
    deviceConns.delete(t.deviceId);              // old socket's close deletes the NEW conn
    for (browser...) safeSend(... status: 'disconnected')
  });

Why the desktop never self-recovers: the orphaned conn is no longer in deviceConns, so the relay's 30s protocol heartbeat stops pinging it, but handleMessage still answers its app-level {type:'ping'} with {type:'pong'}, so the desktop believes the link is healthy indefinitely. routeFromBrowser returns 'device_offline' for every phone command.

Desktop log evidence (~/.config/claude-code-session-manager/logs, 2026-10-16 UTC): 'ws closed {code:1006}' → 'reconnect scheduled ~1s' → 'connected to relay' → 'auth:ok' at 07:58, 08:23, 10:07, 11:05, 13:16, 15:37, 16:52, 17:43 — each one a chance to hit the race. Session Manager is separately adding a desktop-side watchdog (reconnect if relay protocol pings go silent >100s) as defence in depth; this relay fix is the real cure.

Reference: /home/bilko/Projects/Bilko/server/sm-relay/router.ts
Reference: /tmp/smrelay-repro/repro.test.ts

## Agent — 2026-10-17T15:49:48.456Z

The report was right, and the fix is committed on the epic branch as `c357b8c`. I haven't pushed it to `main`, so it isn't live on bilko.run yet.

**Cause:** in `server/sm-relay/router.ts`, `registerDevice`'s `close` handler deleted `deviceConns[deviceId]` without checking which connection it was. When the desktop dropped with 1006 and reconnected before the relay noticed the old socket was gone, the old socket's late close removed the new live connection and told phones the desktop was disconnected. It stayed "offline" until the next drop. Browser connections don't have this problem because each one gets its own random id.

**Fix:**
- **Close handler:** a closing socket now removes the entry and announces `disconnected` only if it is still the registered connection for that device.
- **Replacing a connection:** a new registration for the same `deviceId` now closes the old socket with code 4000 `'superseded'`. The desktop's close handler (`webRemote.cjs:457`) ignores the old socket because of its `_ws === ws` check, and it only stops reconnecting on 4001, so 4000 is safe for it.
- **Test:** the new `tests/sm-relay-device-reconnect.test.ts` connects a phone, then device socket A, then socket B for the same device. It checks that A gets closed with 4000, the device stays online, the phone gets no `disconnected` message, and that closing B still reports the device offline. Both tests fail against the old code and pass with the fix.

**Checks:** typecheck passes, and the full suite passes (104 files, 1176 tests).

If two desktop processes ever share one `deviceId`, they will now keep closing each other's connections instead of one being silently dropped. That should never happen in normal use, and when it does it will show up in logs rather than as the phone saying "offline".

## User — 2026-10-17T23:29:37.440Z

finish all and merge

## Agent — 2026-10-17T23:47:06.276Z

The relay fix is merged into `main`, pushed to `origin` (`fa28600..449d517`), and most likely live on bilko.run. I can't fully confirm that last part because the site doesn't report which commit is running.

- **Merge:** done as `449d517 merge epic sm-relay-stale-device-socket-close-evicts-the-re-74e3a7f4`, on top of the latest `origin/main`. Typecheck and the full suite passed on the merged result (106 files, 1185 tests).
- **Deploy:** bilko.run restarted twice after the push, at about 4:44:34 PM PDT and 4:46:33 PM PDT. The first came too soon after the push to include this change, so the 4:46 PM restart is most likely this fix going live.
- **To confirm on your side:** the phone should stop saying "desktop offline" after the desktop's routine reconnects. Those happen every 1–2 hours.
- **Your local `main` in `~/Projects/Bilko` was not updated.** It has an unpushed commit of its own (`92a8d03 fix(blog): keep Video badge on one line…`), so it couldn't be fast-forwarded. I left it alone; it needs a rebase or merge onto `origin/main` before it's pushed.
- **Uncommitted files I didn't touch:** this epic worktree has changes under `public/outdoor-hours/`, `public/projects/session-manager/` and `session-manager-operations/` that aren't mine. I left them out of the merge.
