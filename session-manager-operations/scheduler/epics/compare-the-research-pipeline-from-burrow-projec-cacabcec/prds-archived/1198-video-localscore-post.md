---
title: Build the 30-second blog video for the rewritten LocalScore post
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
sourcePromptId: compare-the-research-pipeline-from-burrow-projec-cacabcec
tag: feature
agentType: dev-lead
createdVia: scheduler-api
issuedAt: 2026-10-10T16:32:08.820Z
dependsOn: [ship-localscore-rewrite, blog-video-skill-dag-aware]
planId: pl-mv2m10pj-73f010
---
# Goal

build: run the blog-video skill (`.claude/skills/blog-video/SKILL.md`) end to end for the slug `localscore-browser-ai-that-never-sees-your-data`. This post has no video today. Every scene must be grounded in the REWRITTEN post text, landed by PRD `rewrite-localscore-post-dag` and shipped live by `ship-localscore-rewrite`.

# Acceptance criteria

- [ ] `scripts/blog-video-build.ts` creates `public/blog-videos/localscore-browser-ai-that-never-sees-your-data/index.html` from a storyboard.json. Every scene's `source` in that storyboard is a verbatim prose sentence of the current `content/blog/localscore-browser-ai-that-never-sees-your-data.md`. Figure alt and caption text does not count as a source.
- [ ] The storyboard follows the skill's story spine, totals exactly 30 s, and has at least 2 real motion clips (`record`) of interactions the post describes. If WebGPU blocks the model in headless capture, the clips use the interactions that don't need it, and the report says which ones.
- [ ] `pnpm tsx scripts/blog-video.ts validate public/blog-videos/localscore-browser-ai-that-never-sees-your-data/index.html --post content/blog/localscore-browser-ai-that-never-sees-your-data.md` exits 0.
- [ ] The frames are reviewed against the skill's rubric on the contact sheet from `scripts/blog-video-frames.ts`, in at most 2 rounds. The closing frame shows https://bilko.run/projects/local-score/ once, on one line.
- [ ] Only that path is committed. It is pushed to origin main and confirmed live per the skill's step 8 (bounded at 20 tries), or reported as 'pushed, deploy not yet live' with the last status codes.
- [ ] The report includes:
  - the storyboard list
  - the shot list
  - the contact sheet path
  - the rubric result
  - any skill step that was unclear

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- public/blog-videos/localscore-browser-ai-that-never-sees-your-data/

# Implementation notes

Work in /home/bilko/Projects/Bilko.

Read first:
- `.claude/skills/blog-video/SKILL.md` (whole; it is the recipe). Skip step 1 Pick, because the slug is given.
- `content/blog/localscore-browser-ai-that-never-sees-your-data.md` (the rewritten post).
- The `<output_contract>` and `<audio_policy>` sections of `~/.claude/agents/demo-video-builder.md`, for the Kokoro narration.

Notes:
- Use `mktemp -d` for storyboard, shots and frames. Never write them into the repo.
- The screenshots under `public/blog-images/localscore-browser-ai-that-never-sees-your-data/` show which screens the post emphasises. Capture fresh clips with `scripts/blog-video-capture.ts`.
- If Kokoro is unavailable, ship a silent video and say so.

Do not touch: `scripts/` (report defects instead), `content/blog/`, other `public/blog-videos/` folders.

# Out of scope

- Editing scripts/blog-video-*.ts
- Editing the post

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 120 pnpm tsx scripts/blog-video.ts validate public/blog-videos/localscore-browser-ai-that-never-sees-your-data/index.html --post content/blog/localscore-browser-ai-that-never-sees-your-data.md
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
