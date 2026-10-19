---
title: Report top clicks per page in the traffic API and Traffic panel
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-13T03:42:40.090Z
sourcePromptId: inspect-and-confirm-it-work-fix-otherwise-admin--6406d452
agentType: dev-lead
dependsOn: [traffic-panel-ui, click-events-endpoint]
planId: pl-mv64vt5k-acb57a
---
# Goal

behavior. click_events rows (PRD click-events-endpoint) are not visible anywhere. Add click aggregates to GET /api/admin/traffic and a 'Top clicks' table to TrafficPanel so the owner can see what visitors click on each page.

# Acceptance criteria

- [ ] GET /api/admin/traffic in server/routes/admin-observability.ts adds totals.clicks (human clicks in window) and topClicks: [{ path, tag, label, href, clicks, visitors }] — top 25 by clicks from click_events where is_bot=0 and ts_ms within the window, honoring the optional slug filter, via safeQuery and parameterized SQL.
- [ ] src/pages/admin/TrafficPanel.tsx shows a Clicks stat in the stat row and a 'Top clicks' table (page, element label or tag, link target, clicks, visitors) with the same empty-state treatment as the other tables.
- [ ] tests/observability.test.ts seeds click_events (3 human clicks on one button across 2 visitor_hashes, 1 bot click) and asserts totals.clicks=3 and topClicks[0] has clicks=3, visitors=2; beforeEach clears click_events.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/admin-observability.ts
- src/pages/admin/TrafficPanel.tsx
- tests/observability.test.ts

# Implementation notes

Read first: server/routes/admin-observability.ts /api/admin/traffic handler (landed by PRD traffic-admin-api), src/pages/admin/TrafficPanel.tsx (landed by PRD traffic-panel-ui), server/db-schema.ts click_events table (PRD click-events-endpoint), tests/observability.test.ts traffic tests.
Steps: tests first; extend the handler's Promise.all; extend the TS response interface and render the table.
Do not touch: server/routes/analytics.ts, server/click-beacon.ts, server/page-hits.ts.

# Out of scope

- Heatmaps or per-coordinate click data
- Changes to click ingest

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/observability.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
