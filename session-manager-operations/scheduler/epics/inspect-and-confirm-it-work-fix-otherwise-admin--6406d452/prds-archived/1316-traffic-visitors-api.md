---
title: Traffic API: raw hit log with IP/UA/user, per-visitor list and visitor timeline
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T03:49:56.089Z
sourcePromptId: inspect-and-confirm-it-work-fix-otherwise-admin--6406d452
agentType: dev-lead
dependsOn: [click-events-full-detail, clicks-report]
planId: pl-mv64vt5k-acb57a
---
# Goal

behavior. The owner wants to read traffic like a server log and see every visitor, including themselves. Extend GET /api/admin/traffic with full-detail recent hits and a visitors list, and add a per-visitor timeline endpoint merging page hits and clicks.

# Acceptance criteria

- [ ] GET /api/admin/traffic: recent becomes the latest 200 rows and each item adds ip, ua, referrer, visitorId, userEmail, isAdmin; totals.visitors counts DISTINCT visitor_id (falling back to visitor_hash where visitor_id is null).
- [ ] GET /api/admin/traffic adds visitors: top 100 by hits [{ visitorId, ip, country, device, browser, os, userEmail, isAdmin, hits, clicks, pages (distinct paths), firstSeen, lastSeen }], bots excluded, admin included and flagged.
- [ ] Optional query self=exclude removes is_admin=1 rows from every aggregate; default is include (the owner's own traffic is shown).
- [ ] New GET /api/admin/traffic/visitor/:id (requireAdmin) returns the merged, time-ordered events for that visitor_id over the window: { ts, kind: 'hit'|'click', path, status?, label?, href?, referrer?, ip, ua } capped at 500.
- [ ] All SQL parameterized and wrapped in safeQuery; tests/observability.test.ts covers: recent rows carry ip/ua/userEmail, visitors aggregates hits+clicks for one visitor_id, self=exclude drops admin rows, the timeline endpoint orders hits and clicks by time and 403s for non-admins.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/admin-observability.ts
- tests/observability.test.ts

# Implementation notes

Read first: server/routes/admin-observability.ts /api/admin/traffic handler (PRDs traffic-admin-api and clicks-report), server/db-schema.ts page_hits + click_events ADDITIVE_COLUMNS (PRDs page-hits-full-detail, click-events-full-detail), tests/observability.test.ts traffic tests.
Steps: tests first; extend the handler; add the timeline route in registerObservabilityRoutes using a UNION ALL of page_hits and click_events ordered by ts_ms.
Do not touch: src/, server/page-hits.ts, server/routes/analytics.ts.

# Out of scope

- UI changes
- IP geolocation lookups

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
