# Ship: free hour

Pushed SHA: 08ceed8bf75edcf639d2ccfbbe8c05577b314e73 (origin/main, StanislavBG/bilko-run only; 6d4f3927..08ceed8b), pushed 2026-11-01 6:51 PM PST. Live by 6:54 PM PST.
Validation record: all 7 PRDs VERIFIED, no Critical or Important findings.

## Commits (cherry-picked in order onto origin/main in /tmp/ship-free-hour, removed afterwards)
- 9ec33ecb feat(hire): free-hour claim and cancel in the booking store
- 27ad0161 feat(hire): POST free-hour route with .ics and owner notice
- 069b1f96 feat(hire): approved Human For Hire copy and page styles
- d9a5df4e feat(hire): serve /bilko with the copy in the HTML
- 7858d483 feat(hire): Bilko profile page and free-hour booking widget
- 3a330f64 feat(hire): list Human For Hire in the catalog, header and home page
- 08ceed8b feat(hire): admin bookings endpoint

## Checks
- PASS pnpm test (169 files, 1866 passed, 20 skipped), pnpm typecheck, pnpm build, all exit 0 on the pushed tree.
- PASS /bilko: 'Human For Hire' present, 'Start with a free hour' present, '$100 / hour' x3.
- PASS /bilko, /hire, /human-for-hire all 200, identical bodies after removing the nonce. /projects/human-for-hire/ is 301 to https://bilko.run/bilko.
- PASS GET /api/admin/bookings?days=7: keys days, free_hours_booked, paid_hours, mailer_configured, upcoming (array, 0).
- PASS /api/projects lists human-for-hire with url https://bilko.run/bilko; MCP list_projects lists human-for-hire.
- PASS browser (headless Chromium): 1280x720 heading shown, 9 time buttons, hero 'Book a free hour' scrolls the card into view; header Hire link from / reaches /bilko; 390x844 scrollWidth 390 = innerWidth 390.
- Screenshots: /tmp/ship-free-hour-live/1280.png, /tmp/ship-free-hour-live/390.png (both viewed).

## Booking transcript
- GET slots: 9 slots; last slot used for the check.
- POST /free-hour?dryRun=1 -> 503 {error: booking_unavailable}. Nothing booked, so nothing to cancel; steps b to d skipped.
- Owner action: set RESEND_API_KEY, MAIL_FROM and BILKO_INBOX on Render. Until then the live page refuses bookings.

BOOKING-LIVE: BLOCKED-MAIL-ENV (RESEND_API_KEY, MAIL_FROM, BILKO_INBOX unset on Render)

SHIP: PASS
