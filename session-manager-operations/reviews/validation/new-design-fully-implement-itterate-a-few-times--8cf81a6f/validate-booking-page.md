# Validation: booking page plan (Base 1d63ec8f)

Commands re-run in the foreground on HEAD of this worktree: all PRD gates. 10 vitest files / 66 tests pass; `pnpm typecheck` exit 0; `pnpm build` exit 0; `playwright test e2e/booking-page.spec.ts` 14/14 pass. `/code-review` and `/security-review` were not run as separate tools; I reviewed the diff by hand (input handling, secrets, path traversal, reuse). All 10 PRD files were found under `prds-archived/`.

## free-hour-cancel-test-red — VERIFIED
- Commit ff3f8a20 pins the clock in tests/free-hour-routes.test.ts so `slots()[8]` always exists (test bug). The test passes: free-hour-routes (8) and service-bookings-store (11) are green.

## slots-report-taken — VERIFIED
- server/routes/service-bookings.ts:63-68 returns `taken`, filtered to claimed slots and sorted ascending; :83 maps it to `{startMs,endMs}` only, so no email/id/slug/intake is exposed.
- tests/service-booking-routes.test.ts +18 lines pass. docs/host-contract.md slots row documents `taken`.

## free-hour-topic-tags — VERIFIED
- shared/free-hour-topics.ts:1-13 has no imports, the exact allowlist, and `parseTopicTags` with the specified semantics.
- server/routes/free-hour.ts:44-45 returns 400 on a null result; :61 stores `{topic, tags}`.
- server/routes/admin-bookings.ts:59-73 composes `topic` as "tags — note" and adds `tags`; slug/startMs/endMs/email/createdAt are unchanged.
- tests/free-hour-topic-tags.test.ts (4) and admin-bookings (4) pass. The docs free-hour row and the Booking mail paragraph are updated.

## free-hour-reschedule — VERIFIED
- server/services/service-bookings.ts:217-247: `rescheduleFreeHour` does one UPDATE on token + slug + `slot_start_ms > now`, runs through `claimQueue`, and maps a unique violation to `taken`. id/email/intake/created_at are untouched.
- server/routes/free-hour.ts:128-178: rate limit 10/min (429), token regex and safe-integer check (400), non-open slot 409 (the booking's own current start fails the same check), 404 on unknown token. Success returns `{booking, ics, cancelToken}`. The BILKO_INBOX notice 'Rescheduled: free hour' is wrapped in try/catch.
- tests/free-hour-reschedule.test.ts (4) pass. The docs endpoint row is after the cancel row.

## booking-view-helpers — VERIFIED
- src/lib/bookingView.ts (216 lines) exports the helpers. tests/booking-view.test.ts has 15 tests covering zones, the tomorrow flag, week grouping, DST, an invalid zone and the URL formats; all pass.

## booking-page-copy-and-route — VERIFIED
- shared/booking-page.ts:4-20 has the title, description, left-column HTML copy verbatim, and the prerender wrapper with 'Pick a time' and 'Loading open times…'.
- server/bilko-profile-routes.ts:15-17 and :37-42 serve /book and /book/ with `private, no-store`, sharing `injectPrerender` with /bilko. server/og-meta.ts:54 maps /book to the title, description and url.
- tests/booking-page-routes.test.ts (3) and bilko-profile-routes (5) pass.

## booking-page-discoverability — VERIFIED
- server/page-hits.ts:72 includes /book (and with trailing slash); server/routes/sitemap.ts:69 lists it at monthly / 0.9; shared/signin-capture.ts:17 maps it. tests/booking-page-discoverability.test.ts (3) pass.

## booking-page-styles — VERIFIED
- src/styles/booking-page.css:3 defines every token with the exact values; every rule is scoped under .booking-page. Desktop sizes match (:4 1280px / 48px 56px / gap 48px 64px; card 620px, radius 16, padding 28px 32px, shadow). Breakpoints at 900 and 520px are present (:101-110), including the 2-column grid and the 34px h1.
- Hover and focus-visible rules cover the controls. src/index.css:6 imports it; index.html:29 has JetBrains Mono 400;500;600;700. `pnpm build` is green. The 390x844 e2e confirms no sideways scroll.

## booking-page-time-step — VERIFIED
- src/App.tsx:11-13 imports BookingPage eagerly with the comment; :248 adds the route outside Layout.
- src/pages/BookingPage.tsx: aria-pressed slots (:241), the Tomorrow and '✓ Selected' badges (:246), the Taken non-button (:230), the footer text (:262), aria-disabled Continue (:267), trackFlow pick-slot and continue (:242, :271), and the Retry / empty-with-mailto / loading states (:214-220).
- 1280x720 screenshot (test-results/booking-page-1280x720.png) read: split card, cream palette, serif h1, mono eyebrow, stepper, dark selected slot with the amber badge, dashed line-through taken slot and the red Continue match the '1a Split card' layout, palette and type.

## booking-page-details-done — VERIFIED
- src/pages/BookingSteps.tsx: the email regex (:6), chips with aria-pressed (:86), textarea maxLength 2000 (:93), honeypot (:100), aria-disabled book button (:107), notice wordings and the role=alert notice (:18-26), and the Apple Calendar download as bilko-free-hour.ics (:160).
- src/pages/BookingPage.tsx: POST body with email/startMs/topic/tags/website (:110), the 409 handling (:122-125), trackFlow book-free-hour/booked (:107, :113), reschedule (:142-170) and cancel (:178).
- The e2e covers success, already_booked, reschedule, cancel and the step 2/3 screenshots at both sizes (14/14 pass). The step 3 screenshot read: "You're booked.", the truthful invite/video-link wording, the three calendar buttons, the 01-03 list and the Reschedule / Cancel footer match the design apart from the deliberate copy change.

## Findings
### Critical
- none
### Important
- none
### Minor
- src/pages/BookingSteps.tsx:~160: the calendar buttons are ordered Google, Apple, Outlook; the PRD lists Google, Outlook, Apple. The PRD sets no order, so this is cosmetic.
- server/routes/free-hour.ts:128+: the reschedule route does not re-check the one-free-hour-per-email rule. This is by design (documented in host-contract.md). The route is token-gated and rate-limited, and the token regex and body limit (1024) bound the input.
- Security self-review: no secrets, no path handling, SQL is parameterized, tags are allowlisted, and the HTML injected into the shell is a static constant.
