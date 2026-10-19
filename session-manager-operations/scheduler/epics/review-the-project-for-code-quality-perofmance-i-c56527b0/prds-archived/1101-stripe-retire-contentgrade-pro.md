---
title: Stop selling ContentGrade Pro: retire /upgrade, /my-license and license-key issuance from the Stripe routes
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-09T21:29:25.171Z
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
planId: pl-mv1hacoj-72fbb4
---
# Goal

behavior. ContentGrade is a finished, retired product, but server/routes/stripe.ts still sells and supports it publicly. `GET /upgrade` (~line 515) redirects to a live 'Pro $9/mo' Stripe payment link. `GET /my-license` (~447), `GET /api/stripe/license-key` (~299) and `POST /api/stripe/validate-license` (~321) issue or validate 'CG-' license keys. `POST /api/stripe/create-checkout-session` defaults `priceType` to 'contentgrade_pro' (~72), and the success page and webhook mint ContentGrade license keys. Remove the selling and license surfaces, but keep the legacy subscription lifecycle so any remaining subscriber can still be recorded and can cancel.

# Acceptance criteria

- [ ] server/routes/stripe.ts no longer registers GET /my-license, GET /api/stripe/license-key or POST /api/stripe/validate-license, and imports nothing from ../services/license.js.
- [ ] GET /upgrade is kept (old CLI messages link to it) but now replies 302 to `/`; STRIPE_PAYMENT_LINK_CONTENTGRADE_PRO and the hardcoded buy.stripe.com Pro link are gone from the code.
- [ ] POST /api/stripe/create-checkout-session has no default priceType: a missing priceType or a contentgrade_* priceType replies 400. shared/product-catalog.ts no longer lists contentgrade_pro, contentgrade_business or contentgrade_team as purchasable entries.
- [ ] GET /checkout/success and the webhook never mint a license key. A subscription-mode session or an unresolved price shows the generic thank-you page and logs one console.error naming the price/session. The webhook still calls saveSubscription for subscription checkouts and subscription lifecycle events (legacy subscribers).
- [ ] POST /api/stripe/billing-portal is unchanged. GET /api/stripe/subscription-status returns `plan: active ? 'pro' : null`, and isStripeConfigured() in server/services/stripe.ts depends only on the Stripe secret key, not STRIPE_PRICE_CONTENTGRADE_PRO.
- [ ] tests/stripe-checkout-success.test.ts covers: unresolved price yields no upsertLicenseKey call and a 200 generic page; /upgrade gives 302 to /; /my-license gives 404; create-checkout-session without priceType gives 400. Tests coffee-checkout, stripe-webhook-signature and manual stay green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/stripe.ts
- server/services/stripe.ts
- shared/product-catalog.ts
- tests/stripe-checkout-success.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Fastify 5. This is money code: change only what the criteria name.

Read first: server/routes/stripe.ts (whole file, ~580 lines; routes at 49, 137, 265, 299, 321, 340, 447, 515, 526, 555); server/services/stripe.ts lines 1-100 (isStripeConfigured at ~14, priceToPlanTier at ~70-85); shared/product-catalog.ts (whole); tests/stripe-checkout-success.test.ts (whole; three existing tests assert the contentgrade_pro fallback at ~159-187 and must be rewritten to the new behavior).

Steps:
1. Rewrite the three fallback tests and add the new cases first (red).
2. Edit stripe.ts routes as in the criteria. Keep the webhook's saveSubscription path and priceToPlanTier (legacy subscribers).
3. Remove the contentgrade_* entries/union members from shared/product-catalog.ts. Fix every compile error this causes inside the files listed here.
4. Run `git grep -n -i contentgrade -- server/routes/stripe.ts shared/product-catalog.ts server/services/stripe.ts` and report what remains (only legacy priceToPlanTier env names may stay).

Do not touch: server/routes/license.ts, server/services/license.ts, server/index.ts, server/db.ts (a later PRD deletes the license files), .env.example.

# Out of scope

- Deactivating the Stripe payment link or archiving Stripe products (owner does this in the Stripe dashboard)
- Dropping DB tables
- The AudienceDecoder unmatched-price fallback in the webhook

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/stripe-checkout-success.test.ts tests/coffee-checkout.test.ts tests/stripe-webhook-signature.test.ts tests/manual.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
