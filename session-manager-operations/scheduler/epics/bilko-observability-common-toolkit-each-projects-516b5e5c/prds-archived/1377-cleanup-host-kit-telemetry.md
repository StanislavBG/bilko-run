---
title: Cleanup: host-kit telemetry — single touchSession per enqueue, randomUUID fallback, constants order
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-19T02:42:23.478Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
disposition: new-head
planId: pl-mvenfi46-b95cc5
---
# Goal

behavior: fix two issues an independent review found in the host-kit telemetry SDK. First, every log and error enqueue calls touchSession() twice, once per id, so it writes 4 cookies and 2 localStorage entries per call. Second, ids fall back to 'anon' wherever crypto.randomUUID is unavailable (for example plain-http pages). Also tidy the constants block so defaultEndpoint() is not wedged between constants.

# Acceptance criteria

- [ ] In packages/host-kit/src/telemetry.ts, the log and error enqueue paths (around lines 83-84, 125 and 188) call touchSession() exactly once per enqueue and reuse its result for visitor_id and session_id, the same way track() does.
- [ ] UUID generation uses crypto.randomUUID when available, and otherwise falls back to a Math.random v4 UUID that matches the module's valid-id regex. 'anon' is returned only when storage throws.
- [ ] defaultEndpoint() is declared after the constants block. Exports and behavior are otherwise unchanged.
- [ ] packages/host-kit/tests/telemetry.test.ts adds two tests. One asserts a single logError call performs exactly 2 document.cookie writes, by spying on the cookie setter. The other asserts a valid-UUID visitor id is produced when crypto.randomUUID is undefined.
- [ ] A new .changeset/*.md declares a patch bump for host-kit. pnpm --filter host-kit test, typecheck and build pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- packages/host-kit/src/telemetry.ts
- packages/host-kit/tests/telemetry.test.ts
- .changeset/

# Implementation notes

Read first: packages/host-kit/src/telemetry.ts (whole file); packages/host-kit/tests/telemetry.test.ts (existing helpers, cookie reset); .changeset/host-kit-session-telemetry.md (format).

Do not touch: anything outside packages/host-kit/ and .changeset/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm --filter host-kit test && timeout 300 pnpm --filter host-kit typecheck && timeout 300 pnpm --filter host-kit build
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
