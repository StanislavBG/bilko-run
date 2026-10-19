---
title: Observability Command: retire legacy observability panels and update docs
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-19T05:25:31.692Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: feature
agentType: dev-lead
dependsOn: [obs-cmd-page-wire]
planId: pl-mvepeuhy-686687
---
# Goal

migration: After the console is wired, delete the five legacy panel components that only ObservabilityPage used, and update the two docs that describe the old page so they match the new console.

# Acceptance criteria

- [ ] src/pages/admin/SessionsPanel.tsx, FlowsPanel.tsx, TrafficPanel.tsx, BandwidthPanel.tsx and BlogCadencePanel.tsx are deleted, after confirming with rg that nothing in src/ or tests/ imports them (DriftBadge.tsx and SessionPlayer.tsx stay).
- [ ] docs/observability.md section 7 'Verify' names the new modules (02 Sessions journey, 03 App health tile -> detail sheet funnels) instead of the old Sessions/Flows panels.
- [ ] docs/host-internals.md's /admin/observability description says it is the Observability Command console (full-viewport, 7 swappable modules, KPI strip, ticker), refresh default 5m, design source docs/design/observability-command/.
- [ ] `pnpm typecheck` and `pnpm test` pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/SessionsPanel.tsx
- src/pages/admin/FlowsPanel.tsx
- src/pages/admin/TrafficPanel.tsx
- src/pages/admin/BandwidthPanel.tsx
- src/pages/admin/BlogCadencePanel.tsx
- docs/observability.md
- docs/host-internals.md

# Implementation notes

Read first:
- docs/observability.md lines 84-95 (section 7) and docs/host-internals.md lines 125-150.
- docs/design/observability-command/README.md (module names).
Steps:
1. rg -n 'SessionsPanel|FlowsPanel|TrafficPanel|BandwidthPanel|BlogCadencePanel' src tests  (expect matches only in the files being deleted; if anything else imports one, keep that file and say so).
2. git rm the five files; edit the two docs.
Work as the dev-lead persona.

# Out of scope

- Changing any server route or the new command modules.

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 600 pnpm test
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
