---
title: Traffic API: count visitors by the stable visitor id everywhere, not the daily hash
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-13T04:01:50.304Z
sourcePromptId: inspect-and-confirm-it-work-fix-otherwise-admin--6406d452
agentType: dev-lead
disposition: new-head
planId: pl-mv65mk80-5a46d2
---
# Goal

behavior. In GET /api/admin/traffic, totals.visitors and the visitors list count COALESCE(visitor_id, visitor_hash), but byDay, topPages, bySlug and topClicks still count DISTINCT visitor_hash (a hash that changes daily). Over a multi-day window one person is counted once in totals but once per day in the per-page/per-app tables, so the numbers disagree. Switch every visitor count to the same stable key.

# Acceptance criteria

- [ ] In server/routes/admin-observability.ts the /api/admin/traffic handler's byDay, topPages, bySlug and topClicks queries count COUNT(DISTINCT COALESCE(visitor_id, visitor_hash)) (reuse the existing VKEY constant) instead of COUNT(DISTINCT visitor_hash); no other query changes.
- [ ] tests/observability.test.ts adds a test: one visitor_id with hits on the same path on two different dates (different visitor_hash values) yields totals.visitors=1, topPages[0].visitors=1 and bySlug[0].visitors=1; and two clicks on one button from that visitor_id on different dates yields topClicks[0].visitors=1.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/admin-observability.ts
- tests/observability.test.ts

# Implementation notes

Read first: server/routes/admin-observability.ts lines 190-300 (the /api/admin/traffic handler; VKEY is defined at ~line 204), tests/observability.test.ts the traffic tests and the hit() seeding helper added for PRD traffic-visitors-api.
Steps: write the failing test first, then replace the four COUNT(DISTINCT visitor_hash) expressions with COUNT(DISTINCT ${VKEY}).
Do not touch: src/, server/page-hits.ts, server/routes/analytics.ts.

# Out of scope

- UI changes
- Indexing COALESCE expressions

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
