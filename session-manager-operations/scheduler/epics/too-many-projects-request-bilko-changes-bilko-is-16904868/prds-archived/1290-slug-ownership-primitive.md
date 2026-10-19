---
title: bilko-host MCP: `assertCallerOwnsSlug` — bind each slug to its sibling repo
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
createdVia: scheduler-api
issuedAt: 2026-10-13T00:12:34.854Z
sourcePromptId: too-many-projects-request-bilko-changes-bilko-is-16904868
agentType: dev-lead
dependsOn: [listing-patch-primitive]
planId: pl-mv5xdbg3-0eb8c5
---
# Goal

primitive. A sibling session must only be able to change its own project's listing and bytes, never another project's. Add a helper that checks the caller's repo path against the registry entry's `host.localPath`, so the MCP write tools can refuse cross-project edits.

# Acceptance criteria

- [ ] New file mcp-host-server/src/ownership.ts exports `assertCallerOwnsSlug(entry: RegistryProject, callerRepoPath: string | undefined): void`.
- [ ] It throws `slug "<slug>" has no host.localPath — ask the Bilko owner to bind it` when the entry has no localPath, and `callerRepoPath is required to change "<slug>"` when callerRepoPath is missing/empty.
- [ ] It expands a leading `~` to os.homedir(), resolves both paths with fs.realpathSync (falling back to path.resolve when the path does not exist), and throws `"<slug>" is owned by <localPath>; caller is <callerRepoPath>` on mismatch; a trailing slash or a symlink to the same directory is accepted.
- [ ] tests/mcp-ownership.test.ts covers: match via ~ path; match via symlink (temp dir); mismatch throws; missing localPath throws; missing callerRepoPath throws; trailing slash accepted.
- [ ] mcp-host-server/dist/ rebuilt and committed (tests/mcp-dist-sync.test.ts passes).

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- mcp-host-server/src/ownership.ts
- mcp-host-server/dist/
- tests/mcp-ownership.test.ts

# Implementation notes

Chained after listing-patch-primitive only because both rebuild mcp-host-server/dist/; no code dependency.
Read first: mcp-host-server/src/contract/registry.ts (RegistryProject type, host.localPath); tests/mcp-publish-checkout.test.ts lines 1-40 (temp-dir test style).
Steps:
1. Create ownership.ts per the AC (node:fs, node:os, node:path only).
2. tests/mcp-ownership.test.ts with fs.mkdtempSync + fs.symlinkSync for the symlink case.
3. `pnpm --dir mcp-host-server build`.
Do not touch: mcp-host-server/src/server.ts, mcp-host-server/src/listing-patch.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm --dir mcp-host-server build && timeout 300 pnpm vitest run tests/mcp-ownership.test.ts tests/mcp-dist-sync.test.ts && timeout 300 pnpm typecheck
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
