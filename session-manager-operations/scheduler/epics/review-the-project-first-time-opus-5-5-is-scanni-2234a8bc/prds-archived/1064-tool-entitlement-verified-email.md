---
title: AI-tool gateway: paid-tier limits must come from the verified Clerk email, not the request body
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-04T08:56:03.333Z
sourcePromptId: review-the-project-first-time-opus-5-5-is-scanni-2234a8bc
agentType: dev-lead
disposition: new-head
planId: pl-mutl69dx-97c017
---
# Goal

primitive (security): today checkRateLimit in server/routes/tools/_shared.ts grants paid or subscription rate limits to whatever `email` the caller puts in the JSON body. Anyone who sends a paying user's email gets Pro limits. This PRD adds a helper that resolves the entitlement email only from the verified Clerk token, and makes the shared inverse-mode generator use it.

# Acceptance criteria

- [ ] server/routes/tools/_shared.ts exports `async function entitlementEmail(req: FastifyRequest): Promise<string | undefined>` that returns the lowercased email from verifyClerkToken(req.headers.authorization) and never reads req.body
- [ ] server/routes/tools/_shared.ts exports `checkRateLimitForRequest(req, ipHash, endpoint, productKey?)`, which calls checkRateLimit with entitlementEmail(req)
- [ ] The inverse-mode generator helper in _shared.ts (the one whose options include `bodyEmail?: string`, near line 164) ignores bodyEmail for entitlement and uses the verified email; bodyEmail stays in the options type marked @deprecated so existing callers still compile
- [ ] New test tests/tool-entitlement.test.ts (mocking server/clerk.js and server/services/stripe.js) proves: a body email of a paying user with no token gets the free limit; a valid token for a paying user gets the paid limit; a token for user A plus body email of user B uses A

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/tools/_shared.ts
- tests/tool-entitlement.test.ts

# Implementation notes

Read first: server/routes/tools/_shared.ts (whole file, ~250 lines; checkRateLimit at about lines 71-95, generator helper near line 160); server/clerk.ts lines 1-81 (verifyClerkToken signature); server/routes/tools/headline-grader.ts lines 40-70 (current bug pattern: email from body passed to checkRateLimit before the Clerk check); an existing route test that mocks server/clerk.js for the mocking pattern (grep -l "vi.mock('../server/clerk.js'" tests/).

Steps:
1. Add entitlementEmail and checkRateLimitForRequest to _shared.ts. Keep checkRateLimit exported and unchanged in signature (callers are fixed in sibling PRDs tool-entitlement-wire-a and tool-entitlement-wire-b).
2. Change the generator helper to use entitlementEmail(req) for rate limiting and funnel events.
3. Write the test. Write it first and see it fail on the generator case.

Do not touch: server/routes/tools/headline-grader.ts, ad-scorer.ts, thread-grader.ts, email-forge.ts, audience-decoder.ts (sibling PRDs own them).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/tool-entitlement.test.ts
timeout 300 pnpm exec tsc -p tsconfig.server.json --noEmit
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
