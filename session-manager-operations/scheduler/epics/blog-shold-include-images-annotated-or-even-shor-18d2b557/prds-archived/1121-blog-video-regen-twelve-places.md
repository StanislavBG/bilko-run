---
title: Regenerate the OutdoorHours post video with real product screenshots
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 15
createdVia: scheduler-api
issuedAt: 2026-10-09T23:06:05.760Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
agentType: dev-lead
dependsOn: [blog-video-capture, blog-video-skill-real-images]
planId: pl-mv1kpii3-ddbdea
---
# Goal

Behavior: re-run the updated Blog Video skill on `twelve-places-one-weather-rule-you-set-yourself` ("Twelve Places, One Weather Rule You Set Yourself"), replacing its current shapes-only video with one whose key scenes are real, annotated screenshots of https://bilko.run/projects/outdoor-hours/ — the first test of the real-image macro.

# Acceptance criteria

- [ ] Followed .claude/skills/blog-video/SKILL.md with the slug named explicitly (skip the `next` pick); captured 3-5 real screenshots with scripts/blog-video-capture.ts from https://bilko.run/projects/outdoor-hours/ (and optionally https://github.com/StanislavBG/outdoor-hours), and viewed each one, dropping any error/blank/loading capture.
- [ ] public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/index.html is overwritten; it contains at least 3 `data:image/jpeg;base64` images used as key-point scenes with animated annotation overlays, keeps the Kokoro narration (af_heart, else af_bella), sm-demo-duration 30, window.smDemo, and passes `pnpm tsx scripts/blog-video.ts validate`.
- [ ] Every caption and callout traces to a sentence in the post's seed in server/db.ts; the report lists the shot list (name, url, scene, sentence) and the claims list.
- [ ] The commit (that file only) is pushed with `git pull --rebase origin main && git push origin main` (never content-grade); bounded live check (at most 20 tries x 30 s) that https://bilko.run/blog-videos/twelve-places-one-weather-rule-you-set-yourself/ returns 200 and its body contains `data:image/jpeg`; result reported either way.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/index.html

# Implementation notes

Read first: .claude/skills/blog-video/SKILL.md (all — the procedure, including the new Capture step); ~/.claude/agents/demo-video-builder.md `<output_contract>` and `<audio_policy>`; server/db.ts — search for `twelve-places-one-weather-rule-you-set-yourself` for the post body; scripts/blog-video-capture.ts header (shot list format).

Steps: follow the skill. Work in a mktemp -d directory for shots and audio; Kokoro model files are likely already cached from the earlier run (search ~ and ~/.cache before downloading). OutdoorHours has an interactive rule editor and a multi-place view — pick shots that show the exact things the post's sentences describe (use scrollY/actions). Look at each JPEG before using it. Fix validator failures at most 3 rounds, else HALT exit 1. Commit only the html path; a sibling PRD may push concurrently, so retry `git pull --rebase origin main && git push origin main` at most 3 times.

Do not touch: any file other than public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/index.html.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 120 pnpm tsx scripts/blog-video.ts validate public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/index.html && timeout 30 grep -q data:image/jpeg public/blog-videos/twelve-places-one-weather-rule-you-set-yourself/index.html
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
