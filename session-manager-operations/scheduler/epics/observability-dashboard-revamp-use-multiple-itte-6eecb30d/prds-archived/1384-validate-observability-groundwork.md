---
title: Validate: Observability alert count reports global alerts once
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-19T03:38:07.653Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: build
agentType: validator
dependsOn: [observability-global-alerts-once]
planId: pl-mvepeuhy-686687
---
# Goal

validate: Verify the groundwork plan for the Observability Dashboard Revamp Epic. PRDs in this plan: 1383 observability-global-alerts-once — "Observability: report global cost alerts once, not once per app row".

# Acceptance criteria

- [ ] observability-global-alerts-once is VERIFIED against its PRD file (find it by slug under /home/bilko/Projects/Bilko/session-manager-operations/scheduler/epics/observability-dashboard-revamp-use-multiple-itte-6eecb30d/prds/ while queued, or prds-archived/ (possibly a timestamped subfolder) beside it once done): its gate re-runs green and every acceptance criterion holds in the tree.
- [ ] Write and commit session-manager-operations/reviews/validation/observability-dashboard-revamp-use-multiple-itte-6eecb30d/validate-observability-groundwork.md with one VERIFIED/REFUTED verdict per PRD and any findings.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/validation/observability-dashboard-revamp-use-multiple-itte-6eecb30d/validate-observability-groundwork.md

# Implementation notes

Work as the validator persona — the procedure is your system prompt.
Base: 6e01caf52b5140db3f4537e167ea0c3482f60995

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
