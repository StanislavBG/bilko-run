---
title: Credits: a failed token deduction must not hand out a paid result
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-09T19:44:52.493Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
disposition: new-head
planId: pl-mv1djwnh-62ac17
---
# Goal

bug. In the credit-gated AI-tool gateways (server/routes/tools/stack-audit.ts ~line 100, launch-grader.ts ~113, page-roast.ts ~88 and ~135) the code reads `(await deductToken(...)).balance` and ignores `success: false`. The balance is checked before the Gemini call, so two concurrent requests can both pass the check and one gets a paid result without paying. Return 402 when deduction fails.

# Acceptance criteria

- [ ] In stack-audit.ts, launch-grader.ts and page-roast.ts every deductToken call checks `success`; on false the route replies 402 with the same body shape the route's existing insufficient-balance 402 uses, and does not return the scored result.
- [ ] No other behavior of those routes changes (rate limits, entitlement, response shape on success).
- [ ] New tests/tool-credit-deduct.test.ts: for each of the three routes, with deductToken forced to return success:false (vi.mock of the tokens service or a DB state where the balance is drained between check and deduct) and Gemini stubbed, the route returns 402 and no result body.
- [ ] Existing tests/tool-entitlement.test.ts and tests/tokens.test.ts stay green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/tools/stack-audit.ts
- server/routes/tools/launch-grader.ts
- server/routes/tools/page-roast.ts
- tests/tool-credit-deduct.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Fastify 5; tests use app.inject. This is money code — keep the change minimal.

Read first: server/services/tokens.ts (deductToken signature and return type); server/routes/tools/stack-audit.ts (whole); server/routes/tools/page-roast.ts lines 40-140; tests/tool-entitlement.test.ts (how routes are built, how Clerk auth and Gemini are stubbed).

Steps: write the failing test first (one route), then fix all three, then extend the test to all three.

Do not touch: server/routes/tools/_shared.ts, the other five tool files, server/services/tokens.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/tool-credit-deduct.test.ts tests/tool-entitlement.test.ts tests/tokens.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
