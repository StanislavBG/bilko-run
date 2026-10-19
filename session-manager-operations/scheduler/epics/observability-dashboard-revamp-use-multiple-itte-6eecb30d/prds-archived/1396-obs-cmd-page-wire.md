---
title: Observability Command: wire the console into /admin/observability (full-bleed)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-19T05:23:48.019Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: feature
agentType: dev-lead
dependsOn: [obs-cmd-shell, obs-cmd-data-kpis, obs-cmd-globe, obs-cmd-sessions, obs-cmd-apps, obs-cmd-traffic, obs-cmd-audience, obs-cmd-clicks, obs-cmd-bandwidth, obs-cmd-kpis-ticker, observability-global-alerts-once]
planId: pl-mvepeuhy-686687
---
# Goal

wire: Replace the body of ObservabilityPage with the Observability Command console: CommandShell + KpiStrip + Ticker + the seven modules, fed by useCommandData, and render the route outside the site Layout so it is full-viewport as designed. Spec: docs/design/observability-command/README.md (Page frame, Main grid, Data reuse rules).

# Acceptance criteria

- [ ] src/pages/admin/ObservabilityPage.tsx keeps its admin guard (redirect non-admins to '/', loading text until Clerk loads) and document.title, and renders CommandShell with window (default 7D) and refresh (default 5M) state passed to useCommandData({ days, refreshMs, enabled: isAdmin }).
- [ ] Every module from src/pages/admin/command/ is rendered through the shell's render(key, stage) prop with its data slice; shell headers use the modules' subtitle helpers (appsSubtitle, clicksSubtitle, trafficSubtitle) and the status LED uses deriveStatus.
- [ ] The Globe receives pingCountries = countries of traffic.recent hits whose ts is newer than the previous successful traffic fetch (empty on first load).
- [ ] src/App.tsx moves only the /admin/observability route outside <Layout /> (next to the existing outside-Layout routes near line 228, still via lazyRoute(ObservabilityPage)); every other route is unchanged.
- [ ] The page no longer imports SessionsPanel, FlowsPanel, TrafficPanel, BandwidthPanel or BlogCadencePanel; `pnpm typecheck` and `pnpm test` pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/ObservabilityPage.tsx
- src/App.tsx

# Implementation notes

Read first:
- docs/design/observability-command/README.md.
- src/pages/admin/ObservabilityPage.tsx (whole file; 1383 already changed openAlertCount/globalAlerts types here).
- src/App.tsx lines 170-260 (Layout wrapper at ~176, outside-Layout precedent at ~228).
- src/pages/admin/command/*.tsx and useCommandData.ts (all landed by the dependency PRDs; read their exported props before wiring).
Steps:
1. Rewrite ObservabilityPage.tsx to compose the console. Keep export name `ObservabilityPage`.
2. Move the route in App.tsx.
3. Run timeout 300 pnpm test last.
Work as the dev-lead persona.

# Out of scope

- Deleting legacy panel files (obs-cmd-retire-legacy).
- Changing module internals beyond prop-shape fixes required to compile.

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
