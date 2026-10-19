---
title: Add the real Launch Kit entry to WEB_PRODUCTS (live $9 price id + v1.0.0 release hash) and list it as sanctioned app data
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 5
createdVia: scheduler-api
issuedAt: 2026-10-11T04:40:52.773Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [wp-docs, launch-kit-package, launch-kit-stripe]
planId: pl-mv3bwsrs-bb11db
---
# Goal

wire: make the Launch Kit sellable by the host. Add its entry to WEB_PRODUCTS in shared/web-products.ts using the live Stripe price id recorded by PRD launch-kit-stripe and the release metadata recorded by PRD launch-kit-package, and add it to CLAUDE.md's "Sanctioned app-specific host code" list in the same commit, as that rule requires.

# Acceptance criteria

- [ ] WEB_PRODUCTS in shared/web-products.ts contains exactly one entry: slug 'launch-kit', name 'Bilko Launch Kit', productKey 'wp_launch_kit', priceEnvVar 'STRIPE_PRICE_WP_LAUNCH_KIT', defaultPriceId = the price id in launch-kit-stripe.md, displayPrice '$9', downloadLimit 20, release {version '1.0.0', filename 'bilko-launch-kit-1.0.0.zip', bytes, sha256} copied from launch-kit-package.md and equal to /home/bilko/Projects/Bilko-Launch-Kit/releases/1.0.0.json.
- [ ] tests/web-products-catalog.test.ts additionally asserts webProductBySlug('launch-kit') resolves with productKey 'wp_launch_kit' and that validateWebProducts(WEB_PRODUCTS) is still [].
- [ ] CLAUDE.md 'Sanctioned app-specific host code' gains a bullet: 'Bilko Launch Kit web product — its WEB_PRODUCTS entry in shared/web-products.ts (price id + release sha256 only; the paid zip lives in the private ~/Projects/Bilko-Launch-Kit repo and the web_product_releases table)'.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- shared/web-products.ts
- tests/web-products-catalog.test.ts
- CLAUDE.md

# Implementation notes

Read first: session-manager-operations/reviews/deploy/web-product-i-want-to-try-something-diffenet-thi-b771332a/launch-kit-stripe.md (price id) and launch-kit-package.md (filename, bytes, sha256), /home/bilko/Projects/Bilko-Launch-Kit/releases/1.0.0.json (must match), shared/web-products.ts, CLAUDE.md 'Sanctioned app-specific host code' section.

If the two records disagree with releases/1.0.0.json, FAIL with the diff — do not guess.

Do not touch: server/, src/, docs/.

# Out of scope

- Deploying or uploading (launch-kit-deploy-api)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/web-products-catalog.test.ts
timeout 600 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
