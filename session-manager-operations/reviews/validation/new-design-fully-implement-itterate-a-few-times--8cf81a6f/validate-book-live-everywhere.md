# Validation: book-live-everywhere

Base: b2b06b58. Commits: f926c96a (entry points), aa58f56e (/bilko), 7d477d37 (retire widget), f84ec2fc (docs). Combined diff: 11 files, +52/-212. Review skills were not run; self-reviewed the diff (no secrets, no input handling, only static links/copy/deletions).

## book-entry-points-site — VERIFIED
- HomePage.tsx:146 `to="/book"`, data-track home-hire unchanged (diff).
- PricingPage.tsx:280 `to="/book"`, data-track pricing-hire unchanged.
- shared/agent-offers.ts:47 ends "free hour at https://bilko.run/book."; pageUrl untouched.
- e2e/book-entry-points.spec.ts: both tests click home-hire / pricing-hire, expect /book and "Pick a time".
- Gate: vitest agent-offers + og-meta pass; typecheck exit 0; playwright 2/2 pass.

## bilko-page-uses-book — VERIFIED
- shared/bilko-profile.ts hero href="/book", data-track hire-hero-book; new `<div class="btns"><a class="btn primary" href="/book" data-track="hire-free-hour-book">` added in #free-hour card. `$100 / hour` count = 3.
- BilkoProfilePage.tsx: FreeHourBooking import and render removed; checkout message code untouched.
- e2e/bilko-profile.spec.ts: old-form tests replaced by href/no-.fhb-slots/390x844 tests; both checkout tests kept.
- Gate: bilko-profile-copy + routes vitest pass (31 tests across 4 files); typecheck 0; playwright 5/5 pass.

## retire-free-hour-widget — VERIFIED
- src/components/FreeHourBooking.tsx deleted; `grep -rn FreeHourBooking src shared server tests e2e` empty; `fhb|free-hour-booking` absent from src.
- bilko-profile.css: only the 11 .free-hour-booking/.fhb-* lines removed.
- Gate: typecheck 0; `pnpm build` exit 0.

## doc-book-host-code — VERIFIED
- CLAUDE.md bullet: FreeHourBooking.tsx replaced by the six /book files. docs/host-contract.md Free hour bullet now names https://bilko.run/book. One line changed in each file.
- No real name or personal email in changed lines.
- Gate: none.

## Findings
- Critical: none. Important: none.
- Minor: the CLAUDE.md line touched by f84ec2fc is a single long line; it contains the pre-existing package name `@bilkobibitkov/git-viewer` (not introduced here).
- Minor: I did not diff the docs text word by word against the "Reschedule or Cancel / .ics / Google / Outlook / topic chips / time zone" wording beyond reading the changed line.
