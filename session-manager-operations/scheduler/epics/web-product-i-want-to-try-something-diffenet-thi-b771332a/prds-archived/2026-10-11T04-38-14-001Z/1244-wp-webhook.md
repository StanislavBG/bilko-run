---
title: Stripe webhook records web-product orders, handles 100%-off sessions, and success page forwards to the product thanks page
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T04:35:21.966Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [wp-store]
planId: pl-mv3bvhsl-b2ab4f
---
# Goal

wire: connect web products (shared/web-products.ts, server/services/web-products.ts) to the existing Stripe flow in server/routes/stripe.ts. The checkout.session.completed webhook must attribute a web-product sale to its productKey and record the order; a 100%-off session (no PaymentIntent) must still record; and /checkout/success must send a web-product buyer to that product's own thanks page.

# Acceptance criteria

- [ ] In the webhook's mode 'payment' branch, when entryForPriceId misses, webProductForPriceId(seenPriceId, process.env, WEB_PRODUCTS) is tried (WEB_PRODUCTS passed explicitly so tests can mock it); a match sets productKey = product.productKey without the 'matches no STRIPE_PRICE_*' console.error.
- [ ] When a web product matched (or data.metadata.web_product names a catalog slug), the webhook calls recordOrder({checkoutSessionId: data.id, slug, email, amountTotal: data.amount_total, currency: data.currency, paymentStatus: data.payment_status}).
- [ ] saveOneTimePurchase receives stripe_payment_intent_id = data.payment_intent ?? data.id so a no_payment_required session records instead of failing the NOT NULL column.
- [ ] GET /checkout/success redirects (302) to /projects/<slug>/thanks/?session_id=<id> when the retrieved session's metadata.web_product is a catalog slug, before the payment_status check.
- [ ] tests/stripe-webhook-web-products.test.ts (vi.mock of shared/web-products.js supplying a fixture WEB_PRODUCTS, Stripe mocked) covers attribution + order row, the 100%-off session recording with the session id as payment intent key, webhook replay idempotency, and the success-page redirect; tests/stripe-webhook-attribution.test.ts, tests/stripe-checkout-success.test.ts and tests/coffee-checkout.test.ts still pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/stripe.ts
- tests/stripe-webhook-web-products.test.ts

# Implementation notes

Read first: server/routes/stripe.ts lines 137-268 (webhook) and 304-387 (/checkout/success), tests/stripe-webhook-attribution.test.ts (mocking pattern for listLineItems and the DB), shared/web-products.ts and server/services/web-products.ts (landed by wp-catalog / wp-store).

Steps:
1. Import WEB_PRODUCTS, webProductForPriceId, webProductBySlug from ../../shared/web-products.js and recordOrder from ../services/web-products.js.
2. Edit the payment branch as in criteria 1-3. Keep the existing behaviour for every non-web-product price byte-for-byte.
3. Edit /checkout/success as in criterion 4 (use reply.redirect(url, 302); the slug comes from our catalog lookup, never echoed raw from metadata).
4. Write the new test file.

Do not touch: server/routes/web-products.ts, server/index.ts (PRD wp-buy-routes owns them), shared/product-catalog.ts.

# Out of scope

- Changing PRICE_CATALOG or the generic create-checkout-session endpoint

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/stripe-webhook-web-products.test.ts tests/stripe-webhook-attribution.test.ts tests/stripe-checkout-success.test.ts tests/coffee-checkout.test.ts
timeout 600 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
