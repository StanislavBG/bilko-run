# Validation: sync-guard-counts-every-origin-commit (PRD 1692)

Base: 6e6666d63dc133877ef80a6975b2697111010ffe. Commit: 2607200c (touches scripts/sync-local-main.sh, tests/sync-local-main.test.ts).

## sync-guard-counts-every-origin-commit — VERIFIED

- AC1: scripts/sync-local-main.sh:126-127 — LOST subtracts `git log --format= --name-only --no-renames "$MB..$BASE" | sort -u`; the old `git diff --name-only "$MB" "$BASE"` is gone. Comment at lines 122-125 names the changeset-deleted-by-release case.
- AC2: tests/sync-local-main.test.ts (+31 lines) adds the twin/delete test, run in default and `--no-push` modes. Passes in the gate run below.
- AC3: existing tests pass, including exit 3 conflict and merge-commit cases (17/17).
- AC4: the diff changes one line plus comment; BLOCKED check (line 129), exit codes, lock, flags and stderr logging are untouched.
- Gate: `timeout 300 pnpm vitest run tests/sync-local-main.test.ts` → 17 passed (17). `bash -n scripts/sync-local-main.sh` → exit 0.

## Guard-still-catches check

Reading: `comm -23` keeps any path in the rebuild diff that no origin commit touched. The new set is a superset of the net diff, but it holds only files some origin commit touched, so a local-only file still lands in LOST and `die` exits 1 before anything moves.
Run: in a scratch repo (add then delete `.changeset/x.md`, plus `b`, `.c`) the net diff listed `b .c`; the log set listed `b .c .changeset/x.md`. `comm -23` over {`.changeset/x.md`, `localonly.ts`} returned only `localonly.ts`.
Caveat: I did not run the whole script against a local-only change. The existing tests have no case for the LOST exit 1, and the new test covers only the pass case. A LOST case is hard to build, because replay normally keeps local-only changes.

## Findings

- Important: tests/sync-local-main.test.ts has no test that the LOST guard still exits 1 with local main untouched. Nothing would fail if the guard were disabled. Not caused by this PRD, but this PRD changed the guard.
- Minor: the commit's co-author trailer says Claude Opus 5.5. Cosmetic.
- No security issues. The change adds no new input handling; `$MB` and `$BASE` are SHAs from git.

## Finding resolution

Test commit a9a2d4bd ("test(sync): LOST guard exits 1 and leaves local main untouched when a replay drops local work") adds two tests to tests/sync-local-main.test.ts:

- `a replay that drops local work: exit 1, local main untouched, nothing pushed (default mode)`
- `a replay that drops local work: exit 1, local main untouched, nothing pushed (--no-push)`

Both inject the fault through the git shim (a `tmp/drop-pick` sha turns that commit's `cherry-pick --ff` into a no-op). Each asserts exit 1, empty stdout, `never touched` and `server/local-only.ts` in stderr, local main and the local-only file unchanged, no push, origin refs unchanged, no backup branch, one worktree.

Mutation check: with the `[[ -z "$LOST" ]] || die ...` line replaced by `true`, both new tests FAIL (2 failed, 17 passed). With the line restored, `git diff scripts/sync-local-main.sh` is empty and the gate passes: `timeout 300 pnpm vitest run tests/sync-local-main.test.ts` gives 19 passed.

Important finding (no LOST exit-1 test): RESOLVED
