---
title: click_events: tie each click to the stable visitor id, IP and signed-in user
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-13T03:48:27.204Z
sourcePromptId: inspect-and-confirm-it-work-fix-otherwise-admin--6406d452
agentType: dev-lead
dependsOn: [page-hits-full-detail, click-beacon-injection]
planId: pl-mv64vt5k-acb57a
---
# Goal

behavior. Clicks must join to the same visitor as their page hits so the owner can read one visitor's full path (pages then clicks). Store the stable visitor_id, IP and signed-in user on every click using the helpers PRD page-hits-full-detail exported from server/page-hits.ts.

# Acceptance criteria

- [ ] server/db-schema.ts ADDITIVE_COLUMNS gains a click_events entry adding ip TEXT, visitor_id TEXT, user_email TEXT, is_admin INTEGER DEFAULT 0.
- [ ] POST /api/analytics/click in server/routes/analytics.ts sets visitor_id = stableVisitorId(req.ip, user-agent) and ip = req.ip, and for non-bot requests resolves user_email/is_admin from sessionCookie(req.headers.cookie) via verifyClerkToken, exactly as page_hits does; failure leaves them null/0 and the endpoint still returns 204.
- [ ] A click and a page hit from the same IP+UA produce the same visitor_id.
- [ ] tests/analytics-click.test.ts adds tests for visitor_id/ip storage, the signed-in admin case (verifyClerkToken mocked) and the same-visitor_id-as-page_hits case.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/analytics.ts
- server/db-schema.ts
- tests/analytics-click.test.ts

# Implementation notes

Read first: server/page-hits.ts (stableVisitorId, sessionCookie, landed by PRD page-hits-full-detail), server/routes/analytics.ts POST /api/analytics/click handler (PRD click-events-endpoint), server/clerk.ts lines 1-60, tests/analytics-click.test.ts.
Steps: tests first; add columns via ADDITIVE_COLUMNS; extend the INSERT.
Do not touch: server/page-hits.ts, server/click-beacon.ts, server/index.ts.

# Out of scope

- Changing the client beacon payload
- Admin reporting

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/analytics-click.test.ts tests/page-hits.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
