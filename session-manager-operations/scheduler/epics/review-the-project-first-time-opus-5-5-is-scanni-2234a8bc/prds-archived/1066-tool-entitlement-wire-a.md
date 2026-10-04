---
title: Wire verified-email entitlement into headline-grader, ad-scorer, thread-grader
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-04T08:56:52.973Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
dependsOn: [tool-entitlement-verified-email]
planId: pl-mutl69dx-97c017
---
# Goal

wire (security): replace every use of the request-body `email` for rate-limit or paid-tier decisions in three AI-tool gateway routes with the verified Clerk email from `entitlementEmail` / `checkRateLimitForRequest`. These come from server/routes/tools/_shared.ts, landed by PRD tool-entitlement-verified-email.

# Acceptance criteria

- [ ] server/routes/tools/headline-grader.ts, ad-scorer.ts and thread-grader.ts no longer read `body.email` / `body?.email` for checkRateLimit, entitlement or funnel events; they use checkRateLimitForRequest or entitlementEmail(req)
- [ ] These three files no longer pass `bodyEmail` to the shared generator helper
- [ ] Each route calls verifyClerkToken at most once per request (reuse the resolved email for enforceCallLimits)
- [ ] Server typecheck and the tool-entitlement test pass

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/tools/headline-grader.ts
- server/routes/tools/ad-scorer.ts
- server/routes/tools/thread-grader.ts

# Implementation notes

Read the landed code first: server/routes/tools/_shared.ts (entitlementEmail, checkRateLimitForRequest).
Read first: server/routes/tools/headline-grader.ts lines 40-70 (pattern: `const email = (body?.email ?? '').trim().toLowerCase()` then `checkRateLimit(ipHash, ENDPOINT, email)`, then later `verifyClerkToken` for enforceCallLimits); ad-scorer.ts lines 40-70 and 160-180; thread-grader.ts lines 35-65 and 155-175.

Steps: in each handler, resolve `const verifiedEmail = await entitlementEmail(req)` once near the top. Pass it to checkRateLimit (or use checkRateLimitForRequest) and reuse it for enforceCallLimits instead of a second verifyClerkToken call. Drop `email` from the body cast types. Remove `bodyEmail:` from generator-helper calls.

Do not touch: server/routes/tools/_shared.ts, email-forge.ts, audience-decoder.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm exec tsc -p tsconfig.server.json --noEmit
timeout 300 pnpm vitest run tests/tool-entitlement.test.ts
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
