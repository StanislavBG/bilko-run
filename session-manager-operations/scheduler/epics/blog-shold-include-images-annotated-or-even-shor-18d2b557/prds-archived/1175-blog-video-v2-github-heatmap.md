---
title: Regenerate git-viewer heatmap post video with the v2 pipeline
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-10-10T02:05:04.131Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
dependsOn: [blog-video-skill-v2]
planId: pl-mv1r1aja-ec9776
---
# Goal

Behavior: rebuild the video for `turn-your-github-year-into-a-heatmap-and-badge-wall` by following the v2 Blog Video skill end to end (slug named explicitly), so it follows the post's story spine and shows git-viewer actually moving — e.g. switching heatmap styles, as the post describes.

# Acceptance criteria

- [ ] Followed .claude/skills/blog-video/SKILL.md; the storyboard.json used is pasted in the report and every scene `source` is a verbatim sentence from content/blog/turn-your-github-year-into-a-heatmap-and-badge-wall.md.
- [ ] At least 2 `you can` scenes are real motion clips (data:video/mp4) of https://bilko.run/projects/git-viewer/ showing the interaction their source sentence describes.
- [ ] public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html was produced by scripts/blog-video-build.ts and passes `pnpm tsx scripts/blog-video.ts validate <file> --post content/blog/turn-your-github-year-into-a-heatmap-and-badge-wall.md`.
- [ ] scripts/blog-video-frames.ts exits 0 on the file; the report includes the contact sheet rubric result and what was revised.
- [ ] Committed (that file only), pushed with `git pull --rebase origin main && git push origin main` (never content-grade, retry at most 3 times), and a bounded live check (at most 20 tries x 30 s) that https://bilko.run/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/ returns 200 and contains `data:video/mp4`; result reported either way.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html

# Implementation notes

Read first: .claude/skills/blog-video/SKILL.md (the procedure — follow it exactly); content/blog/turn-your-github-year-into-a-heatmap-and-badge-wall.md; ~/.claude/agents/demo-video-builder.md `<audio_policy>`.

Work in a mktemp -d dir for shots, clips, audio and the storyboard; commit only the html. Kokoro model files are likely cached already. git-viewer shows the site owner's public GitHub data; never capture an error or rate-limit screen. A sibling PRD may push concurrently — pull --rebase before push.

Do not touch: any file other than public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 120 pnpm tsx scripts/blog-video.ts validate public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html --post content/blog/turn-your-github-year-into-a-heatmap-and-badge-wall.md && timeout 180 pnpm tsx scripts/blog-video-frames.ts public/blog-videos/turn-your-github-year-into-a-heatmap-and-badge-wall/index.html --out /tmp/bv-frames-github-heatmap
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
