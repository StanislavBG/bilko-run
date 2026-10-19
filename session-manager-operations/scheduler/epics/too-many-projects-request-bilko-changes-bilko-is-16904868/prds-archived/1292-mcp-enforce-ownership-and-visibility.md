---
title: bilko-host MCP: enforce slug ownership on publish/unregister; make `public` host-owned on register
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 10
createdVia: scheduler-api
issuedAt: 2026-10-13T00:15:52.887Z
sourcePromptId: too-many-projects-request-bilko-changes-bilko-is-16904868
agentType: dev-lead
dependsOn: [mcp-update-project-listing-tool]
planId: pl-mv5xdbg3-0eb8c5
---
# Goal

wire. Close the remaining cross-project write paths: publish_static_project and unregister_project must only act for the repo bound to the slug, and register_static_project must bind the new slug to the caller's repo and never make a project public on its own — public visibility on bilko.run is the Bilko owner's call, made in a Bilko session, not a sibling's.

# Acceptance criteria

- [ ] publish_static_project calls assertCallerOwnsSlug(entry, sourceRepoPath) inside the checkout before copying bytes, and refuses with that error; the `requireRegistered` input is removed (an unregistered slug is always refused).
- [ ] unregister_project takes a required `callerRepoPath` and calls assertCallerOwnsSlug before removing the entry.
- [ ] register_static_project: the `public` input is removed and the new entry has no `public` key (admin-only); `localPath` is replaced by a required absolute `callerRepoPath`, stored as host.localPath with the home dir collapsed to `~`; the tool result says the app is admin-only until the Bilko owner lists it.
- [ ] New pure helper `buildRegistration(projects, input)` in mcp-host-server/src/listing-tool.ts builds and schema-validates the entry (refusing duplicate slugs and a callerRepoPath already bound to another slug); tests in tests/mcp-listing-tool.test.ts cover: entry has no public key; localPath collapsed to ~; duplicate slug refused; repo already bound refused.
- [ ] mcp-host-server/dist/ rebuilt and committed; pnpm test and pnpm typecheck pass.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/server.ts
- mcp-host-server/src/listing-tool.ts
- mcp-host-server/dist/
- tests/mcp-listing-tool.test.ts

# Implementation notes

Depends on mcp-update-project-listing-tool (adds mcp-host-server/src/listing-tool.ts and new tools in server.ts) and uses mcp-host-server/src/ownership.ts `assertCallerOwnsSlug`. Read both landed files first.
Read first: mcp-host-server/src/server.ts — `register_static_project` (~line 181), `unregister_project` (~line 227), `publish_static_project` (~line 274-400, note the `requireRegistered` check ~line 348 and where the registry is read inside withPublishCheckout); `buildStaticEntry` helper.
Steps:
1. Add `buildRegistration` to listing-tool.ts (reuse buildStaticEntry logic by moving it there if it is a plain function; keep server.ts importing it).
2. Wire the three handlers per the AC. Ownership checks must run INSIDE withPublishCheckout against the freshly-synced registry, not a stale read.
3. Update each tool's description string to mention the ownership rule.
4. Grep the repo for `requireRegistered` and `register_static_project` callers in tests/ and scripts/ and fix any that break (do not touch docs/ — a later PRD owns docs).
5. `pnpm --dir mcp-host-server build`.
Do not touch: docs/, mcp-host-server/README.md, src/data/.

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
