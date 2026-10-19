---
title: bilko-host MCP: publish syncs the sibling's `bilko.listing.json` into the registry
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T00:18:02.849Z
sourcePromptId: too-many-projects-request-bilko-changes-bilko-is-16904868
agentType: dev-lead
dependsOn: [mcp-enforce-ownership-and-visibility]
planId: pl-mv5xdbg3-0eb8c5
---
# Goal

behavior. Let each sibling keep its /projects card content in its own repo as the source of truth: when `publish_static_project` runs and `<sourceRepoPath>/bilko.listing.json` exists, apply it as a listing patch (same allowlist + standards as update_project_listing) in the same commit as the bytes. Invalid content blocks the publish with an actionable error.

# Acceptance criteria

- [ ] mcp-host-server/src/listing-tool.ts exports `readListingFile(sourceRepoPath: string): unknown | undefined` — returns undefined when the file is absent, throws `bilko.listing.json: <reason>` on invalid JSON or a file over 16 KB.
- [ ] publish_static_project, inside withPublishCheckout after the ownership check, reads the file and, when present, runs updateListingInRegistry; if changed it writes the registry and adds src/data/standalone-projects.json to the commit paths; a patch error refuses the whole publish (no bytes copied).
- [ ] The publish result text includes `listing: synced from bilko.listing.json` or `listing: unchanged` or `listing: no bilko.listing.json` so the caller knows what happened.
- [ ] tests/mcp-listing-tool.test.ts covers readListingFile: absent → undefined; invalid JSON throws; oversize throws; valid file returns the object; and a valid file containing `public: true` is rejected by updateListingInRegistry.
- [ ] mcp-host-server/dist/ rebuilt and committed; pnpm test and pnpm typecheck pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/server.ts
- mcp-host-server/src/listing-tool.ts
- mcp-host-server/dist/
- tests/mcp-listing-tool.test.ts

# Implementation notes

Depends on mcp-enforce-ownership-and-visibility (publish now runs assertCallerOwnsSlug inside the checkout; listing-tool.ts has updateListingInRegistry). Read the landed publish_static_project handler in mcp-host-server/src/server.ts first.
Read first: mcp-host-server/src/server.ts publish_static_project handler (~lines 274-400: gate run, copy/swap, `paths` passed back to withPublishCheckout); mcp-host-server/src/listing-tool.ts.
Steps:
1. Add readListingFile (node:fs statSync + readFileSync, 16384-byte cap).
2. In the publish handler, do the listing read + patch BEFORE the byte copy so an invalid file aborts cleanly; write the registry after the swap succeeds, in the same commit.
3. The file format is the update_project_listing `patch` shape exactly, e.g. {"tagline": "...", "listing": {"detail": "...", "talkingPoints": ["..."]}}.
4. Tests, then `pnpm --dir mcp-host-server build`.
Do not touch: docs/, src/data/.

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
