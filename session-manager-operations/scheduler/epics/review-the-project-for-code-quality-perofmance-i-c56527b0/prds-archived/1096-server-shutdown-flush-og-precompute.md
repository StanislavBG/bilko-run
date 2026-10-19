---
title: Server: flush metering on deploy shutdown, build social-share HTML once, drop dead OG entries
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T19:46:46.498Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [remove-social-roast]
planId: pl-mv1dljgk-fcdaa4
---
# Goal

behavior. server/ has no SIGTERM handler, so Fastify's onClose hooks (the egress meter flush in server/egress.ts) never run when Render stops the old instance: up to 60s of bandwidth data is lost on every deploy. The SPA fallback in server/index.ts (~lines 213-295) runs 4 regex replaces on every hit to an OG path, and OG_OVERRIDES holds entries for /projects/<slug> paths that never reach the fallback (static serving 301s them to the app bundle) plus /pricing copy about PageRoast credits. Read the landed server/index.ts from remove-social-roast first.

# Acceptance criteria

- [ ] server/index.ts registers SIGTERM and SIGINT handlers that call `app.close()` once (guarded against double signals), log one line, and exit 0 after close resolves or exit 1 after a 10 s timeout.
- [ ] OG_OVERRIDES keeps only paths the SPA fallback can actually serve (e.g. /, /projects, /blog, /pricing ...); every removed /projects/<slug> entry is listed in the report with the reason (served by static index.html).
- [ ] The per-path HTML is computed once at boot into a Map and the not-found handler serves from it; the handler keeps `return reply.send(...)` and the `private, no-store` cache header exactly as now.
- [ ] A test (new tests/server-shutdown.test.ts, or added to tests/egress.test.ts if simpler) proves that closing the Fastify app flushes pending egress counts to the DB.
- [ ] tests/spa-fallback-notfound-crash.test.ts and the full `pnpm test` stay green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/index.ts
- tests/server-shutdown.test.ts
- tests/egress.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko.

Read first: server/index.ts lines 180-340 (static plugin, OG table, serveWithOg, setNotFoundHandler, listen); server/egress.ts (onClose flush ~line 358, flush function); tests/spa-fallback-notfound-crash.test.ts (how the app is built in tests).

If the OG/SPA code is only reachable inside index.ts's top-level production block, extract the OG table + HTML builder into a small exported function in the same file only if needed for testing; do not create new server modules beyond the one test file.

Do not touch: server/egress.ts logic (read only), server/static-cache.ts, server/security-headers.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 400 pnpm vitest run
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
