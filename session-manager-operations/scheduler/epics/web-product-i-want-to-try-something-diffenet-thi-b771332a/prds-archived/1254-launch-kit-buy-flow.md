---
title: Launch Kit buy flow: Buy button to Stripe Checkout, thanks page with download and sign-in recovery, page telemetry, golden spec
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 14
createdVia: scheduler-api
issuedAt: 2026-10-11T04:40:46.388Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [launch-kit-landing-page]
planId: pl-mv3bwyfa-549f4d
---
# Goal

feature: wire the Launch Kit landing page (/home/bilko/Projects/Bilko-Launch-Kit/site/) to the host's web-product API so a visitor can buy and download: Buy -> POST checkout -> Stripe; Stripe returns to /projects/launch-kit/thanks/?session_id=... where the page verifies the order and offers the zip; a buyer who lost the link signs in with their purchase email to re-download. Send page views so /admin -> Products can count them, and add the Playwright golden spec the bilko-host publish gate runs.

# Acceptance criteria

- [ ] Clicking #buy POSTs /api/web-products/launch-kit/checkout, disables the button while pending, and window.location.assign()s the returned url; a non-2xx shows an inline error; landing with ?checkout=cancel shows a 'No charge made' note.
- [ ] thanks/index.html reads session_id and GETs /api/web-products/launch-kit/order?session_id=...: paid -> masked email, version, a Download link to /api/web-products/launch-kit/download?session_id=..., downloads used/limit, install steps and 'bookmark this page'; 402 -> 'confirming your payment' retrying every 3s at most 10 times; 400/404 -> help text with https://bilko.run/contact; 429 -> limit reached, offer sign-in recovery.
- [ ] Sign-in recovery uses host-kit (dependency "host-kit": "file:../../Bilko/packages/host-kit") openSignIn/authFetch to GET /api/web-products/launch-kit/account-download and saves the blob as bilko-launch-kit-<version>.zip; 401/402 show a clear message.
- [ ] Both pages POST /api/analytics/pageview once on load with the body shape server/routes/analytics.ts expects and path = location.pathname (starts with /projects/launch-kit/); the landing page sends a 'view_tool' event (tool 'launch-kit') to /api/analytics/event; the client never sends checkout_start (the server records it).
- [ ] site/tests/golden.spec.ts (Playwright, all /api/** routes stubbed) proves: hero, 8 skill cards and '$9' render; Buy POSTs to the checkout endpoint and navigates to the stubbed URL; thanks paid state shows the Download link carrying the session id; 402 state shows the retry message; no console errors; no horizontal scroll at 390px. `pnpm test` passes in site/.
- [ ] dist/ is rebuilt; `grep -rl` finds no .zip and no SKILL.md under site/dist; committed in the sibling, and session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-buy-flow.md is committed in Bilko with the sibling SHA and test output summary.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-buy-flow.md

# Implementation notes

Read first: /home/bilko/Projects/Bilko-Launch-Kit/site/ (landed by launch-kit-landing-page), /home/bilko/Projects/Bilko/server/routes/web-products.ts (exact response shapes and status codes), /home/bilko/Projects/Bilko/server/routes/analytics.ts lines 74-160 (pageview + event body shapes, allowed events), /home/bilko/Projects/Bilko/packages/host-kit/src/ (authFetch, openSignIn exports; its README), /home/bilko/Projects/Stack-Audit/tests/golden.spec.ts (host-kit/testing helpers such as withHostStub).

Steps:
1. pnpm add the local host-kit in site/ (host-kit dist must exist: if not, run `pnpm --filter host-kit build` in /home/bilko/Projects/Bilko first; do not commit that build).
2. Implement src/buy.ts and src/thanks.ts as module scripts; no inline handlers.
3. Write the golden spec with page.route stubs for /api/web-products/** and /api/analytics/**.
4. Build, run tests, check dist has no paid files, commit in the sibling, then the Bilko record.

Do not touch: pack/, dist-pack/, the Bilko repo except the record.

# Out of scope

- Publishing to bilko.run (launch-kit-publish-landing)
- Any server change

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm --dir /home/bilko/Projects/Bilko-Launch-Kit/site build
timeout 300 pnpm --dir /home/bilko/Projects/Bilko-Launch-Kit/site test
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
