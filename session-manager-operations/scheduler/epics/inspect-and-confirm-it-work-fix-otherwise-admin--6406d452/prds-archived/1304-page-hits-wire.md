---
title: Wire the page-hit recorder into the live server and shut it down cleanly
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-13T03:41:31.753Z
sourcePromptId: inspect-and-confirm-it-work-fix-otherwise-admin--6406d452
agentType: dev-lead
dependsOn: [page-hits-recorder]
planId: pl-mv64vt5k-acb57a
---
# Goal

wire. server/page-hits.ts (from PRD page-hits-recorder) exports registerPageHitRecorder(app, opts?) but nothing calls it yet. Register it in server/index.ts so every HTML document the production server sends — SPA shell, blog, and every /projects/<slug>/ static app — lands in page_hits.

# Acceptance criteria

- [ ] server/index.ts imports registerPageHitRecorder from './page-hits.js' and calls registerPageHitRecorder(app) once, immediately after the existing registerEgressMeter(app) call, before any route or staticPlugin registration.
- [ ] The graceful-shutdown path still flushes: registerPageHitRecorder's onClose hook runs on app.close() (verify by reading server/page-hits.ts; add nothing to index.ts beyond the import and call if it already does).
- [ ] tests/page-hits.test.ts gains a test that registers @fastify/static over a temp dir containing projects/demo/index.html and projects/demo/app.js (same pattern as tests/egress.test.ts), GETs /projects/demo/ and /projects/demo/app.js, flushes, and asserts exactly one page_hits row with slug 'demo' and status 200.
- [ ] Typecheck and the full vitest suite pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/index.ts
- tests/page-hits.test.ts

# Implementation notes

Read first: server/page-hits.ts (landed by PRD page-hits-recorder — read its exports before editing), server/index.ts lines 140-150 (registerEgressMeter call site) and 215-270 (staticPlugin + SPA fallback), tests/egress.test.ts lines 1-60 (static temp-dir harness).
Steps:
1. server/index.ts: add the import next to the egress import (line ~37) and the call right after registerEgressMeter(app) (line ~147).
2. tests/page-hits.test.ts: add a describe block with its own Fastify instance registering registerPageHitRecorder(app2, { flush: false }) and @fastify/static over a mkdtempSync dir.
Do not touch: server/egress.ts, server/security-headers.ts, server/routes/*.

# Out of scope

- Changing recorder logic in server/page-hits.ts unless a test proves a bug
- Click beacon injection

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/page-hits.test.ts && timeout 600 pnpm test && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
