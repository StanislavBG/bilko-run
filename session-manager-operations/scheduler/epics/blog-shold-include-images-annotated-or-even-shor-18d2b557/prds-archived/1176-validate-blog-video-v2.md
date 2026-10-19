---
title: Validate: Blog videos v2 tell the post's story with real product motion and a consistent look
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-10T02:06:15.165Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
tag: build
agentType: validator
dependsOn: [blog-video-runtime, blog-video-capture-clips, blog-video-validator-v2, blog-video-frames, blog-video-builder, blog-video-skill-v2, blog-video-v2-twelve-places, blog-video-v2-github-heatmap]
planId: pl-mv1qzmib-d18503
---
# Goal

Validate the plan: blog-video-runtime (shared player template), blog-video-capture-clips (real motion clips + navigation allow-list fix), blog-video-validator-v2 (4 MB cap, voice marker, grounding check), blog-video-frames (contact sheet + blank-frame detector), blog-video-builder (storyboard → video), blog-video-skill-v2 (story-first skill), blog-video-v2-twelve-places and blog-video-v2-github-heatmap (both videos regenerated).

# Acceptance criteria

- [ ] blog-video-runtime: verify against its PRD file (find by slug under /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/blog-shold-include-images-annotated-or-even-shor-18d2b557/prds/ or prds-archived/).
- [ ] blog-video-capture-clips: verify against its PRD file (same location); confirm an off-list redirect/click navigation is aborted.
- [ ] blog-video-validator-v2: verify against its PRD file (same location).
- [ ] blog-video-frames: verify against its PRD file (same location).
- [ ] blog-video-builder: verify against its PRD file (same location).
- [ ] blog-video-skill-v2: verify against its PRD file (same location).
- [ ] blog-video-v2-twelve-places: verify against its PRD file (same location); view the contact sheet yourself and judge it against the skill's rubric; confirm the two videos share the same visual system.
- [ ] blog-video-v2-github-heatmap: verify against its PRD file (same location); same contact-sheet and live checks (https://bilko.run/blog/turn-your-github-year-into-a-heatmap-and-badge-wall plays).
- [ ] Write and commit session-manager-operations/reviews/validation/blog-shold-include-images-annotated-or-even-shor-18d2b557/validate-blog-video-v2.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/blog-shold-include-images-annotated-or-even-shor-18d2b557/validate-blog-video-v2.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 4ec00f0eb79b30224bdd2c29770164ce42409d7a

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
