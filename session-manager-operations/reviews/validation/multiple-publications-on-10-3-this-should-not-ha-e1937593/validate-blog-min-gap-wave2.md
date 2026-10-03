# Validation: multiple-publications-on-10-3-this-should-not-ha-e1937593 (wave 2)

Base: `a1d9d48a0936658dc7dc8cf29b5a1f449b73dbda` (origin/main at the time this job started).
HEAD at validation time: `9a40601052ca1ff0b32fa4433375e219c056efc2` (local `main` in the main
tree, 1 commit ahead of `origin/main`; that commit is `blog-cadence-gate-legacy-dates`'s own fix
and has not been pushed yet).

Both PRD files for this wave were not present in this job's isolated worktree (the scheduler's
`scheduler/epics/*/prds*` trees are untracked, so only files explicitly carried into the worktree
exist there — neither PRD was on that carry list). Located and read from the main checkout
instead, at their real path: `/home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/multiple-publications-on-10-3-this-should-not-ha-e1937593/prds-archived/1045-blog-cadence-gate-legacy-dates.md`
and `.../prds-archived/1041-blog-cadence-remediate-10-03.md`. Same git history in both trees
(same repo, same commits), so this does not affect the evidence below — only the file-lookup
mechanics.

Commits for this wave, found via `git log --oneline a1d9d48..HEAD -- server/db.ts
tests/blog-cadence-gate.test.ts`:

| Slug | Commit |
|---|---|
| blog-cadence-gate-legacy-dates (1045) | `9a40601` |
| blog-cadence-remediate-10-03 (1041) | re-checked live only; its own commits (`faec409`, part of the `8b2f8a8`/`8a8a385` primitive, `a82dc59`, `73989f9`) are unchanged from wave 1 — see `validate-blog-min-gap.md` |

## blog-cadence-gate-legacy-dates — VERIFIED

- Evidence (diff): `git diff a1d9d48..HEAD -- server/db.ts` shows exactly 13 `new
  Date().toISOString()` → fixed-ISO-literal replacements, one per slug named in the PRD's AC
  (`how-pageroast-went-from-frustration-to-product` at `server/db.ts:837`,
  `we-built-stackaudit-because-reddit-told-us-to` at `:908`,
  `localscore-browser-ai-that-never-sees-your-data` at `:991`,
  `10-tools-solo-what-i-learned-shipping-bilko-run` at `:1079`,
  `building-outdoorhours-121-months-of-weather` at `:1170`,
  `burrow-from-background-task-to-cron-orchestrated` at `:1287`,
  `npr-ad-skipper-gemini-only-and-97-percent-agreement` at `:1385`,
  `bilko-flow-v0-3-1-first-npm-release` at `:1489`,
  `outdoorhours-week-2-from-fixed-rules-to-rule-engine` at `:1584`,
  `from-saas-to-host-decomposing-bilko-in-one-week` at `:1708`,
  `week-of-six-games` at `:1834`, `all-green-three-bugs-the-regression-pass-caught` at `:1951`,
  `the-week-the-platform-got-dumber` at `:2066`). No other line in the diff changed.
- Evidence (values match live prod): fetched `https://bilko.run/api/blog` and cross-checked all
  13 slugs' `published_at` against the new literals — every one matches exactly, e.g.
  `how-pageroast-went-from-frustration-to-product` → `2026-04-04T03:04:43.816Z` live and in the
  diff, `the-week-the-platform-got-dumber` → `2026-05-23T04:04:09.966Z` live and in the diff (all
  13 matched; full pairs recorded in the tool transcript). No commit-date fallback was needed, as
  the PRD anticipated.
