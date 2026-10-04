---
title: Wire verified-email entitlement into email-forge and audience-decoder
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 7
createdVia: scheduler-api
issuedAt: 2026-10-04T08:56:58.855Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
dependsOn: [tool-entitlement-verified-email]
planId: pl-mutl69dx-97c017
---
# Goal

wire (security): replace every use of the request-body `email` for rate-limit or paid-tier decisions in email-forge and audience-decoder with the verified Clerk email from `entitlementEmail` / `checkRateLimitForRequest`. These come from server/routes/tools/_shared.ts, landed by PRD tool-entitlement-verified-email. AudienceDecoder owns a one-time-purchase tier (productKey), which must also key off the verified email.

# Acceptance criteria

- [ ] server/routes/tools/email-forge.ts and server/routes/tools/audience-decoder.ts no longer read `body.email` / `body?.email` for checkRateLimit, hasPurchased, entitlement or funnel events
- [ ] audience-decoder.ts passes its productKey through checkRateLimitForRequest (or checkRateLimit with entitlementEmail(req)); the unused `hasPurchased` import is removed
- [ ] Each route calls verifyClerkToken at most once per request
- [ ] Server typecheck and the tool-entitlement test pass

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/tools/email-forge.ts
- server/routes/tools/audience-decoder.ts

# Implementation notes

Read the landed code first: server/routes/tools/_shared.ts (entitlementEmail, checkRateLimitForRequest).
Read first: server/routes/tools/email-forge.ts lines 10-60 and 140-180 (the `_efEmail` / `efcEmail` pattern); server/routes/tools/audience-decoder.ts lines 1-60.

Steps: in each handler, resolve the verified email once, use it for the rate limit and for enforceCallLimits, and drop `email` from the body cast types. Remove `bodyEmail:` from any generator-helper calls in these files.

Do not touch: server/routes/tools/_shared.ts, headline-grader.ts, ad-scorer.ts, thread-grader.ts.

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
