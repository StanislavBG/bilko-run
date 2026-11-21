# Validation: checkout labels reach the funnel

Base: 0d4d5c49 (known). Commits: a0a955a8 (click burst), ad16e810 (unlabeled split). Gates re-run: all green (vitest 3 files / 22 tests; split test 7 tests; `pnpm typecheck` exit 0).

## click-burst-flags-automation-visitor — VERIFIED
- automationBackfillStmts exported: server/page-hits.ts:326; same three UPDATE SQL/args moved verbatim from analytics.ts; webdriver path uses it (analytics.ts ~201).
- Click route: `burst` from recordClickForBurst; `burstVid = readSessionIds(req.headers.cookie).visitorId` (cookie only), `markAutomationVisitor` gates backfill (analytics.ts ~288-295); backfill batch runs after the click insert (~314).
- Stored is_bot: `bot = burst || ...` (analytics.ts ~298); no cookie → burstVid null → no backfill, probe mark only.
- tests/click-burst-flags-automation.test.ts: 4 tests pass (vid flagged, 3 tables backfilled, double click flags nothing, cookieless adds no row).
- analytics-automation and click-burst-marks-script tests pass unchanged (git diff shows neither modified).

## checkout-split-unlabeled-before-labels — VERIFIED
- CHECKOUT_LABELS_SINCE = '2026-11-21 02:39:00' with 7adc431b comment: admin-web-products.ts:~18-22; bound parameter, first arg in both SPLIT_COLS queries (placeholder order correct: SELECT `?` precedes WHERE args).
- checkoutStartsUnlabeled added; human = n − automated − unlabeled; automated unchanged; checkoutStartsAll has unlabeled.
- WebProductsTab.tsx: splitLabel appends ` · before labels U` when U>0; title tooltip text matches; summary line uses it and includes unlabeled in the total.
- Test cases added (before-cutoff unlabeled, bot-visitor automated, after-cutoff human, sum invariant); 7 tests pass.

## Combined check — CONFIRMED by code reading
- FE_AUTOMATED (admin-web-products.ts:15-17) flags a checkout row when `page_views.visitor_id = fe.visitor_id AND is_bot = 1`.
- Burst backfill updates `page_views SET is_bot=1 WHERE visitor_id = <bilko_vid cookie>` (page-hits.ts:343-346).
- web-products.ts:329-336 writes funnel_events.visitor_id from `readSessionIds(req.headers.cookie).visitorId` — the same cookie id. So a crawler that bursts then checks out reads automated (backfill covers earlier views; later views are bot via automation_visitors; funnel row itself is also keyed by that vid). Not exercised end-to-end by a single seeded test; the two halves are each tested.

## Review
/code-review and /security-review not run as separate commands; self-reviewed. Flag key is only the request's own cookie (a client flags only itself); SQL parameterized; no secrets/paths.

## Findings
- Critical: none. Important: none.
- Minor: backfill batch runs after the click insert in a separate batch (analytics.ts ~314); a failure between them is swallowed by the never-fail catch, leaving burst unbackfilled once (markAutomationVisitor already recorded the vid, so no retry). Low impact.
- Minor: the range includes unrelated rebuilt public/projects/threewinds assets (commit b4e0b3f6), outside these PRDs.
- Minor: no single end-to-end test of burst → checkout → /api/admin/web-products.
