---
title: Telemetry retention: daily scheduled prune of old telemetry events and stale installs
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-12T15:59:00.924Z
sourcePromptId: session-manager-telemetry-ingest-stop-silent-dro-42d3e451
tag: feature
agentType: dev-lead
dependsOn: [telemetry-persist-env]
planId: pl-mv5fnakk-fbfa8e
---
# Goal

behavior: retention today covers only app_logs (30d/200k) and app_errors (90d/100k), and runs only as a side effect of incoming writes; telemetry rows in funnel_events and app_installs grow forever. Add pruneTelemetryScheduled() that also removes telemetry funnel_events older than 180 days and installs not seen in 365 days, and run it on a daily unref'd timer plus once 5 minutes after boot. funnel_events is shared with web analytics and web-product checkout metrics (server/routes/analytics.ts, admin-web-products.ts), which must never be pruned — only rows written by telemetry ingest qualify.

# Acceptance criteria

- [ ] server/routes/telemetry.ts exports async pruneTelemetryScheduled() that calls pruneTelemetry(), then runs `DELETE FROM funnel_events WHERE created_at < ? AND (env IS NOT NULL OR version IS NOT NULL)` with a 'YYYY-MM-DD HH:MM:SS' UTC cutoff 180 days ago, then `DELETE FROM app_installs WHERE last_seen_at < ?` with epoch seconds 365 days ago (both parameterized)
- [ ] server/routes/telemetry.ts: registerTelemetryRoutes(app, opts: { scheduledPrune?: boolean } = {}) starts, unless opts.scheduledPrune === false, a setTimeout (5 min) and setInterval (24 h), both .unref()'d and cleared in an app onClose hook; failures log via app.log.warn and never throw
- [ ] server/routes/telemetry.ts retention header comment explains the timer (an app that stops reporting never triggers the write-path prune; Render restarts reset in-process clocks) and why funnel_events pruning is limited to env/version rows
- [ ] tests/telemetry.test.ts registers routes with { scheduledPrune: false } and a new test shows pruneTelemetryScheduled deletes a 200-day-old funnel_events row with env set and one with only version set, keeps a 200-day-old row with neither (checkout_start) and a fresh env row, deletes an install last seen 366 days ago and keeps one seen 10 days ago

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/telemetry.ts
- tests/telemetry.test.ts

# Implementation notes

Read first: server/routes/telemetry.ts retention section (pruneTelemetry, maybePrune, constants) and registerTelemetryRoutes signature; server/index.ts line ~163 (registerTelemetryRoutes(app) — leave the call as is, default starts the timer); server/routes/sm-relay.ts lines 285-295 (unref'd setInterval pattern). Runs after telemetry-persist-env: the env column exists.

Reference implementation: /home/bilko/Projects/Bilko/session-manager-operations/logs/sm-telemetry-ingest.patch (absolute path, untracked; read, do not apply whole) — take the retention block (EVENT_RETENTION_DAYS=180, INSTALL_RETENTION_DAYS=365, SCHEDULED_PRUNE_EVERY_MS, SCHEDULED_PRUNE_FIRST_MS, pruneTelemetryScheduled, startScheduledPrune) and the 'Telemetry retention — pruneTelemetryScheduled()' test. Use a dedicated tool value ('ret-app') in the test and delete its rows first. Insert app_installs test rows with install_id, app, first_seen_at, last_seen_at only.

# Out of scope

- Changing app_logs/app_errors caps
- Pruning web analytics funnel_events rows

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/telemetry.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
