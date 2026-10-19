---
title: Click and pageview ingest store shared session ids (cookie-first)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-18T18:26:38.758Z
sourcePromptId: bilko-observability-common-toolkit-each-projects-516b5e5c
agentType: dev-lead
dependsOn: [session-columns-page-hits]
planId: pl-mve5lxlp-756161
---
# Goal

behavior: make /api/analytics/click and /api/analytics/pageview record the shared session identity, so clicks and pageviews from the injected beacon land in one session. The cookie is the source of truth; validated body ids are the fallback. The pageview route must also accept the text/plain body that navigator.sendBeacon sends, and derive the signed-in user from the Clerk session cookie, because the beacon cannot send an email.

# Acceptance criteria

- [ ] Click route (/api/analytics/click in server/routes/analytics.ts): stores click_events.session_id and client_vid from readSessionIds(req.headers.cookie), falling back to body.session_id/body.visitor_id when they pass isValidId, else NULL. It stores click_events.track_name from body.track, sliced to 60 chars, else NULL.
- [ ] Pageview route (/api/analytics/pageview): when req.body is a string it is JSON.parsed (an invalid string means empty body); visitor_id/session_id resolve cookie-first, then validated body values; the sessions-table upsert uses the resolved ids.
- [ ] Pageview route: when body.email is absent and the request is not a bot, email and is_admin are derived from the Clerk __session cookie via verifyClerkToken, the same pattern the click route uses. body.email is still accepted as today. Admin status still comes only from a verified token.
- [ ] /api/analytics/event: the sessions.converted flip uses the cookie ids when present, so a body cannot flip another session's flag when a cookie exists.
- [ ] Tests: tests/analytics-click.test.ts covers cookie ids stored, body-id fallback, a malformed id rejected, and track_name stored. tests/analytics-pageview.test.ts covers a text/plain JSON body parsed, cookie ids winning over body ids in page_views and sessions, and email derived from a mocked verifyClerkToken.
- [ ] All existing tests in tests/analytics-click.test.ts, tests/analytics-pageview.test.ts and tests/analytics-admin-queries.test.ts pass, and pnpm typecheck passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/analytics.ts
- tests/analytics-click.test.ts
- tests/analytics-pageview.test.ts

# Implementation notes

Read first: server/routes/analytics.ts lines 1-252 (the pageview, event and click handlers; the click route already parses string bodies and reads sessionCookie()); server/session-identity.ts (from PRD session-identity-cookie: readSessionIds, isValidId); server/db-schema.ts ADDITIVE_COLUMNS (click_events.session_id, client_vid and track_name were added by PRD session-columns-page-hits); tests/analytics-click.test.ts lines 1-30 (setup, verifyMock).

Steps:
1. Add a local helper resolveIds(req, body) -> { visitorId, sessionId } (cookie first, then validated body values).
2. Click INSERT: add the three columns.
3. Pageview: parse a string body; use resolveIds; add the Clerk-cookie email lookup only when no body email (sessionCookie is already imported from the page-hits/clerk helpers used by the click route).
4. Event: use resolveIds for the converted-flip.

Keep the existing 'never fail' try/catch and the rate limiters.

Do not touch: server/routes/telemetry.ts, server/click-beacon.ts, server/db-schema.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/analytics-click.test.ts tests/analytics-pageview.test.ts tests/analytics-admin-queries.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
