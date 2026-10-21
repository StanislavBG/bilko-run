# Validation: 1509-hfh-stripe-tests-env-restore

Base: 9884a919. Commit under review: f68714fd (tests/coffee-checkout.test.ts, tests/stripe-checkout-success.test.ts only).

## 1509-hfh-stripe-tests-env-restore — VERIFIED

- AC1 (coffee-checkout): all three env-replacing describes (`GET /coffee`, webhook, `/checkout/success`) have `afterEach(() => { process.env = OLD_ENV; })` with their own OLD_ENV — tests/coffee-checkout.test.ts:83-85, 120-122, 164-166.
- AC2 (stripe-checkout-success): the four describes restore in afterEach — tests/stripe-checkout-success.test.ts:72-74, 134-136, 225-227, 304-306. The former bare `process.env = { ...process.env, ... }` now captures `OLD_ENV` (line ~302), builds from it (line 310) and restores it.
- AC3 (assertions unchanged): `git diff 9884a919..HEAD` shows only import additions, afterEach blocks, one OLD_ENV const and one `process.env`→`OLD_ENV` spread. No assertion lines touched. Both files pass: 28/28.
- AC4 (full run twice): `pnpm vitest run` x2 → 144 files passed | 2 skipped, 1608 tests passed | 14 skipped, both runs. `pnpm typecheck` clean (all three tsc projects).

## Findings

Critical: none.
Important: none.
Minor:
- Grep of `tests/` for `process.env =` assignments: every remaining one has a paired restore (agent-buy.test.ts:39-40, stripe-webhook-signature.test.ts:92, stripe-webhook-attribution.test.ts:60, stripe-billing-portal.test.ts:35, stripe-webhook-web-products.test.ts:88). No unrestored assignments found.
- The dev-lead did not run /code-review or /security-review; test-only diff, nothing in scope for security. Self-review found no issues.
