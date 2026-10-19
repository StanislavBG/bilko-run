---
title: Admin Sessions API: session list + merged per-session timeline
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-18T18:28:02.949Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [session-identity-cookie, session-columns-page-hits]
planId: pl-mve5lxlp-756161
---
# Goal

primitive: add the admin read API behind the Session view. One endpoint lists recent sessions: who, where they landed, where they exited, which apps they touched, plus activity counts. A second returns one session's full ordered timeline of page views, clicks, SDK events and errors from every bilko.run surface.

# Acceptance criteria

- [ ] New server/routes/admin-sessions.ts exports registerAdminSessionRoutes(app: FastifyInstance). Both routes call requireAdmin(req, reply) first and return early when it fails. It is registered in server/index.ts next to registerObservabilityRoutes.
- [ ] GET /api/admin/sessions accepts days (1-30, default 1), email, visitor, app and limit (1-200, default 50). It returns { sessions: [...] } from the sessions table, newest started_at first. Each row has session_id, visitor_id, email, started_at, ended_at, duration_ms, landing_path, exit_path, page_count, source_bucket, referrer_host, country, device, converted, purchased, click_count, event_count, error_count and apps: string[]. apps holds the distinct slugs from that session's page_views paths matching /projects/<slug>/ or /products/<slug>. app filters to sessions whose apps include it.
- [ ] GET /api/admin/sessions/:id returns { session, timeline }. timeline merges page_views (kind 'view', path, referrer), click_events (kind 'click', path, label, href, track_name), funnel_events (kind 'event', name=event, app=tool, path, props parsed from metadata) and app_errors (kind 'error', app, name, msg, url) for that session_id. It is sorted ascending by ts in epoch ms and capped at 1000. 404 when the session is unknown and no timeline rows exist.
- [ ] Timestamps are normalized to epoch ms. Sources: page_views.created_at_ms, click_events.ts_ms, funnel_events.created_at (DATETIME text in UTC), and app_errors.created_at (epoch seconds).
- [ ] All SQL uses bound parameters via the db helpers, never interpolated values. :id must pass isValidId from server/session-identity.ts, else 400.
- [ ] New tests/admin-sessions.test.ts mocks requireAdmin, as other admin tests do. It seeds one session with mixed rows from all four sources and asserts the merged order and kinds; it also covers a 401/403 path when requireAdmin rejects, the app filter, the 400 on a malformed id, and the counts in the list. pnpm typecheck passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/admin-sessions.ts
- server/index.ts
- tests/admin-sessions.test.ts

# Implementation notes

Read first: server/routes/admin-observability.ts lines 1-60 and 350-405 (requireAdmin usage and the existing per-visitor timeline query: mirror its style, but do not modify it); server/db-schema.ts (sessions at ~217-237, page_views, click_events, funnel_events, app_errors schemas, and ADDITIVE_COLUMNS: click_events.session_id/track_name come from PRD session-columns-page-hits); server/index.ts (where registerObservabilityRoutes is called); tests/observability.test.ts lines 1-40 (how admin auth is mocked in tests).

funnel_events.created_at is CURRENT_TIMESTAMP text 'YYYY-MM-DD HH:MM:SS' in UTC. Convert it in SQL with CAST(strftime('%s', created_at) AS INTEGER)*1000, or in JS.

Run the four timeline queries in parallel (Promise.all), each with LIMIT 1000, then merge in JS.

Do not touch: server/routes/admin-observability.ts, server/routes/analytics.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/admin-sessions.test.ts tests/observability.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
