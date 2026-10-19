---
title: Validate: Blog posts can carry a 30-second video and annotated images, with a one-click Blog Video macro
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T21:34:13.599Z
sourcePromptId: blog-shold-include-images-annotated-or-even-shor-18d2b557
tag: build
agentType: validator
dependsOn: [blog-video-discovery-api, blog-video-csp-fence, blog-video-cli, blog-video-player, blog-markdown-links-figures, blog-video-skill, blog-video-first-iteration]
planId: pl-mv1hdjm5-02147b
---
# Goal

Validate the plan: blog-video-discovery-api (Blog API exposes video_url), blog-video-csp-fence (sandboxed CSP for /blog-videos/), blog-video-cli (validate + next CLI), blog-video-player (consistent BlogVideoPlayer + Video badge), blog-markdown-links-figures (links + annotated image figures), blog-video-skill (Blog Video skill), blog-video-first-iteration (first video for twelve-places-one-weather-rule-you-set-yourself, live).

# Acceptance criteria

- [ ] blog-video-discovery-api: verify against its PRD file (find by slug under /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/blog-shold-include-images-annotated-or-even-shor-18d2b557/prds/ or prds-archived/).
- [ ] blog-video-csp-fence: verify against its PRD file (same location).
- [ ] blog-video-cli: verify against its PRD file (same location).
- [ ] blog-video-player: verify against its PRD file (same location); include a screenshot of a post page with the player poster and after click, served by the local dev server.
- [ ] blog-markdown-links-figures: verify against its PRD file (same location); a real post's links render as anchors.
- [ ] blog-video-skill: verify against its PRD file (same location).
- [ ] blog-video-first-iteration: verify against its PRD file (same location), including the live https://bilko.run/blog/twelve-places-one-weather-rule-you-set-yourself showing the player and the video playing.
- [ ] Write and commit session-manager-operations/reviews/validation/blog-shold-include-images-annotated-or-even-shor-18d2b557/validate-blog-video.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/blog-shold-include-images-annotated-or-even-shor-18d2b557/validate-blog-video.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: cb9feb41391c924d483d68e111febc9806a02683

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
