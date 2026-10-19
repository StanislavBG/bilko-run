---
title: Traffic panel on /admin/observability: visitors, pages, referrers, live hit log
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T03:42:17.249Z
sourcePromptId: inspect-and-confirm-it-work-fix-otherwise-admin--6406d452
agentType: dev-lead
dependsOn: [traffic-admin-api]
planId: pl-mv64vt5k-acb57a
---
# Goal

wire. /admin/observability has no traffic view, so the owner cannot see who visits which pages. Add a TrafficPanel component fed by GET /api/admin/traffic (landed by PRD traffic-admin-api) and mount it at the top of the Observability page.

# Acceptance criteria

- [ ] New src/pages/admin/TrafficPanel.tsx exports TrafficPanel, fetching `${API}/admin/traffic?days=${days}` with the Clerk Bearer token exactly the way BandwidthPanel.tsx does, with a days selector of 1 / 7 / 30.
- [ ] It renders: a stat row (hits, unique visitors, bot hits, 404s), a hits-per-day bar list, tables for top pages, top referrers, projects (bySlug), countries, devices and browsers, and a 'Recent hits' table of the 50 latest rows with time shown in the viewer's local timezone and bots visually marked.
- [ ] Each table shows an explicit empty state ('No hits recorded yet' plus the earliestDate when present) instead of rendering nothing; a fetch error renders the error text, not a blank panel.
- [ ] Clicking a row in the projects table re-fetches with &slug=<slug> and shows a clear 'Filtered to <slug> ×' control that removes the filter.
- [ ] src/pages/admin/ObservabilityPage.tsx renders <TrafficPanel /> above the existing per-app table (before BlogCadencePanel); no other behavior on the page changes; pnpm typecheck passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/TrafficPanel.tsx
- src/pages/admin/ObservabilityPage.tsx

# Implementation notes

Read first: src/pages/admin/BandwidthPanel.tsx (whole file: fetch/auth/loading/error pattern, table styling, days selector — copy its idiom and CSS classes), src/pages/admin/ObservabilityPage.tsx lines 1-120 and 250-280 (where BlogCadencePanel/BandwidthPanel mount), server/routes/admin-observability.ts the /api/admin/traffic handler (response shape; landed by PRD traffic-admin-api).
Steps:
1. Define TS interfaces matching the /api/admin/traffic response exactly.
2. Build TrafficPanel.tsx with no new dependencies; plain tables and div bars like BandwidthPanel.
3. Mount in ObservabilityPage.tsx.
Do not touch: server/, src/pages/admin/BandwidthPanel.tsx.

# Out of scope

- Click reporting (separate PRD)
- Charts libraries
- Changes to the /admin analytics page

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck && timeout 600 pnpm test
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
