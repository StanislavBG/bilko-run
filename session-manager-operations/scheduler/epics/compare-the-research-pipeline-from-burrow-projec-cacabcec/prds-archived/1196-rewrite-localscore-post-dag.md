---
title: Rewrite the LocalScore post through the new six-step blog DAG, with real screenshot figures
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-10-10T16:29:54.007Z
sourcePromptId: compare-the-research-pipeline-from-burrow-projec-cacabcec
tag: feature
agentType: dev-lead
disposition: new-head
planId: pl-mv2m10pj-73f010
---
# Goal

doc: rewrite the oldest live post that has no images and no video, `content/blog/localscore-browser-ai-that-never-sees-your-data.md` (LocalScore, published 2026-04-04). This is the first real run of the blog-from-git skill's new six-step content DAG: 3a Decompose → 3b Gather → 5a Outline → 5b Write → 5c Compose + renditions → 5d Illustrate. It is a test of that DAG. Each step leaves an inspectable artifact in the gitignored drafts folder of the main checkout, `scripts/blog-pipeline-check.ts` must pass, and the post gains 2-3 real screenshot figures. A later PRD ships the text to the live database.

# Acceptance criteria

- [ ] The artifacts exist in the main checkout under the absolute folder `/home/bilko/Projects/Bilko/.claude/skills/blog-from-git/drafts/localscore-browser-ai-that-never-sees-your-data/`. They are `questions.json`, `evidence.json`, `outline.json`, `renditions/linkedin.md` and `renditions/x.md`, in the exact shapes from `.claude/skills/blog-from-git/dag.md`. None of them are committed.
- [ ] `npx tsx scripts/blog-pipeline-check.ts /home/bilko/Projects/Bilko/.claude/skills/blog-from-git/drafts/localscore-browser-ai-that-never-sees-your-data content/blog/localscore-browser-ai-that-never-sees-your-data.md` exits 0.
- [ ] `content/blog/localscore-browser-ai-that-never-sees-your-data.md` has a newly written title (under 60 chars), excerpt and body. The frontmatter `slug`, `published_at` (2026-04-04T09:12:07.754Z), `order` (3), `category` and `published` are unchanged.
- [ ] The body passes every line of the final self-check in `.claude/skills/blog-from-git/SKILL.md`. The opening names the coolest thing a reader can do. The one primary link is https://bilko.run/projects/local-score/ and the repo link is https://github.com/StanislavBG/local-score. Every number traces to an `evidence.json` item.
- [ ] `public/blog-images/localscore-browser-ai-that-never-sees-your-data/` holds 2-4 real 1280x720 JPEG screenshots of https://bilko.run/projects/local-score/ or its GitHub repo, each under 220 KB and viewed with Read. Each is referenced exactly once as its own paragraph `![alt](/blog-images/localscore-browser-ai-that-never-sees-your-data/<file>.jpg "caption")`, chosen from an `outline.json` section's `figure` field.
- [ ] The final report has five parts:
  - the pipeline-check JSON `summary`
  - each question and the section(s) that answer it
  - whether burrow-brain community evidence was used, with its upvotes or quality, or why it was skipped
  - the LinkedIn and X renditions pasted verbatim
  - every DAG step that was unclear or did not fit a rewrite

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- content/blog/localscore-browser-ai-that-never-sees-your-data.md
- public/blog-images/localscore-browser-ai-that-never-sees-your-data/

# Implementation notes

Work in /home/bilko/Projects/Bilko.

Read first:
- `.claude/skills/blog-from-git/dag.md` (whole: the recipe and the artifact schemas)
- `.claude/skills/blog-from-git/SKILL.md` (whole)
- `.claude/skills/blog-from-git/research.md`, `ground.md` (incl. 'Community signal (burrow-brain), high-quality only'), `voice.md`, `images.md`
- the current post `content/blog/localscore-browser-ai-that-never-sees-your-data.md` (713 words, 2026-04 voice, pre-dates every current rule)

Mode: an owner-requested rewrite of an existing post. Phase 1 Rotation does NOT apply: add no ledger row and do not edit `blog-ledger.md`.

Steps:
1. Scan, scoped to LocalScore only: the local repo `~/Projects/Local-Score` (README, CLAUDE.md, src; read only, never edit) and its GitHub remote via `gh`, for anything shipped up to today.
2. Ground against these sources:
   - the live page https://bilko.run/projects/local-score/
   - the `local-score` entry in `src/data/standalone-projects.json` (static-path, sourceRepo `github.com/StanislavBG/local-score`)
   - burrow-brain, for high-quality community signal about private / in-browser AI document tools, if it is reachable. Its config is `~/Projects/burrow/data/mcp/burrow-brain.mcp.json`, at http://127.0.0.1:8767/mcp. Use `search_distilled` with `filters.min_upvotes` 25, or `search_adhoc` with `min_quality` 0.7. If it is not reachable, skip community evidence and say so; never substitute.
3. Write the artifacts into the ABSOLUTE main-checkout folder above, not the job worktree, so the human can inspect them after this run. Use `mkdir -p`.
4. Write the post section by section, under each outline H2 heading. Its length must fall within the computed budget, so let the evidence decide how many sections it gets.
5. Illustrate per `images.md`:
   - Use a `mktemp -d` shots.json, then run `pnpm tsx scripts/blog-video-capture.ts --shots <tmp>/shots.json --out <tmp>/shots --max-bytes 220000`.
   - View every JPEG with Read.
   - Allow at most 2 recapture rounds.
   - LocalScore runs a model in the browser via WebGPU, which may not run in headless Chromium. Prefer screens that do not need the model loaded (landing page, upload/paste area, GitHub repo), and say which.
6. Run `npx tsx scripts/blog-readability.ts content/blog/localscore-browser-ai-that-never-sees-your-data.md --check-live` and the pipeline check. Fix and re-run each at most 4 rounds, else HALT with the output.
7. Commit exactly `content/blog/localscore-browser-ai-that-never-sees-your-data.md` and `public/blog-images/localscore-browser-ai-that-never-sees-your-data/`. Do not push.

Do not touch: `server/blog-rewrites/` (next PRD), `public/blog-videos/`, `blog-ledger.md`, the Local-Score repo, the skill docs (report problems with them instead).

# Out of scope

- Shipping to the live DB (server/blog-rewrites)
- Video
- Editing skill docs or scripts
- Posting the renditions anywhere

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 120 npx tsx scripts/blog-pipeline-check.ts /home/bilko/Projects/Bilko/.claude/skills/blog-from-git/drafts/localscore-browser-ai-that-never-sees-your-data content/blog/localscore-browser-ai-that-never-sees-your-data.md
timeout 120 npx tsx scripts/blog-readability.ts content/blog/localscore-browser-ai-that-never-sees-your-data.md --check-live
timeout 300 pnpm vitest run tests/blog-posts-loader.test.ts tests/blog-markdown.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
