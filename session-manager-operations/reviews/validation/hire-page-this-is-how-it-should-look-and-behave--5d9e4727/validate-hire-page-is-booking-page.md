# Validation: Hire page is Booking Page 1a (/book)

Base: c4097bfc8da1ff13ac5ac82736fd12b161be025b. Seven commits (ab066876 .. 492aa95f). All seven PRD files found under prds-archived/.

Gates re-run in the foreground:
- `pnpm vitest run` over the union of the PRDs' vitest files: 14 files, 163 tests, all pass.
- `pnpm typecheck`: exit 0.
- Playwright run one spec at a time: `e2e/booking-page.spec.ts` 23/23 pass; `e2e/hire-page.spec.ts` + `e2e/book-entry-points.spec.ts` 7/7 pass.

## hire-paths-redirect-to-book — VERIFIED
- server/bilko-profile-routes.ts registers /bilko, /hire, /human-for-hire, each with and without a trailing slash, as a 301 to '/book' plus the request's own query; /projects/human-for-hire paths go straight to `'/book' + qs`. Fixed path, so no open redirect.
- renderBilkoProfileShell and the profile import are gone. tests/bilko-profile-routes.test.ts passes (4 tests). Sitemap and og-meta tests pass with the new mapping.

## bilko-hour-offer-points-at-pricing — VERIFIED
- shared/agent-offers.ts pageUrl is `${SITE}/pricing`. standalone-projects.json has host.url https://bilko.run/book and callToAction '... Book at bilko.run/book.' (a 2-line diff).
- agent-offers, offer-jsonld and registry-contract tests pass.

## book-matches-design-frame-and-time-step — VERIFIED
- booking-page.css:10 has `.bk-inner{width:100%;min-height:min(100vh,820px)}` inside the above-900px block; .bk-body is a flex column with 24px top margin (line 14).
- The e2e 'frame and time step match the design at 1280x720 and 1440x900' test passes. It asserts the select is inside the heading box, the card is at least 620px tall, .bk-inner is 820px tall and centered, and the footer shows two lines.
- 'fits 1280x720 on every step' and the 390x844 tests pass. I confirmed this by test results only; I did not eyeball the screenshot files.

## book-matches-design-details-and-done — VERIFIED
- BookingSteps.tsx has the hidden `bk-sr` h2 'Your details'. A .bk-done-foot class is used for the step 3 footer (css:127).
- The approved deviations are still in the tree:
  - paragraph copy at line 161;
  - 'Check your inbox for the invite...' at line 147;
  - 'Cancel booking' at line 178;
  - honeypot `website` input at lines 105-106.
- The e2e 'details and done steps match the design at 1280x720' test passes.

## book-shows-paid-hour-checkout-notice — VERIFIED
- bookingView.ts exports checkoutNotice, using URLSearchParams with a try/catch. Both strings match the spec. Tests in booking-view.test.ts pass.
- BookingPage.tsx:202 renders `{notice}` as a JSX text child in `<p className="bk-status" role="status">` only on step 0, so it is text, never HTML. No dangerouslySetInnerHTML anywhere in the diff.
- css:161 styles it as specified. The e2e checkout-notice tests (paid, cancel, none) pass.

## hire-nav-and-routes-open-book — VERIFIED
- portfolio.ts hire path is '/book'. App.tsx has RedirectHireToBook (`'/book' + loc.search + loc.hash`) on the three routes.
- BilkoProfilePage.tsx, bilko-profile.css and e2e/bilko-profile.spec.ts are deleted. The css @import is removed from index.css. A grep for importers finds none.
- e2e/hire-page.spec.ts passes (nav href, three redirects, query kept with the paid notice).

## retire-bilko-profile-copy — VERIFIED
- shared/bilko-profile.ts exports only BILKO_CONTACT_EMAIL, with a header comment. tests/bilko-profile-copy.test.ts is deleted. A grep for BILKO_PROFILE_ across src, server, shared, tests, e2e and scripts is clean.
- CLAUDE.md bullet and docs/host-contract.md 'Page:' line are updated as required.
- No tracked file adds a real name or personal email. The diff's added lines contain no gmail or name strings. The existing BILKO_CONTACT_EMAIL value is unchanged and is the already-public contact address.

## Findings
Critical: none.
Important: none.
Minor:
- server/page-hits.ts keeps counting the old paths on purpose, as the PRD says. Because those paths now 301, their views will fall over time and are counted under /book only if /book is in HOST_PAGE_PATHS. I did not verify this.
- CLAUDE.md test counts are unchanged (out of scope in the PRD) and will drift.
- /code-review and /security-review were not run as separate tools. I self-reviewed the diff: redirects use a fixed path plus query, the notice is a text node, and no new secrets or path handling were added.
