# Validation sweep: ship-free-hour, hire-report-counts

Base: 0976b254 (from PRD notes). PRD files: prds-archived/1570-ship-free-hour.md, prds-archived/1580-hire-report-counts.md.

## ship-free-hour — VERIFIED
- Commits: the seven feat(hire): commits (9ec33ecb … 08ceed8b) are on origin/main (`git log origin/main --grep='^(feat|fix)\(hire\)'`); `git branch -r --contains 08ceed8b` → origin/main.
- Record exists: reviews/deploy/…/ship-free-hour.md carries pushed SHA 08ceed8b, commits, PST times, per-check PASS, booking transcript, screenshot paths, `BOOKING-LIVE: BLOCKED-MAIL-ENV`, `SHIP: PASS`.
- Gate (`grep -q 'SHIP: PASS'`): the line is present in the record.
- Live checks (curl/browser/admin) are as recorded by that job; I did not re-run them against bilko.run (no network checks in this sweep). The record's claims are internally consistent.
- Caveat: booking is not proven live. The dry run returned 503 booking_unavailable (RESEND_API_KEY, MAIL_FROM, BILKO_INBOX unset on Render). This is an owner action, which the PRD allows as BLOCKED-MAIL-ENV.

## hire-report-counts — VERIFIED
- AC1: server/routes/admin-funnel.ts adds `AND b.slug <> ?` bound to FREE_HOUR_SLUG (imported from services/service-bookings.js); test 'does not count free-hour bookings as booked' in tests/admin-funnel.test.ts.
- AC2: server/page-hits.ts `HOST_PAGE_RE = /^\/(?:bilko|hire|human-for-hire)\/?$/` maps to slug human-for-hire in slugFromPath; test in tests/page-hits.test.ts covers the three paths, `/bilko/`, and `/bilkos` → null.
- AC3: commit a395d789 subject is exactly `feat(menu): keep free hours and /bilko straight in the reports`.
- Gate re-run: `pnpm test` → 166 files passed, 1858 passed, 15 skipped; `pnpm typecheck` → exit 0.
- Commit a395d789 also touched tests/admin-funnel.test.ts and tests/page-hits.test.ts. The PRD's Files list names only the two server files, but its ACs require tests, so this is fine.

## Findings
### Critical
None.
### Important
None.
### Minor
- tests-only files outside the PRD's Files list (see above); the PRD list should have included them.
- a395d789 (menu retirement plan) is not yet on origin/main: ship-menu-retired recorded "blocked, nothing pushed". Until it ships, live reports still count free hours as booked and don't count /bilko traffic.
- Self-review of the diff found no unsafe input handling: SQL stays parameterized, and the path regex is anchored.
