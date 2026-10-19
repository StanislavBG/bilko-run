---
title: Build a 30-second Escape Velocity blog video from the rewritten post with the blog-video skill
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-10-11T01:32:50.192Z
sourcePromptId: rebuild-this-blog-https-bilko-run-blog-a-space-s-01e2b70c
tag: build
agentType: dev-lead
dependsOn: [ship-space-shooter-rewrite]
planId: pl-mv35ds46-72e8e1
---
# Goal

build: run the blog-video skill (.claude/skills/blog-video/SKILL.md) end to end for slug a-space-shooter-shrank-66-percent-to-fit-in-your-browser, creating public/blog-videos/a-space-shooter-shrank-66-percent-to-fit-in-your-browser/index.html (none exists yet). Every scene must be grounded in the REWRITTEN post (landed by PRD rewrite-space-shooter-post), and the motion clips should show real gameplay, since a moving space shooter is the most shareable thing this post has.

# Acceptance criteria

- [ ] public/blog-videos/a-space-shooter-shrank-66-percent-to-fit-in-your-browser/index.html is built by scripts/blog-video-build.ts from a storyboard.json whose every scene source is a verbatim prose sentence of the current content/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.md.
- [ ] The storyboard follows the skill's story spine, totals exactly 30 s, and has at least 2 real motion clips (record) of the game being played at https://bilko.run/projects/escape-velocity/ (ship moving, enemies or a boss on screen), not only static title screens.
- [ ] pnpm tsx scripts/blog-video.ts validate public/blog-videos/a-space-shooter-shrank-66-percent-to-fit-in-your-browser/index.html --post content/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.md exits 0.
- [ ] Frame review per the skill's rubric was done on the contact sheet from scripts/blog-video-frames.ts (max 2 rounds); every callout's focus rect sits on the thing it names; the closing frame shows the URL on one line, once.
- [ ] Committed (that path only), pushed to origin main, and live per the skill's live-check step (bounded 20 tries) with the served file containing data:video/mp4, or reported 'pushed, deploy not yet live' with last status codes.
- [ ] Report includes storyboard list, shot list, contact sheet path, rubric result, whether Kokoro narration was used, and any skill step that was unclear.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- public/blog-videos/a-space-shooter-shrank-66-percent-to-fit-in-your-browser/

# Implementation notes

Read first: .claude/skills/blog-video/SKILL.md (whole — it is the recipe, now DAG-aware; follow it step by step, skipping its Pick step because the slug is given), content/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.md (the rewritten post; read the landed file first), /home/bilko/Projects/Bilko/.claude/skills/blog-from-git/drafts/a-space-shooter-shrank-66-percent-to-fit-in-your-browser/outline.json (if the skill consumes it), ~/.claude/agents/demo-video-builder.md sections output_contract and audio_policy.
Notes:
- The post contains figure lines ![alt](/blog-images/... "caption"); use prose sentences only as scene sources.
- The game is keyboard-only: for record clips, focus the canvas, start a run, and hold/press movement keys (arrows/WASD) so the ship actually moves; wait for the wasm to boot before recording. If gameplay never renders in headless Chromium after 2 tries, use the best real frames and say so.
- Known prior defects to avoid: callouts sitting over the wrong element; the live URL serving a stale file after push — in the live check also confirm the served body contains data:video/mp4.
- Use mktemp -d for storyboard/shots/frames; never write them into the repo.
- If Kokoro is unavailable, ship a silent video and say so.
Do not touch: scripts/, content/blog/, server/, other public/blog-videos/ folders.

# Out of scope

- Editing scripts/blog-video-*.ts (report defects instead)
- Editing the post

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 120 pnpm tsx scripts/blog-video.ts validate public/blog-videos/a-space-shooter-shrank-66-percent-to-fit-in-your-browser/index.html --post content/blog/a-space-shooter-shrank-66-percent-to-fit-in-your-browser.md
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
