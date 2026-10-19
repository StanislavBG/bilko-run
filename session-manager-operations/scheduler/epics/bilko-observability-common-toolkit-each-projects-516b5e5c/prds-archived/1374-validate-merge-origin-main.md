---
title: Validate: observability work merged with origin/main and ready to deploy
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-18T23:03:09.174Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
tag: build
agentType: validator
dependsOn: [merge-origin-main-observability]
planId: pl-mvefl71z-495c68
---
# Goal

validate: verify PRD merge-origin-main-observability (merging origin/main into main and resolving the README, UnpublishedProjectPage and spa-fallback test conflicts).

# Acceptance criteria

- [ ] merge-origin-main-observability: the PRD file under $SM_PROJECT_ROOT/session-manager-operations/scheduler/epics/bilko-observability-common-toolkit-each-projects-516b5e5c/prds/ (or prds-archived/), found by slug, is VERIFIED. That means origin/main is an ancestor of HEAD, both sides of each conflict are preserved, no conflict markers remain, and the gate is green.
- [ ] Write and commit session-manager-operations/reviews/validation/bilko-observability-common-toolkit-each-projects-516b5e5c/validate-merge-origin-main.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/bilko-observability-common-toolkit-each-projects-516b5e5c/validate-merge-origin-main.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 841183c43c5891d09f2f087b004382dd43f25a8a

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
