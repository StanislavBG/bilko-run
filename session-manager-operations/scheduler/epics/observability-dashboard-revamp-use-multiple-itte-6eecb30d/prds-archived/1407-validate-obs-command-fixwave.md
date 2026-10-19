---
title: Validate: Observability Command design-fidelity fix wave
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-19T08:18:05.860Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: build
agentType: validator
dependsOn: [obs-cmd-fix-donut-appstats, obs-cmd-fix-brand-sesscount, obs-cmd-vite-ignore-scheduler]
planId: pl-mvez9z69-034b05
---
# Goal

validate: Verify the fix wave for the Observability Command console. PRDs: 1406 obs-cmd-fix-donut-appstats, 1404 obs-cmd-fix-brand-sesscount, 1405 obs-cmd-vite-ignore-scheduler. Before judging, run `CI=true pnpm install --frozen-lockfile` in the main checkout if node_modules lacks vitest. The previous validator could not re-run any gate for that reason.

# Acceptance criteria

- [ ] Each PRD file lives under /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/observability-dashboard-revamp-use-multiple-itte-6eecb30d/prds/ while queued, or prds-archived/ (possibly a timestamped subfolder) once done; find it by slug.
- [ ] obs-cmd-fix-donut-appstats VERIFIED or REFUTED, with its gate re-run.
- [ ] obs-cmd-fix-brand-sesscount VERIFIED or REFUTED, with its gate re-run.
- [ ] obs-cmd-vite-ignore-scheduler VERIFIED or REFUTED, with its gate re-run.
- [ ] Write and commit session-manager-operations/reviews/validation/observability-dashboard-revamp-use-multiple-itte-6eecb30d/validate-obs-command-fixwave.md with one verdict per PRD and findings.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/observability-dashboard-revamp-use-multiple-itte-6eecb30d/validate-obs-command-fixwave.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 837d52ad

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
