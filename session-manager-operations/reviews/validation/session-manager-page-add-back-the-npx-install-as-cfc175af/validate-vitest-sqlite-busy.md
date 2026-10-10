# Validation: repair-vitest-sqlite-busy

Base: 10b0deabd6bc95d763024e3fc07f5bf2bbf27cd8. PRD: 1216-repair-vitest-sqlite-busy (prds-archived). Fix commit: 06d1714.

## repair-vitest-sqlite-busy — VERIFIED

- AC1 (root cause w/ evidence): commit 06d1714 body states the cause (shared BILKO_SQLITE_PATH; leftovers from earlier file, `vi.resetModules()` orphaned libsql clients, libsql busy_timeout 0) and a repro (4–8 failing files/run). Caveat: the exact lock holder was not pinned down; the cause is stated as "plausible", supported by the failures being in `beforeAll` initDb. Minor.
- AC2 (real fix, no skip/retry/delete): `tests/setup-db.ts:1-10` sets a per-file mkdtemp `BILKO_SQLITE_PATH` and `TURSO_DATABASE_URL=''`; `vitest.config.ts` swaps the shared `env` for `setupFiles: ['tests/setup-db.ts']`. No test files edited by this commit; no data/contentgrade.db or Turso use.
- AC3 (db.ts): `git diff 10b0dea..HEAD --stat -- server/db.ts` is empty, so Turso behavior is unchanged and no new test is required.
- AC4 (gate): re-ran in the foreground — `pnpm typecheck` exit 0; `pnpm vitest run` x3: each exit 0, 78/78 files, 944/944 tests, no skipped count reported.

## Findings

### Critical
- none
### Important
- none
### Minor
- `tests/setup-db.ts:9` — temp dirs per file are never cleaned up (OS tmp only); harmless.
- Root cause is inferred rather than proven (see AC1); the isolation fix removes the shared-file condition regardless, and 3 clean full runs support it. In-process overlap within a single file's own DB is still theoretically possible but was not observed.
- Combined diff (`10b0dea..HEAD`) also contains unrelated npx price-tag and sm-relay work from other plan jobs; the SQLITE_BUSY change itself is only `tests/setup-db.ts` and `vitest.config.ts`. Self-review: no secrets, no unsafe input handling, no path traversal (paths from mkdtemp).
