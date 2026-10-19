---
title: Document web products: host-contract playbook for selling a download, CLAUDE.md architecture + public-repo rule
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-11T04:39:31.442Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [wp-release-account-routes, wp-webhook-orders, wp-admin-stats]
planId: pl-mv3bvhsl-b2ab4f
---
# Goal

doc: the human wants this to be the template for future "web products" they advertise and monitor. Document the shipped framework so the next product is a checklist, not a project: a playbook section in docs/host-contract.md and a short architecture entry plus a hard rule in CLAUDE.md. Describe only what the landed code actually does — read it first.

# Acceptance criteria

- [ ] docs/host-contract.md gains a section '## Selling a downloadable web product' with: the endpoint table (GET /api/web-products/:slug, POST .../checkout, GET .../order, GET .../download, PUT .../releases/:version, GET .../account-download, GET /api/admin/web-products) with auth and status codes as implemented.
- [ ] The same section gives the numbered playbook: live Stripe product + price with metadata web_product=<slug>; build the zip in a PRIVATE sibling repo; add the WEB_PRODUCTS entry (defaultPriceId + release version/filename/bytes/sha256) and deploy; PUT the bytes once (content-addressed, no secret); landing page at /projects/<slug>/ calling checkout, thanks page at /projects/<slug>/thanks/ calling order + download with sign-in recovery; monitor in /admin -> Products.
- [ ] CLAUDE.md Key Architecture gains a short 'Web products' subsection pointing to shared/web-products.ts, server/routes/web-products.ts, server/routes/admin-web-products.ts, server/services/web-products.ts and the host-contract section.
- [ ] CLAUDE.md Rules gains: 'Paid download bytes never go in this repo (it is public on GitHub) — commit only their sha256 in shared/web-products.ts; the bytes live in the web_product_releases table.'

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- docs/host-contract.md
- CLAUDE.md

# Implementation notes

Read first: server/routes/web-products.ts, server/routes/admin-web-products.ts, shared/web-products.ts, server/routes/stripe.ts (the web-product dispatch) — all landed by earlier PRDs; docs/host-contract.md lines 1-140 for tone; CLAUDE.md 'Key Architecture' and 'Rules' sections.

Keep it tight: tables and numbered steps, no marketing prose. Do not add tests that grep docs.

Do not touch: code files.

# Out of scope

- Blog post or marketing copy
- Adding the Launch Kit to the sanctioned app-specific list (launch-kit-catalog-entry does that)

# Gate

This PRD has no runnable check. Check each acceptance criterion by reading the files.

```gate
none
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
