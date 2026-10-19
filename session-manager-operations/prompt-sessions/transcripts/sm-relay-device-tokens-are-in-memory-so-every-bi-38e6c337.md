# Transcript — sm-relay-device-tokens-are-in-memory-so-every-bi-38e6c337

## User — 2026-10-09T17:50:26.005Z

This session is INBOUND FEEDBACK from another project: /home/bilko/Projects/session-manager (session two-pages-vertical-scroll-i-think-we-have-too-mu-d5876ed8). Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: sm-relay: device tokens are in-memory, so every bilko.run redeploy forces phones to re-pair

Symptom: the Session Manager phone remote (bilko.run/projects/session-manager/, relay at wss://bilko.run/projects/session-manager/relay + /api/sm-relay/*) loses every paired device whenever the bilko-run service redeploys. Render auto-deploys on every push to main, so re-pairing is needed after unrelated site pushes too.

Where: server/sm-relay/tokens.ts — its header says "Stores are in-process and lost on redeploy". After a redeploy the desktop's POST /api/sm-relay/device-ticket returns invalid_token and the user must generate a new code on the phone and type it on the desktop.

Why now: Session Manager is restoring its desktop half of the remote (it was disabled 2026-08-06), so the relay is about to carry real traffic again.

Expected: long-lived device tokens (DeviceTokenEntry: token, deviceId, userId, email, issuedAt, expiresAt, revoked, devicePubKey) survive a redeploy — e.g. persisted through server/db.ts. Short-lived OTPs and WS tickets can stay in memory. Revocation must still take effect immediately. The wire protocol and URLs must not change (they are baked into already-shipped desktop builds and the phone app).

This is relay infrastructure, which host-boundary classifies as host-legitimate, so it belongs in Bilko.

Reference: /home/bilko/Projects/Bilko/server/sm-relay/tokens.ts
Reference: /home/bilko/Projects/Bilko/server/sm-relay/router.ts

## Agent — 2026-10-09T18:01:05.015Z

The report was accurate, and it's fixed. Phones and desktops that pair after this deploys will stay paired through later redeploys. It's committed as `2e5245e` on `sm-epic/sm-relay-device-tokens-are-in-memory-so-every-bi-38e6c337` but not pushed or merged to `main`; the epic flow handles that.

**What was wrong:** `server/sm-relay/tokens.ts` kept device tokens only in memory, so every Render redeploy erased them. After that, `/api/sm-relay/device-ticket` returned `invalid_token` and the user had to pair again.

**What changed:**
- **New table:** device tokens now live in a `sm_relay_devices` table in the database (`server/db.ts`), with one row per device and an index on user. It stores only a SHA-256 hash of each token, so reading the database never gives anyone a working token.
- **`tokens.ts`:**
  - The device functions now read and write that table.
  - Revoking a device deletes its row, so the very next check fails. Revoke takes effect immediately, including across redeploys.
  - Pairing the same `deviceId` again replaces its row, which cancels the old token. This matches the old behavior.
  - Expired rows are rejected when checked, and the existing 5-minute cleanup job also removes them.
  - Pairing codes, WS tickets and rate-limit counters still live in memory, as you asked.
- **`routes/sm-relay.ts`:** only internal updates to use the new async functions. No endpoint, URL or response shape changed, so already-shipped desktop builds and the phone app keep working.
- **Tests:** `tests/sm-relay-device-persistence.test.ts` simulates a redeploy (fresh in-memory state, same database). It checks that:
  - a paired device still gets a ticket after the redeploy
  - only the hash is stored
  - revoking works immediately and stays revoked after a redeploy
  - "revoke all" only affects that user's devices
  - pairing again cancels the old token
  - expired tokens are rejected and cleaned up
  
  The full suite passes (52 files, 729 tests) and so does `pnpm typecheck`.

**One-time cost:** devices paired before this deploy only exist in the old in-memory store, so they will need to pair one last time after it ships.

Separately, some MCP connections aren't working. `n8n` and `sqlite` failed to connect. Google Calendar, Google Drive and Stripe need to be authorized: the first two in your claude.ai connector settings, Stripe through `/mcp`. This task didn't need any of them.
