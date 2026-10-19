---
title: Observability Command: data hook and KPI derivation
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-19T05:10:18.906Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: feature
agentType: dev-lead
dependsOn: [obs-cmd-theme-types]
planId: pl-mvesovks-793ac7
---
# Goal

primitive: One hook that loads every existing admin observability source for the selected window with visibility-aware polling, and a pure function that derives the 9 KPI tiles and the status LED from that data. Spec: docs/design/observability-command/README.md sections "KPI strip", "Page frame" (status LED, refresh default) and "Data reuse rules".

# Acceptance criteria

- [ ] src/pages/admin/command/useCommandData.ts exports `useCommandData({ days, refreshMs, enabled })` that fetches /admin/traffic?days, /admin/flows?days (clamped 1-30), /admin/egress?days, /admin/blog-cadence and /admin/observability in parallel via useAdminFetch, returning per-source { data, error } plus lastOkAt, failed (last refresh had any error), reload().
- [ ] Polling matches ObservabilityPage.tsx lines 117-144: interval only while the tab is visible, one immediate reload on regaining visibility, no interval when refreshMs is 0; a failing source keeps its last good data.
- [ ] useCommandData.ts exports pure `deriveKpis(traffic, flows, egress, blog)` returning the 9 tiles (label, value, sub, tone, optional spark number[]) exactly as the README KPI table specifies, tolerating any null input with '—' values.
- [ ] useCommandData.ts exports pure `deriveStatus(obs, failed)` returning {label:'ONLINE'|'N ALERTS'|'STALE', tone}, counting alerts as sum of rows[].openAlerts plus globalAlerts (when present).
- [ ] tests/obs-command-kpis.test.ts covers deriveKpis (bot % math, top erroring app, egress top-slug share, blog cadence tone, all-null input) and deriveStatus (ok, alerts incl. globalAlerts, stale).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/command/useCommandData.ts
- tests/obs-command-kpis.test.ts

# Implementation notes

Read first:
- docs/design/observability-command/README.md (KPI strip; Page frame; Data reuse rules).
- src/hooks/useAdmin.ts (useAdminFetch, useAdminResource signatures).
- src/pages/admin/ObservabilityPage.tsx lines 51-63 and 117-144 (refresh rationale + visibility polling).
- src/pages/admin/command/types.ts and theme.tsx (from obs-cmd-theme-types).
Steps:
1. Write tests/obs-command-kpis.test.ts first against the pure functions.
2. Implement src/pages/admin/command/useCommandData.ts. Paths passed to useAdminFetch follow how existing panels/useAdminResource build them (read useAdmin.ts to see whether the '/api' prefix is added for you).
Work as the dev-lead persona.

# Out of scope

- Sessions list/detail, visitor timeline and egress drilldown fetches (modules own those).
- Any server change.

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/obs-command-kpis.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
