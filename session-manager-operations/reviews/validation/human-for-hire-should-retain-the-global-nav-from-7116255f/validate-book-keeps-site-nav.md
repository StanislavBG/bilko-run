# Validation: /book keeps the site nav

Base: planning base b28f7e9c no longer an ancestor; reviewed the six commits in `origin/main..HEAD` (81cd630e, 6aec829f, f33f155c, f38983d8, 2c61fb74, 28eaa625). 1716 judged by the landed `feat(book)` commit f38983d8.

Gates re-run in the foreground: `pnpm typecheck` green; `vitest run tests/booking-page-routes.test.ts` 4/4; `playwright test hire-page book-entry-points site-navigation booking-page` 46/46; `pnpm build` then `playwright test book-prerender-parity` 2/2.

## book-inside-site-layout — VERIFIED
- src/App.tsx:231-234 /book and the three redirects sit in the `<Layout />` group; old copies removed; comment now says redirects sit inside Layout; duplicate import comment gone (diff).
- src/components/Layout.tsx:26 `/book` or `/book/` returns '/book'; `/bilko` branch gone.
- e2e/hire-page.spec.ts: redirect tests assert Primary nav + aria-current; client-side nav test (:37), trailing slash (:54), phone Menu (:60) all pass.
- Subject exact.

## book-fits-between-site-chrome — VERIFIED
- shared/booking-page.ts: brand row removed; tests/booking-page-routes.test.ts asserts `bk-top` then `bk-eyebrow`, no `bk-avatar`.
- src/styles/booking-page.css: brand rules gone, eyebrow margin 0 at all widths, no vh min-height on .booking-page; `:has(> main > .booking-page)` column shell at 100dvh; 820px cap at min-width 1196px; chip `display:inline-block` and hover color set; font-size 16/line-height 1.5.
- booking-page.spec.ts fit, Berlin, layout and chip tests pass (46/46 run).

## book-prerender-site-chrome — VERIFIED
- shared/site-chrome.ts has no imports, SITE_SECTIONS order and NOW_ITEMS as specified.
- src/data/portfolio.ts builds SECTIONS from it and re-exports NOW_ITEMS; typecheck green.
- server/bilko-profile-routes.ts:20-60 header, nav (Hire active, aria-current), right cluster, main, footer; text escaped; marker handling unchanged.
- tests/booking-page-routes.test.ts order/nav/aria-current test passes.

## book-prerender-parity-spec — VERIFIED
- e2e/book-prerender-parity.spec.ts reads dist, uses renderBookingPageShell, page.route, no server; JS-off vs JS-on tops within 2px at 1280x720 and 390x844 (pass after fresh build).

## book-docs-site-chrome — VERIFIED
- docs/site.md Hire section states Layout since 2026-11-08, no brand row, updated brief, 820px fill, server chrome from shared/site-chrome.ts and the parity spec with `pnpm build`; route-table row lists shared/site-chrome.ts; no names/emails; only docs/site.md changed.

## book-nav-spec-and-signin-return — VERIFIED
- e2e/site-navigation.spec.ts:8-11 PAGES includes '/book', PILLS Hire is `02 Hire` -> '/book'; all pass.
- src/components/Layout.tsx:129 forceRedirectUrl = pathname + search; only that and the activeSectionPath line changed in Layout.

## Regression sweep (owner's ask)
Covered by passing specs at 1280x720 and 390x844: steps 1-3 fit, Hire active, Blog nav without reload, phone Menu opens, chips keep own styling, card within first screen. I did not do a manual visual walk of calendar links or the time-zone select beyond what the specs assert (booking success test checks calendar actions).

## Findings
Critical: none.
Important: none.
Minor:
- src/styles/booking-page.css:121-122 `.bk-chips` switched from flex to inline flow with `line-height:0` and negative margin to dodge the site-chrome `.bk-chip` rule; it works (chip test passes) but couples to site-chrome.css and is fragile if chip text wraps.
- server/bilko-profile-routes.ts:58 server Search chip shows "Ctrl K" while Layout shows ⌘K on Apple devices; a one-label shift on swap, accepted by the PRD.
- Sign-in chip is absent from server HTML (by design); header width may shift slightly once Clerk loads.
