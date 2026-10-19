---
title: Validate: /projects rebuilt as the Projects Ring design and live on bilko.run
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T21:13:13.771Z
sourcePromptId: project-landing-page-design-fully-follow-and-imp-ea2c8617
tag: build
agentType: validator
dependsOn: [projects-ring-math, projects-ring-page, projects-ring-polish, projects-ring-publish-live]
planId: pl-mv76eacb-9e320f
---
# Goal

validate: verify the Projects Ring plan — projects-ring-math (pure geometry + view-model helpers), projects-ring-page (rebuild /projects as ring + hero + scrubber), projects-ring-polish (mobile, a11y, reduced motion, ?p= deep link, dead CSS), projects-ring-publish-live (push to origin main and verify live). Design spec: docs/design/projects-ring/.

# Acceptance criteria

- [ ] projects-ring-math verified against /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/project-landing-page-design-fully-follow-and-imp-ea2c8617/prds/1329-projects-ring-math.md (or prds-archived/ beside it).
- [ ] projects-ring-page verified against .../prds/1330-projects-ring-page.md (or prds-archived/), including a fidelity check of the rendered page against docs/design/projects-ring/README.md.
- [ ] projects-ring-polish verified against .../prds/1331-projects-ring-polish.md (or prds-archived/).
- [ ] projects-ring-publish-live verified against .../prds/1332-projects-ring-publish-live.md (or prds-archived/): origin/main contains the ring commits and scripts/verify-live-marker.ts pr-stage exits 0 against production.
- [ ] Write and commit session-manager-operations/reviews/validation/project-landing-page-design-fully-follow-and-imp-ea2c8617/validate-projects-ring.md.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/project-landing-page-design-fully-follow-and-imp-ea2c8617/validate-projects-ring.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: c66fcacb56b4e3922866da5a0280d321e17a63a5

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
