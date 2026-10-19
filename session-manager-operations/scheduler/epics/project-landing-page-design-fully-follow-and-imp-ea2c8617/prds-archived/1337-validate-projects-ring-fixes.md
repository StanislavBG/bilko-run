---
title: Validate: /projects ring spines are outlined and fill the space, live on bilko.run
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T23:16:22.415Z
sourcePromptId: project-landing-page-design-fully-follow-and-imp-ea2c8617
tag: build
agentType: validator
dependsOn: [projects-ring-outline-fix, projects-ring-fill-space, projects-ring-fixes-publish]
planId: pl-mv7ari6l-84023b
---
# Goal

validate: the ring fix wave — projects-ring-outline-fix (restore spine/button outlines), projects-ring-fill-space (side spines fill the space), projects-ring-fixes-publish (push + verify live). Owner-reported bug: side items had no outlines and did not fill the space beside the hero.

# Acceptance criteria

- [ ] projects-ring-outline-fix verified against /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/project-landing-page-design-fully-follow-and-imp-ea2c8617/prds/1334-projects-ring-outline-fix.md (or prds-archived/).
- [ ] projects-ring-fill-space verified against .../prds/1335-projects-ring-fill-space.md (or prds-archived/).
- [ ] projects-ring-fixes-publish verified against .../prds/1336-projects-ring-fixes-publish.md (or prds-archived/), including a live 1440x900 screenshot of https://bilko.run/projects showing outlined spines filling both sides.
- [ ] Write and commit session-manager-operations/reviews/validation/project-landing-page-design-fully-follow-and-imp-ea2c8617/validate-projects-ring-fixes.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/project-landing-page-design-fully-follow-and-imp-ea2c8617/validate-projects-ring-fixes.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 42e173477ff7ea0d637fd44b07a1bd570f4a5fa5

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
