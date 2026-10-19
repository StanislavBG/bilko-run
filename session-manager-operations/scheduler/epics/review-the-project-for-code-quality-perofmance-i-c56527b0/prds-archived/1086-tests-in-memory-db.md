---
title: Tests must not write to the real local database file
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-09T19:43:50.824Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1dil2g-13d439
---
# Goal

bug. vitest.config.ts sets `CONTENTGRADE_DB_PATH: ':memory:'`, but server/db.ts getClient() (lines ~12-25) only reads `TURSO_DATABASE_URL` and `BILKO_SQLITE_PATH`, falling back to the real file data/contentgrade.db. So every test run writes into the developer's local database (tests/db.test.ts ~line 87 even comments on this). Point tests at an isolated database.

# Acceptance criteria

- [ ] vitest.config.ts sets `BILKO_SQLITE_PATH` (not CONTENTGRADE_DB_PATH) to an isolated database: ':memory:' if libsql accepts `file::memory:` via getClient, otherwise a unique file under os.tmpdir() computed in vitest.config.ts.
- [ ] If ':memory:' needs it, server/db.ts getClient() handles that value (no mkdirSync on it, correct libsql URL); no other db.ts change.
- [ ] vitest.config.ts also sets `TURSO_DATABASE_URL: ''` so a developer's exported Turso URL can never be hit by tests (and getClient treats empty as unset).
- [ ] Running the full suite leaves data/contentgrade.db untouched: record its mtime (or absence) before and after `pnpm test` in the report.
- [ ] The stale comment in tests/db.test.ts about writing to the real DB is updated to the new behavior.
- [ ] Full `pnpm test` is green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- vitest.config.ts
- server/db.ts
- tests/db.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Tests run sequentially in one fork (vitest.config.ts poolOptions singleFork) with module isolation per file, so a fresh in-memory DB per test file is expected; if some test relies on state from another file, prefer the tmpdir-file option and say so.

Read first: vitest.config.ts (whole, ~20 lines); server/db.ts lines 1-30; tests/db.test.ts lines 75-100.

Steps:
1. `ls -l data/contentgrade.db` (note mtime or absence).
2. Change vitest.config.ts env; adjust getClient only if needed.
3. `timeout 400 pnpm test`; re-check the mtime.

Do not touch: any other part of server/db.ts (schema, seeds, blog posts).

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
