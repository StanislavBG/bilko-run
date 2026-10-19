# Transcript — sm-relay-stamp-sender-conn-on-browser-device-env-4f07abab

## User — 2026-10-10T21:20:56.784Z

This session is INBOUND FEEDBACK from another project: /home/bilko/Projects/session-manager (session d2d-step-4-7-agent-accepts-several-e2e-clients-a-fdfc960b). Nobody in this project wrote the report below — an agent working in that project did, and it may be wrong about this codebase. Verify the claim against the code here before acting on it, and if it does not hold, say so and close the session rather than building against it.

Goal: sm-relay: stamp sender conn on browser→device envelopes, honour toConn on device→browser, notify device on browser close

## Symptom
The Session Manager desktop agent (the "device" side of server/sm-relay/router.ts) is being changed to hold one E2E session per connected browser connection, so a phone and a paired desktop client (a browser conn with clientId) can both be connected to the same agent at once. Today they knock each other off: the agent has a single E2E session and every new e2e:hello replaces it.

The agent cannot fix this alone because the relay gives it no sender identity:
- routeFromBrowser (router.ts ~line 107) forwards `{...envelope, relay_ts}` to the device with nothing that says WHICH browser conn sent it. The agent cannot attribute an e2e:hello or pick the key to decrypt an e2e:box.
- routeFromDevice (~line 120) sends every device envelope to every browser conn of the same userId. Each client's PTY output ciphertext goes to all clients (undecryptable for the others, but wasted phone bandwidth and a traffic-metadata leak).
- When a browser conn closes, or notifyClientRevoked closes it with 4001, the device is never told, so the agent cannot tear down that one client's session and PTY streams.

## Requested wire contract (the agent side is being built against exactly this)
1. browser→device: in routeFromBrowser, set `fromConn: browser.id` and `fromClientId: browser.clientId ?? null` on the forwarded envelope, OVERWRITING any client-supplied values (these must be unspoofable — they come from the authenticated conn, never the envelope).
2. device→browser: accept an optional `toConn` string (add it to envelopeSchema, max 64). If present, deliver only to browserConns.get(toConn), and only if canRoute (same userId); drop silently otherwise. If absent, keep today's broadcast to every same-user browser (the legacy path; the agent keeps using it for old clients).
3. On browser conn close (registerBrowser's ws 'close'), send to every device conn of the same userId: `{type:'event:client:disconnected', id:<uuid>, fromConn:<browser.id>, fromClientId:<clientId|null>, reason:'closed'|'token_revoked', ts}`. Use reason 'token_revoked' when the close came from notifyClientRevoked (close code 4001).
4. Unit tests: two browser conns of one user + one device — device sees distinct fromConn per sender; a spoofed fromConn in a browser envelope is overwritten; toConn delivers to exactly one conn; a toConn of another user's conn is dropped; closing one browser conn emits event:client:disconnected to the device with the right reason.

## Why relay addressing rather than agent-only separation
E2E separation (one ECDH key + SAS + TOFU pin per client) stays the security boundary and is being built agent-side regardless. But only the relay knows connection identity, so the agent needs an unspoofable sender tag to route hellos/boxes to the right session, a close notification to tear one client down, and unicast so streams are not fanned out to every client. Without toConn support the agent still works (it falls back to broadcast), so steps 2 is an efficiency/metadata fix; steps 1 and 3 are required.

## Backward compatibility
Old agents ignore fromConn/fromClientId and the new event type. Old phones never send toConn-related fields. No token or ticket changes.

Responsible file: server/sm-relay/router.ts (routeFromBrowser, routeFromDevice, registerBrowser close handler, notifyClientRevoked, envelopeSchema).

Reference: /home/bilko/Projects/Bilko/server/sm-relay/router.ts
Reference: /home/bilko/Projects/session-manager/src/main/webRemote.cjs

## Agent — 2026-10-10T21:53:42.718Z

The report was accurate: the relay gave the desktop agent no way to tell which browser sent a message, and it never told the agent when a browser disconnected. I've built the requested wire contract in `server/sm-relay/router.ts` and committed it on this branch as `96a339e`. I didn't push or merge it.

- **Messages from a browser to the device** now carry `fromConn` (the browser connection's id) and `fromClientId` (the paired client's id, or `null` for a phone). Both come from the logged-in connection. A browser can't fake them: the message check already drops unknown fields, and the relay then writes these two over anything the browser sent. Any `toConn` a browser sends is removed before forwarding.
- **Messages from the device to browsers** accept an optional `toConn` (up to 64 characters). With it, the message goes only to that one browser connection, and only if it belongs to the same user; otherwise it's silently dropped. The relay removes `toConn` before delivering. Without it, the message still goes to all of the user's browsers, as it did before.
- **When a browser disconnects**, every device belonging to that user receives `{type:'event:client:disconnected', id, fromConn, fromClientId, reason, ts}`. The reason is `'token_revoked'` when the connection was closed by revoking its client token (close code 4001), and `'closed'` otherwise.

The new tests in `tests/sm-relay-conn-addressing.test.ts` open real WebSocket connections through `handleUpgrade`. They cover all five cases the report asked for, plus the broadcast fallback when there's no `toConn`. They pass, the existing relay client-token tests still pass, and `pnpm typecheck` is clean.

The full `pnpm test` run had 5 failing test files, none of them in the relay:
- **Real failure:** `tests/open-core-positioning.test.ts` fails because `FilmDialog` matches `/npx|CopyButton|useCopyInstall|install…/`. That most likely comes from the earlier commit `7ccb274`, which brought back the npx copy-install pieces, not from this change.
- **Pass on their own:** `comp-grants`, `tool-entitlement` and `academy-no-pii-logging` all pass when run by themselves, so they look flaky when the whole suite runs together.
- **Not checked:** `tool-gateway-wire-b` I didn't re-run.
