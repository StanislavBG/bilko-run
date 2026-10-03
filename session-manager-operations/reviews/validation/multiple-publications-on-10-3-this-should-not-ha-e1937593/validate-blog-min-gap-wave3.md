# Validation: blog-cadence-gate-test-harden

Base: `f08fdee`. HEAD: `93dbb33`.

No PRD markdown file exists on disk for this slug — the scheduler's per-PRD
`.md` file is ephemeral and was not committed before archiving (confirmed via
`find session-manager-operations -iname "*blog-cadence-gate-test-harden*"` →
only hits in `queue.json`/`active-index.json`/`history.jsonl`, none a PRD
file). `session-manager-operations/scheduler/state/history.jsonl` carries the
completed record for job slug `1047-blog-cadence-gate-test-harden`
(`sourcePromptId`/`epicId`: `multiple-publications-on-10-3-this-should-not-ha-e1937593`,
`landedCommit: 93dbb3372e2fd6125654fe01d4f16ced8171f811`, `exitCode: 0`), which
matches this worktree's HEAD. Evidence below is built from that commit, its
message (which states the PRD's own verification steps), and direct
re-execution — not from a PRD prose file.

```
git log --oneline f08fdee..HEAD -- tests/blog-cadence-gate.test.ts scripts/blog-cadence-gate.ts
93dbb33 test(blog): replace cadence-gate regex scan with a behavioral faked-clock test
```

Single commit, touches only `tests/blog-cadence-gate.test.ts` (17
insertions / 26 deletions). `scripts/blog-cadence-gate.ts` has zero diff —
the commit message's claim that no script change was needed holds.

## blog-cadence-gate-test-harden — VERIFIED

**AC1 — replace the fragile regex scan with a behavioral faked-clock test.**
`tests/blog-cadence-gate.test.ts:74-90` (post-commit): the old test (deleted)
scanned `server/db.ts` source text with
`/\n\s*\);/ ` to find each `INSERT ... blog_posts` block's end, which a post
body containing a code sample ending in `);` could terminate early and mask a
real `new Date()` stamp. The new test instead:
- `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime('2099-01-01T00:00:00.000Z')`
- `vi.resetModules()` then a fresh dynamic `import('../scripts/blog-cadence-gate.js')`
  — necessary because `server/db.ts`'s `getClient()` caches its client at
  module scope; without the reset, the earlier tests in the same file would
  reuse the already-initialized real client instead of seeding a genuinely
  new temp DB under the faked clock.
- Asserts `posts.length > 0` and that no seeded post's `publishedAt` starts
  with `'2099-'`.

Ran the full file standalone:
```
npx vitest run tests/blog-cadence-gate.test.ts
✓ tests/blog-cadence-gate.test.ts (11 tests) 1791ms
  ✓ blog seed published_at values are frozen literals > never seeds a
    published post whose published_at carries the current clock  1412ms
Test Files  1 passed (1)
     Tests  11 passed (11)
```

**AC2 — independently re-prove the test goes red on a temporary
`new Date().toISOString()` seed edit, then revert (not committed).**
Edited `server/db.ts:837` (the first-post seed guarded by
`if (!blogCount || blogCount.n === 0)`) from the frozen literal
`'2026-04-04T03:04:43.816Z'` to `new Date().toISOString()`, independently
of and after reading the commit message's own description of this same
check. Reran the test file:
```
npx vitest run tests/blog-cadence-gate.test.ts
× blog seed published_at values are frozen literals > never seeds a
  published post whose published_at carries the current clock  1111ms
  → expected true to be false // Object.is equality
  AssertionError: expected true to be false
  - false
  + true
   ❯ tests/blog-cadence-gate.test.ts:88:54
Tests  1 failed | 10 passed (11)
```
Confirms the faked-clock assertion catches a live `new Date()` seed stamp
(under the faked 2099 clock, `new Date()` evaluates to 2099-01-01, so the
freshly-seeded first post's `publishedAt` starts with `'2099-'` and the
`.toBe(false)` assertion fails) — reproducing the exact failure class the
regex scan was built to catch, through the new mechanism. Reverted the edit
immediately after:
```
git diff --stat server/db.ts   → (empty)
npx vitest run tests/blog-cadence-gate.test.ts
✓ tests/blog-cadence-gate.test.ts (11 tests) 1791ms
```
`server/db.ts` carries no diff in the working tree or in the commit, matching
the commit message's own claim.

**AC3 — full project test suite is green.**
```
pnpm test  (= vitest run, full suite)
Test Files  44 passed (44)
     Tests  622 passed (622)
```

## Live site + next-slot check — VERIFIED

```
curl -s https://bilko.run/api/blog
→ total posts: 45
→ 2026-10-03 posts: 1 (turn-your-github-year-into-a-heatmap-and-badge-wall,
  publishedAt 2026-10-03T16:08:44.000Z)
```
Exactly one 2026-10-03 post, matching the acceptance criterion.

```
pnpm tsx scripts/blog-cadence-gate.ts next-slot
→ 2026-10-10T16:00:00.000Z
```
Prints exactly `2026-10-10T16:00:00.000Z`, satisfying "2026-10-10T16:00:00.000Z
or later." (Ran against the local seeded SQLite fallback, since no
`TURSO_DATABASE_URL` is configured in this worktree's shell — the seed data
mirrors the production seed set, and this is the same code path the live
watchdog/publisher invokes.)

## Combined diff review

`git diff f08fdee..HEAD --stat` → one file, `tests/blog-cadence-gate.test.ts`
(test-only). `/code-review` (medium) and `/security-review` were run against
this diff.

`/security-review`: no findings — the entire diff is confined to a test file,
which is an explicit exclusion category (test-only files are not security
surface).

`/code-review` (medium): one finding, detailed below under Findings. It
concerns a pre-existing pattern (`loadSeededPosts()` in
`scripts/blog-cadence-gate.ts`, untouched by this commit) rather than
anything newly introduced by this PRD's diff.

## Findings

**Important — `scripts/blog-cadence-gate.ts:66-71` — unrestored global
`process.env` mutation, now exercised from a second call site.**
`loadSeededPosts()` deletes `process.env.TURSO_DATABASE_URL` /
`TURSO_AUTH_TOKEN` and overwrites `process.env.BILKO_SQLITE_PATH` to a fresh
scratch tmp path, with no `finally`/restore. `vitest.config.ts:16-17` runs the
whole suite with `pool: 'forks', poolOptions: { forks: { singleFork: true } }`
— a single process for every test file — so this mutation is process-global
and outlives the test that triggered it. This function and this leak
pre-date this PRD (file has zero diff in `93dbb33`); the "seeded posts obey
the cadence gate" block already called it before this change. This PRD's
diff adds a second call site inside the same test file (now also wrapped in
`vi.useFakeTimers`), extending reliance on the same unguarded pattern rather
than introducing it. The full suite passes today (`622/622`) because no
later-running test in the current file order depends on `BILKO_SQLITE_PATH`
or Turso env vars being in their original state, but that is an ordering
accident, not a guarantee — out of scope for this PRD (it touched only the
test file, not `scripts/blog-cadence-gate.ts`), flagged here for a future
hardening PRD.

## Sentinel

VALIDATION: blog-cadence-gate-test-harden VERIFIED
SCHEDULER_VERDICT: PASS
