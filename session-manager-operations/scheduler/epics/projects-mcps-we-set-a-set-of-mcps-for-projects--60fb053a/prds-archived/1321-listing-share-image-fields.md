---
title: Registry listing: project-owned icon and shareImage fields
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T03:56:33.085Z
sourcePromptId: projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a
agentType: dev-lead
dependsOn: [listing-marketing-fields]
planId: pl-mv653d38-529056
---
# Goal

primitive: let each sibling project publish its own X/OpenGraph imagery. Add two optional, project-owned keys to the registry `ListingSchema`: `icon` (a square PNG in the project's own published bundle, composited onto the generated share card) and `shareImage` (a full 1200x630 PNG in the bundle that replaces the generated card). Both are paths confined to `/projects/<own-slug>/`, so a project can only point at its own bytes on bilko.run and the host never fetches remote URLs.

# Acceptance criteria

- [ ] mcp-host-server/src/contract/registry.ts `ListingSchema` accepts optional `icon` and `shareImage`, each a string matching `^/projects/[a-z0-9-]+/[A-Za-z0-9._/-]+\.png$`, max 200 chars, and rejecting any value containing `..` or `//`.
- [ ] `RegistrySchema` superRefine rejects an entry whose `listing.icon` or `listing.shareImage` does not start with `/projects/<that entry's slug>/`, with a message naming the slug and field.
- [ ] The `update_project_listing` description in mcp-host-server/src/server.ts mentions `icon` and `shareImage` and says both must be PNG files inside the project's own published bundle (icon square, shareImage exactly 1200x630).
- [ ] tests/registry-contract.test.ts covers: valid icon/shareImage parse; a .jpg, a `..` path, an https URL and another slug's path are each rejected.
- [ ] mcp-host-server/dist/ rebuilt with `pnpm --dir mcp-host-server build` and committed; tests/mcp-dist-sync.test.ts passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/contract/registry.ts
- mcp-host-server/src/server.ts
- mcp-host-server/dist/
- tests/registry-contract.test.ts

# Implementation notes

Read first: mcp-host-server/src/contract/registry.ts (whole; PRD listing-marketing-fields already added offering/pricing/callToAction/avoidClaims there — keep them); mcp-host-server/src/server.ts lines 275-290; tests/registry-contract.test.ts.
Steps:
1. Red: tests first.
2. Add `ProjectAssetPathSchema` (exported) in registry.ts implementing the regex + refine for `..`/`//`; use it for `icon` and `shareImage` in `ListingSchema`.
3. In the `RegistrySchema` superRefine loop, add the own-slug prefix check for both fields.
4. Update the tool description string in server.ts.
5. `pnpm --dir mcp-host-server build`; commit dist with src.
The existing top-level `thumbnail` field is unrelated and stays untouched.

# Out of scope

- Serving or rendering the images (separate PRDs)
- JPEG/WebP support
- Changing any registry entry's data

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/registry-contract.test.ts tests/mcp-dist-sync.test.ts tests/mcp-listing-patch.test.ts tests/mcp-listing-tool.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
