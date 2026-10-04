---
title: Harden legacy-date regression test: detect clock-stamped seeds behaviourally, not by text scan
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-03T20:52:53.814Z
sourcePromptId: multiple-publications-on-10-3-this-should-not-ha-e1937593
agentType: dev-lead
planId: pl-musvc9ti-9eb5f3
---
# Goal

behavior: the regression test in tests/blog-cadence-gate.test.ts (around line 93) that guards against blog seeds using `new Date()` for published_at finds INSERT blocks with the regex `/\n\s*\);/`, which a post body containing a code sample ending in `);` can fool into a false green. Replace it with a behavioural test that seeds a fresh temp DB under a faked clock and asserts no published post carries the faked time, so any clock-stamped seed is caught no matter what the post text contains.

# Acceptance criteria

- [ ] `tests/blog-cadence-gate.test.ts`: the text-scan test using `/\n\s*\);/` is removed and replaced by a test that fakes only Date (`vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(new Date('2099-01-01T00:00:00.000Z'))`), calls `loadSeededPosts()` from scripts/blog-cadence-gate.ts against a fresh temp DB, and asserts no row's publishedAt starts with '2099-'; timers are restored in a finally/afterEach.
- [ ] The new test is proven to catch the regression: a temporary local edit making one blog seed use `new Date().toISOString()` makes it fail (done during the run, then reverted; state this in the commit message). No such edit is committed.
- [ ] If `loadSeededPosts` caches the db client so a second call in one test process reuses the first DB, `scripts/blog-cadence-gate.ts` is minimally changed (or the test uses `vi.resetModules()` + a fresh dynamic import) so the faked-clock call really seeds a new temp DB.
- [ ] All existing tests in tests/blog-cadence-gate.test.ts still pass, and `pnpm tsx scripts/blog-cadence-gate.ts check` still exits 0.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- tests/blog-cadence-gate.test.ts
- scripts/blog-cadence-gate.ts

# Implementation notes

Read first: tests/blog-cadence-gate.test.ts (whole file), scripts/blog-cadence-gate.ts (loadSeededPosts: deletes TURSO env vars, sets BILKO_SQLITE_PATH to a mkdtemp file, dynamically imports ../server/db.js, runs initDb, selects published rows), server/db.ts lines 8-25 (getClient caches `_client`).

Steps:
1. Delete the regex-scan test. 2. Add the faked-clock test; give it a 60s timeout. Fake only Date so libsql/fs timers are untouched. 3. Handle the cached client (see AC 3). 4. Prove red with a temporary edit, revert, run the gate last.

Do not touch: server/db.ts seed content, scripts/blog-cadence-watchdog.sh, .claude/skills/.

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
