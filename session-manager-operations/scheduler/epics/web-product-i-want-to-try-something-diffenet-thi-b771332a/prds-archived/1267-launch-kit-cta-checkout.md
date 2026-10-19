---
title: Launch Kit page: every "Get it / Get the Launch Kit" CTA starts Stripe checkout (not a scroll to top)
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T20:16:19.663Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
tag: bug
agentType: dev-lead
planId: pl-mv49k24v-9e85f3
---
# Goal

behavior: on the Launch Kit sales page (private sibling repo /home/bilko/Projects/Bilko-Launch-Kit/site), only the hero button #buy starts checkout. The header pill "Get it · $9" (index.html:20, href="#pricing"), the pricing-card button (index.html:157, href="#top") and the final CTA (index.html:191, href="#top") only scroll the page, so buyers who click them never reach Stripe. Make all four purchase CTAs start the same checkout flow, with tests.

# Acceptance criteria

- [ ] site/index.html: the four purchase CTAs (header pill, hero #buy, pricing-card button, final CTA) all carry a data-buy attribute; no purchase CTA links to #top. The brand logo and the nav links (What's inside, How it works, Pricing, FAQ) stay plain scroll links.
- [ ] site/src/buy.ts binds one click handler to every [data-buy] element: preventDefault, POST /api/web-products/launch-kit/checkout with body '{}', then window.location.assign(url). A module-level busy flag allows only one request at a time across all CTAs.
- [ ] While pending, the clicked CTA reads 'Opening checkout…' and every CTA is disabled (button.disabled, aria-disabled=true on links); on failure all are restored and the error appears in a role=alert element next to the clicked CTA (the hero keeps #buy-error).
- [ ] Visual parity: the header pill, pricing button and final CTA look the same as before at 1512px and 390px; refreshed screenshots in site/screenshots/ are committed.
- [ ] site/tests/golden.spec.ts: a test clicks each of the 4 [data-buy] CTAs in a fresh page with /api/** stubbed and asserts a POST to the checkout endpoint plus navigation to the stubbed Stripe URL; a test asserts a 503 from the pricing-card CTA shows its adjacent alert and re-enables it; existing tests still pass.
- [ ] dist/ rebuilt with no .zip or SKILL.md under site/dist; committed in the sibling; session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-cta-checkout.md committed in Bilko with the sibling SHA and the test summary.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-cta-checkout.md

# Implementation notes

The real work happens in the private sibling repo /home/bilko/Projects/Bilko-Launch-Kit (never push it to a public remote). The Bilko commit is only the record file.

Read first:
- /home/bilko/Projects/Bilko-Launch-Kit/site/index.html lines 14-45 (bar + hero CTA + #buy-note/#buy-error), 140-160 (pricing card), 186-195 (final CTA).
- /home/bilko/Projects/Bilko-Launch-Kit/site/src/buy.ts (whole file, 43 lines: the current single-button handler to generalise).
- /home/bilko/Projects/Bilko-Launch-Kit/site/tests/golden.spec.ts lines 1-75 (stubApi, the STRIPE stub URL, the existing Buy and 503 tests that use #buy/#buy-error — keep those ids working).
- /home/bilko/Projects/Bilko-Launch-Kit/site/src/style.css lines 30-95 (.pill, .pill-sm, .btn, .btn-wrapper).

Steps:
1. golden.spec.ts: add the per-CTA test (loop over the 4 CTAs by an accessible locator, fresh page each, assert the POST and waitForURL of the stub) and the 503 pricing-card test. Run `pnpm --dir /home/bilko/Projects/Bilko-Launch-Kit/site test` and see them fail first; capture that early.
2. index.html: add data-buy to all four CTAs. Keep the header pill and final CTA as <a> elements styled exactly as now, with href="#pricing" as the no-JavaScript fallback (never #top). Keep the pricing-card CTA inside its .btn-wrapper. Keep #buy on the hero button.
3. buy.ts: replace the single #buy listener with a handler bound to document.querySelectorAll('[data-buy]'); keep the CHECKOUT constant, the cancel note, trackPageview/trackEvent and the "checkout_start is server-side" rule. For the error, reuse #buy-error for the hero and create or reuse one <p class="note err" role="alert"> right after the clicked CTA (after its .btn-wrapper when it has one) for the others.
4. Build (`pnpm --dir /home/bilko/Projects/Bilko-Launch-Kit/site build`), run the tests, retake the 1512px and 390px screenshots into site/screenshots/ the way the existing ones were taken, and confirm `find /home/bilko/Projects/Bilko-Launch-Kit/site/dist -name '*.zip' -o -name SKILL.md` prints nothing.
5. Commit in the sibling only the files you changed. Leave the pre-existing untracked site/scripts/live-purchase.mjs alone (screenshots you retake may be committed). Then write and commit the Bilko record.

Do not touch: pack/, dist-pack/, releases/, any Bilko file except the record, and public/projects/launch-kit/ in Bilko (the next PRD publishes through the bilko-host MCP).

# Out of scope

- Publishing to bilko.run (next PRD)
- Any server or price change
- Copy or design changes beyond the CTA wiring

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
