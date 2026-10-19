# Publish: home radar pause + site navigation

- Validation record: VERIFIED (both sentinels, no Critical/Important).
- Pushed `origin/main`: `c9eaa8e0..44527318` (fast-forward) at 10:56 AM PDT.
- Pre-push checks (main checkout): `pnpm typecheck` OK; `pnpm vitest run` 117 files / 1306 tests pass; Playwright site-navigation + home-radar + projects-hub 19 passed.
- Bundle before: `assets/index-CLT5F1aq.js` (10:56 AM PDT). After: `assets/index-DCoNS41Q.js` (seen on poll 6, by 10:58 AM PDT).

## Live smoke (https://bilko.run, 10:58 AM PDT)
- PASS `Make. Ship.` heading visible
- PASS hovering `.hr-readout` keeps `[data-radar-sweep]` transform unchanged for 1500ms
- PASS key `1` lands on `/projects?p=session-manager`
- PASS immediate Back returns to `/` and stays 1500ms
- PASS `/contact` shows header pills and `.bk-bottombar`
- PASS no `console.error`

Coffee link and `[data-buy]` were not clicked.
