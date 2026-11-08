# Ship: sync-guard-consumed-files

Run: 1:41 AM PST, 2026-11-08 (America/Los_Angeles).

Pushed SHA: none from this run. Origin already held the equivalent of both commits before this run started.

Commits considered:
- 2607200c fix(sync): LOST guard counts every file origin touched since the merge base. Already on origin/main as 6827c539 (git cherry shows "-").
- a9a2d4bd test(sync): LOST guard exits 1 and leaves local main untouched when a replay drops local work. Written here; origin/main already has 620a8e00 "test(sync): LOST guard exits 1 when a replay would drop a file origin never touched", which covers default and --no-push modes. Pushing a9a2d4bd would duplicate it, so it was not pushed.
- cc00f0ce docs(validation): finding resolution record, on the job branch.

| Criterion | Result |
| --- | --- |
| LOST exit-1 tests, default and --no-push | PASS (a9a2d4bd, 19 tests pass; origin has an equivalent in 620a8e00) |
| Mutation check; scripts/sync-local-main.sh unchanged | PASS (2 new tests failed with the guard disabled, passed restored, diff empty) |
| Validation record has Finding resolution section | PASS (cc00f0ce) |
| origin/main has both commits by exact subject, nothing else pushed | FAIL (superseded: origin has different subjects for the same fix and test; this run pushed no product commits) |
| pnpm test, typecheck, build on the pushed tree | FAIL (not run; nothing pushed) |
| sync-local-main.sh exit 0, main 0 behind origin | PASS (exit 0; `main...origin/main [ahead 2]`; it pushed 4 record commits) |
| Ship record committed | PASS |

SHIP: FAIL (superseded, not a defect: the work was already on origin; a9a2d4bd is redundant and stays unpushed)
