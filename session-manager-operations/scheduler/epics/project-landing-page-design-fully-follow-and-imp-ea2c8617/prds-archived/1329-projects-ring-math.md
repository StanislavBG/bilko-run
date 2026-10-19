---
title: Projects Ring: pure geometry + view-model helpers
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-13T21:11:10.043Z
sourcePromptId: project-landing-page-design-fully-follow-and-imp-ea2c8617
agentType: dev-lead
planId: pl-mv76eacb-9e320f
---
# Goal

primitive: add the pure, DOM-free math and view-model helpers for the /projects "Projects Ring" redesign (spec: docs/design/projects-ring/README.md + docs/design/projects-ring/Projects Ring.dc.html), with unit tests. A later PRD renders the page from these helpers; this PRD changes no UI. Also expose the registry's existing optional `thumbnail` on HubCard so the hero can show a real screenshot when one exists.

# Acceptance criteria

- [ ] src/data/projectsRing.ts exports `ringOffset(i: number, active: number, n: number): number` returning ((i-active) mod n) shifted into [-n/2, n/2] exactly like the prototype's `wrap` (e.g. ringOffset(139,0,140) === -1, ringOffset(70,0,140) === 70, ringOffset(0,0,1) === 0).
- [ ] src/data/projectsRing.ts exports `heroBox(stageW: number): { left: number; width: number }` with width = round(clamp(stageW*0.44, 460, 680)) and left = round((stageW-width)/2) (heroBox(1280) → { left: 359, width: 563 } per the prototype's rounding — verify the exact numbers against the prototype formula in the test).
- [ ] src/data/projectsRing.ts exports `spineGeom(k: number, stageW: number, stageH: number, falloff?: number)` returning { x, w, h, opacity, fontPx, hidden } that reproduces the prototype's renderVals ring math verbatim (width 64*f^(j-1), height max(120,stageH-40)*0.95^j, font max(11, round(22*0.93^(j-1))), opacity max(.25, 1-(j-1)*.06), 8px hero gap, 6px spine gap, j clamped to 30, hidden when off-stage or j>29, k=0 hidden and centered).
- [ ] src/data/projectsRing.ts exports `tickStyle(d: number): { h: number; color: string }` (d=0 → 28/#a83818, d<=6 → 16/#5d5648, else 8/#d4ccb8), `pad3(i: number): string` (pad3(0) === '001'), `RING_DOTS` = ['#a83818','#1a1612','#2e5a3e'], and `ringStats(card: HubCard): { v: string; l: string }[]` giving [metric/metricLabel?, lang/'PRIMARY LANG'?, lastWorkedLabel/'UPDATED'?] with absent entries omitted and labels upper-cased.
- [ ] src/data/projectsView.ts HubCard gains optional `thumbnail?: string`, set from the registry Project's `thumbnail` in projectCard(); nothing else in that file changes behavior.
- [ ] tests/projects-ring.test.ts covers every export above (including the n=1 and empty-stat edge cases) and passes; tests/projects-view.test.ts still passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/projectsRing.ts
- src/data/projectsView.ts
- tests/projects-ring.test.ts

# Implementation notes

Read first: docs/design/projects-ring/Projects Ring.dc.html (the <script type="text/x-dc"> block — `wrap`, `meta`, `renderVals`), docs/design/projects-ring/README.md ("Spines (the ring)" + "Hero window"), src/data/projectsView.ts (HubCard interface lines ~32-75, projectCard ~92-122, lastWorkedLabel), src/data/projectsRegistry.ts (Project.thumbnail).

Steps:
1. Write tests/projects-ring.test.ts first (vitest, import from '../src/data/projectsRing.js'); compute expected numbers by hand from the prototype formulas.
2. Create src/data/projectsRing.ts with the exports named in the criteria. Pure functions only — no React, no DOM. `ringStats` imports `lastWorkedLabel` and `type HubCard` from './projectsView.js'. Keep the exact formulas from the prototype's renderVals (cum(j) = 8 + sum_{m<j}(W(m)+6); right side x = heroRight + cum(jj); left side x = heroLeft - cum(jj) - w; for k=0 x = stageW/2 - 32, w 64, h = base, hidden true). spineGeom should call heroBox internally.
3. In src/data/projectsView.ts add `thumbnail?: string` to HubCard (with a one-line doc comment like its neighbours) and `thumbnail: p.thumbnail,` in projectCard().

This is UI-support code only: do not touch the registry JSON, mcp-host-server/, or any server file.

# Out of scope

- Any React component, CSS or page change (next PRD)
- Registry / MCP / listing schema changes

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/projects-ring.test.ts tests/projects-view.test.ts tests/project-catalog.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
