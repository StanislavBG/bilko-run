---
title: Cadence gate: restore process.env after loadSeededPosts (no leaked DB env in test process)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 7
createdVia: scheduler-api
issuedAt: 2026-10-03T21:19:01.202Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
agentType: dev-lead
disposition: new-head
planId: pl-musw9v82-5ceb50
---
# Goal

behavior: `loadSeededPosts()` in scripts/blog-cadence-gate.ts (lines ~66-71) deletes TURSO_DATABASE_URL / TURSO_AUTH_TOKEN and overwrites BILKO_SQLITE_PATH with no restore. vitest runs every test file in one forked process (vitest.config.ts singleFork), so the mutation leaks into later tests by ordering accident. Restore the original env values in a finally block.

# Acceptance criteria

- [ ] `scripts/blog-cadence-gate.ts` loadSeededPosts snapshots TURSO_DATABASE_URL, TURSO_AUTH_TOKEN and BILKO_SQLITE_PATH before changing them and restores each in a `finally` (deleting keys that were originally undefined), and also closes/discards the temp db client it created if server/db.ts exposes a way to do so without changing server/db.ts.
- [ ] `tests/blog-cadence-gate.test.ts` gains a test that sets sentinel values for the three env vars, calls loadSeededPosts, and asserts all three are back to the sentinels afterwards (and that the result is still non-empty).
- [ ] Existing tests in tests/blog-cadence-gate.test.ts pass and `pnpm tsx scripts/blog-cadence-gate.ts check` exits 0.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- scripts/blog-cadence-gate.ts
- tests/blog-cadence-gate.test.ts

# Implementation notes

Read first: scripts/blog-cadence-gate.ts (whole file), tests/blog-cadence-gate.test.ts, server/db.ts lines 8-25 (getClient caches _client; note the module-level cache means a restored env does not reset the client — that is fine, just restore env). Never point at a real Turso DB in tests.

Do not touch: server/db.ts, scripts/blog-readability.ts, tests/blog-readability.test.ts, .claude/skills/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/blog-cadence-gate.test.ts tests/db.test.ts
timeout 120 pnpm tsx scripts/blog-cadence-gate.ts check
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
