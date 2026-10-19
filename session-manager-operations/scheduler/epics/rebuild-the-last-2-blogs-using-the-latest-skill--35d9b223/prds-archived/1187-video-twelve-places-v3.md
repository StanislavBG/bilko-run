---
title: Rebuild the OutdoorHours blog video from the rewritten post with the blog-video skill
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-10-10T04:34:04.782Z
sourcePromptId: rebuild-the-last-2-blogs-using-the-latest-skill--35d9b223
tag: build
agentType: dev-lead
dependsOn: [ship-twelve-places-rewrite, blog-video-closing-url-fit]
planId: pl-mv1wb2m5-d98a4b
---
# Goal

build: run the blog-video skill (.claude/skills/blog-video/SKILL.md) end to end for slug twelve-places-one-weather-rule-you-set-yourself, replacing the existing public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/index.html. Every scene must be grounded in the REWRITTEN post text (landed by PRD rewrite-twelve-places-post), so the old video's claims no longer apply. This is a test of the skill: report any step that was unclear or failed.

# Acceptance criteria

- [ ] public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/index.html is rebuilt by scripts/blog-video-build.ts from a new storyboard.json whose every scene `source` is a verbatim sentence of the current content/blog/twelve-places-one-weather-rule-you-set-yourself.md
- [ ] The storyboard follows the skill's story spine, totals exactly 30 s, and has at least 2 real motion clips (`record`) of interactions the post describes
- [ ] `pnpm tsx scripts/blog-video.ts validate public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/index.html --post content/blog/twelve-places-one-weather-rule-you-set-yourself.md` exits 0
- [ ] Frame review per the skill's rubric was done on the contact sheet from scripts/blog-video-frames.ts (max 2 rounds); the closing frame shows the URL on one line, once
- [ ] Committed (that path only), pushed to origin main, and live per the skill's step 8 (bounded 20 tries), or reported 'pushed, deploy not yet live' with last status codes
- [ ] Report includes storyboard list, shot list, contact sheet path, rubric result, and any skill step that was unclear

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/index.html

# Implementation notes

Read first: .claude/skills/blog-video/SKILL.md (whole, 176 lines — it is the recipe; follow it step by step, skipping step 1 Pick because the slug is given), content/blog/twelve-places-one-weather-rule-you-set-yourself.md (the rewritten post), ~/.claude/agents/demo-video-builder.md sections <output_contract> and <audio_policy> (the skill points there for Kokoro narration).
Notes:
- The post now contains figure lines `![alt](/blog-images/... "caption")`; do not use alt/caption text as a scene source — use prose sentences only. The real screenshots under public/blog-images/twelve-places-one-weather-rule-you-set-yourself/ show which screens the post emphasises; capture fresh ones with scripts/blog-video-capture.ts as the skill says.
- Use `mktemp -d` for storyboard/shots/frames; never write them into the repo.
- If Kokoro is unavailable, ship a silent video and say so.
Do not touch: public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/ (sibling PRD), scripts/, content/blog/.

# Out of scope

- Editing scripts/blog-video-*.ts (report defects instead)
- Editing the post

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 120 pnpm tsx scripts/blog-video.ts validate public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/index.html --post content/blog/twelve-places-one-weather-rule-you-set-yourself.md
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
