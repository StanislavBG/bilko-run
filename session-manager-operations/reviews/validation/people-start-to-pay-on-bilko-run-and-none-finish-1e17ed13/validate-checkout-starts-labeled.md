# Validation: checkout-starts-labeled

Base: 4bd58cff. Commits: 7adc431b (1871), 220314d3 (1872), 466b9572 (1873). PRD files found in prds-archived/ (1871, 1872, 1873).
Gates re-run: `pnpm vitest run` on the three new test files: 16/16 pass. `pnpm typecheck`: exit 0.
/code-review and /security-review were not run as separate agents; I self-reviewed the diff (bound params, no path handling, no secrets).

## checkout-start-visitor-class — VERIFIED
- web-products.ts INSERT adds is_bot from `classifyVisitor(UA) === 'human' ? 0 : 1` (server/routes/web-products.ts ~L330).
- agent-buy.ts INSERT does the same (server/routes/agent-buy.ts ~L178).
- Behavior is unchanged apart from the extra column. An empty UA gives 'script' (server/services/analytics.ts:111), so it counts as not human.
- tests/checkout-start-visitor-class.test.ts covers curl and Chrome UAs on both routes, plus a missing UA. Passes.

## click-burst-marks-script — VERIFIED
- recordClickForBurst (server/page-hits.ts) marks via the existing markProbeVisitor. It requires the same path, a differing (href, label), and ts within 300 ms.
- The map is bounded: 5000 keys, 8 clicks per session.
- The route calls it only when a session id exists (server/routes/analytics.ts ~L309). It never blocks, and the INSERT and status codes are unchanged.
- tests/click-burst-marks-script.test.ts (6 tests) pass. They cover different targets at 100 ms, a double click, 2 s apart, and different paths.

## admin-checkout-starts-split — VERIFIED
- Per-product checkoutStartsHuman and checkoutStartsAutomated sum to checkoutStarts (admin-web-products.ts FE_AUTOMATED/SPLIT_COLS). Automated means is_bot=1 or a bot-flagged page_views row for the visitor or session.
- checkoutStartsAll and coffeeRedirects are added. The owner exclusion reuses mineExclusionSql, and all SQL uses bound parameters.
- WebProductsTab.tsx shows "human H · automated A" per product, plus a summary line.
- tests/admin-checkout-starts-split.test.ts (3 tests) pass.

## Findings
- Critical: none.
- Important: none.
- Minor: a click with no session id skips the burst rule (server/routes/analytics.ts ~L309). This is consistent with the PRD, which keys the rule on the session id.
- Minor: the FE_AUTOMATED correlated EXISTS subqueries scan page_views per row (server/routes/admin-web-products.ts). The cost is acceptable at the current volume, and an index on page_views(visitor_id, session_id) would help if it grows.
