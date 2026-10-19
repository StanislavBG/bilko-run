---
title: Move /projects drawer enrichment (ENRICH) from projectsView.ts into registry `listing`
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T00:11:51.453Z
sourcePromptId: too-many-projects-request-bilko-changes-bilko-is-16904868
agentType: dev-lead
dependsOn: [listing-schema-standards]
planId: pl-mv5xdbg3-0eb8c5
---
# Goal

migration. The /projects hub reads per-project metric/metricLabel/lang/detail from a hardcoded `ENRICH` map in src/data/projectsView.ts, so a sibling can only change its own card by editing Bilko source. Move every ENRICH value into that slug's registry entry `listing` block (schema added by PRD listing-schema-standards) and make projectsView.ts read from `p.listing`, with identical rendered output.

# Acceptance criteria

- [ ] src/data/standalone-projects.json: each of git-viewer, session-manager, social-signals-trader, bilko-host, outdoor-hours, bilko-flow, escape-velocity, launch-kit has `listing.metric`, `listing.metricLabel`, `listing.lang`, `listing.detail` equal (byte-for-byte) to its former ENRICH value.
- [ ] src/data/projectsView.ts no longer defines `ENRICH` or the `Enrich` interface; `projectCard(p)` sets metric/metricLabel/lang/detail from `p.listing` (fields absent when the listing field is absent); `packageCard` no longer spreads ENRICH.
- [ ] src/data/projectsRegistry.ts `Project` interface gains `listing?: Listing` (type imported from mcp-host-server/src/contract/registry.js).
- [ ] tests/projects-view.test.ts has a test asserting the git-viewer and launch-kit HubCards carry the same metric and detail strings as before the move (hardcode the expected strings in the test), and a test that a project with no listing has metric/detail undefined.
- [ ] pnpm test and pnpm typecheck pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- src/data/standalone-projects.json
- src/data/projectsView.ts
- src/data/projectsRegistry.ts
- tests/projects-view.test.ts

# Implementation notes

Depends on listing-schema-standards (adds `ListingSchema`/`Listing` and `listing` to `RegistryProjectSchema` in mcp-host-server/src/contract/registry.ts) — read that landed code first.
Read first: src/data/projectsView.ts lines 50-160 (HubCard, `ENRICH` map at ~line 67, `projectCard`, `packageCard`); src/data/projectsRegistry.ts lines 15-80 (`Project` interface; how standalone JSON is cast into PROJECTS); tests/projects-view.test.ts.
Steps:
1. Copy each ENRICH entry into src/data/standalone-projects.json under that slug as `"listing": { "metric", "metricLabel", "lang", "detail" }` — exact strings, preserve unicode (en dash, middle dot, em dash). Place `listing` as the last key of each entry.
2. In projectsRegistry.ts import `type Listing` from '../../mcp-host-server/src/contract/registry.js' and add `listing?: Listing;` with a doc comment "Project-owned card content; edited by the owning sibling via the bilko-host MCP".
3. In projectsView.ts delete `Enrich`/`ENRICH`; in `projectCard` replace `...ENRICH[p.slug]` with `metric: p.listing?.metric, metricLabel: p.listing?.metricLabel, lang: p.listing?.lang, detail: p.listing?.detail`; in `packageCard` drop the spread. Update the HubCard doc comment for metric ("from the registry entry's listing").
4. Leave `audience`/`talkingPoints` absent from the JSON — PRD listing-migrate-promo does those.
Do not touch: src/data/projectCatalog.ts, mcp-host-server/ (other PRDs own them).

# Out of scope

- PROMO / audience / talking points (separate PRD)
- Visual changes to /projects

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/projects-view.test.ts tests/project-catalog.test.ts tests/registry-contract.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
