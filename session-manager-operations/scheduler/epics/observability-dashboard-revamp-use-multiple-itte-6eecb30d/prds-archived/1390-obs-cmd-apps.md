---
title: Observability Command: 03 App health module with app detail sheet
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-19T05:12:15.006Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: feature
agentType: dev-lead
dependsOn: [obs-cmd-theme-types]
planId: pl-mvesovks-793ac7
---
# Goal

feature: Implement module 03 App health per docs/design/observability-command/README.md section "03 App health" and prototype lines 226-259 and 682-688: heat-tinted app tiles from /api/admin/flows apps merged with /api/admin/observability rows, plus an in-module detail sheet that keeps funnels and manifest/synthetic/drift data reachable.

# Acceptance criteria

- [ ] src/pages/admin/command/AppsModule.tsx exports `AppsModule({ stage, flows, obs })` and pure `appTiles(flows, obs, nowMs)` producing per-app {name, sessions, views, clicks, events, errors, led, bg, border, status, statusTone} with the README LED rules (errors -> red, last seen within 48h -> green, else idle) and heat formula act = min(1, sqrt((s+v+c+e/10)/400)).
- [ ] Stage: 5-column tile grid matching prototype lines 231-245 (LED, name, big sessions number, VIEW/CLK/EVT/ERR, status line), apps sorted by sessions desc; manifest-only apps from obs.rows with no flow data still appear as idle tiles.
- [ ] Clicking a tile on stage opens a detail sheet inside the module (close button and Esc-safe) showing that app's funnels from flows.flows (step, sessions, % of first step, bar) and manifest facts from obs.rows (version, git sha, host-kit drift via DriftBadge colors, synthetic passes/fails and avg/max load, bundle size, latest error, open alerts).
- [ ] Compact: mini tiles with LED and name only (prototype lines 249-256).
- [ ] Exports `appsSubtitle(tiles)` returning '{n} erroring' (err tone) or '{n} apps' for the shell header; loading, error and empty states render inside the module.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/command/AppsModule.tsx

# Implementation notes

Read first:
- docs/design/observability-command/README.md (Tokens; 03 App health).
- docs/design/observability-command/Observability Command.dc.html lines 226-259 and 682-688.
- src/pages/admin/FlowsPanel.tsx (funnel math lines 144-181) and src/pages/admin/ObservabilityPage.tsx lines 13-37, 72-105 (row fields, formatters) and src/pages/admin/DriftBadge.tsx.
- src/pages/admin/command/theme.tsx and types.ts (from obs-cmd-theme-types).
Note: 'synthetic.loadP50' is really AVG(load_ms) and 'loadP95' is MAX; label them avg/max.
Work as the dev-lead persona.

# Out of scope

- Server changes.
- Editing FlowsPanel.tsx or DriftBadge.tsx.

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
