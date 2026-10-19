---
title: Rebuild the GitViewer blog video from the rewritten post with the blog-video skill
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-10-10T04:34:41.729Z
sourcePromptId: rebuild-the-last-2-blogs-using-the-latest-skill--35d9b223
tag: build
agentType: dev-lead
dependsOn: [ship-github-heatmap-rewrite, blog-video-closing-url-fit]
planId: pl-mv1wb2m5-d98a4b
---
# Goal

build: run the blog-video skill (.claude/skills/blog-video/SKILL.md) end to end for slug turn-your-github-year-into-a-heatmap-and-badge-wall, replacing the existing public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html. Every scene must be grounded in the REWRITTEN post text (landed by PRD rewrite-github-heatmap-post). This is a test of the skill: report any step that was unclear or failed.

# Acceptance criteria

- [ ] public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html is rebuilt by scripts/blog-video-build.ts from a new storyboard.json whose every scene `source` is a verbatim sentence of the current content/blog/turn-your-github-year-into-a-heatmap-and-badge-wall.md
- [ ] The storyboard follows the skill's story spine, totals exactly 30 s, and has at least 2 real motion clips (`record`) of interactions the post describes (e.g. switching heatmap style, opening the settings panel)
- [ ] `pnpm tsx scripts/blog-video.ts validate public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html --post content/blog/turn-your-github-year-into-a-heatmap-and-badge-wall.md` exits 0
- [ ] Frame review per the skill's rubric was done on the contact sheet from scripts/blog-video-frames.ts (max 2 rounds); every callout's focus rect sits on the thing it names; the closing frame shows the URL on one line, once
- [ ] Committed (that path only), pushed to origin main, and live per the skill's step 8 (bounded 20 tries) with the served file containing `data:video/mp4`, or reported 'pushed, deploy not yet live' with last status codes
- [ ] Report includes storyboard list, shot list, contact sheet path, rubric result, and any skill step that was unclear

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html

# Implementation notes

Read first: .claude/skills/blog-video/SKILL.md (whole — it is the recipe; follow it step by step, skipping step 1 Pick because the slug is given), content/blog/turn-your-github-year-into-a-heatmap-and-badge-wall.md (the rewritten post), ~/.claude/agents/demo-video-builder.md sections <output_contract> and <audio_policy>.
Notes:
- The post now contains figure lines `![alt](/blog-images/... "caption")`; use prose sentences only as scene sources.
- Prior run (2026-10-09) defects to avoid: a 'No code needed' callout sat over the stats cards instead of the settings (gear/Tweaks) panel it described; the live URL kept serving the stale v1 file for a while after push — in step 8 also check the served body contains `data:video/mp4`.
- Use `mktemp -d` for storyboard/shots/frames; never write them into the repo.
- If Kokoro is unavailable, ship a silent video and say so.
Do not touch: public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/ (sibling PRD), scripts/, content/blog/.

# Out of scope

- Editing scripts/blog-video-*.ts (report defects instead)
- Editing the post

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 120 pnpm tsx scripts/blog-video.ts validate public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html --post content/blog/turn-your-github-year-into-a-heatmap-and-badge-wall.md
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
