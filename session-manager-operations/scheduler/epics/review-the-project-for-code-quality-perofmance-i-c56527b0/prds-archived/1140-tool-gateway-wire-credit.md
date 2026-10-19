---
title: Paid AI tools: take the credit before calling Gemini, refund on failure; adopt the shared credit gate
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T23:12:16.574Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
dependsOn: [tool-gateway-helpers]
planId: pl-mv1kq7fd-a90b4e
---
# Goal

wire. In server/routes/tools/stack-audit.ts, launch-grader.ts and page-roast.ts, the credit is deducted after the Gemini call. A user racing their balance to zero gets a 402, but the paid AI work has already run. Adopt creditGate and toolErrorReply from _shared.ts (landed by tool-gateway-helpers), and move the deduction before the Gemini call with a refund if Gemini fails. Also cache page-roast's public `/api/roasts/stats` (2 COUNT(*) queries per hit) for 60 s.

# Acceptance criteria

- [ ] Each credit route uses creditGate. The deduction happens before the Gemini call, and if deductToken reports success:false the route replies 402 without calling Gemini.
- [ ] If the Gemini call throws after a successful deduction, the tokens are refunded using an existing tokens-service function that adds tokens (name it in the report); if none exists, add `refundTokens(email, amount, reason)` in server/services/tokens.ts with a parameterized insert into the same ledger the deduction uses.
- [ ] No reply body contains err.message.
- [ ] `/api/roasts/stats` serves from a 60 s in-process memo.
- [ ] tests/tool-credit-deduct.test.ts is green, plus new cases: Gemini failure leaves the balance unchanged; deduct failure means Gemini is never called.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/tools/stack-audit.ts
- server/routes/tools/launch-grader.ts
- server/routes/tools/page-roast.ts
- server/services/tokens.ts
- tests/tool-credit-deduct.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Money code — minimal, tested. Read first: server/routes/tools/_shared.ts (creditGate); server/services/tokens.ts (deductToken, grant/add functions); server/routes/tools/stack-audit.ts (whole); server/routes/tools/page-roast.ts (whole); tests/tool-credit-deduct.test.ts. Do not touch: _shared.ts, the five free-tier tool files.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/tool-credit-deduct.test.ts tests/tokens.test.ts tests/tool-entitlement.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
