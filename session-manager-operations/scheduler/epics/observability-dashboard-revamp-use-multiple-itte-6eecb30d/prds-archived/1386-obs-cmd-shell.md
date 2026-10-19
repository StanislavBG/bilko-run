---
title: Observability Command: layout shell (rails/dock/wing, swap, focus, keys)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-19T05:10:04.926Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: feature
agentType: dev-lead
dependsOn: [obs-cmd-theme-types]
planId: pl-mvesovks-793ac7
---
# Goal

primitive: Build the full-viewport command console frame from the design: top bar, KPI slot, 7-module grid with stage/rail swapping across the rails/dock/wing/max layouts, keyboard control, and ticker slot. Spec: docs/design/observability-command/README.md sections "Page frame" and "Main grid and module mechanics"; prototype lines 25-61, 104-109, 467-552, 640-651, 703-711.

# Acceptance criteria

- [ ] src/pages/admin/command/CommandShell.tsx exports pure functions `swapToStage(pos, key)` (exchanges the key's slot with the current stage module; no-op if already on stage) and `layoutGrid(layout, max)` returning {cols, rows, slots} copied exactly from the prototype LAY table, plus `DEFAULT_POS`.
- [ ] CommandShell renders the top bar (brand, LAYOUT/WINDOW/REFRESH `Seg`s, FOCUS/RESTORE button, status LED with label+tone from props, live 24h clock, SESSION VIEW link to /admin/sessions), a `kpis` ReactNode slot, the grid, a `ticker` ReactNode slot, and the scanline overlay, with tokens from theme.tsx.
- [ ] Each module is rendered inside a frame with the 28px header (num, title, subtitle+tone from props, hint `ON STAGE · F` / `FOCUSED · ESC` / `[n] ⤢`), `view-transition-name: m-<key>`, stage outline, click-to-swap on rails; module bodies come from a `render(key, stage: boolean)` prop.
- [ ] Keys 1-7 swap, F toggles max, Esc restores (ignored when focus is in INPUT/TEXTAREA); swaps and layout changes use document.startViewTransition when available; layout, positions and window persist in localStorage under 'obs-cmd:v1' with try/catch.
- [ ] Window and refresh are controlled props (value + onChange) so the page owns data fetching; prefers-reduced-motion skips view transitions.
- [ ] tests/obs-command-layout.test.ts covers swapToStage (swap, no-op on stage, every key ends in exactly one slot) and layoutGrid for rails, dock, wing and max.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/command/CommandShell.tsx
- tests/obs-command-layout.test.ts

# Implementation notes

Read first:
- docs/design/observability-command/README.md (Page frame; Main grid and module mechanics).
- docs/design/observability-command/Observability Command.dc.html lines 25-61, 104-109, 467-475, 478-552, 640-651, 703-711.
- src/pages/admin/command/theme.tsx and types.ts (landed by obs-cmd-theme-types; read them first, use C, FONT, Seg, MODULES, ModuleKey).
Steps:
1. Write tests/obs-command-layout.test.ts first (vitest, node env; import only the pure functions).
2. Create src/pages/admin/command/CommandShell.tsx. Props: { layout, onLayout?, window: '1D'|'7D'|'30D', onWindow, refresh: '30S'|'1M'|'5M'|'OFF', onRefresh, status: {label, tone:'ok'|'warn'|'err'}, kpis: ReactNode, ticker: ReactNode, headers: Record<ModuleKey,{sub:string; tone?:'muted'|'err'}>, render: (key, stage) => ReactNode }. Shell owns layout/pos/max state (persisted). Root: position fixed inset 0 is NOT needed; the page route will be outside Layout, so use width 100vw height 100vh min 1280x760 per prototype line 25, with overflow auto on the outer wrapper so smaller screens can scroll.
3. Call useCommandFonts() on mount.
Work as the dev-lead persona.

# Out of scope

- Data fetching, module bodies, KPI tiles, ticker contents.
- Routing changes.

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/obs-command-layout.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
