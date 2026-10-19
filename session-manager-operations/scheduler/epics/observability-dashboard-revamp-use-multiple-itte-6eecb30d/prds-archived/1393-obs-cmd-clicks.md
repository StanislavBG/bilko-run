---
title: Observability Command: 06 Top clicks module
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-19T05:18:33.370Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: feature
agentType: dev-lead
dependsOn: [obs-cmd-theme-types]
planId: pl-mvesovks-793ac7
---
# Goal

feature: Implement module 06 Top clicks per docs/design/observability-command/README.md section "06 Top clicks" and prototype lines 385-415 from /api/admin/traffic topClicks.

# Acceptance criteria

- [ ] src/pages/admin/command/ClicksModule.tsx exports `ClicksModule({ stage, traffic })`; stage renders the PAGE / ELEMENT / TARGET / CLICKS / UV table per prototype lines 389-401 with ELEMENT = label or tag when label is empty, TARGET = href path or '—', and a 6px orange bar proportional to the max clicks.
- [ ] Compact renders the top 6 with label, page, count and a 3px bar (prototype lines 404-412).
- [ ] Exports `clicksSubtitle(traffic)` returning '{totals.clicks} total'.
- [ ] Loading, error and empty ('no clicks in window') states render inside the module.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/command/ClicksModule.tsx

# Implementation notes

Read first:
- docs/design/observability-command/README.md (Tokens; 06 Top clicks).
- docs/design/observability-command/Observability Command.dc.html lines 385-415 and 689.
- src/pages/admin/command/theme.tsx and types.ts (from obs-cmd-theme-types).
Work as the dev-lead persona.

# Out of scope

- Server changes.

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
