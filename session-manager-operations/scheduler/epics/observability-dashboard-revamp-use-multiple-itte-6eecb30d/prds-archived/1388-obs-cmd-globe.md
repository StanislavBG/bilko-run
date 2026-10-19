---
title: Observability Command: 01 Globe module (d3 orthographic, real origin data)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 14
createdVia: scheduler-api
issuedAt: 2026-10-19T05:10:41.209Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: feature
agentType: dev-lead
dependsOn: [obs-cmd-theme-types]
planId: pl-mvesovks-793ac7
---
# Goal

feature: Implement module 01 Globe as specified in docs/design/observability-command/README.md section "01 Globe" and prototype lines 107-143 and 554-627: a canvas orthographic globe of real traffic origins from /api/admin/traffic byCountry, with stage and compact renderings. Land data and the projection are bundled locally (no CDN fetch).

# Acceptance criteria

- [ ] package.json adds dependencies d3-geo, topojson-client, world-atlas and devDependencies @types/d3-geo, @types/topojson-client; pnpm-lock.yaml updated by pnpm install.
- [ ] src/pages/admin/command/GlobeModule.tsx exports `GlobeModule({ stage, traffic, pingCountries })` (traffic: TrafficData | null; pingCountries: string[] of country codes for new hits since the previous fetch) and draws the prototype frame() layers in order: dot-grid land (computed once, module-level cache, chunked so it never blocks), graticule, glow + rotating tick ring, country pulses sized by sqrt(hits), dashed amber arcs from the top 14 countries to HOME [-122.4, 37.8], green origin square, top-10 labels on stage.
- [ ] Country centroids: an exported ISO-3166 alpha-2 -> [lon, lat] map covering every country (not only the prototype's 22), defined inside GlobeModule.tsx; unknown or null codes are skipped.
- [ ] Stage overlay (top-12 rows with bars, '+N more' line, top-right ARCS/PINGS/DRAG text, legend) and compact overlay (top 3) match prototype lines 112-141; drag-to-rotate only on stage with tilt clamped to +/-60.
- [ ] No simulated pings: a ping animates only for codes in pingCountries; prefers-reduced-motion disables autorotate and pulse animation; requestAnimationFrame and listeners are cleaned up on unmount; world-atlas land-110m is loaded via dynamic import so it stays out of the main bundle.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/command/GlobeModule.tsx
- package.json
- pnpm-lock.yaml

# Implementation notes

Read first:
- docs/design/observability-command/README.md (Tokens; 01 Globe).
- docs/design/observability-command/Observability Command.dc.html lines 107-143 and 554-627 (port this rendering code to TypeScript; replace this.D.countries with traffic.byCountry sorted desc).
- src/pages/admin/command/theme.tsx and types.ts (from obs-cmd-theme-types).
Steps:
1. pnpm add d3-geo topojson-client world-atlas && pnpm add -D @types/d3-geo @types/topojson-client (world-atlas ships JSON; import 'world-atlas/land-110m.json' dynamically; add a module declaration only if TS needs one, inside GlobeModule.tsx).
2. Create GlobeModule.tsx. Canvas sized by clientWidth/Height with devicePixelRatio capped at 2, as in the prototype.
3. Empty state: when traffic is null show 'loading'; when byCountry is empty show 'no geo data in window'.
Work as the dev-lead persona.

# Out of scope

- Wiring into the page (obs-cmd-page-wire does that).
- Any server change.

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
