---
title: Validate: /projects hero shows each project's X share card, live
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-14T02:02:16.438Z
sourcePromptId: project-landing-page-design-fully-follow-and-imp-ea2c8617
tag: build
agentType: validator
dependsOn: [projects-ring-og-image, projects-ring-og-publish]
planId: pl-mv7grr9n-107a88
---
# Goal

validate: projects-ring-og-image (hero image = /og/<slug>.png, the same card X shows) and projects-ring-og-publish (push + verify live). Owner ask: use the same image that shows on an X link preview for every project.

# Acceptance criteria

- [ ] projects-ring-og-image verified against /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/project-landing-page-design-fully-follow-and-imp-ea2c8617/prds/1342-projects-ring-og-image.md (or prds-archived/), including that the hero src equals the og:image path in that project's live page meta (compare at least 2 projects, ignoring the ?v= query).
- [ ] projects-ring-og-publish verified against .../prds/<NN>-projects-ring-og-publish.md (find by slug; or prds-archived/), including a live screenshot of https://bilko.run/projects with the share card in the hero.
- [ ] Write and commit session-manager-operations/reviews/validation/project-landing-page-design-fully-follow-and-imp-ea2c8617/validate-projects-ring-og.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/project-landing-page-design-fully-follow-and-imp-ea2c8617/validate-projects-ring-og.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: a3d40ce76530f530ed9ad772e2b971c78b48de4b

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
