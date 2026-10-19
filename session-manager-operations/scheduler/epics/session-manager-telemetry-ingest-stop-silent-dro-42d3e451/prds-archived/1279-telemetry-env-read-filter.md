---
title: Usage + observability summaries exclude test/dev telemetry by default (?env=)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-12T15:59:13.007Z
sourcePromptId: session-manager-telemetry-ingest-stop-silent-dro-42d3e451
tag: feature
agentType: dev-lead
dependsOn: [telemetry-persist-env]
planId: pl-mv5fnakk-fbfa8e
---
# Goal

wire: adopt parseEnvSelector/envPredicate (exported from server/routes/telemetry.ts by telemetry-persist-env) in every telemetry query of GET /api/admin/session-manager/usage, GET /api/admin/observability and GET /api/admin/observability/installs, so summaries default to prod (NULL counted as prod for legacy rows) and accept ?env=prod|dev|test|all.

# Acceptance criteria

- [ ] server/routes/admin-session-manager-usage.ts: every query over app_installs, funnel_events, app_errors and app_logs adds `AND ${ev.sql}` (the app_errors e / app_installs i join uses envPredicate(env, 'e.env')) with ev.args spliced in placeholder order (before LIMIT ? args); response includes `env`
- [ ] server/routes/admin-observability.ts /api/admin/observability: the app_errors count, app_logs warn/error count, latest-error (inner subquery with env, outer `WHERE ${evA.sql}` using envPredicate(env,'a.env')) and desktopApps app_installs queries are env-filtered; response includes env
- [ ] server/routes/admin-observability.ts /api/admin/observability/installs: all seven queries are env-filtered and the response includes env
- [ ] tests/session-manager-usage.test.ts: a test with installs p1 (env prod), t1 (env test), legacy (NULL), a test-env error and test/prod epic.create events asserts default response env 'prod', installs.total 2, issues [], epics sum 1; ?env=test gives total 1 and the TestOnly issue; ?env=all gives total 3

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/admin-session-manager-usage.ts
- server/routes/admin-observability.ts
- tests/session-manager-usage.test.ts

# Implementation notes

Read first: server/routes/admin-session-manager-usage.ts (whole, ~305 lines — 11 queries in a Promise.all); server/routes/admin-observability.ts lines 40-135 and 183-290; server/routes/telemetry.ts envPredicate/parseEnvSelector (landed by telemetry-persist-env; read it first).

At the top of each handler after auth: `const env = parseEnvSelector(query?.env); const ev = envPredicate(env);`. Placeholder order matters: for queries ending `LIMIT ?`, args go `..., ...ev.args, limitValue`. All SQL stays parameterized; the column argument is a literal.

Reference implementation: /home/bilko/Projects/Bilko/session-manager-operations/logs/sm-telemetry-ingest.patch (absolute path, untracked; read, do not apply whole) — take the admin-observability.ts hunks and the env-filter hunks of admin-session-manager-usage.ts, NOT the hasReadToken / timingSafeEqual hunk (sibling PRD telemetry-usage-read-token owns that), and the 'excludes test/dev rows by default' test. The existing tests/observability.test.ts must keep passing unchanged.

# Out of scope

- Token auth on the usage route
- Admin UI

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/session-manager-usage.test.ts tests/observability.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
