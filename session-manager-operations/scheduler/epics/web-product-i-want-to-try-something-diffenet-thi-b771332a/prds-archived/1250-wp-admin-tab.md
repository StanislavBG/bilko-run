---
title: Admin dashboard "Products" tab showing each web product's funnel, revenue, downloads and release status
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-11T04:39:08.472Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [wp-admin-stats]
planId: pl-mv3bvhsl-b2ab4f
---
# Goal

feature: give the admin a place to monitor web products. Add a 'products' tab to /admin that reads GET /api/admin/web-products?days=N (added by PRD wp-admin-stats) and shows, per product, the funnel views -> checkout starts -> orders -> downloads, revenue, and whether the paid release is stored.

# Acceptance criteria

- [ ] src/pages/admin/analytics/WebProductsTab.tsx exports WebProductsTab({days, excludeSelf}) that fetches /api/admin/web-products?days=<days> with the same authenticated fetch helper the other admin tabs use, with loading, error and 'No web products yet' empty states.
- [ ] Each product renders a card: name, displayPrice, version, a release badge ('release stored' or a red 'release missing'), the funnel Views -> Checkout starts -> Orders -> Downloads with step conversion percentages, revenue in dollars from revenueCents, and last order/download times in America/Los_Angeles with the PDT/PST abbreviation.
- [ ] Below the cards, a compact table of the daily series (date, product, views, checkout starts, orders, downloads).
- [ ] src/pages/AdminPage.tsx adds 'products' to TABS and renders <WebProductsTab days={days} excludeSelf={excludeSelf} /> for it, matching the existing tab rendering pattern.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/pages/admin/analytics/WebProductsTab.tsx
- src/pages/AdminPage.tsx

# Implementation notes

Read first: src/pages/AdminPage.tsx (whole file, 103 lines), src/pages/admin/analytics/GrowthTabs.tsx (fetch helper, card and table styling to copy), server/routes/admin-web-products.ts (response shape, landed by wp-admin-stats).

Steps: create the tab component using existing Tailwind classes from GrowthTabs; wire it into AdminPage; run the gate. Use Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', timeZoneName: 'short', ...}) for times.

Do not touch: server/, other admin tabs.

# Out of scope

- Charts library additions
- Server changes

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 600 pnpm typecheck
timeout 600 pnpm build
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
