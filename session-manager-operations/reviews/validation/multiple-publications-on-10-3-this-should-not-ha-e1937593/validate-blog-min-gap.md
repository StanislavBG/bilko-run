# Validation: multiple-publications-on-10-3-this-should-not-ha-e1937593

Base: `3e91c9427ff01f167d5142f04844b5f58012fa69`
HEAD at validation time: `73989f973e38a4a244b83972ceef3f61d1370128` (local `main` in the
main tree, 7 commits ahead of `origin/main` — see Finding 1).

The PRD files for these five slugs no longer exist on disk (not in the epic's `prds/`, not in
any `prds-archived/`, and `git log --all --diff-filter=A` finds no path ever named after any of
the five slugs). Evidence below is reconstructed from `session-manager-operations/scheduler/state/history.jsonl`
(truncated `bodyPreview` per slug — Goal only, no AC/Gate text survives) plus the actual commits
and current tree. Commit-to-slug mapping, by file ownership and commit-message cross-reference:

| Slug | Commit(s) |
|---|---|
| blog-api-scheduled-publishing (1040) | `252e45e` |
| blog-cadence-gate-primitive (1039) | `8a8a385` (merged via `8b2f8a8`) |
| blog-cadence-remediate-10-03 (1041) | `faec409` |
| blog-watchdog-wire-cadence-gate (1042) | `a82dc59` |
| blog-skill-docs-min-gap (1043) | `73989f9` |

## blog-cadence-gate-primitive — VERIFIED (with Critical finding, see Findings)

- Evidence: `scripts/blog-cadence-gate.ts:25-64` implements `findSpacingViolations` and
  `nextAllowedSlot` as pure functions exactly as described; `main()` (`:152-162`) wires a
  `check`/`next-slot` CLI. `.claude/skills/blog-from-git/blog.config.yaml` diff (`8a8a385`) adds
  `cadence.min_gap_days: 3` and `cadence.min_gap_enforced_since: '2026-10-01T00:00:00.000Z'`.
- Ran `pnpm tsx scripts/blog-cadence-gate.ts next-slot` → `2026-10-10T16:00:00.000Z`.
- Ran `pnpm tsx scripts/blog-cadence-gate.ts check` → exits 1, lists 13 false-positive
  violations among legacy posts (see Finding 1 — Critical).
- Ran `pnpm vitest run tests/blog-cadence-gate.test.ts` → 12 passed, 1 failed
  (`has no spacing violations among seeded posts`, line 76) — same root cause as Finding 1.
- The primitive's own logic (sort, gap math, `sinceIso` cutoff) is correct; the failure is a
  data problem in `server/db.ts`'s legacy seed rows, not a bug in the gate's math.

## blog-api-scheduled-publishing — VERIFIED

- Evidence: `server/routes/blog.ts:9` (list) and `:17` (single) now filter
  `AND datetime(published_at) <= datetime('now')`; `server/routes/admin-observability.ts:344`
  carries the same filter for the "last published" observability query.
- Ran `pnpm vitest run tests/blog-scheduled-publish.test.ts` → 12/12 passed.
- Ran `pnpm run typecheck` → clean (`tsc --noEmit` exits 0).
- No SQL injection: both filters are static strings; the only parameter (`slug`) is still
  bound, unchanged from before this PRD.

## blog-cadence-remediate-10-03 — REFUTED (live-check criterion not met; code criteria VERIFIED)

- Evidence (code): `server/db.ts:3052` seeds `twelve-places-one-weather-rule-you-set-yourself`
  at `2026-10-07T16:00:00.000Z` (was `2026-10-03T17:26:18.000Z`). `server/db.ts:3058-3068` adds
  a one-shot `applyDataMigrationOnce('2026-10-03-reschedule-outdoor-hours-post', …)` that
  `UPDATE`s any already-seeded prod row, scoped by both `slug` AND the old `published_at`
  (`WHERE slug = ? AND published_at = ?`), so a later owner edit to a different date is never
  clobbered — correct, idempotent, and narrowly scoped.
- Evidence (test): `tests/blog-cadence-gate.test.ts` gained the "repo-wide cadence" assertion
  this PRD's Goal promised, but it is permanently red — see Finding 1. The AC's "lock the rule
  in with a repo-wide test" is not actually met: the test cannot distinguish a real future
  regression from this pre-existing collision, because it already fails today for an unrelated
  reason.
