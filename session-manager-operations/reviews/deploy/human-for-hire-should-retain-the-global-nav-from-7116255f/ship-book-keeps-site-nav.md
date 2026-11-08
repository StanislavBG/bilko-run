# Ship: /book keeps the site nav

Pushed SHA: `c0e3c9154c4cc442a688ca93b01f0fe010a37d7f` (origin/main `3cd25331..c0e3c915`, push to `https://github.com/StanislavBG/bilko-run.git` only).
Pushed: 2026-11-08 9:38:35 AM PST. Deploy seen: 9:41:41 AM PST. Live checks: 9:41–9:42 AM PST.

## Commits (log order, cherry-picked onto origin/main 3cd25331 in /tmp/ship-book-site-nav)

| Local | Pushed | Subject |
| --- | --- | --- |
| 81cd630e | 5b637eaf | fix(hire): /book keeps the site header, nav and bottom bar |
| 6aec829f | 72bf85bb | fix(nav): site-nav e2e covers /book; header sign-in keeps the query |
| f33f155c | 0b94b760 | fix(book): fit /book between the site header and bottom bar |
| f38983d8 | 171fa21f | feat(book): server-rendered /book carries the site header, nav and bottom bar |
| 28eaa625 | c806cb14 | docs(hire): /book lives inside the site layout |
| 2c61fb74 | c0e3c915 | test(book): server-rendered /book lines up with the React page |

No other commit went out in this push. Two record commits (58237f3e, 9b8938d3) reached origin/main afterwards from another writer, not from this push.

## Checks

- PASS: validation record shows all six PRDs VERIFIED (1714, 1715, 1716, 1717, 1718, 1721); Critical: none, Important: none.
- PASS: each of the six subjects appeared exactly once in `origin/main..HEAD`; none were on origin yet (`git cherry` all `+`); cherry-picks applied cleanly.
- PASS: on the pushed tree, `pnpm test` exit 0 (181 files passed, 2 skipped; 2137 tests passed, 15 skipped), `pnpm typecheck` exit 0, `pnpm build` exit 0.
- PASS: push accepted on the first try (fast-forward).
- PASS: deploy: `/api/health` uptime 62s at 189s after the push (try 7 of 20).
- PASS: `curl https://bilko.run/book` 200; HTML has `class="bk-header"`, `aria-label="Primary"`, `<a class="bk-pill-nav active" href="/book" aria-current="page">`, `class="booking-page"`, `Bring your AI idea. Leave with a plan.`
- PASS: `curl -sI https://bilko.run/hire` gives `HTTP/2 301` and `location: /book`.
- PASS: 1280x720, clicking Primary Hire on /blog ends on `/book`; `header.bk-header` visible; Hire `aria-current="page"`.
- PASS: 1280x720 America/Los_Angeles: `.bk-card` bottom 636 (≤ 720); scrollHeight 720; 9 slots showed on the first run.
- PASS: JS-off vs JS-on `.bk-card` top: 1280x720 102 vs 102 (0px); 390x844 470.6 vs 470.6 (0px). Both measured after `document.fonts.ready` plus 1s. A first pass that measured JS-off right at `load`, before web fonts swapped, read 458.8 vs 470.6 at 390x844 (and 104 vs 102 at 1280). A diagnostic showed the JS-off page settles to 470.6 with the same header/top heights, so that gap was font-swap timing, not layout drift.
- PASS: 390x844 Menu button visible.

View only: no slot, Continue, booking or Stripe button was clicked. Screenshots: /tmp/ship-book-site-nav-live/ (not in the repo).

SHIP: PASS
