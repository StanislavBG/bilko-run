---
title: Make /coffee always reach the live Stripe "Buy me a coffee" payment link and attribute its payments
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T01:35:49.706Z
sourcePromptId: buy-me-coffee-this-needs-to-make-a-comeback-on-t-352f8148
agentType: dev-lead
disposition: new-head
planId: pl-mv35j362-c3a974
---
# Goal

behavior: GET https://bilko.run/coffee currently returns the 200 "Tipping is temporarily unavailable" page because the Render env vars STRIPE_PAYMENT_LINK_PUBLICTRADES_COFFEE / STRIPE_PRICE_PUBLICTRADES_COFFEE are unset. A live Stripe product already exists (prod_V2Q4ego2oijqo4 "Buy me a coffee", $5 one-time price price_1U2LEcR6w0VtQRLThguPtRCI, active payment link https://buy.stripe.com/eVq6oJ73C65L6jbaow8k80d). Commit those public identifiers as code defaults (env still overrides) so /coffee redirects to Stripe with no dashboard step, the webhook attributes the payment to publictrades_coffee, and the /checkout/success page shows coffee-specific thanks.

# Acceptance criteria

- [ ] shared/product-catalog.ts: PriceCatalogEntry gains an optional `defaultPriceId?: string`; the publictrades_coffee entry sets it to 'price_1U2LEcR6w0VtQRLThguPtRCI'; entryForPriceId(priceId, env) matches an entry when `(env[e.envVar] || e.defaultPriceId) === priceId` (env value wins when set). The file also exports `COFFEE_PAYMENT_LINK_DEFAULT = 'https://buy.stripe.com/eVq6oJ73C65L6jbaow8k80d'`.
- [ ] server/routes/stripe.ts GET /coffee: uses `process.env.STRIPE_PAYMENT_LINK_PUBLICTRADES_COFFEE || COFFEE_PAYMENT_LINK_DEFAULT` and 302-redirects to it; the price-based checkout-session branch and the 200 'temporarily unavailable' fallback remain in code (reachable only if the resolved link is empty) so the route still never 404s/5xxs.
- [ ] server/routes/stripe.ts GET /checkout/success: when the resolved productKey is PRODUCT_KEYS.PUBLICTRADES_COFFEE, the body thanks the buyer for the coffee (e.g. 'Thanks for the coffee ☕ — it keeps the free tools on bilko.run running.') with a link back to https://bilko.run/ ; email still rendered through escHtml. The success-page price lookup must also use the catalog default (i.e. resolve via entryForPriceId with the default, not a raw env compare).
- [ ] tests/coffee-checkout.test.ts: existing 'unavailable when nothing configured' case is replaced by a case asserting that with both env vars unset GET /coffee returns 302 with location 'https://buy.stripe.com/eVq6oJ73C65L6jbaow8k80d'; a case asserting env STRIPE_PAYMENT_LINK_PUBLICTRADES_COFFEE overrides the default; a case asserting entryForPriceId('price_1U2LEcR6w0VtQRLThguPtRCI', {}) resolves to PUBLICTRADES_COFFEE; a case asserting an env-set price still resolves and a different unknown price returns undefined.
- [ ] tests/coffee-checkout.test.ts or tests/stripe-checkout-success.test.ts unchanged-or-extended: a /checkout/success case with a session whose line item price is the default coffee price renders the coffee thank-you text (add it to tests/coffee-checkout.test.ts, which already mocks sessions.retrieve/listLineItems).
- [ ] pnpm typecheck and the full vitest suite pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- shared/product-catalog.ts
- server/routes/stripe.ts
- tests/coffee-checkout.test.ts

# Implementation notes

Read first: shared/product-catalog.ts (whole file, ~70 lines); server/routes/stripe.ts lines 180-240 (webhook attribution via entryForPriceId) and 320-415 (/checkout/success and /coffee); tests/coffee-checkout.test.ts (whole file).

Steps:
1. Red: in tests/coffee-checkout.test.ts add the new cases from the criteria first; run `timeout 300 pnpm vitest run tests/coffee-checkout.test.ts 2>&1 | tail -15` early (expected red).
2. shared/product-catalog.ts: add `defaultPriceId?: string` to PriceCatalogEntry with a one-line doc comment ("public Stripe price id used when the env var is unset"); set it on the publictrades_coffee entry; update entryForPriceId; export COFFEE_PAYMENT_LINK_DEFAULT. Keep the module dependency-free.
3. server/routes/stripe.ts: import COFFEE_PAYMENT_LINK_DEFAULT; change /coffee to use the env-or-default link. For the price branch use `process.env.STRIPE_PRICE_PUBLICTRADES_COFFEE || entryForPriceType('publictrades_coffee')?.defaultPriceId`. Update the route's comment to say defaults are the live Stripe product prod_V2Q4ego2oijqo4 and env overrides them.
4. /checkout/success: check how productKey is resolved (around line 338-350). If it compares raw env values, switch it to entryForPriceId so the default applies. Add the coffee branch to the `body` ternary.
5. Webhook (around line 199-230) already uses entryForPriceId — confirm it now attributes the default coffee price; no entitlement is granted for coffee (it is a tip), keep that.
6. Run gate last.

These IDs are public (payment link URLs and price ids are not secrets); committing them is intentional. Do not change env var names — sibling projects and .env.example reference them.

Do not touch: src/, .env.example, CLAUDE.md (sibling PRDs own them).

# Out of scope

- Any Stripe dashboard/API change (separate PRD)
- Frontend CTAs
- Renaming the publictrades_coffee product key or env vars

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm typecheck
timeout 600 pnpm vitest run
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
