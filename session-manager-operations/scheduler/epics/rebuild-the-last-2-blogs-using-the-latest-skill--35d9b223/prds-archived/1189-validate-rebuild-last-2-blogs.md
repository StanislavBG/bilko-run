---
title: Validate: rebuild the last 2 blog posts (text, screenshots, videos) with the latest skills
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T04:36:09.237Z
sourcePromptId: rebuild-the-last-2-blogs-using-the-latest-skill--35d9b223
tag: build
agentType: validator
dependsOn: [blog-readability-figure-aware, blog-video-closing-url-fit, blog-skill-illustrate-step, rewrite-twelve-places-post, rewrite-github-heatmap-post, ship-twelve-places-rewrite, ship-github-heatmap-rewrite, video-twelve-places-v3, video-github-heatmap-v3]
planId: pl-mv1waavv-83d93c
---
# Goal

validate: verify the plan that rebuilt the two newest bilko.run posts. PRDs: 1177 blog-readability-figure-aware (readability accepts figure blocks); 1178 blog-video-closing-url-fit (closing URL on one line, once); 1179 blog-skill-illustrate-step (images.md in blog-from-git); 1184 rewrite-twelve-places-post and 1183 rewrite-github-heatmap-post (new text + real screenshot figures); 1185 ship-twelve-places-rewrite and 1186 ship-github-heatmap-rewrite (blog-rewrites entries, live); 1187 video-twelve-places-v3 and 1188 video-github-heatmap-v3 (videos rebuilt from the new text, live).

# Acceptance criteria

- [ ] blog-readability-figure-aware: every AC in $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/rebuild-the-last-2-blogs-using-the-latest-skill--35d9b223/prds/1177-blog-readability-figure-aware.md (or prds-archived/) holds
- [ ] blog-video-closing-url-fit: every AC in .../prds/1178-blog-video-closing-url-fit.md holds
- [ ] blog-skill-illustrate-step: every AC in .../prds/1179-blog-skill-illustrate-step.md holds
- [ ] rewrite-twelve-places-post: every AC in .../prds/1184-rewrite-twelve-places-post.md holds; view each figure image
- [ ] rewrite-github-heatmap-post: every AC in .../prds/1183-rewrite-github-heatmap-post.md holds; view each figure image
- [ ] ship-twelve-places-rewrite: every AC in .../prds/1185-ship-twelve-places-rewrite.md holds, including live https://bilko.run/api/blog/twelve-places-one-weather-rule-you-set-yourself title and image URLs
- [ ] ship-github-heatmap-rewrite: every AC in .../prds/1186-ship-github-heatmap-rewrite.md holds, including live checks
- [ ] video-twelve-places-v3: every AC in .../prds/1187-video-twelve-places-v3.md holds; run scripts/blog-video-frames.ts and view the contact sheet; live file matches local
- [ ] video-github-heatmap-v3: every AC in .../prds/1188-video-github-heatmap-v3.md holds; contact sheet viewed; live file matches local and contains data:video/mp4
- [ ] Write and commit session-manager-operations/reviews/validation/rebuild-the-last-2-blogs-using-the-latest-skill--35d9b223/validate-rebuild-last-2-blogs.md, including a section 'Skill test findings' collecting every unclear or failed skill step the executors reported

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/rebuild-the-last-2-blogs-using-the-latest-skill--35d9b223/validate-rebuild-last-2-blogs.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 2410e70dbe5733b764c7b9e549d1716c518b842e
PRD files live under $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/rebuild-the-last-2-blogs-using-the-latest-skill--35d9b223/prds/ while queued and prds-archived/ (possibly a timestamped subfolder) once done; find each by slug. That folder is gitignored, so read it from the main checkout, not your job worktree.
Also check: the rendered post page https://bilko.run/blog/<slug> shows the figures (fetch the API content and confirm figure lines parse with parseFigure in src/lib/blogMarkdown.ts).

# Out of scope

- (none)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
