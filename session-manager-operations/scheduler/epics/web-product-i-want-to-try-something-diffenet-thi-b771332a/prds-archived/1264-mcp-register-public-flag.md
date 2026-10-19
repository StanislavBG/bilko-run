---
title: bilko-host MCP: register_static_project accepts public and displayName, and says how hub visibility works
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 7
createdVia: scheduler-api
issuedAt: 2026-10-11T07:38:29.250Z
sourcePromptId: web-product-i-want-to-try-something-diffenet-thi-b771332a
agentType: dev-lead
dependsOn: [mcp-register-entry-builder]
planId: pl-mv3ifdyr-cbe8da
---
# Goal

wire: adopt buildStaticEntry (added to mcp-host-server/src/publish-request.ts by PRD mcp-register-entry-builder) in the register_static_project tool, add optional `public` and `displayName` inputs, and correct the tool description, which claims a registered app "shows up on /, /products, and ⌘K" although without public: true it is admin-only on /projects and absent from the home page. Document the two inputs in docs/host-contract.md.

# Acceptance criteria

- [ ] mcp-host-server/src/server.ts register_static_project inputSchema adds `public: z.boolean().optional()`, described as listing the app on the public /projects hub and home page (omit = admin-only).
- [ ] The same inputSchema adds `displayName: z.string().min(1).max(60).optional()`, described as a hub-only display name.
- [ ] The handler builds the entry with buildStaticEntry (no inline entry literal remains) and passes public and displayName through; the duplicate-slug check and withPublishCheckout flow are unchanged.
- [ ] The tool description says the app appears in ⌘K and the admin view of /projects, and on the public /projects hub only with public: true.
- [ ] docs/host-contract.md documents the public and displayName inputs next to the register_static_project step (around line 182), in one or two sentences.
- [ ] mcp-host-server/dist/server.js is rebuilt with `pnpm --dir mcp-host-server build` and committed; tests/mcp-dist-sync.test.ts passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/server.ts
- mcp-host-server/dist/server.js
- docs/host-contract.md

# Implementation notes

The previous PRD (mcp-register-entry-builder) exported buildStaticEntry from mcp-host-server/src/publish-request.ts and rebuilt dist/publish-request.js. Read the landed code first.

Read first:
- mcp-host-server/src/server.ts lines 38-45 (imports) and 180-240 (register_static_project).
- mcp-host-server/src/publish-request.ts (buildStaticEntry signature).
- docs/host-contract.md lines 170-200 (the per-session MCP steps block).

Steps:
1. server.ts: import buildStaticEntry from './publish-request.js' (extend the existing import). Add the two inputs to inputSchema, destructure them in the handler, replace the inline `const entry: RegistryProject = {...}` with `buildStaticEntry({ slug, name, tagline, category, status, year, sourceRepo, localPath, tags, public: isPublic, displayName })` (rename the destructured `public` since it is a reserved word in strict mode), keep everything else as is.
2. Update the tool description text as the criterion states.
3. docs/host-contract.md: after the step list, add one or two sentences: register_static_project takes optional `public` (true lists the app on the public /projects hub and home page; omitted means admin-only) and `displayName` (hub-only name).
4. `pnpm --dir mcp-host-server build`; commit only mcp-host-server/dist/server.js from dist (HALT if other dist files change).
5. Gate last.

Do not touch: mcp-host-server/src/publish-request.ts, dist/publish-request.js, tests/ (the helper's tests already exist), src/data/ (another plan edits the registry JSON).

# Out of scope

- An update/edit tool for existing registry entries
- Re-registering any existing app

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/mcp-dist-sync.test.ts tests/mcp-publish-request.test.ts && timeout 300 pnpm --dir mcp-host-server exec tsc --noEmit
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
