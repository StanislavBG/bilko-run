# Ship: sync-guard-counts-every-origin-commit (PRD 1694)

Run: 2026-11-08 1:29 AM PST. Base: 6e6666d63dc133877ef80a6975b2697111010ffe.

| Commit | Subject |
| --- | --- |
| 2607200c | fix(sync): LOST guard counts every file origin touched since the merge base |

Pushed SHA: none. Nothing was pushed.

## Checks

| # | Check | Result |
| --- | --- | --- |
| 1 | Validation record VERIFIED with no open Critical or Important finding | FAIL |
| 2 | origin/main contains the fix commit; push carried only it, to origin | FAIL (not attempted) |
| 3 | pnpm test, typecheck, build exit 0 on the pushed tree | FAIL (not attempted) |
| 4 | `bash scripts/sync-local-main.sh` exits 0; main 0 behind origin/main | FAIL (not attempted) |
| 5 | Ship record committed | PASS |

## Why check 1 failed

`reviews/validation/local-main-checkout-has-diverged-from-origin-ahe-374ea667/validate-sync-guard-consumed-files.md`
marks the PRD VERIFIED, but it lists one open **Important** finding:

> tests/sync-local-main.test.ts has no test that the LOST guard still exits 1 with local main
> untouched. Nothing would fail if the guard were disabled.

No later commit closes it. At 1:29 AM PST, `tests/sync-local-main.test.ts` on local main has
no LOST exit-1 case, and no other branch has touched the file since 2607200c. The PRD says that
in this case nothing is pushed, so the throwaway tree was never made and the sync was not run.

## State at the end of the run

- `git -C /home/bilko/Projects/Bilko status -sb`: `## main...origin/main [ahead 7, behind 2]`.
- origin/main: 2d80cbad5c8510f7716f17b0bd5188ccc8477b8d.
- `git cherry -v origin/main main` still lists 2607200c as `+`, so it is not on origin.

## To unblock

Add a test to `tests/sync-local-main.test.ts` that builds a local-only change the LOST guard
must catch, and asserts exit 1 with local main and origin unchanged. Re-validate, then re-queue
this ship.

SHIP: FAIL
