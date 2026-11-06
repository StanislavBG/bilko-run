# Ship: hire-page-is-booking-page

SHIP: PASS

Pushed SHA: 80d865a8faa73f1088709dc73dc5ace23a76f0a7 (origin/main, c4097bfc..80d865a8, no force, origin only: StanislavBG/bilko-run)
Push time: 6:28 PM PST, 2026-11-05. Deploy seen live at about 6:32 PM PST (/api/health uptime 45s, below the 202s since push).

## Commits (cherry-picked from local main onto origin/main c4097bfc, no conflicts)
- 339bc710 feat(hire): /bilko, /hire and /human-for-hire redirect to /book (was ab066876)
- 53812f83 feat(offers): bilko-hour page is /pricing; Human For Hire card links /book (was b40c598a)
- a0d5efc4 fix(book): match Booking Page 1a frame and time step (was da5bed5f)
- 393fad80 fix(book): match Booking Page 1a details and done steps (was f3be3cf6)
- 8d6e1a94 feat(book): show the paid-hour Checkout notice on /book (was 567e140b)
- 8234e127 feat(hire): site nav Hire opens /book; retire the profile page (was 1eb0098c)
- 80d865a8 docs(hire): retire the profile copy; /book is the Hire page (was 492aa95f)

The validation-record commit (5e1fb3a0) and other local-main commits were not pushed.

## Checks
- Validation record: all seven PRDs VERIFIED, no Critical or Important open: PASS
- pnpm test (1913 passed, 15 skipped), pnpm typecheck, pnpm build on the pushed tree: PASS
- Push went only to origin, only these seven commits: PASS
- /bilko, /hire, /human-for-hire: 301, location /book: PASS (the first curl of /bilko and /hire returned no headers; a retry 301'd both with location /book)
- /projects/human-for-hire/thanks/?session_id=x&offer=bilko-hour: 301 to /book?session_id=x&offer=bilko-hour: PASS
- /book 200 with 'Bring your AI idea. Leave with a plan.': PASS
- /api/offers bilko-hour pageUrl https://bilko.run/pricing: PASS
- /api/projects human-for-hire url https://bilko.run/book: PASS
- Chromium 1280x720, no clicks: nav link on / (text '02Hire', the 02 is an index number) has href /book: PASS
- /hire ends on https://bilko.run/book, scrollHeight 720; 'Pick a time' heading (y 123, h 31) and 'Times in' select (y 123, h 31) share a row: PASS
- /book?offer=bilko-hour&session_id=x shows 'Payment received. Thank you. Bilko will email you shortly to plan your hours.': PASS

Screenshot: /tmp/ship-hire-page-live/book.png (outside the repo).
