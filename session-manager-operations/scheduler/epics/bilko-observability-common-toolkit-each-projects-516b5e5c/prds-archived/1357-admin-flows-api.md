---
title: Admin Flows API: per-app health + primary-flow step funnels
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-18T18:28:42.044Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [admin-sessions-api]
planId: pl-mve5lxlp-756161
---
# Goal

behavior: add the monitoring read API. It gives a per-app health summary: sessions, views, clicks, events and errors. It also gives a funnel for each primary flow that apps tag with host-kit trackFlow(flow, step). trackFlow sends funnel_events with event `${flow}.${step}` and metadata JSON containing flow and step. The app is funnel_events.tool. Each step is counted in distinct sessions.

# Acceptance criteria

- [ ] server/routes/admin-sessions.ts adds GET /api/admin/flows, which is requireAdmin-gated and takes days (1-30, default 7) and an optional app.
- [ ] The response is { apps: [...], flows: [...] }.
- [ ] apps has one row per app slug seen in the window, with sessions, views, clicks, events, errors, error_sessions and last_seen_ms. The slug comes from page_views/click_events paths /projects/<slug>/ or /products/<slug>, from funnel_events.tool, and from app_errors.app. Rows are sorted by sessions descending.
- [ ] flows has one row per (app, flow) where json_extract(metadata, '$.flow') is not null. Each row is { app, flow, steps: [{ step, sessions, first_seen_ms }] }, with steps ordered by sessions descending and then by first_seen_ms ascending, plus total_sessions = the distinct sessions that hit any step.
- [ ] All SQL is parameterized, and a slug-shaped app filter is validated with /^[a-z0-9][a-z0-9._-]{0,59}$/i, otherwise 400.
- [ ] tests/admin-sessions.test.ts gets tests for: a seeded 3-step flow with 10/6/2 sessions returned in that order; the app filter; the per-app error counts; a 400 on a bad app value. pnpm typecheck passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/admin-sessions.ts
- tests/admin-sessions.test.ts

# Implementation notes

Read first: server/routes/admin-sessions.ts (landed by PRD admin-sessions-api; reuse its helpers, such as the slug-from-path and timestamp normalization); tests/admin-sessions.test.ts (its setup and seeding helpers); server/db-schema.ts definitions of funnel_events and app_errors.

Per-app counts should be computed with a few grouped queries, not one query per app. funnel_events.created_at is UTC DATETIME text; app_errors.created_at is epoch seconds; page_views.created_at_ms and click_events.ts_ms are epoch ms.

Do not touch: server/index.ts (the route registers through the existing registerAdminSessionRoutes).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/admin-sessions.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
