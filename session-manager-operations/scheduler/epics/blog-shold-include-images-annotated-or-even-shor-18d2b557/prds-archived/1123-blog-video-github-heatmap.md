---
title: New video for the GitHub heatmap post with real git-viewer screenshots
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-10-09T23:06:21.914Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
dependsOn: [blog-video-capture, blog-video-skill-real-images]
planId: pl-mv1kpii3-ddbdea
---
# Goal

Behavior: run the updated Blog Video skill exactly as the one-click macro would — `pnpm tsx scripts/blog-video.ts next` should now pick `turn-your-github-year-into-a-heatmap-and-badge-wall` ("Turn Your GitHub Year Into a Heatmap and Badge Wall") — producing its first video with real, annotated screenshots of https://bilko.run/projects/git-viewer/. Second test of the real-image macro, on a different product.

# Acceptance criteria

- [ ] Ran `pnpm tsx scripts/blog-video.ts next` first and recorded its output; if it was not `turn-your-github-year-into-a-heatmap-and-badge-wall`, used that slug anyway and noted the discrepancy.
- [ ] Captured 3-5 real screenshots with scripts/blog-video-capture.ts from https://bilko.run/projects/git-viewer/ (and optionally https://github.com/StanislavBG/git-viewer), viewed each one, dropped any error/blank/loading capture.
- [ ] public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html exists with at least 3 `data:image/jpeg;base64` images as key-point scenes with animated annotation overlays, Kokoro narration (af_heart, else af_bella), sm-demo-duration 30, window.smDemo, and passes `pnpm tsx scripts/blog-video.ts validate`.
- [ ] Every caption and callout traces to a sentence in the post's seed in server/db.ts; the report lists the shot list (name, url, scene, sentence) and the claims list.
- [ ] The commit (that file only) is pushed with `git pull --rebase origin main && git push origin main` (never content-grade); bounded live check (at most 20 tries x 30 s) that https://bilko.run/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/ returns 200 and https://bilko.run/api/blog/turn-your-github-year-into-a-heatmap-and-badge-wall has a non-null video_url; result reported either way.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html

# Implementation notes

Read first: .claude/skills/blog-video/SKILL.md (all — the procedure, including the new Capture step); ~/.claude/agents/demo-video-builder.md `<output_contract>` and `<audio_policy>`; server/db.ts — search for `turn-your-github-year-into-a-heatmap-and-badge-wall` for the post body; scripts/blog-video-capture.ts header (shot list format).

Steps: follow the skill. Work in a mktemp -d directory for shots and audio; Kokoro model files are likely already cached (search ~ and ~/.cache before downloading). git-viewer may need a GitHub username entered to show a heatmap — if the post names one, use it via `fill`/`press` actions; otherwise use `StanislavBG` (the site owner's public account). Look at each JPEG before using it; never show an error or rate-limit screen. Fix validator failures at most 3 rounds, else HALT exit 1. Commit only the html path; a sibling PRD may push concurrently, so retry `git pull --rebase origin main && git push origin main` at most 3 times.

Do not touch: any file other than public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 120 pnpm tsx scripts/blog-video.ts validate public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html && timeout 30 grep -q data:image/jpeg public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