- Evidence (no other `published_at` touched, no prod migration added): `grep -n "new Date()"
  server/db.ts` after the change returns exactly 4 remaining hits — `server/db.ts:593`
  (`applyBlogRewrites`'s `updated_at`), `:2804` (`2026-09-25-blog-manual-now-free` migration's
  `updated_at`), `:3003` (`2026-10-03-blog-absolute-links` migration's `updated_at`), `:3063`
  (`2026-10-03-reschedule-outdoor-hours-post` migration's `updated_at`, pre-existing from PRD
  1041, untouched by this diff) — none of these is a `published_at` argument, and no new
  `applyDataMigrationOnce` call was added by this diff.
- Evidence (static regression test added): `tests/blog-cadence-gate.test.ts:76-103` adds `blog
  seed published_at values are frozen literals`, which regex-scans every `INSERT (OR IGNORE)
  INTO blog_posts ... published_at` block in `server/db.ts` and fails if any contains `new
  Date()`.
- Ran gate (both commands, foreground):
  - `timeout 300 pnpm vitest run tests/blog-cadence-gate.test.ts tests/db.test.ts
    tests/blog-rewrites.test.ts` → 3 files, 18 tests, all passed (up from 12 tests / 1 failure
    pre-fix in wave 1).
  - `timeout 120 pnpm tsx scripts/blog-cadence-gate.ts check` → prints `ok`, exit 0.
  - `timeout 120 pnpm tsx scripts/blog-cadence-gate.ts next-slot` → prints
    `2026-10-10T16:00:00.000Z`, matching the AC exactly.
- `pnpm run typecheck` → clean (`tsc --noEmit` exits 0).

All five acceptance criteria are met.

## blog-cadence-remediate-10-03 — now VERIFIED (live, re-checked; was REFUTED in wave 1 for a push gap)

- Live check (first poll, no further polling needed): fetched `https://bilko.run/api/blog` —
  posts with `published_at` starting `2026-10-03`: only
  `turn-your-github-year-into-a-heatmap-and-badge-wall` (`2026-10-03T16:08:44.000Z`).
  `twelve-places-one-weather-rule-you-set-yourself` is **absent** from the live list entirely
  (its `published_at` is now `2026-10-07T16:00:00.000Z`, in the future, so the scheduled-publish
  filter from `blog-api-scheduled-publishing` correctly hides it rather than listing it early).
  Both AC conditions ("lists only the heatmap post on 2026-10-03" and "does not list
  twelve-places...") are met.
- `origin/main contains all plan commits`: checked with `git merge-base --is-ancestor <c>
  origin/main` for each of the remediate plan's six commits (`252e45e`, `8a8a385`, `8b2f8a8`,
  `faec409`, `a82dc59`, `73989f9`) — all six report "ancestor of origin/main". `origin/main` is
  at `a1d9d48`, which is `73989f9`'s direct child plus the wave-1 validation commit, so Render
  has deployed this plan's code. (Separately, `9a40601` — this wave's unrelated
  `blog-cadence-gate-legacy-dates` fix — is one commit ahead of `origin/main` and not yet pushed;
  it is not one of the remediate-plan's commits and the AC does not require it to be pushed for
  this criterion.)

Wave 1's root cause (`main` not pushed to `origin/main`) has been resolved since that
validation; the live double-publication is confirmed gone.

## Combined diff review (this wave's commits only: `a1d9d48..HEAD`)

`git diff a1d9d48..HEAD --stat`: 2 files changed, 45 insertions(+), 13 deletions(-) —
`server/db.ts`, `tests/blog-cadence-gate.test.ts`.

- `/code-review` (medium, scoped to `HEAD~1..HEAD`): one finding — see Findings below.
- `/security-review`: no findings. The diff only swaps string literals for other string literals
  and adds a test file (hard-excluded from the security review's scope); no new I/O, no user
  input, no injection surface.
- `pnpm run typecheck` → clean.
- Full gate suite (`blog-cadence-gate.test.ts`, `db.test.ts`, `blog-rewrites.test.ts`) → 18/18
  passed.

## Findings

**Important — the new static regression test's INSERT-block boundary detection can be fooled by
blog post content that itself contains a line matching `\n\s*);`.** `tests/blog-cadence-gate.test.ts:93`.
The test finds each INSERT statement's end with `/\n\s*\);/.exec(source.slice(start))` — a naive
text search for the first line that is only whitespace followed by `);`. Blog post `content` is
long markdown/prose embedded in the same template literal the regex scans. If a future blog post
(added the same way as these 13) includes a markdown code sample quoting something like
`await dbRun(\n  ...\n);`, the scanner's `block` slice would end at that embedded line instead of
the INSERT statement's real closing paren. Concretely: if that post's actual `published_at`
argument were later careless reset to `new Date().toISOString()` (the exact class of regression
this test exists to catch) and the `new Date()` text happened to fall after the false early
closing match, `offenders` would stay empty and this gate would report green while silently
missing the regression. Today's 13 posts' content does not happen to contain this pattern, so the
test is not currently a false negative, but the boundary logic is a latent gap. Recommend the
next blog-related PRD harden this to match balanced parens/backticks (or scan to the INSERT's
actual statement terminator via a small state machine) rather than the first whitespace-`);`
line.

No other findings. No SQL injection, secrets, path traversal, or auth surface in this wave's diff
(string literals and a test file only).

---

VALIDATION: blog-cadence-gate-legacy-dates VERIFIED
VALIDATION: blog-cadence-remediate-10-03 VERIFIED
SCHEDULER_VERDICT: PASS
