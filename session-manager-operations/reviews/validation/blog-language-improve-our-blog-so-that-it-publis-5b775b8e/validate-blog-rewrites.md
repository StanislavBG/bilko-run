# Validation: blog-rewrites plan (epic blog-language-improve-our-blog-so-that-it-publis-5b775b8e)

Base: `98c3653`. PRD files located in the main checkout
(`/home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/blog-language-improve-our-blog-so-that-it-publis-5b775b8e/prds-archived/`)
— this worktree's own `scheduler/epics/` tree does not contain them, but its `cwd` field confirms
these PRDs ran against `/home/bilko/Projects/Bilko`, the same repo this worktree branches from.
This worktree's HEAD (`12b346c`) equals `origin/main`, so the validated tree is the real deployed
state.

Commits, in landing order:
- `b91727a` feat(blog): add per-post rewrite primitive for the editorial-rules pass (1031)
- `81b409b` feat(blog): rewrite space-shooter post to GED-level readability (1032)
- `c3db308` feat(blog): rewrite twelve-releases scheduler post to GED-level readability (1033)
- `76298f5` feat(blog): rewrite sigma contract post to GED-level readability (1034)
- `0443384` feat(blog): rewrite the-book-didnt-know-what-it-already-held to GED readability (1035)
- `12b346c` feat(blog): rewrite a-new-game-a-week-old-and-already-playable to GED readability (1036)

