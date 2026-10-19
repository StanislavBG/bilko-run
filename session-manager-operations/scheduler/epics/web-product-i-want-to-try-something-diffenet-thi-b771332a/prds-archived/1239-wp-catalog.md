---
title: Add the web-products catalog (shared/web-products.ts) with validators and lookups
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 7
createdVia: scheduler-api
issuedAt: 2026-10-11T04:33:26.229Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
planId: pl-mv3bvhsl-b2ab4f
---
# Goal

primitive: bilko.run is gaining a reusable way to sell downloadable digital products ("web products"); the first is the $9 "Bilko Launch Kit" Claude skill pack. Create shared/web-products.ts — pure data plus pure functions (no fs, no env reads, no Stripe import) so it loads in both the browser bundle and the server — holding the catalog types, an initially EMPTY catalog, lookups and input validators, with unit tests. Later PRDs build the DB store, routes, webhook wiring and the real catalog entry on top of it.

# Acceptance criteria

- [ ] shared/web-products.ts exports interfaces WebProductRelease {version: string; filename: string; bytes: number; sha256: string} and WebProduct {slug: string; name: string; productKey: string; priceEnvVar: string; defaultPriceId?: string; displayPrice: string; downloadLimit: number; release: WebProductRelease | null}, the constant MAX_RELEASE_BYTES = 5 * 1024 * 1024, and WEB_PRODUCTS: readonly WebProduct[] = [] (empty for now).
- [ ] shared/web-products.ts exports webProductBySlug(slug, list = WEB_PRODUCTS), resolveWebProductPriceId(product, env) returning env[product.priceEnvVar] || product.defaultPriceId, and webProductForPriceId(priceId, env, list = WEB_PRODUCTS) returning the product whose resolved price id equals priceId (undefined when priceId is undefined or empty).
- [ ] shared/web-products.ts exports isValidWebProductSlug (regex ^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$), isValidCheckoutSessionId (regex ^cs_(live|test)_[A-Za-z0-9]{10,250}$) and isValidReleaseVersion (regex ^\d{1,4}\.\d{1,4}\.\d{1,4}$).
- [ ] shared/web-products.ts exports validateWebProducts(list): string[] returning one message per problem: duplicate slug, invalid slug, productKey !== 'wp_' + slug with every '-' replaced by '_', priceEnvVar not matching ^STRIPE_PRICE_WP_[A-Z0-9_]+$, downloadLimit not an integer in 1..100, and for a non-null release: invalid version, filename not matching ^[A-Za-z0-9._-]+\.zip$, bytes not an integer in 1..MAX_RELEASE_BYTES, sha256 not 64 lowercase hex chars.
- [ ] tests/web-products-catalog.test.ts covers every export: lookups against a fixture list, env override beating defaultPriceId, accept and reject cases for each validator (including '../x', 'A', '-x' slugs and session ids containing '/', '%' or spaces), validateWebProducts on a bad fixture returning each listed message, and validateWebProducts(WEB_PRODUCTS) returning [].

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- shared/web-products.ts
- tests/web-products-catalog.test.ts

# Implementation notes

Read first: shared/product-catalog.ts (whole file — the existing pure-data Stripe catalog; copy its doc-comment style and keep this module dependency-free the same way), shared/manual-catalog.ts lines 1-30.

Steps:
1. Create shared/web-products.ts with the exports named in the criteria. Doc-comment the module: what a web product is (a paid download sold at /projects/<slug>/, Stripe price resolved from env var then committed default, release bytes stored server-side and pinned by sha256 because the GitHub repo is public), and that WEB_PRODUCTS is the single source of truth.
2. Functions take an optional `list` argument (default WEB_PRODUCTS) so tests and routes can inject fixtures.
3. Create tests/web-products-catalog.test.ts (vitest, same style as tests/manifest.test.ts) with a fixture product, e.g. slug 'demo-pack', productKey 'wp_demo_pack', priceEnvVar 'STRIPE_PRICE_WP_DEMO_PACK', defaultPriceId 'price_demo', displayPrice '$9', downloadLimit 20, release {version '1.0.0', filename 'demo-pack-1.0.0.zip', bytes 1234, sha256 '<64 hex>'}.

Do not touch: shared/product-catalog.ts, anything under server/ or src/.

# Out of scope

- DB tables, routes, webhook changes (separate PRDs)
- Adding the real Launch Kit catalog entry (PRD launch-kit-catalog-entry)

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
