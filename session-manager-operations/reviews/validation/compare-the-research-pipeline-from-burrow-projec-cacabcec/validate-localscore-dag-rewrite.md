# Validation: LocalScore DAG rewrite plan

Base: `3f50c16643dba1483180c6488fdf098de10aed03`. Commits in range for this plan: `4f4ed05` (rewrite), `7f70816` (ship), `583bb80` (skill), `59574a4` (video). All four are on `origin/main`. The `node_modules` symlink used to run tsx in the job worktree is untracked and not committed.

## 1196-rewrite-localscore-post-dag — VERIFIED
- Artifacts in the main checkout drafts folder: `questions.json`, `evidence.json`, `outline.json`, `renditions/linkedin.md`, `renditions/x.md` all present. They sit in a gitignored folder outside the repo, so they are uncommitted.
- `npx tsx scripts/blog-pipeline-check.ts <abs drafts> content/blog/<slug>.md` exits 0. Summary: 6 questions, 11 evidence items, 1 community item kept, 3 sections, 449 words (budget 424-636), LinkedIn 187 words, X 221 chars.
- Frontmatter: title "Read a contract with AI that stays on your computer" (51 chars); slug, `published_at` 2026-04-04T09:12:07.754Z, `order` 3, category `deep-dive` and `published: true` unchanged (diff shows no change to those lines).
- Links: `content/blog/...md:45` has the one primary link https://bilko.run/projects/local-score/ and the repo link https://github.com/StanislavBG/local-score.
- Figures: 3 JPEGs in `public/blog-images/<slug>/`, each 1280x720, 56-100 KB (under 220 KB). Each is referenced once, as its own paragraph (lines 21, 31, 41), with a caption.
- Readability `--check-live`: pass (FK 4.8, no hits). `vitest` blog-posts-loader and blog-markdown: pass.
- Not checked: the PRD's five-part final report (not available to me), and whether each JPEG was viewed with Read.

## 1197-ship-localscore-rewrite — VERIFIED
- `server/blog-rewrites/<slug>.ts` exports `rewrite` with the required slug and migrationId `2026-10-10-rewrite-localscore-browser-ai-that-never-sees-your-data-v2`.
- Byte identity (script comparing the module to the md): title true, excerpt true, content true (body after frontmatter).
- `index.ts` imports `localScoreRewrite` and appends it to `BLOG_REWRITES`.
- `tests/blog-rewrites.test.ts` (2 tests) passes, and the test file is unchanged in the diff. `pnpm typecheck` exits 0.
- `7f70816` is in `origin/main`.
- Live: `curl --max-time 15 https://bilko.run/api/blog/<slug>` returns the new title and content, equal to the rewrite entry. All three `/blog-images/<slug>/*.jpg` return 200 image/jpeg.

## 1209-blog-video-skill-dag-aware — VERIFIED
Read against `.claude/skills/blog-video/SKILL.md`:
- "System of record" note near the top (line ~13) has all three statements.
- Step 2 checks the absolute `drafts/<slug>/outline.json`, uses sections and `figure` fields, confirms with `evidence.json`, and falls back to the post's emphasis when missing.
- Step 3 says to let `public/blog-images/<slug>/` guide the shot list and still capture fresh motion clips.
- Verbatim PROSE `source` rule, with figure alt and caption excluded, is in Step 2.
- Closing beat uses the post's one primary project link.
- The diff is small (24 lines, one file). Other steps, exit lines and the example storyboard are unchanged.
- Gate `vitest tests/blog-video.test.ts tests/blog-video-build.test.ts`: 39 tests pass.

## 1198-video-localscore-post — VERIFIED
- `public/blog-videos/<slug>/index.html` exists (714 KB, 1 file in the commit). It has 2 `<video>` clips and an embedded audio track (Kokoro narration).
- The embedded `blog-video-claims` JSON carries one `source` per scene.
- Gate `blog-video.ts validate ... --post content/blog/<slug>.md` exits 0 ("OK"). That checks the sources, so each is verbatim in the post.
- The closing scene (`s6`) holds https://bilko.run/projects/local-score/.
- `59574a4` is in `origin/main`. `https://bilko.run/blog-videos/<slug>/index.html` returns 200.
- Not checked: exactly 30 s total and the contact-sheet rubric. I did not re-run the frame review. The validator passing covers duration limits only indirectly.

## Findings
### Critical
None.
### Important
None.
### Minor
- `scripts/blog-pipeline-check.ts` needs `js-yaml` and fails with `ERR_MODULE_NOT_FOUND` in a job worktree that has no `node_modules`. The drafts folder is only in the main checkout, so a validator or dev job in a worktree has to link `node_modules` first.
- Review caveat: the combined range `base..HEAD` also contains the unrelated workflows-cleanup commits (`97ddf8b`, `247e7f6` and others). I excluded them from this plan's review. I did not run `/code-review` or `/security-review` on them. I self-reviewed the plan's own diff: no secrets, no user-input handling, no path traversal. The rewrite file holds static strings, and the video is a static HTML file.
