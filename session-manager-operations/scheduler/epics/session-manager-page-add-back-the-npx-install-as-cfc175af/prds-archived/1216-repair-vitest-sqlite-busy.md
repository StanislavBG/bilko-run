---
title: bug: vitest suites intermittently die with SQLITE_BUSY at initDb, CI on main red since 2026-10-09
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-10T21:04:27.743Z
sourcePromptId: session-manager-page-add-back-the-npx-install-as-cfc175af
tag: bug
agentType: dev-lead
dependsOn: [npx-price-tag-wire]
planId: pl-mv2utb6r-b533e1
---
# Goal

behavior. GitHub Actions CI on StanislavBG/bilko-run main has failed the Test step on almost every push since commit 20c3543 (2026-10-09 7:28 PM PDT), with `LibsqlError: SQLITE_BUSY: database is locked` thrown from initDb (server/db.ts:158, the MIGRATIONS batch) in the beforeAll of 2-10 DB-backed test files. The failing set changes run to run, and it reproduces locally even with `--no-file-parallelism`. Find the root cause and fix it so the full vitest suite is reliably green.

# Acceptance criteria

- [ ] The root cause is identified with evidence (which test/module holds a write lock or opens a second libsql connection/transaction on the shared BILKO_SQLITE_PATH file while another file's initDb runs) and stated in the commit message body.
- [ ] The fix addresses that cause (e.g. closing/awaiting the leaked client or transaction, giving each test file its own DB file, or a busy_timeout/serialized initDb) — not by skipping, retrying, or deleting the affected tests, and without pointing tests at data/contentgrade.db or Turso.
- [ ] If server/db.ts changes, production behavior is unchanged for Turso (TURSO_DATABASE_URL set) and only the local-file path is affected; any new test proves the fix (e.g. two concurrent initDb calls on one file do not throw SQLITE_BUSY).
- [ ] `pnpm vitest run` passes three consecutive times locally with 0 failed files, and `pnpm typecheck` passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- vitest.config.ts
- server/db.ts
- tests/

# Implementation notes

Read first:
- vitest.config.ts (whole file: one mkdtemp test.db shared by ALL files via BILKO_SQLITE_PATH; pool 'forks' + singleFork; vitest 3.2.4)
- server/db.ts lines 1-60 (getClient: one module-level libsql client, `file:` URL) and 140-200 (initDb: client.batch(MIGRATIONS, 'write') at ~158, then additive column migrations)
- One failing file's setup, e.g. tests/cost-controls.test.ts lines 1-20, tests/tokens.test.ts, tests/db.test.ts
- `git log --oneline cc2ebef..20c3543` and `git log --oneline -15 -- server/db.ts server/db-schema.ts tests/` to see what changed around when CI went red (last green CI: f6c830b 2026-10-09 3:43 PM PDT; first red: 70fd69f, then 20c3543 onward).

Repro: `timeout 600 pnpm vitest run` (fails 2-10 files with SQLITE_BUSY); also `timeout 600 pnpm vitest run --no-file-parallelism` (still fails 2-3 files). Use the systematic-debugging approach: grep tests/ and server/ for other createClient( / getClient overrides / `_client` resets / dbTransaction usage that never commits or rolls back / vi.resetModules (which would create a fresh module-level client while the old one still holds a lock). Check whether singleFork is really in effect in vitest 3.2.4 (log process.pid per file).

This PRD runs after npx-price-tag-wire (which edits tests/open-core-positioning.test.ts); do not edit that file. Do not touch: src/, e2e/. Do not push; commit only.

# Out of scope

- CI workflow Node 20 deprecation warnings
- Unrelated test cleanups

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 600 pnpm vitest run
timeout 600 pnpm vitest run
timeout 600 pnpm vitest run
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
