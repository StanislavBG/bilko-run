---
title: page_hits: keep full IP, user-agent, referrer, a stable visitor id and the signed-in user
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T03:46:51.413Z
sourcePromptId: inspect-and-confirm-it-work-fix-otherwise-admin--6406d452
agentType: dev-lead
dependsOn: [page-hits-wire, click-events-endpoint]
planId: pl-mv64vt5k-acb57a
---
# Goal

behavior. The owner wants raw traffic-log detail for every visitor, including their own visits: page_hits currently stores only a daily-rotating 16-hex hash, no IP, no user-agent, no full referrer and no identity, so one person cannot be followed across days or recognized. Extend the server-side recorder to store full request detail and identify signed-in Clerk users from the same-origin __session cookie.

# Acceptance criteria

- [ ] server/db-schema.ts ADDITIVE_COLUMNS gains a page_hits entry adding ip TEXT, ua TEXT, referrer TEXT, visitor_id TEXT, user_email TEXT, is_admin INTEGER DEFAULT 0, plus an index on page_hits(visitor_id) in MIGRATIONS.
- [ ] server/page-hits.ts stores ip = req.ip (trustProxy is already on), ua sliced to 400, referrer = full Referer header sliced to 500, and visitor_id = first 16 hex of sha256(salt + '|' + ip + '|' + ua) where salt = process.env.ANALYTICS_VISITOR_SALT ?? 'bilko-visitor-v1' — stable across days. Export it as stableVisitorId(ip, ua). The existing daily visitor_hash column keeps being written unchanged.
- [ ] server/page-hits.ts exports sessionCookie(cookieHeader: string|undefined): string|null that returns the __session cookie value; the onResponse hook, for non-bot hits only, resolves user_email via verifyClerkToken('Bearer ' + token) from '../server/clerk.js' and sets is_admin = 1 when that email is in ADMIN_EMAILS. Identity lookup happens inside the hook without delaying the response send and any failure leaves user_email null.
- [ ] The 5000-row buffer cap and 90-day retention prune still apply to the new columns; all inserts stay parameterized.
- [ ] tests/page-hits.test.ts (verifyClerkToken mocked via vi.mock) proves: ip, ua, referrer and visitor_id are stored; the same IP+UA on two different dates gets the same visitor_id; a request with Cookie '__session=tok' resolving to the admin email stores user_email and is_admin=1; a request with no cookie stores user_email null and is_admin 0; a bot UA never calls verifyClerkToken.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/page-hits.ts
- server/db-schema.ts
- tests/page-hits.test.ts

# Implementation notes

Read first: server/page-hits.ts (whole file, 162 lines — recordPageHit at ~73, flush INSERT at ~102, hook at ~130), server/db-schema.ts lines 138-155 (page_hits) and 540-565 (ADDITIVE_COLUMNS shape), server/clerk.ts lines 1-60 (ADMIN_EMAILS, verifyClerkToken — it caches token->email for 60s), tests/page-hits.test.ts.
Steps:
1. Tests first.
2. Add columns via ADDITIVE_COLUMNS (do not edit the CREATE TABLE, existing prod tables need the ALTER path).
3. In the hook, capture everything synchronously from req/reply, then do `void (async () => { email lookup; recordPageHit(...) })()` wrapped in try/catch so the response is never awaited on Clerk.
4. Extend PageHitInput and the INSERT.
Do not touch: server/clerk.ts, server/index.ts, server/routes/*.

# Out of scope

- Admin API or UI changes
- Excluding the owner's own traffic from storage (it must be recorded, only flagged)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/page-hits.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
