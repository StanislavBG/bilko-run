---
title: Observability Command: shared types and design theme primitives
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-19T05:09:38.908Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: feature
agentType: dev-lead
disposition: new-head
planId: pl-mvesovks-793ac7
---
# Goal

primitive: Create the shared foundation every Observability Command module imports: typed response interfaces for the existing admin endpoints, and the design's tokens plus small presentational primitives. The spec is docs/design/observability-command/README.md (Tokens, Module header, Data reuse rules) and the prototype docs/design/observability-command/Observability Command.dc.html.

# Acceptance criteria

- [ ] src/pages/admin/command/types.ts exports interfaces TrafficData, VisitorTimeline, SessionRow, SessionsList, SessionDetail, FlowsData, EgressData, BlogCadence, ObservabilityData (rows incl. openAlerts, optional globalAlerts, desktopApps, env, latestKit, generatedAt) matching the server response shapes field-for-field, plus `type ModuleKey = 'globe'|'sessions'|'apps'|'traffic'|'audience'|'clicks'|'bandwidth'` and `MODULES` (ordered array with num '01'..'07', title, default subtitle).
- [ ] src/pages/admin/command/theme.tsx exports `C` (every color token in the README Tokens table), `FONT` ({ sans: Inter Tight stack, mono: JetBrains Mono stack, serif: Source Serif 4 stack }), and `useCommandFonts()` which appends one Google Fonts <link> for Inter Tight 400-700, JetBrains Mono 400-600, Source Serif 4 (idempotent, no duplicate on re-mount).
- [ ] theme.tsx exports components `Seg` (segmented control: options, value, onChange; active bg #f26a2e fg #0b0907, inactive transparent/#9c937f; clicks stopPropagation), `MonoLabel`, `UnderlineBar` (2px absolute bar with width % and color), `Donut` (conic-gradient ring: segments [{label,value,color}], size, inset, center label), and `StatusLine` helpers, all styled per the prototype.
- [ ] theme.tsx exports formatters fmtNum (en-US grouping), fmtMB (bytes -> '336.4 MB' / '12 KB'), fmtDur (ms -> 'm:ss'), fmtClock (Date -> 'HH:MM:SS' 24h), fmtDay (ms -> 'MM/DD'); fmtMB reuses formatBytes from src/lib/format.ts where it fits.
- [ ] No existing file is modified; `pnpm typecheck` passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/command/types.ts
- src/pages/admin/command/theme.tsx

# Implementation notes

Read first:
- docs/design/observability-command/README.md (whole file, it is short).
- docs/design/observability-command/Observability Command.dc.html lines 25-61 (top bar segs), 109 (module header), 338 (donut), 652 (seg colors).
- src/pages/admin/TrafficPanel.tsx lines 59-74 (traffic response shape), src/pages/admin/SessionsPanel.tsx lines 7-32, src/pages/admin/FlowsPanel.tsx lines 6-18, src/pages/admin/BandwidthPanel.tsx lines 7-19, src/pages/admin/BlogCadencePanel.tsx lines 6-12, src/pages/admin/ObservabilityPage.tsx lines 13-43, server/routes/admin-observability.ts line ~185 (returned object), server/routes/admin-sessions.ts (sessions list/detail return objects; detail returns {session, timeline, apps}).
Steps:
1. Create src/pages/admin/command/types.ts. For SessionDetail.timeline import `TimelineItem` from src/lib/sessionSteps.ts rather than redefining it.
2. Create src/pages/admin/command/theme.tsx with the exports in the criteria. Inline styles (style={{...}}) are the house idiom for this design; Tailwind arbitrary values are fine too.
Work as the dev-lead persona.

# Out of scope

- Any module UI, data fetching, or page wiring.
- Editing the legacy panels.

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
