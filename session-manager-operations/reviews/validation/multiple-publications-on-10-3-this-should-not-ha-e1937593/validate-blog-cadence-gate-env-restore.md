# Validation: blog-cadence-gate-env-restore

Base (from the PRD's implementation notes): `bc88c34`. HEAD: `40818e4`.

No PRD markdown file exists on disk for this slug — same ephemeral-PRD situation
documented in `validate-blog-min-gap-wave3.md`: the scheduler's per-PRD `.md` is
not committed before archiving. Confirmed via
`find session-manager-operations -iname "*blog-cadence-gate-env-restore*"` →
no hits anywhere in `scheduler/prds/`, `scheduler/prds-archived/`, or any
`scheduler/epics/*/prds*/` directory. `session-manager-operations/scheduler/state/history.jsonl`
carries the completed record for job slug `1053-blog-cadence-gate-env-restore`
(title "Cadence gate: restore process.env after loadSeededPosts (no leaked DB
env in test process)", `sourcePromptId`/`epicId`:
`multiple-publications-on-10-3-this-should-not-ha-e1937593`,
`landedCommit: 40818e45e456520a49f7ef3238c780c50e7fefbc`, `exitCode: 0`,
`status: completed`), which matches this worktree's HEAD. Evidence below is
built from that commit, re-execution of the tests it added, and a full
`pnpm test` run — not from a PRD prose file.

Note on `Base: bc88c34`: three other commits (`7e31838`, `e9073aa`, `9897aa1`)
land between `bc88c34` and `40818e4`. Those belong to a different, separately
queued and already-validated plan (`blog-distribution-objective-policy`,
closed out in `validate-blog-distribution-objective.md`, 3 VERIFIED) touching
only `scripts/blog-readability.ts` / `tests/blog-readability.test.ts` / docs —
disjoint files from this PRD. The combined-diff review below is scoped to this
PRD's own files (`scripts/blog-cadence-gate.ts`, `tests/blog-cadence-gate.test.ts`),
which resolve to the single commit `40818e4`:

```
git log --oneline bc88c34..HEAD -- scripts/blog-cadence-gate.ts tests/blog-cadence-gate.test.ts
40818e4 fix(blog): restore TURSO/sqlite env vars after loadSeededPosts
```

## blog-cadence-gate-env-restore — VERIFIED

**AC — `loadSeededPosts` restores `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and
`BILKO_SQLITE_PATH` to their pre-call values in a `finally`, instead of
deleting/overwriting them with no restore.**

`scripts/blog-cadence-gate.ts:66-104` (post-commit): the function now snapshots
all three vars into `savedEnv` before mutating them, wraps the entire body
(delete Turso vars, set a fresh `BILKO_SQLITE_PATH`, `initDb`, query, build the
`posts` array, `return`) in a `try`, and in the `finally` loops over
`savedEnv`'s entries — `delete process.env[key]` for a key that was originally
`undefined`, else `process.env[key] = value` — so a var that didn't exist
before the call doesn't exist after it, and one that did is put back exactly.

Test added at `tests/blog-cadence-gate.test.ts:96-125`
("restores TURSO_DATABASE_URL, TURSO_AUTH_TOKEN and BILKO_SQLITE_PATH to their
sentinel values"): sets all three vars to sentinel strings, calls
`loadSeededPosts()`, asserts `posts.length > 0` (the function still does real
work) and that all three env vars are back to their sentinel values
afterward. This directly exercises the finding from
`validate-blog-min-gap-wave3.md` ("Important — unrestored global `process.env`
mutation"), which is the regression this PRD fixes.

Re-ran the file standalone:
```
npx vitest run tests/blog-cadence-gate.test.ts
✓ tests/blog-cadence-gate.test.ts (13 tests) 1823ms
Test Files  1 passed (1)
     Tests  13 passed (13)
```

**Conditional clause — "also stop caching/reset the `server/db.ts` client if a
reset hook exists."** `server/db.ts` exposes no close/reset function:
```
grep -n 'export function\|export async function' server/db.ts | grep -i 'close\|reset\|client'
server/db.ts:11:export function getClient(): Client {
```
Only `getClient()` exists — no close/reset export. Per the PRD's own
conditional wording, this part of the PRD was correctly skipped; the
landed diff touches only the env-var restore.

**AC — the full `pnpm test` suite is green.**
```
pnpm install --frozen-lockfile   # this worktree had no node_modules
pnpm test
 Test Files  44 passed (44)
      Tests  636 passed (636)
```
(Resolved `scripts/blog-readability.ts`/`tests/blog-readability.test.ts` into
the current HEAD state first, since they're the other plan's already-landed
work in this same tree — the full suite result reflects HEAD as checked out,
not a filtered subset.)

## Combined diff review

`git diff 40818e4^..40818e4 --stat` → 2 files, 63 insertions / 17 deletions,
confined to `scripts/blog-cadence-gate.ts` and `tests/blog-cadence-gate.test.ts`.

`/code-review` (medium, scoped to `40818e4^..40818e4`): no findings. The
reviewer additionally checked the deeper concern of whether `server/db.ts`'s
module-level `_client` singleton could still leak state across test files even
with env vars restored — confirmed it does not, because vitest's forked-pool
module isolation resets `db.js`'s module state between test files, and the
two production call sites (`runCheck`/`runNextSlot`) are mutually exclusive
per process.

Security review: the diff is a pure save/restore of `process.env` values
(no new input-validation, auth, injection, or secrets-handling surface —
environment variables are a trusted input, not attacker-controlled, in this
execution context) inside a dev/test script plus a test-only addition. No
findings.

## Findings

None.

## Sentinel

VALIDATION: blog-cadence-gate-env-restore VERIFIED
SCHEDULER_VERDICT: PASS
