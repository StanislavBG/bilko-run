---
title: Validate: rebuild the Escape Velocity space-shooter blog post (text, figures, video) with the latest skills
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T01:33:03.871Z
sourcePromptId: rebuild-this-blog-https-bilko-run-blog-a-space-s-01e2b70c
tag: build
agentType: validator
dependsOn: [rewrite-space-shooter-post, ship-space-shooter-rewrite, video-space-shooter]
planId: pl-mv35ds46-72e8e1
---
# Goal

validate: verify the plan that rebuilt https://bilko.run/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser. PRDs: 1228 rewrite-space-shooter-post (DAG rewrite + real gameplay figures); 1229 ship-space-shooter-rewrite (v2 blog-rewrites entry, live); 1230 video-space-shooter (30 s blog video, live).

# Acceptance criteria

- [ ] rewrite-space-shooter-post: every AC in $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/rebuild-this-blog-https-bilko-run-blog-a-space-s-01e2b70c/prds/1228-rewrite-space-shooter-post.md (or prds-archived/) holds; view each figure image; re-run the pipeline check against the main-checkout drafts folder.
- [ ] ship-space-shooter-rewrite: every AC in .../prds/1229-ship-space-shooter-rewrite.md holds, including live https://bilko.run/api/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser title and image URLs.
- [ ] video-space-shooter: every AC in .../prds/1230-video-space-shooter.md holds; run scripts/blog-video-frames.ts and view the contact sheet; confirm real gameplay motion; live file matches local and contains data:video/mp4.
- [ ] Write and commit session-manager-operations/reviews/validation/rebuild-this-blog-https-bilko-run-blog-a-space-s-01e2b70c/validate-space-shooter-blog.md, including a 'Skill test findings' section collecting every unclear or failed skill step the executors reported, and a 'Shareability' note judging hook, title and renditions against the owner's goal of a share-worthy post.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/rebuild-this-blog-https-bilko-run-blog-a-space-s-01e2b70c/validate-space-shooter-blog.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 37ffe61deeb285e7e79113eecfc178c2035b843e
PRD files live under $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/rebuild-this-blog-https-bilko-run-blog-a-space-s-01e2b70c/prds/ while queued and prds-archived/ (possibly a timestamped subfolder) once done; find each by slug. That folder and .claude/skills/blog-from-git/drafts/ are gitignored, so read them from the main checkout, not your job worktree.
Also check: the rendered post page https://bilko.run/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser shows the figures (fetch the API content and confirm figure lines parse with parseFigure in src/lib/blogMarkdown.ts) and the video.

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
