# Ship: sync-guard-consumed-files

Run 1 (PRD 1694 first attempt): 1:41 AM PST, 2026-11-08 (America/Los_Angeles). Recorded SHIP: FAIL (superseded): origin already had the fix, so nothing was pushed and the pushed-tree checks were not run.

Run 2 (this record): 2:05 AM PST to 2:08 AM PST, 2026-11-08 (America/Los_Angeles).

## Commit

- Fix: `fix(sync): LOST guard counts every file origin touched since the merge base`. Written as 2607200c; on origin/main as 6827c539 (committed 1:33 AM PST, 2026-11-08). Matched by exact subject in `git log origin/main`. `git cherry -v origin/main main` lists no `+` line for it: local main already holds the origin copy.
- Pushed SHA: none from this run. The fix reached origin before this run started; pushing again would have added a duplicate. origin/main tip at verification: 516c30b6e54f12c137a1fbc4de5eb87a0fd2cd6b.
- Nothing from this run went to any remote. The sync pushed nothing either (0 record commits to publish).

## Checks

| Check | Result |
| --- | --- |
| Validation record shows VERIFIED for sync-guard-counts-every-origin-commit, no open Critical or Important finding | PASS (the one Important finding, no LOST exit-1 test, is RESOLVED; origin has 620a8e00 for it) |
| origin/main has the fix by exact subject; no other local-main commit pushed; only origin targeted | PASS (6827c539; this run ran no `git push`) |
| `pnpm test` on the origin/main tree 516c30b6, which contains the fix | PASS (exit 0; 180 files passed, 2 skipped; 2087 tests passed, 15 skipped) |
| `pnpm typecheck` on 516c30b6 | PASS (exit 0) |
| `pnpm build` on 516c30b6 | PASS (exit 0) |
| Throwaway tree /tmp/ship-sync-guard-consumed-files: symlinks removed, `git worktree remove` done | PASS |
| `bash scripts/sync-local-main.sh` in /home/bilko/Projects/Bilko exits 0; main 0 behind origin/main | PASS (exit 0; `## main...origin/main [ahead 4]`; "already 4 unshipped commit(s) strictly ahead of origin/main; nothing to do") |
| Ship record committed | PASS |

Local main still holds four commits that are not on origin, and this PRD leaves them there: f049b6b9 and 3e10eafb (flows env filter, another plan's feature), eb0a657d (the LOST test, a duplicate of origin's 620a8e00, which run 1 said not to push), and e2536779 (a docs(validation) commit that the sync does not treat as record-only).

No live bilko.run check: nothing Render serves changed.

SHIP: PASS