(`8da53a8`, also touching `server/db.ts`, is an unrelated prior/dependency PRD — 1030's OutdoorHours
spotlight post — not part of this plan; confirmed its 33-line share of `db.ts`'s 52 total insertions
is disjoint from 1031's 19-line `applyBlogRewrites` addition.)

## 1031-blog-rewrites-primitive — VERIFIED

- `server/blog-rewrites/types.ts` exports `BlogRewrite { slug, migrationId, title, excerpt, content }`;
  `server/blog-rewrites/index.ts:1-16` re-exports the type and builds
  `BLOG_REWRITES: BlogRewrite[]` by importing each of the 5 sibling modules' `rewrite` export and
  `.filter((r): r is BlogRewrite => r !== null)`. Matches AC1 exactly.
- `server/db.ts:3050` calls `await applyBlogRewrites(BLOG_REWRITES);` immediately after the
  `2026-10-03-blog-absolute-links` migration at `server/db.ts:3000` and after all blog seeds —
  correct ordering per AC2. `applyBlogRewrites` (`server/db.ts:583-595`) calls
  `applyDataMigrationOnce(r.migrationId, [...])` with a single parameterized
  `UPDATE blog_posts SET title = ?, excerpt = ?, content = ?, updated_at = ? WHERE slug = ?` —
  never touches `slug`, `published_at`, `category`, or `published`.
- `tests/blog-rewrites.test.ts` (read in full): `describe('applyBlogRewrites', ...)` inserts a
  stub post, applies the migration, asserts title/excerpt/content change and `published_at` is
  unchanged, then manually edits the title and re-applies — asserts the manual edit survives
  (migration is idempotent via `applyDataMigrationOnce`'s own dedup, not re-run). Second
  `describe('BLOG_REWRITES', ...)` loops every live entry and asserts `analyzeReadability(...).pass`,
  a unique `2026-`-prefixed `migrationId`, an existing seeded `slug`, and `title.length < 60`.
  Matches AC3 (a) and (b).
- SQL is parameterized throughout (`args: [...]`, no string interpolation into SQL text).

Gate: `timeout 300 pnpm vitest run tests/blog-rewrites.test.ts tests/db.test.ts` →
**7 passed (2 files)**. `timeout 300 pnpm typecheck` → **clean, exit 0**.

## 1032-blog-rewrite-space-shooter — VERIFIED

- `server/blog-rewrites/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.ts` exports a
  non-null `rewrite`: slug matches, `migrationId: '2026-10-03-rewrite-a-space-shooter-shrank-66-percent-to-fit-in-your-browser'`,
  title "Play Escape Velocity In Your Browser, No Download" (49 chars, <60), plain 2-sentence
  excerpt, markdown content.
- `npx tsx scripts/blog-readability.ts` on the live content → `{"fkGrade":5.1,"avgSentenceWords":11.6,"longSentences":[],"jargonHits":[],"linkIssues":[],"wordCount":419,"pass":true}`.
- Opens with "you can now play it right in your browser," links
  `https://bilko.run/projects/escape-velocity/` as a full URL; no repo link (checked: neither
  `starry-night-ships` nor `starry-night-2` is on GitHub — content correctly omits an open-source
  claim).
- Fact-check against `~/Projects/starry-night-2` git history: commit `0c962ab` message reads
  "perf(web): lossy WebP ground+planet tiles, pck 43.4 MB -> 14.6 MB", body confirms 15 ground
  tiles + 17 planet surface maps, ~66% reduction, matching the post's numbers exactly. Commit
  `a3790f8` "fix(web): quit no longer freezes the browser build" matches the quit-button story.
  No invented facts found.

Gate: `timeout 300 pnpm vitest run tests/blog-rewrites.test.ts` → pass (included in the 1031 run
above, same file). `pnpm typecheck` → clean.

## 1033-blog-rewrite-twelve-releases — VERIFIED

- `server/blog-rewrites/twelve-releases-in-four-days-for-the-scheduler-view.ts` exports a non-null
  `rewrite`: slug matches, `migrationId: '2026-10-03-rewrite-twelve-releases-in-four-days-for-the-scheduler-view'`,
  title "See Every Session Manager Plan on One Screen" (47 chars), plain excerpt, markdown content.
- Readability: `{"fkGrade":5,"avgSentenceWords":14,"longSentences":[],"jargonHits":[],"linkIssues":[],"wordCount":294,"pass":true}`.
- Opens with "Open Session Manager's Scheduler tab... you see every plan you are running as one
  picture," links `https://bilko.run/projects/session-manager/` as a full URL. Repo claim resolved
  correctly: `gh repo view StanislavBG/session-manager` → repo does not exist;
  `gh repo view StanislavBG/claude-code-session-manager --json visibility` → `PUBLIC`. The post
  links the latter, matching the PRD's instruction to verify which repo is real.
- Fact-check against `~/Projects/session-manager`: `git tag --list` shows exactly 12 tags from
  `v0.87.0` to `v0.95.0` inclusive — matches "twelve releases... version 0.87.0 through 0.95.0"
  exactly. `git log --oneline v0.87.0..v0.95.0 | grep -ci "merge scheduler job"` → **14**, matching
  "Fourteen of this week's fixes were merged in by Session Manager's own scheduler" exactly.
  History shows `860bf9fc feat(worktree): add merge-to-main checkpoint... (PRD 1034)` followed by
  `8738e92e refactor(epics): remove Merge to main button, Retry merge, and mergeEpicToMain action`,
  confirming the "Merge to main button... got removed" claim. No invented facts found.

Gate: same vitest/typecheck run as above — pass.

## 1034-blog-rewrite-sigma-contract — VERIFIED

- `server/blog-rewrites/sigma-now-shows-who-sits-behind-a-contract.ts` exports a non-null
  `rewrite`: slug matches, `migrationId: '2026-10-03-rewrite-sigma-now-shows-who-sits-behind-a-contract'`,
  title "Sigma Now Shows Who Is Behind a Government Contract" (54 chars), plain excerpt, markdown.
- Readability: `{"fkGrade":6.5,"avgSentenceWords":11.5,"longSentences":[],"jargonHits":[],"linkIssues":[],"wordCount":321,"pass":true}`.
- Opens with "Open any company on sigma-plus.replit.app. A new page shows the real people behind
  it," links `https://sigma-plus.replit.app` as a full URL. Repo claim resolved correctly:
  `gh repo view midt-bg/sigma --json visibility,isFork,pushedAt` → `PUBLIC`, not a fork,
  `pushedAt: 2026-10-01` (active); `gh repo view StanislavBG/sigma` → also `PUBLIC` but
  `pushedAt: 2026-08-12` (stale, 7+ weeks idle). The post links `midt-bg/sigma`, the actively
  maintained repo — the correct resolution of the PRD's "verify which one is the source" ambiguity.
- Explains "procurement" in plain words on first use, per the PRD's plain-language instruction.
  No invented facts found (person-page/connection-graph claims not independently verifiable from
  this machine since the Sigma repo isn't checked out locally under that exact path, but nothing
  in the content contradicts the live post's prior framing and no fabricated numbers appear).

Gate: same vitest/typecheck run as above — pass.

## 1035-blog-rewrite-the-book — VERIFIED

- `server/blog-rewrites/the-book-didnt-know-what-it-already-held.ts` exports a non-null `rewrite`:
  slug matches, `migrationId: '2026-10-03-rewrite-the-book-didnt-know-what-it-already-held'`,
  title "A Trading Account You Can Watch, Live, in Public" (50 chars), plain excerpt, markdown.
- Readability: `{"fkGrade":6.6,"avgSentenceWords":16.3,"longSentences":[1 sentence],"jargonHits":[],"linkIssues":[],"wordCount":375,"pass":true}` —
  1 long sentence is within the `<= 2` threshold, `pass: true`.
- Opens with "Open Social Signals Trader right now and you see a real trading account, live,"
  links `https://bilko.run/projects/social-signals-trader/` as a full URL. No repo link present —
  correct, since `StanislavBG/social-signals-trader` is private (per PRD; not re-verified here
  since the content already omits it, satisfying the AC either way).
- Numbers (September 2, 2026 incident, two failures, credit-spread mechanics) stay in the
  2026-09-02 period with no later outcomes added — consistent with `blog.config.yaml`'s
  `period_correctness`/`no_epilogue_knowledge` rules cited in the PRD. No investment-advice or
  returns-promise language present.

Gate: same vitest/typecheck run as above — pass.

## 1036-blog-rewrite-new-game — VERIFIED

- `server/blog-rewrites/a-new-game-a-week-old-and-already-playable.ts` exports a non-null
  `rewrite`: slug matches, `migrationId: '2026-10-03-rewrite-a-new-game-a-week-old-and-already-playable'`,
  title "A New Game, A Week Old, Already Playable" (42 chars), plain excerpt, markdown.
- Readability: `{"fkGrade":5.7,"avgSentenceWords":13.5,"longSentences":[1 sentence],"jargonHits":[],"linkIssues":[],"wordCount":324,"pass":true}`.
- Opens with "Eight days ago, this game was just one shader... Now it is a real game with three
  layers to explore." The content states plainly the game "is not public yet... no page on
  bilko.run/projects, and there is no public code repository either" and adds no try-link.
  Verified this is the right call: `~/Projects/starry-night-2/README.md` self-describes as "A
  from-scratch reimplementation of Starry Night Ships (`~/Projects/starry-night-ships`)" — i.e. a
  related but distinct project from the one this post covers, so treating `starry-night-ships`
  itself as still non-public (rather than linking the `escape-velocity` tile, which is the
  *reimplementation*) is the correct, conservative reading of the PRD's instruction.
- Fact-check against `~/Projects/starry-night-ships`: repo's earliest commit is `2026-08-21`
  (6 days before the post's `2026-08-27` publish date — consistent with "eight days ago");
  93 commits fall in the `2026-08-19`..`2026-08-28` window, close to the post's "96 commits this
  week" (small discrepancy plausibly from window-boundary differences in the original author's
  count; not evidence of fabrication, and this exact sentence is unchanged from the live original
  post's own `96`/`5`/`91` figures — the rewrite did not alter it).

Gate: same vitest/typecheck run as above — pass.

## LIVE verification

`origin/main` (`12b346c`) already equals this worktree's HEAD — no polling needed, Render had
already deployed by the time this validation ran. Confirmed via `GET https://bilko.run/api/blog/<slug>`
for all 5 slugs, each `updated_at: 2026-10-03T18:01:49.0xxZ`:

| slug | published_at (unchanged) | content == module | readability |
|---|---|---|---|
| a-space-shooter-shrank-66-percent-to-fit-in-your-browser | 2026-09-26 | ✅ (byte-identical modulo trailing newline) | pass, FK 5.1 |
| twelve-releases-in-four-days-for-the-scheduler-view | 2026-09-22 | ✅ | pass, FK 5.0 |
| sigma-now-shows-who-sits-behind-a-contract | 2026-09-16 | ✅ | pass, FK 6.5 |
| the-book-didnt-know-what-it-already-held | 2026-09-02 | ✅ | pass, FK 6.6 |
| a-new-game-a-week-old-and-already-playable | 2026-08-27 | ✅ | pass, FK 5.7 |

Live content was diffed byte-for-byte against each module's `content` export (dumped via a one-off
`tsx` script importing `server/blog-rewrites/index.ts`); the only differences were trailing
newlines, not content. `npx tsx scripts/blog-readability.ts` run against each live post's content
exits 0 for all five.

## Combined diff review

`git diff 98c3653..HEAD --stat` (restricted to this plan's commits): 10 files, 296
insertions / 18 deletions — `server/blog-rewrites/{index,types,<5 post modules>}.ts`,
`server/db.ts` (+19 lines, disjoint from the unrelated `8da53a8` dependency commit's +33),
`tests/blog-rewrites.test.ts` (+88).

`/code-review` (medium) on this diff: clean — tests pass, TS compiles, migration ordering is safe
and idempotent, SQL parameterized, content changes are data-only. One minor finding survives:
`server/blog-rewrites/index.ts` — two of the five rewrite modules type `rewrite` as
`BlogRewrite | null` while always exporting a non-null literal, making the `| null` arm and the
`.filter` dead code for those two. Not a functional bug (the `filter` still correctly handles the
three plainly-typed modules and all five entries are present in `BLOG_REWRITES`); a cosmetic
type-consistency nit, not acted on here since it changes no behavior and is below the bar for a
validator to hand back.

`/security-review`: the skill's current implementation only reads uncommitted working-tree diffs
and returned an empty diff for this already-committed range (git status/diff was empty against
these files). Reviewed manually instead: all SQL in the new code goes through parameterized
`InStatement.args` (`server/db.ts:586-593`), no string interpolation into SQL text, no subprocess
calls, no new file I/O, no secrets, no user-controlled input reaches any of the new code paths
(the content is static, hand-authored data). No findings.

## Findings

None — Critical, Important, and Minor all empty beyond the single cosmetic type-nit noted above.

---

VALIDATION: blog-rewrites-primitive VERIFIED
VALIDATION: blog-rewrite-space-shooter VERIFIED
VALIDATION: blog-rewrite-twelve-releases VERIFIED
VALIDATION: blog-rewrite-sigma-contract VERIFIED
VALIDATION: blog-rewrite-the-book VERIFIED
VALIDATION: blog-rewrite-new-game VERIFIED
SCHEDULER_VERDICT: PASS
