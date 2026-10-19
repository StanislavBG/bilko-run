---
title: Auth helpers: make 401/403 replies safe with async send hooks (reproduce first)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:07:56.874Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1kt26i-997e24
---
# Goal

bug. server/clerk.ts requireAuth/requireAdmin (~lines 64-81) call `reply.status(401|403).send(...)` without returning the reply, and ~45 handlers then `return;` (undefined). server/index.ts documents that exactly this pattern (an async handler resolving undefined while async onSend hooks are still writing) crashed the process with ERR_HTTP_HEADERS_SENT in the SPA fallback. Reproduce whether it affects 401/403 replies under the real hooks; fix it if it does, and lock it in with a test either way.

# Acceptance criteria

- [ ] A test in tests/clerk-auth.test.ts builds a Fastify app with the real registerSecurityHeaders and egress/static-cache onSend hooks plus one route using requireAuth. It fires 50 unauthenticated requests, asserts each gets exactly one 401 response, and asserts no `ERR_HTTP_HEADERS_SENT` or unhandled rejection (listen on process 'unhandledRejection'/'uncaughtException' during the test).
- [ ] Same for requireAdmin with a non-admin token: 403.
- [ ] If the test fails on the current code, server/clerk.ts is fixed so the helpers are safe regardless of how callers return. Prefer awaiting the reply inside the helper, e.g. `await reply.status(401).send(...)`, and returning null, without changing the helper signature. If the test passes as-is, no code change is made and the report says so.
- [ ] Full `pnpm test` green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/clerk.ts
- tests/clerk-auth.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: server/clerk.ts (whole); server/index.ts lines 290-320 (the documented crash comment); server/security-headers.ts (onSend hook ~139); tests/clerk-auth.test.ts. Do not touch: route files (45 call sites) — the fix belongs in clerk.ts.

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
