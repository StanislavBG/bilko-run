---
title: Create the live Stripe product, $9 price and a 5-use 100%-off QA promo code for the Bilko Launch Kit
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 7
createdVia: scheduler-api
issuedAt: 2026-10-11T04:34:27.112Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
disposition: new-head
planId: pl-mv3bwsrs-bb11db
---
# Goal

migration: the human asked for a real Stripe-backed product for the "Bilko Launch Kit" (8 Claude skills, sold at bilko.run/projects/launch-kit/ for $9 one-time). Using the already-authenticated Stripe CLI in live mode, create the product, its $9 USD one-time price, and a 100%-off promotion code limited to 5 redemptions on this product only (used later for a free end-to-end purchase test). Record the ids — never the promo code value — in a committed record.

# Acceptance criteria

- [ ] A live product named 'Bilko Launch Kit' exists with metadata web_product=launch-kit and description: '8 Claude skills that take a solo founder from "it works" to launched: page roast, headline lab, pricing and offer, launch emails, launch-week plan, build-in-public threads and first-100 outreach.'
- [ ] A live one-time price of unit_amount 900, currency usd, metadata web_product=launch-kit exists on that product and is set as its default_price.
- [ ] A live coupon (percent_off 100, duration once, applies_to that product only, max_redemptions 5) and a promotion code on it (max_redemptions 5, code LAUNCHKITQA + 6 random uppercase alphanumerics) exist; the code value is written ONLY to /home/bilko/.config/bilko/launch-kit-qa-promo.txt (mode 600), never to the repo or the transcript summary.
- [ ] No other live Stripe object is created, archived or modified; a re-run reuses existing objects found by metadata web_product=launch-kit instead of duplicating them.
- [ ] session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-stripe.md is committed with the product id, price id, coupon id, promotion code id (not its code), the exact CLI commands run (promo code value redacted) and the retrieve output fields proving each criterion, times in America/Los_Angeles with PDT/PST.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-stripe.md

# Implementation notes

The Stripe CLI at /home/bilko/.local/bin/stripe is logged in to live account acct_1SbkmmR6w0VtQRLT (live key valid until 2026-11-07). Use `--live` on every command and `timeout 30` on each. The human's Epic request ("use my Stripe to create a product") authorizes exactly these live creations.

Steps:
1. Idempotency check first: `stripe products search --live --query "metadata['web_product']:'launch-kit'"`; reuse a hit (and its prices/coupons) rather than creating duplicates.
2. `stripe products create --live -d name="Bilko Launch Kit" -d "description=..." -d "metadata[web_product]=launch-kit"`.
3. `stripe prices create --live -d product=<prod> -d unit_amount=900 -d currency=usd -d "metadata[web_product]=launch-kit"`, then `stripe products update <prod> --live -d default_price=<price>`.
4. `stripe coupons create --live -d percent_off=100 -d duration=once -d name="Launch Kit QA" -d "applies_to[products][0]=<prod>" -d max_redemptions=5`.
5. Generate the code with `python3 -c` (secrets.choice over A-Z0-9, 6 chars), then `stripe promotion_codes create --live -d coupon=<coupon> -d code=<CODE> -d max_redemptions=5`. Write the code to /home/bilko/.config/bilko/launch-kit-qa-promo.txt (mkdir -p the folder, chmod 600). Do not echo the code in later output.
6. Re-retrieve product, price, coupon and promotion code (print only non-secret fields) and confirm each criterion. If a call errors, print the Stripe error, write it into the record, and FAIL — do not try alternative objects.
7. Write the record (create the folder) and commit only it.

This repo is PUBLIC on GitHub — the promo code must never appear in any committed file.

# Out of scope

- Code changes
- Test-mode objects
- Render env vars (the price id is committed as a catalog default by a later PRD)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 30 grep -Eq 'prod_[A-Za-z0-9]+' session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-stripe.md && timeout 30 grep -Eq 'price_[A-Za-z0-9]+' session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-stripe.md
timeout 30 test -s /home/bilko/.config/bilko/launch-kit-qa-promo.txt
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
