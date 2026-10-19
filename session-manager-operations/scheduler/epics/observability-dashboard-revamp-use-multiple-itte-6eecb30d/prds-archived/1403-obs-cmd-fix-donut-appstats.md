---
title: Observability Command: donut 'other' bucketing and full-number app stats match the design
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-19T08:14:01.042Z
sourcePromptId: observability-dashboard-revamp-use-multiple-itte-6eecb30d
tag: bug
agentType: dev-lead
disposition: new-head
planId: pl-mvez9z69-034b05
---
# Goal

behavior: A live screenshot review of /admin/observability/preview found two deviations from docs/design/observability-command/. First, the Browsers donut centers '53% OTHER' and lists 'other' twice, because a real 'other' row from the API is kept beside the synthetic top-4 'other' bucket. The design centers the largest named segment ('39% CHROME', prototype line 348). Second, App health tiles show compact numbers like '1.5k' where the design shows '1,519' (prototype lines 237-240, fmt at 641).

# Acceptance criteria

- [ ] src/pages/admin/command/AudienceModule.tsx donutSegments merges any input row whose key is 'other' (case-insensitive) or empty/null into the single 'other' bucket, so the legend never lists 'other' twice; segments still sum to the total.
- [ ] donutSegments' center label and percent are the largest segment that is not 'other' (the Browsers donut shows Chrome's share, the Devices donut still shows desktop), used by both the stage and compact donuts.
- [ ] src/pages/admin/command/AppsModule.tsx tile mini-stats VIEW/CLK/EVT/ERR render fmtNum (en-US grouping, e.g. '1,519') instead of the compact 'k' form, without overflowing a tile at 1440x900.
- [ ] tests/obs-command-audience.test.ts covers donutSegments: duplicate 'other' merged, center = largest named segment when 'other' is biggest, all-'other' input, empty input.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/command/AudienceModule.tsx
- src/pages/admin/command/AppsModule.tsx
- tests/obs-command-audience.test.ts

# Implementation notes

Read first:
- src/pages/admin/command/AudienceModule.tsx lines 1-80 (donutSegments at ~19).
- src/pages/admin/command/AppsModule.tsx lines 215-235 (fmtCompact use at ~228).
- docs/design/observability-command/Observability Command.dc.html lines 336-358 and 236-241.
Steps: write the test first (vitest node env, import the pure function only), then fix donutSegments, then switch the AppsModule stat to fmtNum (keep the title tooltip).
Work as the dev-lead persona.

# Out of scope

- Other modules, server changes.

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/obs-command-audience.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
