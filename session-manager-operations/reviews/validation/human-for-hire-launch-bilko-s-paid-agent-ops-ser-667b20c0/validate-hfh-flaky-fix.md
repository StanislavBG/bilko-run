# Validation: 1505-hfh-fix-flaky-webhook-test

Base: c1ba6f77. Plan commits: `a82d1000` only (`git log c1ba6f77..HEAD`); diff is +3 lines in `tests/stripe-webhook-web-products.test.ts`.

## 1505-hfh-fix-flaky-webhook-test — VERIFIED

- AC1 root cause in commit body: `a82d1000` body names it (singleFork shares one `process.env`; `tests/agent-buy.test.ts` sets `STRIPE_PRICE_WP_HFH_FRACTIONAL=price_hfh_fractional` in `beforeEach` (lines 42-50) with no `afterEach` restore (grep: none), so the webhook price check mismatches and `recordOrder` is never called). Config confirmed: `vitest.config.ts:16-17` `pool: 'forks'`, `singleFork: true`.
- AC2 fix at the cause, no retry/skip/loosening: diff adds `delete process.env.STRIPE_PRICE_WP_HFH_FRACTIONAL` / `_SESSION` in `beforeEach` (`tests/stripe-webhook-web-products.test.ts` ~line 80-83). No `it.retry`, `.skip`, or assertion edits in the diff. `server/routes/stripe.ts` untouched (not a webhook ordering bug).
- AC3 assertions intact: `tests/stripe-webhook-web-products.test.ts:156-157` still asserts `recordOrder` with slug `hfh-fractional`, email `buyer@test.com`, paymentStatus `paid`, and `saveOneTimePurchase` not called.
- AC4 gate: `timeout 500 pnpm vitest run` x3, each exit 0, each `Test Files 144 passed | 2 skipped (146); Tests 1608 passed | 14 skipped (1622)`. `timeout 300 pnpm typecheck` exit 0.

## Findings

### Critical
- none

### Important
- none

### Minor
- `tests/agent-buy.test.ts:37-50`: leak source is still present (replaces `process.env` in `beforeEach`, no `afterEach` restoring `OLD_ENV`). Any other file that reads price env vars and runs after it can flake the same way. The fix only protects the one webhook file. Suggest an `afterEach(() => { process.env = OLD_ENV })` there (a separate PRD).
- Proof limits: the flake depends on file order, so the three green runs show no regression but cannot prove the fix by themselves. The causal argument rests on the code reading above and the planner's earlier reproduction.
- Review: `/code-review` and `/security-review` were not run; I self-reviewed the 3-line test-only diff. It has no input handling, secrets, or path concerns and duplicates no helper.
