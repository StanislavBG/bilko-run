---
title: Telemetry ingest joins the cookie session
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-18T18:24:51.191Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [session-identity-cookie]
planId: pl-mve5lxlp-756161
---
# Goal

behavior: 14 sibling apps ship host-kit builds that still send per-tab sessionStorage ids, and they keep doing so until each one reinstalls and republishes. Make the server-side telemetry ingest stamp browser records with the same-origin bilko_vid/bilko_sid cookie ids when they are present, so events and errors from those apps join the site-wide session now. Desktop clients send no cookie and keep their body ids.

# Acceptance criteria

- [ ] In server/routes/telemetry.ts, the /api/telemetry/event, /log and /error handlers call readSessionIds(req.headers.cookie) from server/session-identity.ts once per request. When the cookie yields a valid sessionId or visitorId, that value replaces the record's session_id or visitor_id before the INSERT.
- [ ] With no cookie, or an invalid one, the body's session_id and visitor_id are stored unchanged, as today.
- [ ] The per-install quota in admit() is still charged against the id that is actually stored. A cookie id replaces the body id before quota accounting, or the quota uses the same resolved id.
- [ ] tests/telemetry.test.ts gets new cases: a cookie sid overrides the body session_id in funnel_events and in app_errors; a body id is kept when there is no cookie; a malformed cookie value is ignored.
- [ ] All existing tests in tests/telemetry.test.ts still pass, and pnpm typecheck passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/telemetry.ts
- tests/telemetry.test.ts

# Implementation notes

Read first: server/session-identity.ts (added by PRD session-identity-cookie; read the landed code for the exact exports readSessionIds(cookieHeader) -> { visitorId, sessionId }); server/routes/telemetry.ts lines 110-150 (admit) and 270-345 (the event/log/error handlers); tests/telemetry.test.ts lines 1-60 (setup: Fastify({ trustProxy: true }), registerTelemetryRoutes(app, { scheduledPrune: false })).

Steps:
1. In each of the three handlers, resolve const ids = readSessionIds(req.headers.cookie). Map the batch so each record gets session_id = ids.sessionId ?? rec.session_id and visitor_id = ids.visitorId ?? rec.visitor_id, before calling admit().
2. Leave the install route alone: desktop installs use their own install_id.
3. Add the tests, sending the cookie via inject headers: { cookie: 'bilko_sid=<uuid>; bilko_vid=<uuid>' }.

Do not touch: server/session-identity.ts, server/routes/analytics.ts.

# Out of scope

- (none)

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
