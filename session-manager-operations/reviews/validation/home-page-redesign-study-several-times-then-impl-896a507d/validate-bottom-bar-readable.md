# Validation: bottom-bar-readable-rotation (PRD 1428)

Base: be1a85be. Commit under review: 6fa6e4ba (Layout.tsx, site-chrome.css, e2e/site-navigation.spec.ts only; `src/data/portfolio.ts` and `src/pages/*` untouched per `git diff --stat`).

VALIDATION: bottom-bar-readable-rotation VERIFIED

## Criteria evidence
- 12000ms + ~400ms crossfade: `src/components/Layout.tsx:19-20` `NOW_ROTATE_MS = 12000`, `NOW_FADE_MS = 400`; `.is-fading` opacity transition `.4s` at `src/styles/site-chrome.css:59-60`; span no longer remounted (key removed).
- Pause/reduced motion: `Layout.tsx:36` returns before the interval when `prefers-reduced-motion: reduce` matches; ticks skipped while `pausedRef.hover/focus`; footer handlers `Layout.tsx:152-158`, blur only clears when `relatedTarget` is outside the footer; CSS `.bk-bb-now { transition: none }` in the reduced-motion block.
- Full-width at 1280/1440 on `/` and `/contact`, 52px: asserted in the new e2e (scrollWidth <= clientWidth for all 4 items, height 52) — passed. CSS keeps `height: 52px`; the <=900px rules were not modified.
- New test `bottom bar text is calm and readable` exists (`e2e/site-navigation.spec.ts:97`) using `page.clock`; covers 6s/13s, 30s hover, 30s reduced motion, 1280+1440 per item — passed (49.6s).
- No fixme/skip in the three specs (grep clean).

## Gate (re-run)
- `timeout 300 pnpm typecheck` -> exit 0
- `timeout 300 pnpm exec playwright test e2e/site-navigation.spec.ts e2e/home-radar.spec.ts e2e/projects-hub.spec.ts` -> 20 passed (port 3002 was free beforehand)

## Findings
### Critical
- None.
### Important
- None.
### Minor
- `src/styles/site-chrome.css:50` grid changed from `1fr auto 1fr` to `minmax(0,1fr) auto auto`; the centre hint is no longer exactly centred on the bar (right column sizes to content). Design nit, not tested.
- `src/components/Layout.tsx:152-158` focus pause is a ref flag; if a focused element inside the footer unmounts (route change) without a blur with an outside relatedTarget, pause could stick. Low likelihood (footer links are persistent).
- `src/components/Layout.tsx:36` reduced-motion is read once; toggling the OS setting mid-session needs a reload.
- The <900px "no horizontal overflow" claim is not covered by the new e2e (rules unchanged, so existing behaviour).
