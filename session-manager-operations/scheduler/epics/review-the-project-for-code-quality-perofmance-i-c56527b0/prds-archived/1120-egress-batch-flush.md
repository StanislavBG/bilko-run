---
title: Egress meter: flush with one batched DB call instead of one round-trip per key
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-09T23:05:59.711Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1kqjrz-0f9ce3
---
# Goal

behavior. server/egress.ts flushes the bandwidth meter every minute with one `await dbRun` per key (~lines 73-88) and one DELETE per row during pruning (~215-230, 266-271). On Turso each round-trip costs 20-60 ms. Use a single `getClient().batch([...], 'write')` per flush and per prune.

# Acceptance criteria

- [ ] The flush writes all pending keys in one client.batch call (or chunks of at most 100 statements); pruning deletes with one statement (a WHERE range) or one batch.
- [ ] Stored totals are identical to before for the same traffic: an existing or new test in tests/egress.test.ts records traffic for 3 keys, flushes, and asserts the DB rows.
- [ ] A test asserts the flush makes at most one batch call for 3 keys (spy on getClient().batch).
- [ ] Flush on shutdown (the onClose hook) still works; tests/server-shutdown.test.ts stays green if present.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/egress.ts
- tests/egress.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. All SQL stays parameterized. Read first: server/egress.ts (whole, ~420 lines); server/db.ts lines 1-70 (getClient, helpers); tests/egress.test.ts. Do not touch: server/db.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/egress.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
