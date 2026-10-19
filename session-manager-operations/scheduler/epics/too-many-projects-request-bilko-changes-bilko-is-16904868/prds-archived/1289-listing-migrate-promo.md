---
title: Move catalog audience/talking points (PROMO) from projectCatalog.ts into registry `listing`
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-13T00:12:26.204Z
sourcePromptId: too-many-projects-request-bilko-changes-bilko-is-16904868
agentType: dev-lead
dependsOn: [listing-migrate-enrich]
planId: pl-mv5xdbg3-0eb8c5
---
# Goal

migration. The public catalog (GET /api/projects and the read-only /mcp) takes `audience` and `talking_points` from a hardcoded `PROMO` map in src/data/projectCatalog.ts. Move every PROMO value into that slug's registry `listing.audience` / `listing.talkingPoints` and read them from the card's project entry, with byte-identical API output.

# Acceptance criteria

- [ ] src/data/standalone-projects.json: every slug in the old PROMO map has `listing.audience` and `listing.talkingPoints` equal to its former PROMO `audience` / `talkingPoints` (byte-for-byte, order preserved).
- [ ] src/data/projectCatalog.ts no longer defines `PROMO` or `Promo`; `toCatalogProject` gets audience/talking_points from the registry entry's listing (empty string / [] when absent). The module doc comment says card content lives in the registry `listing` block and is edited by the owning sibling through the bilko-host MCP.
- [ ] src/data/projectsView.ts HubCard carries `audience?: string` and `talkingPoints?: readonly string[]` populated from `p.listing` in `projectCard`, so projectCatalog.ts reads them off the card (no second registry lookup).
- [ ] tests/project-catalog.test.ts has a test asserting git-viewer's audience and talking_points equal the former PROMO strings (hardcoded in the test) and that a public project with no listing yields audience '' and talking_points [].
- [ ] pnpm test and pnpm typecheck pass; tests/project-catalog.test.ts existing tests unchanged and green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/standalone-projects.json
- src/data/projectCatalog.ts
- src/data/projectsView.ts
- tests/project-catalog.test.ts

# Implementation notes

Depends on listing-migrate-enrich (moved ENRICH into `listing` and added `listing?: Listing` to `Project` in src/data/projectsRegistry.ts; projectCard now reads p.listing) — read the landed projectsView.ts first.
Read first: src/data/projectCatalog.ts (whole, ~146 lines; `PROMO` at ~line 46, `toCatalogProject` ~line 115); src/data/projectsView.ts `HubCard` + `projectCard`; tests/project-catalog.test.ts.
Steps:
1. For each PROMO slug, add `audience` and `talkingPoints` inside that entry's existing `listing` object in standalone-projects.json (create `listing` if missing). Keep strings exact.
2. Add `audience?` / `talkingPoints?` to HubCard and set them in projectCard from p.listing.
3. In projectCatalog.ts delete Promo/PROMO; `audience: card.audience ?? ''`, `talking_points: [...(card.talkingPoints ?? [])]`.
4. CATALOG_SCHEMA_VERSION stays 1 (no field renamed/removed).
Do not touch: mcp-host-server/ (other PRDs own it), docs/.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/project-catalog.test.ts tests/projects-view.test.ts tests/registry-contract.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
