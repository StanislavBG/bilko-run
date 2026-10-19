---
title: bilko-host MCP: `update_project_listing` + `get_project` tools
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T00:13:57.276Z
sourcePromptId: too-many-projects-request-bilko-changes-bilko-is-16904868
agentType: dev-lead
dependsOn: [slug-ownership-primitive]
planId: pl-mv5xdbg3-0eb8c5
---
# Goal

wire. Give sibling sessions a self-service way to change their own /projects card (tagline, name, tags, status, drawer story, metric, audience, talking points) without asking Bilko: a new `update_project_listing` MCP tool that checks ownership, applies the allowlisted patch, and commits + pushes through the existing isolated publish checkout; plus a read-only `get_project` tool so they can see their current entry.

# Acceptance criteria

- [ ] New file mcp-host-server/src/listing-tool.ts exports `updateListingInRegistry(projects: RegistryProject[], slug: string, callerRepoPath: string | undefined, patch: unknown): { next: RegistryProject[]; changed: boolean }` which throws on unknown slug, calls assertCallerOwnsSlug then applyListingPatch, validates the whole array with RegistrySchema, and returns changed=false when the patched entry deep-equals the original.
- [ ] mcp-host-server/src/server.ts registers `update_project_listing` with input { slug, callerRepoPath (absolute sibling repo root), patch (ListingPatchSchema) }; inside withPublishCheckout it reads the registry, calls updateListingInRegistry, writes the registry only if changed, commit message `listing: update <slug>`; when unchanged it returns `no change: <slug>` without committing.
- [ ] server.ts registers read-only `get_project` { slug } returning the full registry entry as pretty JSON, or an error result for an unknown slug.
- [ ] tests/mcp-listing-tool.test.ts covers: owner updates tagline + listing; other repo path rejected; `public` in patch rejected; unknown slug rejected; identical patch returns changed=false; result passes RegistrySchema.
- [ ] mcp-host-server/dist/ rebuilt and committed (tests/mcp-dist-sync.test.ts passes).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/listing-tool.ts
- mcp-host-server/src/server.ts
- mcp-host-server/dist/
- tests/mcp-listing-tool.test.ts

# Implementation notes

Depends on listing-patch-primitive (mcp-host-server/src/listing-patch.ts: `applyListingPatch`, `ListingPatchSchema`, `PROJECT_OWNED_FIELDS`) and slug-ownership-primitive (mcp-host-server/src/ownership.ts: `assertCallerOwnsSlug`). Read both landed files first.
Read first: mcp-host-server/src/server.ts lines 120-275 (server setup, `register_static_project` handler — copy its withPublishCheckout / readRegistry / writeRegistry / ok / err / checkoutErr / pushedLine pattern exactly); mcp-host-server/src/publish-checkout.ts exports.
Steps:
1. Create listing-tool.ts (pure; no fs, no git).
2. In server.ts add both tools after `unregister_project`, numbered in the existing `// N) name ───` comment style. Tool description for update_project_listing: "Change YOUR project's public card content (name, displayName, tagline, category, tags, status, thumbnail, listing{detail,metric,metricLabel,lang,audience,talkingPoints}). Only the repo bound to the slug (host.localPath) may call it. Visibility (public), slug and hosting are owned by Bilko and cannot be changed here. Commits and pushes; bilko.run redeploys in ~1 minute."
3. Tests on listing-tool.ts (red first), then `pnpm --dir mcp-host-server build`.
Do not touch: publish_static_project / register_static_project handlers (next PRD).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm --dir mcp-host-server build && timeout 300 pnpm vitest run tests/mcp-listing-tool.test.ts tests/mcp-dist-sync.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
