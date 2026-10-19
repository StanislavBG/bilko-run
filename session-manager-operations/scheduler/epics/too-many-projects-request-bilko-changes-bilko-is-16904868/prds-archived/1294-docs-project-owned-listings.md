---
title: Docs: project-owned listings, ownership rule, host-owned visibility
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-13T00:19:51.403Z
sourcePromptId: too-many-projects-request-bilko-changes-bilko-is-16904868
agentType: dev-lead
dependsOn: [mcp-publish-syncs-listing-file, listing-migrate-promo]
planId: pl-mv5xdbg3-0eb8c5
---
# Goal

doc. Document the new split so sibling sessions stop asking Bilko for card changes: siblings own their card content (via update_project_listing or bilko.listing.json at publish), Bilko owns slug, hosting, visibility (`public`) and the content standards, and each slug is bound to one repo.

# Acceptance criteria

- [ ] docs/host-contract.md has a new section `## Project listing — who owns what` (after `## Registry rules`) with: a table of project-owned fields vs Bilko-owned fields (slug, host, year, launchedAt, public); the ownership rule (host.localPath binds a slug to one repo; publish/unregister/update_project_listing refuse other callers); the content standards caps and banned-term rule as implemented in mcp-host-server/src/contract/registry.ts; the two edit paths (update_project_listing tool, bilko.listing.json synced on publish) with a JSON example; and that going public is the Bilko owner's call made in a Bilko session.
- [ ] docs/host-contract.md `## Public project catalog` source-of-truth bullet now says detail/audience/talking_points come from the registry entry `listing` (no longer ENRICH/PROMO); `## Adding from a sibling-repo Claude session (MCP)` steps mention callerRepoPath and drop `public` from register.
- [ ] mcp-host-server/README.md tools table lists update_project_listing and get_project, and the flow/safety notes describe ownership and bilko.listing.json; `requireRegistered` mention removed.
- [ ] CLAUDE.md `Public project catalog` / registry description lines no longer reference ENRICH or PROMO.
- [ ] Every field name, cap and tool parameter in the docs matches the landed code (verify by reading registry.ts, listing-patch.ts, listing-tool.ts, server.ts).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- docs/host-contract.md
- mcp-host-server/README.md
- CLAUDE.md

# Implementation notes

Depends on mcp-publish-syncs-listing-file and listing-migrate-promo — all code has landed; read it before writing: mcp-host-server/src/contract/registry.ts, mcp-host-server/src/listing-patch.ts, mcp-host-server/src/listing-tool.ts, mcp-host-server/src/server.ts (tool registrations).
Read first: docs/host-contract.md lines 91-230; mcp-host-server/README.md lines 1-120; CLAUDE.md lines mentioning `projectCatalog` / `server/routes/project-catalog.ts`.
Style: short sentences, tables where the doc already uses them; no marketing tone. Do not add tests that grep docs.
Do not touch: any .ts source.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 600 pnpm test
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
