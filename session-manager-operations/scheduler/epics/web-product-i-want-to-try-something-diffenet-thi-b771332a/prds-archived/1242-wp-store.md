---
title: Add web-product orders/downloads/releases tables and server/services/web-products.ts
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T04:34:42.251Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [wp-catalog]
planId: pl-mv3bvhsl-b2ab4f
---
# Goal

primitive: persistence for web products (paid downloads). Add three tables to server/db-schema.ts and a new server/services/web-products.ts with order, download and release helpers used by the upcoming routes and the Stripe webhook. Releases are stored as a DB BLOB because the GitHub repo is public and the paid zip must never be committed; a release is accepted only when its bytes match the sha256 and size declared in shared/web-products.ts.

# Acceptance criteria

- [ ] server/db-schema.ts MIGRATIONS gains web_product_orders (checkout_session_id TEXT PRIMARY KEY, slug, email, amount_total INTEGER, currency, payment_status, created_at INTEGER; index on slug+email), web_product_downloads (id INTEGER PRIMARY KEY, slug, version, checkout_session_id, email, via, ip_hash, created_at INTEGER; indexes on slug+created_at and checkout_session_id) and web_product_releases (slug, version, filename, sha256, bytes INTEGER, content BLOB NOT NULL, uploaded_at INTEGER; PRIMARY KEY slug+version).
- [ ] server/services/web-products.ts exports recordOrder({checkoutSessionId, slug, email, amountTotal, currency, paymentStatus}) as INSERT OR IGNORE with email trimmed and lowercased, findOrder(slug, checkoutSessionId) returning the row or null, and hasOrderForEmail(slug, email).
- [ ] server/services/web-products.ts exports recordDownload({slug, version, checkoutSessionId, email, via, ipHash}) where via is 'session' or 'account', and countSessionDownloads(slug, checkoutSessionId).
- [ ] server/services/web-products.ts exports storeRelease(product, version, buf) returning 'undeclared' (no release or other version), 'mismatch' (length or node:crypto sha256 differ), 'exists' (row present) or 'stored', and getRelease(slug, version) returning {filename, bytes, sha256, content: Buffer} or null, cached in a module Map.
- [ ] All SQL goes through the parameterized dbGet/dbAll/dbRun helpers in server/db.ts; created_at/uploaded_at are epoch milliseconds.
- [ ] tests/web-products-store.test.ts covers order idempotency and case-insensitive email lookup, per-session download counts, all four storeRelease outcomes (mismatch stores nothing), and getRelease returning bytes equal (Buffer.equals) to what was stored.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/db-schema.ts
- server/services/web-products.ts
- tests/web-products-store.test.ts

# Implementation notes

Read first: server/db-schema.ts lines 1-60 and 485-529 (MIGRATIONS and ADDITIVE_COLUMNS style), server/db.ts (helper signatures), tests/comp-grants.test.ts (how a test boots the DB via tests/setup-db.ts), shared/web-products.ts (landed by PRD wp-catalog: WebProduct, WebProductRelease, MAX_RELEASE_BYTES).

Steps:
1. Add the three CREATE TABLE IF NOT EXISTS statements plus CREATE INDEX IF NOT EXISTS lines to MIGRATIONS in server/db-schema.ts, with a short comment: paid bytes live in the DB, pinned by the sha256 committed in shared/web-products.ts, because this repo is public.
2. Create server/services/web-products.ts. libsql may return a BLOB as Uint8Array or ArrayBuffer — normalize to Buffer in getRelease. storeRelease rejects buffers over MAX_RELEASE_BYTES as 'mismatch'.
3. Tests use a fixture WebProduct (WEB_PRODUCTS is still empty) and real sha256 of a small Buffer.

Do not touch: shared/web-products.ts, server/routes/, server/index.ts.

# Out of scope

- HTTP routes (wp-buy-routes, wp-release-account-routes)
- Webhook wiring (wp-webhook)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/web-products-store.test.ts tests/db.test.ts
timeout 600 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
