---
title: Analytics pageview: rate-limit it, take admin status from the verified token, validate `days`
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T23:06:06.111Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1kqopr-64f191
---
# Goal

bug. In server/routes/analytics.ts, the pageview endpoint (~lines 70-142) has no rate limiter, unlike /event (~162). It decides `is_admin` from the client-supplied `body.email` (~80, 101), so anyone can mark their views as admin or spoof an admin's email. It also makes 3 sequential DB round-trips. The admin stats route reads `days` (~191) without validating it, so `days=abc` throws on `new Date(NaN).toISOString()`.

# Acceptance criteria

- [ ] Pageview uses the same rate limiter pattern as /event, with a limit at least as generous; it returns 429 when exceeded.
- [ ] is_admin comes only from a verified Clerk token, using the existing helper in server/clerk.ts that reads the bearer token without requiring it. No token means not admin, and body.email is never trusted for that.
- [ ] The pageview's DB writes use one batch or a single statement where possible (report the round-trip count before and after).
- [ ] `days` is parsed as an integer clamped to [1, 365] with the current default when missing or invalid; `days=abc` returns 200, not 500.
- [ ] New tests/analytics-pageview.test.ts covers: body.email set to an admin address without a token gives is_admin=0; the rate limit gives 429; days=abc gives 200.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/analytics.ts
- tests/analytics-pageview.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: server/routes/analytics.ts lines 1-200; server/clerk.ts (whole; find the optional-token helper used by entitlementEmail in server/routes/tools/_shared.ts ~line 101); tests/clerk-auth.test.ts (how tokens are stubbed). Do not touch: server/clerk.ts, admin query SQL below line 200 (analytics-admin-queries does that).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/analytics-pageview.test.ts tests/observability.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
