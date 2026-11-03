# Validation: booking-page-mobile-fold

Base: 0ab59fab. Commit: ab2a2718 (src/styles/booking-page.css, e2e/booking-page.spec.ts only).

## booking-page-mobile-fold — VERIFIED

- Order rules: booking-page.css:94-98 (@media max-width:900px): `.bk-left{display:contents}`, `.bk-top` order 1, `.bk-card` 2, `.bk-foot` 3. `.bk-foot` border-top/padding-top untouched (line 22).
- ≤520px: css ~106-110: `.bk-grid` 3 cols, gap 8px; slot-top/bottom column + flex-start; slot padding 10px; `.bk-date` 18px; slot-top wraps.
- Desktop unchanged: diff touches only the two media blocks; e2e "fits 1280x720 on every step" and "left column spacing matches the design" pass.
- New fold test (spec ~228): slot bottom <= 844, foot top >= card bottom, no sideways scroll: passes.
- New overflow test (spec ~242): scrollWidth <= clientWidth before pick, after pick (✓ Selected), with Tomorrow badge: passes.
- Screenshot test-results/booking-page-390x844-step1.png exists; read it: pitch, then card with "This week" slots in one row of 3 (Tomorrow badges), then "Next week" row. The footer is below the fold, so it is not in the viewport screenshot; its position is asserted by the DOM test instead.

Gate: `timeout 500 pnpm exec playwright test e2e/booking-page.spec.ts` → 18 passed.

## Findings

- Critical: none. Important: none.
- Minor: the screenshot is viewport-only, so it does not show the footer; the footer-after-card check rests on the bounding-box assertion (spec ~237).
- Minor: the author wrote the tests and CSS together (no red run), per their report; tests do exercise the changed behavior.
- Review: self-reviewed the CSS and spec diff; no unsafe input, secrets, or duplicated helpers.
