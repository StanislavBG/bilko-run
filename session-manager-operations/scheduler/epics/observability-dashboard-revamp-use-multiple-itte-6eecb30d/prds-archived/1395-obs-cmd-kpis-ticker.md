---
title: Observability Command: KPI strip and recent-hits ticker
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-19T05:21:10.245Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: feature
agentType: dev-lead
dependsOn: [obs-cmd-data-kpis]
planId: pl-mvesovks-793ac7
---
# Goal

feature: Render the 9-tile KPI strip and the recent-hits ticker from the design (README sections "KPI strip" and "Page frame" ticker; prototype lines 63-102, 467-472, 692-702), fed by deriveKpis from useCommandData.ts and traffic.recent.

# Acceptance criteria

- [ ] src/pages/admin/command/KpiStrip.tsx exports `KpiStrip({ tiles })` rendering a 9-column grid of tiles per prototype lines 64-101 (label, big value, sub-label colored by tone, 7-bar sparkline when tile.spark is set, red error-tile styling when tone is 'err').
- [ ] src/pages/admin/command/KpiStrip.tsx also exports `Ticker({ recent })` rendering traffic.recent items (HH:MM:SS, status green <400 red >=400, path amber when bot, country, device/browser/os, BOT or 4xx badge) duplicated and scrolling with a 50s linear infinite keyframe, plus the right-side hint '1–7 SWAP · F FOCUS · ESC'.
- [ ] The ticker animation is disabled under prefers-reduced-motion and the keyframes are injected once (no duplicate <style> on re-render).
- [ ] Empty recent list renders 'no hits in window' instead of an empty strip.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/command/KpiStrip.tsx

# Implementation notes

Read first:
- docs/design/observability-command/README.md (KPI strip; Page frame).
- docs/design/observability-command/Observability Command.dc.html lines 63-102, 467-472, 692-702.
- src/pages/admin/command/useCommandData.ts (deriveKpis tile shape, from obs-cmd-data-kpis) and theme.tsx/types.ts.
Work as the dev-lead persona.

# Out of scope

- Changing deriveKpis.
- Page wiring.

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