- Evidence (live, required by the validate PRD's AC): fetched `https://bilko.run/api/blog` live
  — it lists **both** `twelve-places-one-weather-rule-you-set-yourself` (`2026-10-03T17:26:18.000Z`)
  **and** `turn-your-github-year-into-a-heatmap-and-badge-wall` (`2026-10-03T16:08:44.000Z`), i.e.
  the exact double-publication this plan exists to fix is still live in production.
- Root cause, confirmed by `git`: the main tree's local `main` branch (`/home/bilko/Projects/Bilko`)
  is `73989f9`, **7 commits ahead of `origin/main`** (`git log --oneline origin/main..main`
  lists all 5 commits implementing this plan, plus the prior validation commit `3e91c94`).
  Render deploys from `origin/main`; none of this plan's commits have been pushed, so Render has
  deployed none of it. The AC's "after Render deploys origin/main" precondition has not occurred
  — polling further would not change the result, since the fix is not in the branch Render
  watches. No poll loop was run past the first check for this reason (see Finding 1 note below
  on scope: this is a push gap, not a code defect in this PRD).

## blog-watchdog-wire-cadence-gate — VERIFIED

- Evidence: `scripts/blog-cadence-watchdog.sh:497-505` computes `NEXT_SLOT` via
  `blog-cadence-gate.ts next-slot` right after the live-gap read, fails closed
  (`write_heartbeat "error: cadence gate unavailable"; exit 1`) on a non-ISO or non-zero-exit
  result (`:500-504`). `:564-567` re-checks `NEXT_SLOT_EPOCH` against `NOW_EPOCH` even when the
  live-gap decision already said "due," and falls back to scan-only. `:920-925` re-verifies
  `cadence-gate.ts check` after a publish rather than trusting the subprocess, and fails the run
  (`exit 1`) on a post-seed violation. The publishing prompt text (`:678`) requires
  `published_at >= ${NEXT_SLOT}` and a passing `check` before every commit.
- `blog.config.yaml`'s `cadence.target_gap_days` is `[3, 4]` (`a82dc59` diff), matching the AC.
- Ran `pnpm tsx scripts/blog-cadence-gate.ts next-slot` → `2026-10-10T16:00:00.000Z`, which is
  `>= 2026-10-10T16:00:00.000Z` (exactly equal — 3 days after the rescheduled
  `2026-10-07T16:00:00.000Z` OutdoorHours post). The watchdog therefore cannot publish on
  `2026-10-07`, satisfying the AC as stated.
- Ran `pnpm vitest run tests/blog-cadence-watchdog.test.ts` as part of the full suite → passed
  (part of the 620 passing tests; see Finding 1 for the one unrelated failure).

## blog-skill-docs-min-gap — VERIFIED

- Evidence: `.claude/skills/blog-from-git/rotation.md:9-11` states `cadence.min_gap_days` is
  "enforced by `scripts/blog-cadence-gate.ts`, code, not prose, and nothing in this skill can
  waive it," and that `rotation.override: user-explicit-only` covers rotation rules only.
  `rotation.md:15-16` documents that an owner request inside the gap is honored by seeding at
  `next-slot`, never same-day. `.claude/skills/blog-from-git/seed.md:20-39` ties `published_at`
  to `max(now, next-slot)` and requires `cadence-gate.ts check` to exit 0 before commit.
  `docs/blog-watchdog.md:81-106` documents the `NEXT_SLOT` fail-closed gate, the `[3, 4]`
  target, and narrates the exact 2026-10-03 incident this doc update closes.
- These are prose/doc files; `# Gate: none` applies — checked by reading, as instructed.

## Combined diff review

`git diff 3e91c9427ff01f167d5142f04844b5f58012fa69..HEAD --stat`: 13 files changed, 559
insertions, 27 deletions — `scripts/blog-cadence-gate.ts` (new), `scripts/blog-cadence-watchdog.sh`,
`server/db.ts`, `server/routes/blog.ts`, `server/routes/admin-observability.ts`, 4 skill/doc
files, 3 test files.

- `/code-review` (medium, scoped to this diff): one finding, matching Finding 1 below
  independently (confirmed by reproducing `check` against both a fresh DB and a copy of the
  real local SQLite file).
- Self-ran security review (no injection sinks changed): all SQL in the diff is either a static
  string or already-parameterized (`dbRun`/`dbGet` with `args`); `blog-cadence-watchdog.sh`'s
  new `date -d "$NEXT_SLOT"` call consumes output from the repo's own trusted CLI, pre-validated
  against `^[0-9]{4}-[0-9]{2}-[0-9]{2}T` before use, not user input. No secrets, no new
  endpoints, no auth changes. No findings.
- `pnpm run typecheck` → clean.
- `pnpm test` (full suite) → 1 failed, 620 passed, 43/44 files green. The one failure is
  Finding 1.

## Findings

**Critical — `scripts/blog-cadence-gate.ts` check always fails against real seed data, so the
"lock the rule in" test (1041) and the gate's own `check` command (1039) are permanently red.**
`tests/blog-cadence-gate.test.ts:76`, `scripts/blog-cadence-gate.ts:133`. Thirteen pre-existing
legacy posts in `server/db.ts` (e.g. lines 908, 991, 1079 … 2066, 2804, 3003) seed `published_at`
as `new Date().toISOString()` — the wall-clock time `initDb()` runs — rather than a fixed
historical date. Since `min_gap_enforced_since` is `2026-10-01T00:00:00.000Z` and every one of
these rows gets re-stamped to "now" on every fresh DB init, they always land within
microseconds of each other and always trip `findSpacingViolations`, regardless of how well any
*new* post is spaced. Concretely: `pnpm tsx scripts/blog-cadence-gate.ts check` exits 1 today,
on this unmodified tree, listing 13 violations among posts that have nothing to do with the
2026-10-03 incident — e.g. `how-pageroast-went-from-frustration-to-product ->
we-built-stackaudit-because-reddit-told-us-to: 0.0h apart`. Per `seed.md:39` and
`blog-cadence-watchdog.sh:678,920-924`, a non-zero exit from `check` means **every future manual
seed aborts as `SEED_RESULT: noop`** and **every future watchdog publish run exits 1 with
`error: cadence gate violation after seed`** — the exact mechanism this plan built to stop
silent double-publishing instead silently blocks (or falsely red-flags) all future publishing,
whether or not a real violation occurred. Both `faec409`'s and `a82dc59`'s commit messages
flag this as a "known pre-existing, out-of-scope issue" to be fixed in a follow-up PRD — but no
such follow-up has landed, so the gate those two PRDs' AC depend on is not actually usable yet.
This should be queued as a follow-up PRD to assign fixed historical `published_at` values to the
13 legacy posts (or otherwise exclude them from the gate's accounting) before relying on `check`
exiting 0 as a real signal.

**Critical — the fix for the 2026-10-03 double-publish has not been pushed to `origin/main`, so
production still shows both posts live right now.** None of this plan's 5 commits (`252e45e`,
`8a8a385`, `8b2f8a8`, `faec409`, `a82dc59`, `73989f9`) exist on `origin/main`
(`git log --oneline origin/main..main` lists all of them plus the baseline validation commit).
Render deploys from `origin/main`, so none of this plan's code has reached production. Live
`https://bilko.run/api/blog` still lists `twelve-places-one-weather-rule-you-set-yourself` dated
`2026-10-03T17:26:18.000Z` alongside `turn-your-github-year-into-a-heatmap-and-badge-wall` dated
`2026-10-03T16:08:44.000Z` — the precise bug this plan exists to close. This is an ops/push gap,
not a defect in any PRD's code, but it means the plan's stated outcome ("double publication is
fixed") is not yet true in the world the owner actually looks at. The architect should push
`main` to `origin/main` (or have the next PRD do so) before considering this plan complete.

No other findings. All SQL in the diff is parameterized or static; no auth/secrets/injection
surface was touched.

---

VALIDATION: blog-cadence-gate-primitive VERIFIED
VALIDATION: blog-api-scheduled-publishing VERIFIED
VALIDATION: blog-cadence-remediate-10-03 REFUTED — live /api/blog still shows both 2026-10-03 posts because the fix commits were never pushed to origin/main, so Render has not deployed them
VALIDATION: blog-watchdog-wire-cadence-gate VERIFIED
VALIDATION: blog-skill-docs-min-gap VERIFIED
SCHEDULER_VERDICT: PASS
