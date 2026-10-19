---
title: Point the live Stripe coffee payment link back to bilko.run and make the product a generic Bilko tip jar
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-11T01:36:09.762Z
sourcePromptId: buy-me-coffee-this-needs-to-make-a-comeback-on-t-352f8148
agentType: dev-lead
disposition: new-head
planId: pl-mv35jin6-e81788
---
# Goal

migration: The live Stripe product prod_V2Q4ego2oijqo4 ("Buy me a coffee", $5) still describes itself as supporting PublicTrades only, and its payment link plink_1U2LEcR6w0VtQRLTVdfPa3Kp ends on Stripe's hosted confirmation instead of bilko.run. Using the already-authenticated Stripe CLI in live mode, update the product description to a generic Bilko tip jar and set the payment link to redirect to bilko.run's thank-you page, then commit a record of what changed.

# Acceptance criteria

- [ ] Live product prod_V2Q4ego2oijqo4 description is exactly: 'Buy Bilko a coffee — keeps the free tools on bilko.run (including Session Manager) running.' and name stays 'Buy me a coffee'.
- [ ] Live payment link plink_1U2LEcR6w0VtQRLTVdfPa3Kp has after_completion.type = 'redirect' and after_completion.redirect.url = 'https://bilko.run/checkout/success?session_id={CHECKOUT_SESSION_ID}', is still active, and still sells price_1U2LEcR6w0VtQRLThguPtRCI at 500 usd, quantity 1.
- [ ] No other live Stripe object is created, archived or modified (no new product, price or payment link).
- [ ] session-manager-operations/reviews/deploy/buy-me-coffee-this-needs-to-make-a-comeback-on-t-352f8148/stripe-live-config.md is committed with: before/after values for both fields, the exact stripe CLI commands run, and the retrieve output fields proving the after state (no secret keys).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- session-manager-operations/reviews/deploy/buy-me-coffee-this-needs-to-make-a-comeback-on-t-352f8148/stripe-live-config.md

# Implementation notes

The Stripe CLI at /home/bilko/.local/bin/stripe is logged in to account acct_1SbkmmR6w0VtQRLT with a live key (expires 2026-11-07). Use `--live` on every command. The human requested this Epic ("ensure the hook is real and has a stripe backed product"), which authorizes these two live edits — nothing else.

Steps:
1. Record before state: `timeout 30 stripe products retrieve prod_V2Q4ego2oijqo4 --live` and `timeout 30 stripe payment_links retrieve plink_1U2LEcR6w0VtQRLTVdfPa3Kp --live` (note description, after_completion).
2. `timeout 30 stripe products update prod_V2Q4ego2oijqo4 --live -d "description=Buy Bilko a coffee — keeps the free tools on bilko.run (including Session Manager) running."`
3. `timeout 30 stripe payment_links update plink_1U2LEcR6w0VtQRLTVdfPa3Kp --live -d "after_completion[type]=redirect" -d "after_completion[redirect][url]=https://bilko.run/checkout/success?session_id={CHECKOUT_SESSION_ID}"` (quote so the shell leaves the braces literal).
4. Re-retrieve both, plus `timeout 30 stripe payment_links list_line_items plink_1U2LEcR6w0VtQRLTVdfPa3Kp --live`, and confirm the criteria. If any update errors, print the Stripe error, write it in the record, and FAIL — do not try alternative objects.
5. Write the record file (create the folder) and commit only it. Times in America/Los_Angeles with zone abbreviation.

The bilko.run /checkout/success page already handles session_id and a sibling PRD (coffee-stripe-defaults) adds coffee-specific copy; this PRD does not touch code.

Do not touch: any file except the record.

# Out of scope

- Code changes
- Test-mode Stripe objects
- Render env vars

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 30 stripe payment_links retrieve plink_1U2LEcR6w0VtQRLTVdfPa3Kp --live
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
