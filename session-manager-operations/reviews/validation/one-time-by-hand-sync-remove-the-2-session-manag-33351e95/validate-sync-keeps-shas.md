# Validation: sync-replay-keeps-shas

Base: 69d740be (given). Landed commit: 85967893 (touches scripts/sync-local-main.sh, tests/sync-local-main.test.ts only). PRD file: prds-archived/1648-sync-replay-keeps-shas.md.

## sync-replay-keeps-shas — VERIFIED

- AC1 replay uses `cherry-pick --ff`: scripts/sync-local-main.sh:77; `--skip`/conflict path unchanged in diff.
- AC2 `nothing to do` exit 0: scripts/sync-local-main.sh:89-92, placed before the LOST/BLOCKED checks, the dry-run exit (~:105), the push, the backup and the reset. Covered by the test in both modes.
- AC3 NEW==OLD with records: records push block runs first (:107-111), then the `NEW == OLD` exit at :115-118, before `git branch -f backup/...` and `git reset --keep`.
- AC4 header comment: lines 16-17 state shas are kept and a strictly-ahead main with nothing to publish is left untouched.
- AC5 test `strictly ahead with only unshipped commits: exit 0, nothing moves`: tests/sync-local-main.test.ts:134-148; asserts status 0, local/origin shas unchanged, backup absent, `nothing to do`, for `--dry-run` and normal.
- AC6 test `records directly on origin/main keep their shas`: tests/sync-local-main.test.ts:150-159; asserts origin/main == R, main == O, backup absent. The 4 existing tests still pass.
- Gate `timeout 120 pnpm vitest run tests/sync-local-main.test.ts`: re-run, 1 file passed, 6 tests passed.

## Combined diff review

2 files, +41/-1. Self-review (no new input handling, no secrets, no path handling beyond existing code, no duplicated helper). The dry-run check in AC2 is exercised by the test; the NEW==OLD+records branch is only exercised by the second test (normal run).

## Findings

- Critical: none.
- Important: none.
- Minor: scripts/sync-local-main.sh:115 — the `NEW == OLD` exit with records is reached only after the LOST/BLOCKED checks; harmless, as those compare equal trees.
