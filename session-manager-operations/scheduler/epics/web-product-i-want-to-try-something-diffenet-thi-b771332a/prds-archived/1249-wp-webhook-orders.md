---
title: Stripe webhook records verified web-product orders (no customer needed), 100%-off safe; success page forwards to the product thanks page
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T04:38:28.173Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [wp-store]
planId: pl-mv3bvhsl-b2ab4f
---
# Goal

wire: connect web products (shared/web-products.ts, server/services/web-products.ts) to the existing Stripe flow in server/routes/stripe.ts. A verified web-product checkout.session.completed must record its order in web_product_orders even when the session has no Stripe customer, must grant nothing for a wrong product or unpaid session, must not break on 100%-off sessions (no PaymentIntent), and /checkout/success must forward a web-product buyer to that product's own thanks page.

# Acceptance criteria

- [ ] In the checkout.session.completed handler, BEFORE the existing `data.mode === 'subscription'` / `email && stripeCustomerId` branches, a web-product dispatch runs when data.metadata.web_product names a catalog slug (webProductBySlug(slug, WEB_PRODUCTS), WEB_PRODUCTS passed explicitly so tests can vi.mock it).
- [ ] That dispatch records via recordOrder({checkoutSessionId: data.id, slug, email, amountTotal: data.amount_total, currency: data.currency, paymentStatus: data.payment_status}) only when payment_status is 'paid' or 'no_payment_required' AND the session's first line-item price id equals resolveWebProductPriceId(product, process.env); otherwise it logs one line and records nothing. Email comes from customer_details.email ?? customer_email; a missing customer id does not block the order.
- [ ] For web-product sessions that also have a customer id, the legacy stripe_one_time_purchases row is written with product_key = product.productKey and stripe_payment_intent_id = data.payment_intent ?? data.id; every non-web-product session behaves exactly as before.
- [ ] GET /checkout/success redirects (302) to /projects/<slug>/thanks/?session_id=<id> when the retrieved session's metadata.web_product is a catalog slug, before the payment_status check (so no_payment_required sessions don't dead-end on 'Payment pending'); the slug used is the catalog's, never raw metadata.
- [ ] tests/stripe-webhook-web-products.test.ts covers: verified order recorded without a customer id, wrong price recorded nothing, unpaid recorded nothing, 100%-off session recorded, webhook replay idempotent (one order row), success-page redirect; tests/stripe-webhook-attribution.test.ts, tests/stripe-checkout-success.test.ts and tests/coffee-checkout.test.ts still pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/stripe.ts
- tests/stripe-webhook-web-products.test.ts

# Implementation notes

Read first: server/routes/stripe.ts lines 137-268 (webhook) and 304-387 (/checkout/success), tests/stripe-webhook-attribution.test.ts (mocking pattern for listLineItems and the DB), shared/web-products.ts (webProductBySlug, resolveWebProductPriceId, WEB_PRODUCTS) and server/services/web-products.ts (recordOrder) — both already on main.

Steps:
1. Import from ../../shared/web-products.js and ../services/web-products.js.
2. Add the dispatch at the top of the checkout.session.completed block (criteria 1-3). Use stripe.checkout.sessions.listLineItems(data.id, {limit: 1}) for the price, like the existing branch. Return 500 only on DB errors (so Stripe retries); recordOrder is INSERT OR IGNORE so retries are safe.
3. /checkout/success change (criterion 4) using reply.redirect(url, 302).
4. Write the test file with a fixture WEB_PRODUCTS via vi.mock of the shared module.

Do not touch: server/routes/web-products.ts, server/index.ts, shared/product-catalog.ts.

# Out of scope

- Changing PRICE_CATALOG or the generic create-checkout-session endpoint
- Async payment-method events (the order endpoint's Stripe fallback already re-checks payment_status)

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
