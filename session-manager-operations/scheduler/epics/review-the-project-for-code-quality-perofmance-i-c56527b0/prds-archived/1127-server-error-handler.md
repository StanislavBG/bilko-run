---
title: Server: one error handler that never leaks internal error text to visitors
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:07:36.374Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1ksmd2-85365b
---
# Goal

behavior. The server has no `setErrorHandler`. Uncaught route errors use Fastify defaults, and ~18 places reply with raw `err.message`, e.g. server/routes/stripe.ts ~133 and ~294, which can leak internals such as Stripe error details or SQL messages. Add one global handler in server/index.ts that logs the error and returns a generic body, and replace stripe.ts's raw-message replies.

# Acceptance criteria

- [ ] server/index.ts registers `app.setErrorHandler`. 4xx errors with a Fastify validation or statusCode keep their status and a safe message; anything else logs `console.error` with method and url and replies 500 `{ error: 'Something went wrong. Please try again.' }`.
- [ ] server/routes/stripe.ts no longer puts `err.message` in any reply body (checkout, billing portal and others); each such place logs the error and returns a generic message with the same status.
- [ ] New tests/error-handler.test.ts: a route that throws `new Error('secret detail')` yields 500 and a body without 'secret detail'. The stripe billing-portal failure path with a stubbed Stripe error returns no Stripe message.
- [ ] Full `pnpm test` is green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/index.ts
- server/routes/stripe.ts
- tests/error-handler.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. The AI-tool routes' raw messages are handled by the tool-gateway wire PRDs; do not edit server/routes/tools/.

Read first: server/index.ts lines 40-140; server/routes/stripe.ts (grep `err.message`); tests/spa-fallback-notfound-crash.test.ts (how the app is built in tests).

Do not touch: server/routes/tools/, the SPA not-found handler.

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
