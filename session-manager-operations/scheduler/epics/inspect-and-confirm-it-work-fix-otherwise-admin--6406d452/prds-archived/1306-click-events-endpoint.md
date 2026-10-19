---
title: Click capture endpoint: POST /api/analytics/click + click_events table
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T03:41:47.923Z
sourcePromptId: inspect-and-confirm-it-work-fix-otherwise-admin--6406d452
agentType: dev-lead
dependsOn: [page-hits-recorder]
planId: pl-mv64vt5k-acb57a
---
# Goal

primitive. The host has no record of what visitors click. Add a rate-limited, privacy-safe ingest endpoint that stores one row per click (page, element, link target) so a later PRD can inject a site-wide beacon that posts to it.

# Acceptance criteria

- [ ] server/db-schema.ts MIGRATIONS contains CREATE TABLE IF NOT EXISTS click_events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts_ms INTEGER NOT NULL, date TEXT NOT NULL, path TEXT NOT NULL, slug TEXT, tag TEXT, el_id TEXT, label TEXT, href TEXT, visitor_hash TEXT, is_bot INTEGER NOT NULL DEFAULT 0) with indexes on (date) and (path, date).
- [ ] server/routes/analytics.ts registers POST /api/analytics/click accepting JSON or text/plain (navigator.sendBeacon sends text/plain) body { path, tag, id, label, href }; path sliced to 300, tag to 20 (lowercased), id to 80, label to 80 with whitespace collapsed, href to 300; slug computed with slugFromPath from '../page-hits.js'; visitor_hash computed the same way as page_hits (sha256(date|ip|ua) first 16 hex — export a visitorHash(date, ip, ua) helper from server/page-hits.ts and reuse it).
- [ ] The endpoint reuses checkEventRate with scope 'click' (same per-visitor/per-IP limits as /event, keyed on IP only since there is no visitor_id), returns 204 on success and on any internal error (never 500), and returns 400 when path is missing or does not start with '/'.
- [ ] href values that are not http(s) or root-relative (e.g. javascript:, data:) are stored as null; no request body field other than the five listed is persisted.
- [ ] tests/analytics-click.test.ts proves: a valid JSON click is stored with slug and visitor_hash; a text/plain JSON body is accepted; a javascript: href is nulled; a missing path returns 400; exceeding the per-IP limit stops inserting rows.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/analytics.ts
- server/db-schema.ts
- server/page-hits.ts
- tests/analytics-click.test.ts

# Implementation notes

Read first: server/routes/analytics.ts lines 1-60 (ALLOWED_EVENTS, checkEventRate, bumpAndCheck) and 160-205 (/api/analytics/event handler shape), server/page-hits.ts (slugFromPath and the visitor hash code; landed by PRD page-hits-recorder), tests/analytics-pageview.test.ts lines 1-40 (harness).
Steps:
1. Tests first in tests/analytics-click.test.ts (DELETE FROM click_events in beforeEach).
2. server/page-hits.ts: extract the existing hash code into exported visitorHash(date: string, ip: string, ua: string): string and use it in recordPageHit (no behavior change). This is the only edit allowed in page-hits.ts.
3. server/db-schema.ts: append click_events table + indexes to MIGRATIONS.
4. server/routes/analytics.ts: text/plain parsing — register a scoped content-type parser only if Fastify has none for text/plain (app.hasContentTypeParser('text/plain')); otherwise JSON.parse the string body inside the handler. is_bot via isBot(user-agent).
Do not touch: server/index.ts, server/routes/admin-observability.ts, src/.

# Out of scope

- Injecting the client beacon script
- Admin reporting of clicks
- Recording input values, form contents or keystrokes

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/analytics-click.test.ts tests/analytics-pageview.test.ts tests/page-hits.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
