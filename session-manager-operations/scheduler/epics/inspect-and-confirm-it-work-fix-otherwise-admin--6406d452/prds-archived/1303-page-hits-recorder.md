---
title: Server-side page-hit recorder: page_hits table + buffered recorder module
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T03:41:02.168Z
sourcePromptId: inspect-and-confirm-it-work-fix-otherwise-admin--6406d452
agentType: dev-lead
planId: pl-mv64vt5k-acb57a
---
# Goal

primitive. /admin/observability shows near-zero traffic because page views are only recorded when client JS POSTs /api/analytics/pageview, which only the host SPA and 1 of 22 static-path apps (launch-kit) do. Add a server-side recorder that logs every HTML document response the Fastify server sends (every visitor, every page, including /projects/<slug>/ static apps) into a new page_hits table, without storing raw IPs.

# Acceptance criteria

- [ ] server/db-schema.ts MIGRATIONS contains CREATE TABLE IF NOT EXISTS page_hits (id INTEGER PRIMARY KEY AUTOINCREMENT, ts_ms INTEGER NOT NULL, date TEXT NOT NULL, path TEXT NOT NULL, slug TEXT, status INTEGER NOT NULL, referrer_host TEXT, visitor_hash TEXT, country TEXT, device TEXT, browser TEXT, os TEXT, is_bot INTEGER NOT NULL DEFAULT 0) plus indexes on (date), (slug, date) and (ts_ms).
- [ ] New server/page-hits.ts exports slugFromPath(path): string|null (returns 'outdoor-hours' for '/projects/outdoor-hours/' and '/projects/outdoor-hours/x.html', null for '/', '/blog/x', '/projects'), recordPageHit(input), flushPageHits(): Promise<void>, and registerPageHitRecorder(app, opts?: { flush?: boolean }).
- [ ] registerPageHitRecorder adds an onResponse hook that records only GET requests whose path does not start with /api/ and whose reply content-type starts with text/html; it never throws into the response (try/catch like egress.ts).
- [ ] visitor_hash is the first 16 hex chars of sha256(date + '|' + ip + '|' + user-agent); no raw IP and no raw user-agent string is stored in page_hits; referrer_host is the lowercased host of the Referer header with www. stripped, and null when it equals the request's own Host.
- [ ] flushPageHits batch-inserts buffered rows with parameterized SQL, caps the in-memory buffer at 5000 rows (excess dropped), and at most once per calendar day deletes page_hits rows with ts_ms older than 90 days.
- [ ] tests/page-hits.test.ts (Fastify + initDb, flush:false, explicit flushPageHits) proves: an HTML GET is recorded with slug/status/is_bot/device; a JS asset, a JSON /api/ response and a HEAD request are not recorded; a Googlebot UA gets is_bot=1; two requests with the same IP+UA on the same day share one visitor_hash and the row contains no IP.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/page-hits.ts
- server/db-schema.ts
- tests/page-hits.test.ts

# Implementation notes

Read first: server/egress.ts lines 1-80 and 305-370 (buffer + flush timer + onResponse pattern to copy), server/services/analytics.ts lines 56-90 (parseUa, isBot — reuse, do not reimplement), server/routes/analytics.ts lines 62-72 (parseRefHost shape), tests/egress.test.ts lines 1-40 (test harness pattern).
Steps:
1. server/db-schema.ts: append the page_hits CREATE TABLE and three CREATE INDEX IF NOT EXISTS statements to the MIGRATIONS array (near the other analytics tables).
2. Create server/page-hits.ts. Row fields: ts_ms=Date.now(), date=dayKey-style YYYY-MM-DD UTC (import dayKey from './egress.js'), path=req.url split on '?' sliced to 300 chars, slug=slugFromPath(path), status=reply.statusCode, ua parsed via parseUa/isBot, country from headers cf-ipcountry ?? x-vercel-ip-country ?? x-country (sliced to 8), ip=req.ip. Use getClient().batch(stmts, 'write') for the flush like egress.ts batchWrite. Timer: setInterval(flushPageHits, 60_000).unref() only when opts.flush !== false, plus onClose flush — mirror registerEgressMeter exactly.
3. Write tests/page-hits.test.ts first (red), then implement. Clear page_hits in beforeEach. Use app.inject with headers user-agent / x-forwarded-for not needed — req.ip from inject is fine; set remoteAddress via inject option if needed.
Do not touch: server/index.ts (wiring is a separate PRD), server/routes/analytics.ts, server/egress.ts.

# Out of scope

- Registering the hook in server/index.ts
- Admin API or UI changes
- Click tracking

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/page-hits.test.ts tests/egress.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
