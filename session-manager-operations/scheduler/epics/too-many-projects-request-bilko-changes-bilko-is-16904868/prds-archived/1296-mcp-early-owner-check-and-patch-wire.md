---
title: bilko-host MCP: ownership check before publish gates; update tool accepts null-deletes and external url
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T00:46:41.814Z
sourcePromptId: too-many-projects-request-bilko-changes-bilko-is-16904868
agentType: dev-lead
disposition: new-head
planId: pl-mv5ynlw6-df564a
---
# Goal

behavior. Two validator findings in the bilko-host MCP. First, publish_static_project runs the golden/audit gates (which execute commands in the caller's sourceRepoPath) before checking that the caller owns the slug, so a non-owner can trigger gate commands; add a cheap ownership check before the gates. Second, update_project_listing's input schema rejects `null` (delete) and `url` (external-url entries), although applyListingPatch supports both and the docs promise them.

# Acceptance criteria

- [ ] mcp-host-server/src/listing-tool.ts exports `assertPublishOwner(projects: RegistryProject[], slug: string, sourceRepoPath: string | undefined): void` that throws `slug "<slug>" is not registered. Call register_static_project first.` for an unknown slug and otherwise calls assertCallerOwnsSlug.
- [ ] In mcp-host-server/src/server.ts publish_static_project reads the host registry and calls assertPublishOwner BEFORE runGates (or whatever runs the five publish gates); the existing ownership check inside withPublishCheckout stays as the authoritative re-check.
- [ ] update_project_listing's `patch` input is `z.record(z.string(), z.unknown())` (described as 'Fields to change; null deletes an optional field; url only for external-url entries') and is passed unchanged to updateListingInRegistry, which already validates via applyListingPatch.
- [ ] listing-tool.ts imports from './ownership.js' in a single import statement.
- [ ] tests/mcp-listing-tool.test.ts adds: assertPublishOwner rejects an unknown slug; rejects a non-owner path; accepts the owner path; updateListingInRegistry with patch {displayName: null} deletes displayName; with {url: 'https://x.example'} on an external-url entry sets host.url.
- [ ] mcp-host-server/dist/ rebuilt and committed; pnpm test and pnpm typecheck pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/server.ts
- mcp-host-server/src/listing-tool.ts
- mcp-host-server/dist/
- tests/mcp-listing-tool.test.ts

# Implementation notes

Read first: mcp-host-server/src/listing-tool.ts (whole); mcp-host-server/src/server.ts publish_static_project handler (~lines 330-460: find where the gates run relative to withPublishCheckout and the existing `assertCallerOwnsSlug(p, sourceRepoPath)` at ~line 408) and update_project_listing (~lines 280-310); tests/mcp-listing-tool.test.ts.
Steps:
1. Add assertPublishOwner to listing-tool.ts; merge the two './ownership.js' import lines.
2. In server.ts publish handler, before the gates: `assertPublishOwner(await readRegistry(HOST_ROOT), slug, sourceRepoPath)` (use the existing readRegistry helper; HOST_ROOT is the host repo). Return err(...) on throw like the other early errors.
3. Change update_project_listing's patch schema per the AC; remove the now-unused ListingPatchSchema import from server.ts if nothing else uses it.
4. Tests (red first), then `pnpm --dir mcp-host-server build`.
Do not touch: docs/, mcp-host-server/README.md (a sibling PRD owns them).

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm --dir mcp-host-server build && timeout 600 pnpm test && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
