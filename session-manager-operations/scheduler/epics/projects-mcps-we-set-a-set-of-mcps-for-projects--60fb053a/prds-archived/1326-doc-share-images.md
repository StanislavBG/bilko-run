---
title: host-contract.md: document project-owned icon and share images for X cards
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 6
createdVia: scheduler-api
issuedAt: 2026-10-13T04:01:47.124Z
sourcePromptId: projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a
agentType: dev-lead
dependsOn: [doc-listing-marketing-fields, og-card-icon, publish-gate-share-assets, catalog-share-image-url]
planId: pl-mv653d38-529056
---
# Goal

doc: update docs/host-contract.md so a sibling agent knows how to give its project a custom X/OpenGraph image: put a PNG in its published bundle, point `listing.icon` or `listing.shareImage` at it via bilko.listing.json or update_project_listing, and publish.

# Acceptance criteria

- [ ] docs/host-contract.md "Social share cards" section explains the resolution order for `https://bilko.run/og/<slug>.png`: valid `listing.shareImage` (1200x630 PNG, ≤5 MB) served as-is → generated card with `listing.icon` (square PNG 128–1024 px, ≤512 KB) → plain generated card; and that og:image carries a `?v=` content hash so X refetches after a change.
- [ ] It gives a 4-step recipe: add the PNG to the build output (e.g. `public/og.png` so it lands at `/projects/<slug>/og.png`), set the path in bilko.listing.json, run publish_static_project, check the card at https://bilko.run/og/<slug>.png; and states that the `share-assets` publish gate blocks a missing or wrongly sized file.
- [ ] The listing limits table in "Project listing — who owns what" has rows for `icon` and `shareImage` (must start with `/projects/<own-slug>/`, `.png`).
- [ ] "Public project catalog" lists `share_image_url`.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- docs/host-contract.md

# Implementation notes

Read first: docs/host-contract.md lines 100-210; the landed server/og-routes.ts, server/og-meta.ts, mcp-host-server/src/gates/share-assets.ts and mcp-host-server/src/contract/registry.ts — use the exact limits implemented there if they differ from this PRD.
Edit only the three sections named in the AC; plain, short sentences.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 30 grep -q shareImage docs/host-contract.md && timeout 30 grep -q share_image_url docs/host-contract.md && timeout 30 grep -q share-assets docs/host-contract.md
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
