# Validate 1695: sync-lost-check-net-zero

Checked on 2026-11-08 against the shared checkout. Verdict: the work is done and on origin. Nothing in the code is missing.

- The fix `fix(sync): LOST guard counts every file origin touched since the merge base` is on origin as 6827c539.
- The test `test(sync): LOST guard exits 1 when a replay would drop a file origin never touched` is on origin as 620a8e00.
- Check 1: both SHAs are ancestors of origin/main (`git merge-base --is-ancestor`): passed.
- Check 2: origin/main is an ancestor of local main: passed.
- Check 3: `git cherry -v main refs/sm-stranded/1695-sync-lost-check-net-zero/f0acc5689e9f39a716a8d6013a9ddea816f2f158 | grep '^+'` printed nothing, so all four stranded commits are already on main.
- Check 4: `scripts/sync-local-main.sh` contains `git log --format= --name-only --no-renames "$MB..$BASE"`: passed.
- Gate: `npx vitest run tests/sync-local-main.test.ts` exited 0 with 21 of 21 tests passing.
- Dry run: `bash scripts/sync-local-main.sh --dry-run` exited 0. Last line: `[sync-local-main] would push 2 record commit(s) and move local main to 5 commit(s) on origin/main`.
- Why it was parked: the reaper checks branch ancestry, not patch equivalence. The run cherry-picked onto a throwaway origin/main tree, so origin got new SHAs and the job branch looked unmerged. That was a gap in the scheduler's record, not a failure in the work.
- Fact: local main also holds 0fac797d, a second LOST exit-1 test from the sync-guard-consumed-files plan. It is not on origin yet. Shipping it is PRD 1691's job.
