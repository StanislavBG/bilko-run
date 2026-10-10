# Validation: blog-files-db plan

Base: f6c830b41387627d97916c1af828bf4c1472dae1. All PRD files found in `prds-archived/`.

## Whole-plan gates
- `pnpm typecheck`: exit 0.
- `pnpm build`: exit 0.
- `pnpm test`: first run 4 files failed with `SQLITE_BUSY` (stack: `initDb` at server/db.ts:158 via tests/tool-gateway-wire-b.test.ts). Second full run: 72 files passed, 848 tests passed, 21 skipped. Targeted run of the 10 blog/db test files: 156 passed. The failure is flaky (see Findings).

## 1115-blog-posts-loader — VERIFIED
- server/blog-posts.ts (87 lines) exports `SeedBlogPost` and `loadBlogPosts`; tests/blog-posts-loader.test.ts: 6 tests pass.
- Gate (loader test + typecheck) green.

## 1137-blog-posts-migrate — VERIFIED
- 43 `content/blog/*.md` files (plus README.md). A fresh `initDb` yields 43 rows, all published. The base had 42 inline INSERTs plus the one conditional seed.
- Equivalence re-run by me: I loaded the base `server/db.ts` (from `f6c830b`) and the current one against fresh temp DBs and dumped `SELECT * FROM blog_posts ORDER BY slug` without id/created_at/updated_at. `cmp` reports IDENTICAL, 43 rows.
- server/db.ts went from 3121 lines to 402 (db-schema.ts split included). The shrink is well over 2,000 lines.
- Related tests green (blog-cadence-gate, blog-rewrites, blog-scheduled-publish, blog-contentgrade-scrub, db).

## 1144-blog-pipeline-seed-path — REFUTED — dry run prints FATAL (pre-existing cause)
- `EXPECTED_COMMIT_PATHS=("content/blog/" ".claude/skills/blog-from-git/blog-ledger.md")` at scripts/blog-cadence-watchdog.sh:431. The consistency check against blog.config.yaml passes: the run got past it. `git grep 'server/db.ts'` in the script and config returns nothing.
- Prompt text and pathspecs updated (diff reviewed). tests/blog-cadence-watchdog.test.ts and blog-watchdog-heartbeat.test.ts pass.
- AC "dry run prints no FATAL" is NOT met. `bash scripts/blog-cadence-watchdog.sh --help` prints: `FATAL: cadence gate next-slot unavailable or returned a non-ISO value (rc=0): [DB] Initialized (local SQLite)\n2026-10-10T16:00:00.000Z`. Cause: `initDb()` logs `[DB] Initialized...` to stdout (server/db.ts:401), and the watchdog captures `2>&1` and requires the value to start with an ISO date (scripts/blog-cadence-watchdog.sh:501-505). The log line also exists in the base (db.ts:3120) and scripts/blog-cadence-gate.ts is unchanged, so this is not a regression from this plan, but the unattended watchdog fails closed on every run and will never publish.

## 1145-blog-skill-docs-seed-path — VERIFIED
- `git grep -n 'server/db.ts' -- .claude/skills/blog-from-git` returns one line, blog-ledger.md:52, a historical note marked "(historical; posts now live in content/blog/*.md)".
- seed.md, scan.md, SKILL.md, rotation.md, voice.md changed (diff stat reviewed).

## 1146-db-boot-batch — VERIFIED
- server/db.ts:163-167 `PRAGMA table_info` once per table and ALTER only for missing columns; seeds batched at db.ts:180, 293 (chunks of 50), 299.
- tests/db-boot.test.ts: second boot <= 25 round-trips and identical schema/rows; passes. The before count on the old code is not in the repo, so I could not re-verify it.

## 1150-db-schema-split — VERIFIED
- server/db-schema.ts (516 lines) holds MIGRATIONS and the additive columns; db.ts imports them (db.ts:158). db.ts is 402 lines. Full tests and build green. The schema-identical assertion in db-boot passes; I did not byte-diff the SQL strings.

## 1151-secret-metadata-names — VERIFIED
- server/db.ts:254-260 `applyDataMigrationOnce('2026-10-10-secret-metadata-names')`: parameterized rename guarded by `NOT EXISTS`, then deletes of STRIPE_API_KEY and CLERK_WEBHOOK_SECRET. The seed at db.ts:277 is `INSERT OR IGNORE`. tests/secrets-metadata.test.ts and db-boot (8 secret rows) pass.

## Findings
### Important
- scripts/blog-cadence-watchdog.sh:501 + server/db.ts:401: the stdout `[DB] Initialized` line breaks the next-slot ISO check, so the daily watchdog exits FATAL. The fix belongs in scripts/blog-cadence-gate.ts or the watchdog (print only the last line, or send the log to stderr). Pre-existing, but it contradicts 1144's acceptance criterion.
### Minor
- First full `pnpm test` hit `SQLITE_BUSY` in 4 files; the rerun was clean. Likely contention on the shared sqlite file when other jobs run concurrently; not reproduced.
- Untracked stray file `<path>` in the worktree, not part of this plan.
- tests/db-boot.test.ts: the old-code round-trip baseline is not recorded in the repo.
- Combined diff reviewed for secrets, path traversal and SQL interpolation. The new SQL is parameterized; the table names in `PRAGMA table_info(${table})` and `ALTER TABLE` come from the static schema list, not input. No security findings.
