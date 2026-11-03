# Validation sweep: ship-booking-page-fit

Base: 603aa72f. PRD: prds-archived/1605-ship-booking-page-fit.md. Commits since base touching the PRD's file: 577e7327 (the ship record only; the PRD ships a pushed fix, not a file diff).

## ship-booking-page-fit — VERIFIED
- Validation precondition: validate-booking-page-fit.md:6 "booking-page-fits-720 — VERIFIED", lines 22-23 Critical none, Important none.
- origin/main contains the fix: `git branch -r --contains 2c6b6710` -> origin/main; `git log 8ddcef09..origin/main` lists only 2c6b6710 (no other local-main commit pushed).
- Pushed commit is limited to the 4 expected files: `git show --stat 2c6b6710` -> e2e/booking-page.spec.ts, shared/booking-page.ts, src/styles/booking-page.css, tests/booking-page-routes.test.ts.
- test/typecheck/build on the pushed tree: taken from the ship record (172 files, 1888 passed, 15 skipped; typecheck and build PASS). Not re-run: the throwaway tree is gone.
- Live /book (re-checked 2026-11-02 ~7:46 PM PST): curl -> HTTP 200; `class="bk-inner"` count 1; `class="bk-top"` count 1.
- Live /bilko has an h1 (count 1).
- /api/health uptime 239 s, so the new build is serving.
- 1280x720 scrollHeight: taken from the ship record (720, screenshot /tmp/ship-booking-page-fit-live/book-1280x720.png); not re-measured.
- No slot click, booking or Stripe click: ship record states it; nothing here contradicts it.
- Ship record exists with pushed SHA, PST times, and `SHIP: PASS`.
- Gate: `timeout 10 grep -q 'SHIP: PASS' <ship record>` re-run, exit 0.

## Findings
- Critical: none.
- Important: none.
- Minor: test/typecheck/build and the 720px height are carried from the ship record and were not independently re-run in this sweep.
