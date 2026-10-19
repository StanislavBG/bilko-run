---
title: Publish gate: verify the listing's icon and shareImage exist and have the right size
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 12
createdVia: scheduler-api
issuedAt: 2026-10-13T03:57:03.786Z
sourcePromptId: projects-mcps-we-set-a-set-of-mcps-for-projects--60fb053a
agentType: dev-lead
dependsOn: [listing-share-image-fields]
planId: pl-mv653d38-529056
---
# Goal

behavior: give sibling agents immediate feedback when they publish. Add a `share-assets` gate to the bilko-host MCP's `publish_static_project` pipeline: if the project's listing (from its bilko.listing.json patch, else the current registry entry) sets `icon` or `shareImage`, the referenced PNG must exist in the staged bundle with the right dimensions, or the publish is blocked with a clear message.

# Acceptance criteria

- [ ] New mcp-host-server/src/gates/share-assets.ts exports `shareAssetsGate: Gate`; with no icon/shareImage it returns `pass` with details 'no share assets declared'.
- [ ] It fails when `shareImage` is missing from the bundle, is not a PNG, is not exactly 1200x630, or exceeds 5 MB; it fails when `icon` is missing, not a PNG, not square, outside 128–1024 px, or exceeds 512 KB; each failure's `details` names the field, the path and the problem.
- [ ] `GateContext` in mcp-host-server/src/gates/index.ts gains optional `listing?: { icon?: string; shareImage?: string }`, the gate is appended to `GATES`, and the publish path in mcp-host-server/src/server.ts fills `listing` from the bilko.listing.json patch if present, else the registry entry, before `runGates`.
- [ ] Asset paths map to the staged bundle by stripping the `/projects/<slug>/` prefix and resolving under `ctx.bundleDir`; a path escaping bundleDir fails the gate.
- [ ] New tests/mcp-share-assets-gate.test.ts covers pass-with-none, pass-with-valid-both, and each failure above, using PNGs generated in-test with @resvg/resvg-js in a temp dir.
- [ ] mcp-host-server/dist/ rebuilt and committed; tests/mcp-dist-sync.test.ts passes.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/gates/share-assets.ts
- mcp-host-server/src/gates/index.ts
- mcp-host-server/src/server.ts
- mcp-host-server/dist/
- tests/mcp-share-assets-gate.test.ts

# Implementation notes

Read first: mcp-host-server/src/gates/index.ts (whole); mcp-host-server/src/gates/budget.ts (a simple gate to mirror); mcp-host-server/src/server.ts lines 340-430 (where runGates is called and where bilko.listing.json is read via readListingFile); the landed ProjectAssetPathSchema in mcp-host-server/src/contract/registry.ts.
Steps:
1. Red: write the test file.
2. Implement the gate with its own tiny PNG IHDR reader (first 24 bytes: signature then width at offset 16, height at 20, big-endian). Do not import from the host's server/ folder — mcp-host-server is a separate package.
3. Wire into GATES and fill ctx.listing in server.ts. If bilko.listing.json is currently read after runGates, read it once earlier and reuse the parsed value (do not parse twice).
4. Rebuild dist and commit.
Do not touch: mcp-host-server/src/contract/registry.ts.

# Out of scope

- Bypassing via the existing bypass set beyond what other gates already support
- Rendering or serving images

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/mcp-share-assets-gate.test.ts tests/mcp-dist-sync.test.ts
timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
