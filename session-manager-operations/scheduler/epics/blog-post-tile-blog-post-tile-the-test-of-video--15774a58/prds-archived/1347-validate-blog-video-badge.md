---
title: Validate: Blog list Video badge renders on one line
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-17T23:39:42.521Z
sourcePromptId: blog-post-tile-blog-post-tile-the-test-of-video--15774a58
tag: build
agentType: validator
dependsOn: [blog-list-video-badge-one-line]
planId: pl-mvd1e1j1-497c80
---
# Goal

validate: Validate the plan's single PRD, blog-list-video-badge-one-line ("Blog list: keep the ▶ Video badge on one line, stacked under the category").

# Acceptance criteria

- [ ] blog-list-video-badge-one-line: every acceptance criterion in $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/blog-post-tile-blog-post-tile-the-test-of-video--15774a58/prds/1346-blog-list-video-badge-one-line.md (or prds-archived/ once done; find it by slug) is verified against the tree, and its gate re-runs green.
- [ ] Write and commit session-manager-operations/reviews/validation/blog-post-tile-blog-post-tile-the-test-of-video--15774a58/validate-blog-video-badge.md

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/blog-post-tile-blog-post-tile-the-test-of-video--15774a58/validate-blog-video-badge.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: d161d3c306fc58cc88a73bb4f42b4eed6f56893f

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
