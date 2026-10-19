---
title: One manifest schema: the host re-uses the MCP's schema instead of a hand-synced copy
cwd: /home/bilko/Projects/Bilko
estimateMinutes: 8
sourcePromptId: review-the-project-for-code-quality-perofmance-i-c56527b0
agentType: dev-lead
createdVia: scheduler-api
issuedAt: 2026-10-09T23:10:09.964Z
dependsOn: [registry-public-fields-schema]
disposition: new-head
planId: pl-mv1kvwvg-fc3c17
---
# Goal

migration. shared/manifest-schema.ts and mcp-host-server/src/manifest-schema.ts define the same zod ManifestSchema, kept in sync by hand ('Keep in sync' comment), which will drift. The host already imports from mcp-host-server/src elsewhere (server/db.ts, src/data/projectsRegistry.ts, scripts/sanity-qa-runners/size.ts). Make shared/manifest-schema.ts re-export ManifestSchema and Manifest from the MCP file, keeping its own validateManifestRaw and computeDrift.

# Acceptance criteria

- [ ] shared/manifest-schema.ts no longer defines its own schema object; it re-exports `ManifestSchema` and `type Manifest` from '../mcp-host-server/src/manifest-schema.js' and keeps validateManifestRaw/computeDrift unchanged.
- [ ] The 'Keep in sync' comment in mcp-host-server/src/manifest-schema.ts is replaced with a note that the host imports it (mcp dist unchanged, or rebuilt if the comment change alters dist so tests/mcp-dist-sync.test.ts passes).
- [ ] `pnpm build` (Vite client + server tsc) succeeds and `node dist-server/server/index.js` is not required to run; but `ls dist-server` shows the imported module compiled where shared expects it (report the path).
- [ ] tests/manifest.test.ts, tests/publish-gate.test.ts and tests/mcp-dist-sync.test.ts are green.

# Files

Change only these files. If the work needs another file, change it and say why in your report.

- shared/manifest-schema.ts
- mcp-host-server/src/manifest-schema.ts
- mcp-host-server/dist/manifest-schema.js
- tests/manifest-schema-sync.test.ts

# Implementation notes

Repo: /home/bilko/Projects/Bilko. Read first: shared/manifest-schema.ts; mcp-host-server/src/manifest-schema.ts; tsconfig.server.json (include/rootDir); `git grep -n manifest-schema`. If the server tsc build cannot include the mcp file without changing rootDir, stop and keep both copies but add tests/manifest-schema-sync.test.ts asserting identical parse results on 6 fixtures; say which path you took. Do not touch: mcp-host-server/src/server.ts.

# Out of scope

- (none)

# Gate

Run these commands last, in order. Each must exit 0.

```gate
timeout 300 pnpm vitest run tests/manifest.test.ts tests/publish-gate.test.ts tests/mcp-dist-sync.test.ts
timeout 300 pnpm typecheck
timeout 300 pnpm build
```

## Engineering standards

Your system prompt carries the ordered run contract.
`/home/bilko/.npm/_npx/5346543b21849140/node_modules/claude-code-session-manager/plugins/session-manager-dev/skills/develop/standards.md` holds the reasoning behind each contract line (Performance, Debugging,
API reuse, TDD, Execution discipline) — read the section a line points at when it is unclear;
do not re-read the whole file every run.
