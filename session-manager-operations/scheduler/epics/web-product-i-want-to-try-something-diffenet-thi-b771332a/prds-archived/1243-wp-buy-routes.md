---
title: Web-product buy and delivery routes: info, Stripe checkout, order lookup, session-bound download
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 13
createdVia: scheduler-api
issuedAt: 2026-10-11T04:35:03.525Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [wp-store]
planId: pl-mv3bvhsl-b2ab4f
---
# Goal

behavior: add server/routes/web-products.ts (registered in server/index.ts) giving every catalog product a public buy-and-deliver API used by its static landing page at /projects/<slug>/: product info, a Stripe Checkout endpoint (Stripe collects the buyer's email), an order lookup for the thanks page, and a download bound to the Stripe checkout session id. Verification trusts our DB order row first and falls back to Stripe, so a buyer can download before the webhook arrives.

# Acceptance criteria

- [ ] server/routes/web-products.ts exports registerWebProductRoutes(app, opts?: {products?: readonly WebProduct[]}) (default WEB_PRODUCTS) and server/index.ts calls it right after registerStripeRoutes(app).
- [ ] GET /api/web-products/:slug returns 404 for an invalid or unknown slug, else {slug, name, displayPrice, version, available} with Cache-Control no-store, where available = release declared and stored (getRelease) and a price resolves and getStripe() is non-null.
- [ ] POST /api/web-products/:slug/checkout returns {url} from stripe.checkout.sessions.create with mode payment, the resolved price (quantity 1), customer_creation 'always', allow_promotion_codes true, metadata.web_product = slug, success_url PUBLIC_URL + '/projects/<slug>/thanks/?session_id={CHECKOUT_SESSION_ID}', cancel_url PUBLIC_URL + '/projects/<slug>/?checkout=cancel'; 404 unknown slug, 503 when Stripe or the price is unconfigured, 429 past 10 requests/min per IP; it also inserts a funnel_events row (event 'checkout_start', tool = slug) best-effort.
- [ ] GET /api/web-products/:slug/order?session_id= returns 400 for an invalid id (isValidCheckoutSessionId), 404 unknown slug or Stripe resource_missing, 402 {paid:false} when unpaid, else {paid:true, slug, name, version, filename, bytes, downloadsUsed, downloadsLimit, email} with email masked like 'j***@example.com'; verification is findOrder first, then stripe.checkout.sessions.retrieve(id, {expand:['line_items']}) requiring metadata.web_product === slug, status 'complete', payment_status 'paid' or 'no_payment_required' and a line-item price equal to the resolved price, after which recordOrder is called.
- [ ] GET /api/web-products/:slug/download?session_id= applies the same verification, returns 429 once countSessionDownloads reaches product.downloadLimit and 404 when the release is not stored, else records the download (via 'session', ipHash from hashIp in server/routes/tools/_shared.ts) and sends the bytes with Content-Type application/zip, Content-Disposition attachment; filename="<release.filename>", Cache-Control private, no-store and X-Content-Type-Options nosniff; order and download share a 30/min per-IP limiter.
- [ ] tests/web-products-routes.test.ts (Stripe mocked, fixture product injected via opts.products, release stored via storeRelease) covers: unknown slug 404, malformed session id 400, checkout passing metadata and the thanks success_url, order paid via DB row, order paid via Stripe fallback then recorded, unpaid 402, other product's session rejected, download bytes and headers, and the download cap 429.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/web-products.ts
- server/index.ts
- tests/web-products-routes.test.ts

# Implementation notes

Read first: server/routes/stripe.ts lines 48-135 (checkout creation, PUBLIC_URL default 'https://bilko.run'), server/routes/manual.ts lines 114-161 (streaming a file with attachment headers), tests/stripe-checkout-success.test.ts (how getStripe is mocked and the Fastify app is built for inject()), server/services/web-products.ts and shared/web-products.ts (landed by wp-store / wp-catalog).

Steps:
1. Create server/routes/web-products.ts. Rate limiters: copy the module-local Map limiter shape from checkEventRate in server/routes/analytics.ts (lines 18-60); key by req.ip.
2. Write one internal helper resolvePaidOrder(product, sessionId) used by both order and download; it returns {status: 'paid', order} | {status: 'unpaid'} | {status: 'not_found'}. Stripe errors other than resource_missing → 502 with a logged message, never a stack to the client.
3. The funnel_events insert uses dbRun with parameters: event 'checkout_start', tool slug, path '/projects/<slug>/'; wrap in try/catch.
4. Register in server/index.ts next to registerStripeRoutes.
5. Tests: vi.mock '../server/services/stripe.js' getStripe to return a fake with checkout.sessions.create/retrieve.

Do not touch: server/routes/stripe.ts (PRD wp-webhook owns it), server/db-schema.ts, shared/web-products.ts.

# Out of scope

- Release upload and Clerk account download (PRD wp-release-account-routes)
- Admin stats (PRD wp-admin-stats)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/web-products-routes.test.ts
timeout 600 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
