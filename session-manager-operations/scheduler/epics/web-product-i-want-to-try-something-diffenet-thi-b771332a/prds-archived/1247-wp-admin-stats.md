---
title: Admin API for web-product monitoring: views, checkout starts, orders, revenue, downloads
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-11T04:36:55.089Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [wp-buy-routes]
planId: pl-mv3bvhsl-b2ab4f
---
# Goal

behavior: the human wants to advertise web products and then monitor their usage and downloads. Add an admin-only endpoint in a new server/routes/admin-web-products.ts (registered in server/index.ts) that returns, per catalog product, the landing-page funnel (views, unique visitors, checkout starts, orders, revenue, downloads) plus a daily series, so the admin dashboard can show it.

# Acceptance criteria

- [ ] server/routes/admin-web-products.ts exports registerAdminWebProductRoutes(app, opts?: {products?: readonly WebProduct[]}) and server/index.ts registers it after registerWebProductRoutes.
- [ ] GET /api/admin/web-products?days=N requires requireAdmin (401/403 otherwise), clamps days to 1..365 (default 30) and returns {days, products: [...], daily: [...]}.
- [ ] Each products entry has slug, name, displayPrice, version, releaseStored, views and uniqueVisitors (page_views rows whose path starts with '/projects/<slug>/', bots excluded), checkoutStarts (funnel_events event 'checkout_start' with tool = slug), orders and revenueCents (web_product_orders), downloads and uniqueDownloadSessions (web_product_downloads), lastOrderAt and lastDownloadAt (epoch ms or null).
- [ ] daily is [{date, slug, views, checkoutStarts, orders, downloads}] for the window; all SQL is parameterized (the LIKE pattern is built in JS and bound).
- [ ] tests/admin-web-products.test.ts seeds page_views, funnel_events, orders and downloads for a fixture product and asserts every count, the days clamp and the non-admin rejection.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- server/routes/admin-web-products.ts
- server/index.ts
- tests/admin-web-products.test.ts

# Implementation notes

Read first: server/routes/analytics.ts lines 200-240 (admin query style, `date >= ?` on page_views, admin exclusion helpers) and 486-510, server/db-schema.ts page_views (lines 125-137) and funnel_events (lines 168-176) plus the web_product_* tables (added by wp-store), tests/analytics-admin-queries.test.ts (how requireAdmin is satisfied in tests).

Steps:
1. Create the route file; compute `since` for page_views (date string) and epoch-ms tables separately.
2. Register in server/index.ts right after registerWebProductRoutes(app).
3. Write the test.

Do not touch: server/routes/web-products.ts, server/routes/analytics.ts, src/.

# Out of scope

- The admin UI tab (wp-admin-tab)
- Telemetry inside the skills themselves (deliberately none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/admin-web-products.test.ts
timeout 600 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
