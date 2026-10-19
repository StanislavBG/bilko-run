---
title: Web-product release upload (sha256-pinned, no secret) and signed-in re-download route
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T04:36:46.129Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [wp-buy-routes]
planId: pl-mv3bvhsl-b2ab4f
---
# Goal

behavior: extend server/routes/web-products.ts with (1) a content-addressed release upload, so the paid zip reaches the production DB without ever being committed to this public repo and without a new secret — the server stores bytes only if they exactly match the sha256 and size committed in shared/web-products.ts, and only once; and (2) a Clerk-authenticated re-download for buyers who lost their session link.

# Acceptance criteria

- [ ] PUT /api/web-products/:slug/releases/:version accepts an application/zip or application/octet-stream body up to MAX_RELEASE_BYTES (parser registered only inside the web-products route scope, parseAs buffer) and maps storeRelease to 201 {stored:true, sha256, bytes} / 409 exists / 404 undeclared or unknown slug or invalid version / 422 mismatch; oversize bodies get 413; 5 requests/min per IP; a code comment explains why no auth is needed.
- [ ] GET /api/web-products/:slug/account-download returns 401 when verifyClerkToken(req.headers.authorization) yields no email, 402 unless hasOrderForEmail(slug, email) or hasPurchased(email, product.productKey) (the latter honours admin comp grants), 404 when the release is not stored, else records the download (via 'account', email) and streams the bytes with the same headers as the session download; 30 requests/min per IP.
- [ ] tests/web-products-release-account.test.ts covers: upload stored then 409 on repeat, mismatch 422 with nothing stored, undeclared version 404, oversize 413, account download 401 without a token, 402 for a signed-in non-buyer, 200 bytes for an email with an order row and for an email with only a stripe_one_time_purchases comp row (verifyClerkToken mocked via vi.mock of server/clerk.js).
- [ ] tests/web-products-routes.test.ts still passes unchanged.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/web-products.ts
- tests/web-products-release-account.test.ts

# Implementation notes

Read first: server/routes/web-products.ts (landed by wp-buy-routes — reuse its limiter, verification and streaming helpers), server/services/web-products.ts (storeRelease, getRelease, hasOrderForEmail, recordDownload), server/clerk.ts lines 15-80 (verifyClerkToken), server/index.ts lines 55-80 (the global rawBody/JSON parser — make sure the zip parser does not disturb it), server/services/stripe.ts hasPurchased.

Steps:
1. Register the two routes inside registerWebProductRoutes. For the body parser, wrap the PUT route in `app.register(async (scope) => { scope.addContentTypeParser(['application/zip','application/octet-stream'], {parseAs:'buffer', bodyLimit: MAX_RELEASE_BYTES}, ...); scope.put(...) })` so other routes are unaffected.
2. Comment on the PUT: content-addressed fill — anyone may PUT, but only the exact pre-declared bytes are accepted, once; this keeps paid bytes out of the public repo without a deploy secret.
3. Write the tests.

Do not touch: server/routes/stripe.ts, server/index.ts, server/db-schema.ts.

# Out of scope

- Admin stats
- Landing-page UI for recovery (launch-kit-buy-flow)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/web-products-release-account.test.ts tests/web-products-routes.test.ts
timeout 600 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
