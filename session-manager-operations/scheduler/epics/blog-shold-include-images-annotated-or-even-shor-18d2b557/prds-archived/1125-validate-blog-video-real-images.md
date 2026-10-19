---
title: Validate: Blog Video macro uses real, annotated product screenshots (2 videos regenerated)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:07:13.018Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
tag: build
agentType: validator
dependsOn: [blog-video-capture, blog-video-skill-real-images, blog-video-regen-twelve-places, blog-video-github-heatmap]
planId: pl-mv1kpii3-ddbdea
---
# Goal

Validate the plan: blog-video-capture (allow-listed screenshot capture script), blog-video-skill-real-images (skill builds scenes on real annotated screenshots), blog-video-regen-twelve-places (OutdoorHours post video regenerated), blog-video-github-heatmap (git-viewer post video created).

# Acceptance criteria

- [ ] blog-video-capture: verify against its PRD file (find by slug under /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/blog-shold-include-images-annotated-or-even-shor-18d2b557/prds/ or prds-archived/); confirm the host allow-list cannot be bypassed.
- [ ] blog-video-skill-real-images: verify against its PRD file (same location).
- [ ] blog-video-regen-twelve-places: verify against its PRD file (same location); extract the embedded JPEGs and confirm each is a real OutdoorHours page (not an error/blank screen); screenshot the live post with the video playing at 3 different seek times.
- [ ] blog-video-github-heatmap: verify against its PRD file (same location); same image and live checks for git-viewer.
- [ ] Write and commit session-manager-operations/reviews/validation/blog-shold-include-images-annotated-or-even-shor-18d2b557/validate-blog-video-real-images.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/blog-shold-include-images-annotated-or-even-shor-18d2b557/validate-blog-video-real-images.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: f6c830b41387627d97916c1af828bf4c1472dae1

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
