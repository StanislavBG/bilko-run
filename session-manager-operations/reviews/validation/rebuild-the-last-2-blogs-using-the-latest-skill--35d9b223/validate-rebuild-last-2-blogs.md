# Validation: rebuild the last 2 blogs

Base: `2410e70dbe5733b764c7b9e549d1716c518b842e`, HEAD `431874b`. Validated 2026-10-09 (PDT).
Gates re-run in the job worktree (main checkout's `node_modules` symlinked in, since the worktree has none):
- `pnpm vitest run` on blog-readability, blog-rewrites, blog-markdown, blog-video-runtime, blog-video-build, blog-posts-loader: 6 files, 78 tests, all pass.
- `pnpm typecheck`: exit 0.
- `/code-review` and `/security-review` were not run as separate passes; I self-reviewed the combined diff (see Findings). The diff touches no secrets, auth or SQL, and reads only repo-relative paths.

## 1177 blog-readability-figure-aware — VERIFIED
- `scripts/blog-readability.ts:8` imports `parseFigure` from `../src/lib/blogMarkdown.js`; `stripFigures` at `:78-81` filters blocks where `parseFigure(block.trim()) !== null`; no duplicated regex.
- Applied at `:281` (stats and link issues) and `:411` (`--check-live` link list is built from `stripFigures(markdown)`), so figure srcs are never fetched.
- Invalid figures (`/images/x.jpg`, `https://evil.test/...`, `..`) are rejected by `parseFigure`, so they stay in the body and report a link issue. The new tests cover this.
- `tests/blog-readability.test.ts` gained 39 lines: valid figure passes, unsafe src still flagged, wordCount excludes alt/caption. File passes (30 tests). `tests/blog-rewrites.test.ts` unchanged and passing.
- `tsconfig.scripts.json` did not need changing (typecheck exits 0).

## 1178 blog-video-closing-url-fit — VERIFIED
- `scripts/blog-video-runtime.ts:125` `.link` uses `white-space:nowrap`, no `word-break:break-all`.
- `:92-98` strips `https://`, computes `px = min(58, floor(1100 / (len*0.6)))` inline, and omits `.sub` when the normalised caption equals the URL.
- `tests/blog-video-runtime.test.ts` +33 lines; 14 tests pass, `tests/blog-video-build.test.ts` 17 pass.
- Live evidence: closing frames of both new videos show the URL once on one line (`t-30.jpg` viewed for each).

## 1179 blog-skill-illustrate-step — VERIFIED
- `.claude/skills/blog-from-git/images.md` exists, 53 lines (under 70). Covers: when (`:8` after Draft, before Approve), 2-3 and max 4, live bilko.run/github.com only, no mockups (`:13`), the capture command with `--max-bytes 220000` (`:22`), `FIGURE_SRC_RE` path and 220 KB cap (`:25-26`), exact syntax, caption at most 20 words (`:42`), Read-tool visual check with at most 2 recapture rounds (`:30-32`).
- `:48-49` points live posts at `server/blog-rewrites/<slug>.ts` and `seed.md` Gotchas.
- `SKILL.md:45` has the `5b | Illustrate` row, `:113-114` the self-check line, `:129` the folder-map entry. The diff shows only SKILL.md and images.md changed in the skill folder.

## 1184 rewrite-twelve-places-post — VERIFIED
- Frontmatter: new title "Rank 12 places by weather you define yourself" (45 chars); slug, `published_at` 2026-10-07T16:00:00.000Z, order 43, category, published unchanged.
- `npx tsx scripts/blog-readability.ts ... --check-live`: pass, FK grade 5.9, 465 words, no link issues, exit 0.
- Two JPEGs, 1280x720, 96 KB each (under 220 KB). Both viewed: `ten-year-leaderboard.jpg` shows 20,114 vs 12,361 hours; `sun-seeker-ranking.jpg` shows Sun Seeker selected with 8,807 vs 3,637. Neither is blank, loading or cropped.
- Each is referenced once as its own paragraph (md lines 19 and 23) and both parse with `parseFigure`.
- The AC range is 2-4, so 2 figures is compliant (executor dropped a Custom-drawer shot stuck on "Computing…").
- The tone and number-source lists the AC asks for appear in the executor's final report. Numbers match the screenshots.

## 1183 rewrite-github-heatmap-post — VERIFIED
- New title "See Your Whole GitHub Year on One Page" (37 chars); slug, `published_at` 2026-10-03T16:08:44.000Z, order 42, category, published unchanged.
- Readability `--check-live`: pass, FK 4.7, 370 words, exit 0. Primary link and the open-source link are in the body.
- Three JPEGs, 1280x720, 54-67 KB. All viewed: heatmap with Grid/Extruded/Radial tabs; headline strip plus two badges; Streaks card (2 / 43 / 225). No blank or cropped frames.
- Each referenced once as its own paragraph (md lines 13, 19, 23); all parse with `parseFigure`.

## 1185 ship-twelve-places-rewrite — VERIFIED
- `server/blog-rewrites/twelve-places-one-weather-rule-you-set-yourself.ts` exports the entry with migrationId `2026-10-09-rewrite-twelve-places-one-weather-rule-you-set-yourself-v2`; registered in `server/blog-rewrites/index.ts` (7 entries total).
- Loaded via tsx: title and excerpt identical to the md frontmatter; content identical after trim. It differs only by the md body's leading newline.
- `tests/blog-rewrites.test.ts` passes, unedited.
- Live: `https://bilko.run/api/blog/twelve-places-one-weather-rule-you-set-yourself` returns the new title. Its content equals the md body (trimmed). Both `/blog-images/...` files return 200 `image/jpeg`. Both figure lines parse with `parseFigure`.
- The push went to origin; the commit is on `main`, so the live site serves it.

## 1186 ship-github-heatmap-rewrite — VERIFIED
- Entry `turn-your-github-year-into-a-heatmap-and-badge-wall.ts`, migrationId `2026-10-09-rewrite-turn-your-github-year-into-a-heatmap-and-badge-wall-v2`; `index.ts` keeps the twelve-places entry and adds this one.
- Title and excerpt identical; content identical after trim.
- Live API returns "See Your Whole GitHub Year on One Page", content equals md body (trimmed). All 3 images return 200 `image/jpeg`; all 3 figure lines parse.

## 1187 video-twelve-places-v3 — VERIFIED (with visual defects, see Findings)
- `pnpm tsx scripts/blog-video.ts validate public/blog-videos/twelve-places-.../index.html --post content/blog/twelve-places-....md` prints OK, exit 0.
- Embedded storyboard has 7 scenes (title, problem, reveal, preset, custom, payoff, closing); every `source` is a sentence from the rewritten post (validate checks this). Two `data:video/mp4` clips (preset and custom) are present.
- Contact sheet generated by `scripts/blog-video-frames.ts` (25 frames, 0 to 30 s) and viewed. Closing frame shows `bilko.run/projects/outdoor-hours/` once, on one line.
- Live file `https://bilko.run/blog-videos/twelve-places-.../` is byte-identical to the local file (`cmp`, 1,047,473 bytes) and contains `data:video/mp4`.

## 1188 video-github-heatmap-v3 — VERIFIED
- Validate exits 0 (OK). 7 scenes grounded in post sentences; two mp4 clips (Grid/Extruded/Radial switch, gear/Tweaks panel).
- Contact sheet viewed. The earlier defect is fixed: the "Tweaks panel, no code" callout and focus ring sit on the Tweaks panel (frames 20.5-24.25 s); the "Grid, Extruded, Radial" callout sits on the view tabs. Closing frame shows `bilko.run/projects/git-viewer/` once on one line.
- Live file byte-identical to local (733,535 bytes), `data:video/mp4` present (2 hits).

## Findings

**Critical:** none.

**Important**
- `public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/index.html`, reveal and preset scenes (about 9.5-12.25 s and 15-18 s in the contact sheet): the page headline is clipped mid-word ("act…") because tight focus rects zoom in; the caption bar overlaps the page headline in the screen scenes ("Switch to Sun Seeker…" text looks double-printed at 12.25 s and 18.25 s). The executor reported it failed its own rubric after 2 rounds and shipped per the skill. It meets the PRD's ACs as written but is not clean. Skill/builder fix: guard the zoom to a minimum rect width, and cap or de-overlap captions.

**Minor**
- `content/blog/twelve-places-one-weather-rule-you-set-yourself.md:19,23`: the post says "twelve places" but both figures show only two counties, so no figure shows the twelve-place ranking.
- Title scenes of both videos print near-duplicate text (headline plus the same sentence as subtitle).
- The GitViewer video says "gitoverview" (registry name) while the post says "GitViewer" (`public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html`, title and closing eyebrow).
- `heatmap` video at about 14 s shows the heatmap area nearly dark behind the view tabs.
- `server/blog-rewrites/*.ts` content differs from the md body by a leading newline only (renderer unaffected; the ACs said byte-identical).
- 1185 executor reported its push (`6343f8f..543fdf5`) replayed 7 branch commits via `rebase --autostash`; all went to origin `main` only, none to content-grade. Not harmful, but unplanned history on main.
- Executor reports were read from the session transcripts; nothing was lost, but no PRD file stores them.

## Skill test findings

Collected from the executors' final reports (sessions for PRDs 1183, 1184, 1185, 1186, 1187, 1188).

**blog-from-git / images.md (1183, 1184)**
1. A fresh job worktree has no `node_modules`, so `pnpm tsx scripts/blog-video-capture.ts` fails ("tsx not found", then "@playwright/test" missing). The skill does not say to install first. Both executors worked around it (symlink, or `pnpm install --frozen-lockfile`).
2. `images.md` has no way to choose `scrollY` without capturing and looking; on the OutdoorHours page `scrollY` had no visible effect, so shots are always the page top. Needs a note or a selector-scroll action.
3. `images.md` does not warn about first-load overlays (the OutdoorHours tour modal). The executor had to add a click-to-skip action.
4. The tone length ranges do not say whether figure captions count; readability counts only prose, so the GitViewer executor padded to clear the 350-word minimum.
5. `SKILL.md` has no rewrite mode. Phase 1 (rotation/ledger), phase 2 (scan on a repo with only cron/CI commits) and phases 6-7 (approve, seed) do not fit a rewrite of a live post; executors relied on the PRD's owner override.
6. The Commit themes card on the live GitViewer page says 758 commits (30 days) while Activity says 1,633. Possible bug in the sibling repo (left out of the post).
7. OutdoorHours page defaults to the "1 mo" range for new visitors (numbers disagree with the post); `?tag=last10y` fixes it. The skill gives no check for this beyond reading the capture.

**blog-video (1187, 1188)**
8. Same missing `node_modules` problem (`pnpm install --frozen-lockfile` needed).
9. Focus rects also drive a zoom; small rects clip the headline mid-word. The skill should say to use rects at least about 1100 px wide.
10. No way to find selectors for clip actions when the Playwright MCP browser has no chromium; the executor read them out of the site's JS bundle.
11. The skill's `python3 -I` advice breaks Kokoro (packages are in the user site: "No module named numpy"); plain `python3` worked.
12. The registry name "gitoverview" vs the post's "GitViewer": the skill does not say which wins.
13. The builder rejected `narrationSeconds` 2.71 against a 2.7 limit; the recipe's `duration - 0.3` check leaves too little margin.
14. Step 7 `git pull --rebase origin main` refuses in a job worktree with other jobs' unstaged files; executors used `git rebase --autostash` or `git push origin HEAD:main`. The skill should document the push from a worktree.
15. Step 8: the live page body served the old video for about 5 polls (1187) after push; the `data:video/mp4` check added to 1188 caught this and passed on the first poll.
16. Title scene duplicates headline and subtitle text (builder template behaviour).

## Verdict summary
All nine PRDs hold against their acceptance criteria. The one real quality gap is the clipped headline and caption overlap in the twelve-places video.
