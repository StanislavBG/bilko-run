---
title: Live end-to-end purchase of the Launch Kit with the 100%-off QA code: checkout, thanks page, download, sha256 match
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-11T04:41:57.618Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [launch-kit-publish-landing]
planId: pl-mv3bwyfa-549f4d
---
# Goal

validate-adjacent: prove the real production path a buyer takes, without charging money, using the live 100%-off promotion code (restricted to the Launch Kit, 5 uses) created by PRD launch-kit-stripe: landing page -> Buy -> Stripe Checkout -> thanks page -> download, and confirm the downloaded bytes are the pinned v1.0.0 release and the download was counted.

# Acceptance criteria

- [ ] A headless Chromium Playwright script at /home/bilko/Projects/Bilko-Launch-Kit/site/scripts/live-purchase.mjs (not part of the golden spec) opens https://bilko.run/projects/launch-kit/, clicks Buy, and on checkout.stripe.com enters email bilkobibitkov2000+launchkit-qa@gmail.com and the promotion code read from /home/bilko/.config/bilko/launch-kit-qa-promo.txt, confirms a $0.00 total, and completes checkout; at most 2 attempts, with a screenshot of every step saved under /tmp/launch-kit-e2e/.
- [ ] The browser lands on https://bilko.run/projects/launch-kit/thanks/?session_id=cs_live_... and the paid state with a Download link appears within 60s.
- [ ] The downloaded file's sha256 equals the release sha256 in shared/web-products.ts, and GET /api/web-products/launch-kit/order for that session then reports downloadsUsed >= 1.
- [ ] If Stripe shows a captcha or bot wall, or demands card details despite the code, the run stops, records 'E2E: BLOCKED' with the screenshot paths and the exact blocker, and ends SCHEDULER_VERDICT: FAIL so the human can do the purchase by hand.
- [ ] session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-e2e-purchase.md is committed and pushed (origin only, after a conflict-free rebase) with 'E2E: PASS' or 'E2E: BLOCKED', times in America/Los_Angeles with PDT/PST, and the session id shortened to its last 6 characters; the promo code value and the full session id never appear in any committed file.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-e2e-purchase.md

# Implementation notes

Read first: /home/bilko/Projects/Bilko-Launch-Kit/site/src/buy.ts and thanks.ts (selectors), shared/web-products.ts (sha256), session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-stripe.md (promotion code id only).

Use Playwright from the site's devDependencies (`pnpm --dir /home/bilko/Projects/Bilko-Launch-Kit/site exec playwright install chromium` if browsers are missing). Stripe Checkout selectors: find the email field by label/role, the 'Add promotion code' button by role, and the submit button by role; wait on visible text, never fixed sleeps beyond 5s. Download via the page's Download link (page.waitForEvent('download')) and hash it with node:crypto.

This uses one of the 5 promo redemptions. The full checkout session id is a working download link: keep it only in /tmp, never in the repo or the final summary.

Do not touch: code in either repo (record only).

# Out of scope

- Fixing anything that fails (a fix wave follows the validator)
- Real-money purchases

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 30 grep -q 'E2E: PASS' session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-e2e-purchase.md
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
