---
title: Fix crash-loop: any unmatched path under /projects/ kills the server (ERR_HTTP_HEADERS_SENT)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 60
createdVia: scheduler-api
issuedAt: 2026-08-13T22:26:36.661Z
sourcePromptId: render-http-bandwith-we-need-to-identify-what-ap-7331446e
---
# Goal

The Render service is in a crash loop and shows "Failed service". A single GET to any unmatched path under /projects/ (e.g. /projects/fake-app-xyz/nope.js) kills the Node process with an uncaught ERR_HTTP_HEADERS_SENT thrown from Fastify's onSend chain. Render restarts it and the cycle repeats. This is user-visible as intermittent 503s and 15s cold starts, and it also destroys the in-process egress metering buffer on every restart, so platform usage data is unreliable while it persists. Find the double-header-write and fix it so a 404 under /projects/ returns a normal response instead of taking down the host.

# Acceptance criteria

- [ ] A GET to an unmatched path under /projects/ (e.g. /projects/fake-app-xyz/nope.js) returns an HTTP response and the server process is still alive afterwards — verified by requesting it and then successfully hitting /api/health on the same process.
- [ ] A regression test asserts the above: boot the app, request an unmatched /projects/<slug>/<file>, assert a response status AND that a subsequent request still succeeds. This test must fail against current HEAD.
- [ ] The root cause is identified and stated in the commit message — which hook or handler writes headers twice. Do NOT paper over it by wrapping the throw in a try/catch or adding a process-level uncaughtException handler that swallows it; those hide the bug and leave the response half-written.
- [ ] Related shapes are covered too: unmatched path directly under /projects/ (no trailing segment), a path under a slug that DOES exist but a file that does not (e.g. /projects/local-score/nope.js), and the trailing-slash redirect case (/projects/local-score → 301) all return responses without killing the process.
- [ ] Existing tests still pass (pnpm test, currently 262 passing across 28 files).
- [ ] pnpm build still succeeds.

# Implementation notes

REPRO (confirmed locally against HEAD, production mode):

  pnpm build
  NODE_ENV=production PORT=4323 node dist-server/server/index.js &
  curl -o /dev/null -w '%{http_code}\n' http://localhost:4323/projects/fake-app-xyz/nope.js   # 200
  curl http://localhost:4323/api/health                                                        # connection refused — process is dead

Requests to /, /outdoor-hours/last1m.json, and /projects/local-score/ all succeed and leave the process alive. Only the unmatched-/projects/ shape kills it.

Stack (uncaught, kills the process):
  Error [ERR_HTTP_HEADERS_SENT]: Cannot write headers after they are sent to the client
      at ServerResponse.writeHead (node:_http_server:354:11)
      at safeWriteHead (fastify/lib/reply.js:566:9)
      at onSendEnd (fastify/lib/reply.js:631:5)
      at wrapOnSendEnd (fastify/lib/reply.js:559:5)
      at next (fastify/lib/hooks.js:292:7)
      at handleResolve (fastify/lib/hooks.js:309:5)

It is the onSend chain, NOT onResponse. Prime suspects, in order:
1. The @fastify/static registration in server/index.ts:125-137 uses `redirect: true`. That redirect interacting with the SPA notFound/fallback handler is the most likely place a reply gets sent twice. Find where the SPA fallback is registered (setNotFoundHandler / the OG_OVERRIDES index.html serving path around server/index.ts:140-190) and check whether it can run after the static plugin has already replied.
2. server/egress.ts:129-138 registers an onSend hook. It is wrapped in try/catch and returns payload unchanged, so it looks innocent — but it is in the failing chain, so rule it in or out explicitly rather than by inspection.

TIMELINE / CAUSATION — UNRESOLVED, DO NOT ASSUME: two commits landed today before the crash-loop was noticed. 89e0a80 deleted public/projects/game-academy/ (which is very likely what started GENERATING unmatched /projects/ traffic at volume — 117 sprite URLs are still being requested by crawlers and cached service workers). be3c6b0 added the static egress metering. An attempt to bisect by reverting server/egress.ts to its 2727290 version failed to build, because server/routes/admin-observability.ts:5 imports `dayKey` which the older egress.ts does not export — if you retry that bisect, revert BOTH files together. Determine causation properly; do not guess.

If the root cause turns out to be in the egress metering, prefer fixing the hook over reverting the feature — the platform needs that data.

# Out of scope

- Re-publishing public/projects/game-academy/ — it stays down until its sprites are converted to WebP in the sibling repo.
- Cache-Control / Render edge-caching changes.
- Any change to how egress is bucketed by slug — that shipped in be3c6b0 and validated clean.

## Engineering standards

Before writing any code, read `/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` — it has the Performance, Debugging,
API-reuse, TDD, and Execution-discipline rules that apply to this PRD. Every rule in it is
mandatory, especially Execution discipline (bounded commands, verify before done, the
finish-protocol sentinel).
