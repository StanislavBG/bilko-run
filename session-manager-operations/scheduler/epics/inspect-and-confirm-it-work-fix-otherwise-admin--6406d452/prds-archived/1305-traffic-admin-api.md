---
title: Admin traffic report API over page_hits, and fix per-app traffic24h
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T03:41:42.511Z
sourcePromptId: inspect-and-confirm-it-work-fix-otherwise-admin--6406d452
agentType: dev-lead
dependsOn: [page-hits-recorder]
planId: pl-mv64vt5k-acb57a
---
# Goal

behavior. The observability rollup's traffic24h counts page_views rows that static-path apps never write, so every app shows ~0. Add GET /api/admin/traffic returning a real report from the server-side page_hits table, and switch traffic24h in GET /api/admin/observability to human page_hits per slug.

# Acceptance criteria

- [ ] server/routes/admin-observability.ts registers GET /api/admin/traffic guarded by requireAdmin, with query days (default 7, clamped 1-90) and optional slug, returning { days, totals: { hits, visitors, botHits, notFound }, byDay: [{ date, hits, visitors }], topPages: [{ path, hits, visitors }], topReferrers: [{ host, hits }], bySlug: [{ slug, hits, visitors }], byCountry, byDevice, byBrowser, recent: [{ ts, path, status, referrerHost, country, device, browser, os, isBot }], earliestDate, generatedAt }.
- [ ] All aggregates except botHits and recent exclude is_bot=1 rows and rows with status >= 400; notFound counts human status=404 hits; visitors = COUNT(DISTINCT visitor_hash); topPages/topReferrers/bySlug are capped at 25 rows; recent is the latest 50 rows (bots included, flagged).
- [ ] All SQL is parameterized via dbAll/dbGet; each query is wrapped in the existing safeQuery helper so a missing table returns empty results, not a 500.
- [ ] GET /api/admin/observability computes traffic24h per slug from page_hits (is_bot=0, status<400, ts_ms within the last 24h, grouped by slug) instead of page_views.
- [ ] tests/observability.test.ts adds tests: /api/admin/traffic returns 403 for non-admin; with seeded page_hits rows (2 human visitors on /projects/demo/, 1 bot, 1 404) it returns totals.hits=2, visitors=2, botHits=1, notFound=1 and bySlug[0].slug='demo'; and the observability rollup's demo row has traffic24h=2.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/admin-observability.ts
- tests/observability.test.ts

# Implementation notes

Read first: server/routes/admin-observability.ts lines 38-185 (safeQuery, rollup, traffic query at ~line 68) and 280-310 (/api/admin/egress shape to mirror), server/page-hits.ts (page_hits columns; landed by PRD page-hits-recorder), tests/observability.test.ts lines 1-80 (requireAdmin mock + asAdmin()).
Steps:
1. Write the failing tests first; add 'DELETE FROM page_hits' to the beforeEach.
2. Replace the page_views traffic query in the rollup with a page_hits query keyed on the slug column (no SUBSTR parsing needed).
3. Add the /api/admin/traffic route inside registerObservabilityRoutes. Window: ts_ms >= Date.now() - days*86_400_000. If slug is given, add AND slug = ? to every query. earliestDate = SELECT MIN(date) FROM page_hits.
Do not touch: server/routes/analytics.ts (the existing /admin page_views dashboard stays as is), server/page-hits.ts, src/.

# Out of scope

- UI changes
- Click data
- Removing page_views or /api/analytics/pageview

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
