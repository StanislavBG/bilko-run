# Ship: booking-page-mobile-fold

- Pushed SHA: c498b2177c6eb6c86205f86ab0466d30e726aa03 (origin/main, 2c6b6710..c498b217)
- Commit: fix(booking): show open times on the first phone screen (source ab2a2718, cherry-picked onto origin/main in a throwaway tree; no other local-main commit pushed)
- Pushed: 2026-11-02 7:58 PM PST; deploy seen (uptime reset) about 8:02 PM PST
- Pushed to origin only (https://github.com/StanislavBG/bilko-run.git)

## Checks
- Validation record VERIFIED, no Critical/Important: PASS
- pnpm test (172 files passed, 1888 tests passed, 15 skipped): PASS
- pnpm typecheck: PASS
- pnpm build: PASS
- Deploy: /api/health uptime (59.7 s) below seconds since push (215 s): PASS
- Live 390x844 (America/New_York): first .bk-slot bottom 735.7 <= 844: PASS
- Live 390x844: .bk-foot top 1114.7 >= .bk-card bottom 1086.7: PASS
- Live 390x844: no sideways scroll (scrollWidth 390 = clientWidth 390): PASS
- Live 1280x720 (Europe/Berlin): scrollHeight 720 <= 720: PASS
- Only viewed /book; no slot click, booking or buy button: PASS

Screenshots: /tmp/ship-booking-page-mobile-live/mobile.png, desktop.png

SHIP: PASS
