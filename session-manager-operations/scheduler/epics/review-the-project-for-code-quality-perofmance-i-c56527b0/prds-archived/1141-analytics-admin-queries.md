---
title: Admin analytics queries: let SQLite use the indexes (no date() on indexed columns)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:12:25.694Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [analytics-pageview-hardening]
planId: pl-mv1kqopr-64f191
---
# Goal

behavior. The admin stats queries in server/routes/analytics.ts filter with `date(created_at) >= ?` (~lines 231, 233, 239-243, 271-275, 480). Wrapping the column in a function stops SQLite using its index, so every admin load scans whole tables. The token_balances listing (~224-228) also runs 3 correlated subqueries per row. Rewrite the filters as plain range comparisons and the subqueries as one grouped join. Read the landed file from analytics-pageview-hardening first.

# Acceptance criteria

- [ ] Every `date(created_at) >= ?` (and similar date() wrappers on indexed columns) becomes `created_at >= ?` with the bound computed in JS in the column's stored format; check whether created_at is ISO text or epoch and say which.
- [ ] The per-row correlated subqueries for token balances become one aggregate join or a CTE.
- [ ] A new test in tests/analytics-admin-queries.test.ts seeds rows across 3 days, calls the stats route as admin, and asserts the counts equal the pre-change results (compute the expected values in the test).
- [ ] EXPLAIN QUERY PLAN for the main pageview count query uses an index (asserted in the test) when one exists on created_at; if none exists, say so in the report (adding indexes is out of scope).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/analytics.ts
- tests/analytics-admin-queries.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: server/routes/analytics.ts lines 180-490; CREATE INDEX statements for page_views/token tables in server/db.ts (read only). Do not touch: server/db.ts.

# Out of scope

- Adding indexes (schema lives in server/db.ts)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/analytics-admin-queries.test.ts tests/analytics-pageview.test.ts tests/observability.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
