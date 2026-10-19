---
title: Public catalog + /mcp: expose offering, pricing, call_to_action, avoid_claims
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-13T03:48:53.972Z
sourcePromptId: projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a
agentType: dev-lead
dependsOn: [listing-marketing-fields]
planId: pl-mv653d38-529056
---
# Goal

wire: carry the four new registry listing fields (offering, pricing, callToAction, avoidClaims — added to ListingSchema by PRD listing-marketing-fields) through the hub view model into the public catalog served at GET /api/projects and the read-only MCP at /mcp. Burrow reads that catalog to decide what to promote; this is an additive change, so schema_version stays 1.

# Acceptance criteria

- [ ] src/data/projectsView.ts `HubCard` gains optional `offering`, `pricing`, `callToAction`, `avoidClaims` (readonly string[]) and `projectCard()` copies them from `p.listing`; `packageCard()` leaves them undefined.
- [ ] src/data/projectCatalog.ts `CatalogProject` gains `offering: string`, `pricing: string`, `call_to_action: string`, `avoid_claims: string[]`; `toCatalogProject` defaults absent values to '' / []; `buildCatalog` deep-copies `avoid_claims` like `talking_points`; `CATALOG_SCHEMA_VERSION` stays 1.
- [ ] tests/project-catalog.test.ts `FIELDS` includes the four new keys and a new test asserts each public project's `offering` is '' or one of saas|free-tool|showcase|open-source|game|content|experiment and `pricing` is '' or one of free|freemium|paid|none; MCP `get_project` returns the same four fields.
- [ ] The doc comment at the top of projectCatalog.ts mentions the four new fields and that Burrow must honor `avoid_claims`.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/projectsView.ts
- src/data/projectCatalog.ts
- tests/project-catalog.test.ts

# Implementation notes

Read first: the landed mcp-host-server/src/contract/registry.ts `ListingSchema` (from PRD listing-marketing-fields — confirm the field names there before coding); src/data/projectsView.ts (whole, 144 lines); src/data/projectCatalog.ts (whole, 79 lines); tests/project-catalog.test.ts (whole).
Steps:
1. Write the failing test changes in tests/project-catalog.test.ts first.
2. projectsView.ts: add fields to `HubCard` interface (with one-line doc comments, matching existing style) and to `projectCard()`.
3. projectCatalog.ts: add snake_case fields to `CatalogProject`, map in `toCatalogProject`, copy array in `buildCatalog`.
server/routes/project-catalog.ts already serializes `buildCatalog()` / `findCatalogProject()` whole — no route change needed.
Do not touch: src/pages/ProjectsPage.tsx, src/styles/portfolio.css (other PRDs own them).

# Out of scope

- Bumping schema_version
- Setting values on any registry entry
- Burrow-side changes

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/project-catalog.test.ts tests/projects-view.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
